"use client";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { readEntries, readChildren, MEDIA_BUCKET } from "@/lib/records";
import { Status } from "./auth-ui";

export function DataAccount({
  email,
  userId,
  childNames,
}: {
  email: string;
  userId: string;
  childNames: string[];
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function exportData() {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("기록과 첨부 원본을 모으고 있습니다.");
    try {
      const c = createClient();
      const [entries, children] = await Promise.all([
        readEntries(c, userId),
        readChildren(c, userId),
      ]);
      const { zipSync, strToU8 } = await import("fflate");
      const files: Record<string, Uint8Array> = {};
      const manifest: {
        attachment_id: string;
        file: string;
        storage_path: string;
      }[] = [];
      for (const entry of entries)
        for (const attachment of entry.attachments) {
          const { data, error } = await c.storage
            .from(MEDIA_BUCKET)
            .download(attachment.storage_path);
          if (error || !data)
            throw new Error(
              "첨부 원본을 내려받지 못해 내보내기를 중단했습니다. 다시 시도해 주세요.",
            );
          const extension =
            attachment.storage_path
              .split(".")
              .pop()
              ?.replace(/[^a-zA-Z0-9]/g, "") || "bin";
          const path = `attachments/${attachment.id}.${extension}`;
          files[path] = new Uint8Array(await data.arrayBuffer());
          manifest.push({
            attachment_id: attachment.id,
            file: path,
            storage_path: attachment.storage_path,
          });
        }
      files["records.json"] = strToU8(
        JSON.stringify(
          {
            version: 1,
            exported_at: new Date().toISOString(),
            children,
            entries,
            media: manifest,
          },
          null,
          2,
        ),
      );
      files["README.txt"] = strToU8(
        "PASS ON 원본 내보내기\nrecords.json에 삭제 표시를 포함한 모든 기록과 관계가 있습니다.\nattachments/에는 사진과 음성 원본이 있습니다.\n이 파일에는 개인 기록이 포함되어 있습니다. 안전한 곳에 보관해 주세요.\n",
      );
      const bytes = zipSync(files, { level: 0 });
      const blob = new Blob([new Uint8Array(bytes)], {
        type: "application/zip",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `PASS_ON_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setMessage(
        `기록 ${entries.length}개와 첨부 ${manifest.length}개의 다운로드를 시작했습니다. 다운로드 폴더에서 파일을 확인해 주세요.`,
      );
    } catch (e) {
      setMessage("");
      setError(
        e instanceof Error
          ? e.message
          : "내보내지 못했습니다. 다시 시도해 주세요.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const { error } = await createClient().auth.signOut({ scope: "local" });
      if (error) throw error;
      location.assign("/login");
    } catch {
      setError("로그아웃을 확인하지 못했습니다.");
      setBusy(false);
    }
  }
  return (
    <section>
      <div className="list-head">
        <h1>내 데이터</h1>
        <p>기록은 당신의 것입니다.</p>
      </div>
      <div className="card">
        <h2>계정</h2>
        <p className="break">{email}</p>
        <p className="hint">{childNames.join(", ")}에게 남기고 있습니다.</p>
      </div>
      <div className="card">
        <h2>보안</h2>
        <Link className="data-button" href="/data/security">
          비밀번호 변경 <span aria-hidden="true">→</span>
        </Link>
        <Link className="text-link" href="/forgot-password">
          이메일로 계정 복구
        </Link>
      </div>
      <div className="card">
        <h2>기록 가져가기</h2>
        <p className="hint">
          글·사진·목소리·링크와 덧붙인 생각을 원본으로 내려받습니다. 삭제 표시된
          기록도 포함됩니다.
        </p>
        <button className="data-button" disabled={busy} onClick={exportData}>
          {busy ? "처리 중..." : "내 기록과 첨부 원본 내보내기"}
        </button>
      </div>
      <Status error={error} message={message} />
      <button className="text-link logout" disabled={busy} onClick={logout}>
        이 브라우저에서 로그아웃
      </button>
    </section>
  );
}

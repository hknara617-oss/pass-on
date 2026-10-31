"use client";
import { useState } from "react";
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
    if (busy || !confirm("이 기기 연결만 해제합니다. 기록은 삭제되지 않습니다. 다시 연결하려면 개인 연결 링크가 필요합니다. 계속할까요?")) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/device", { method: "DELETE", credentials: "same-origin" });
      if (!response.ok) throw new Error("disconnect");
      location.assign("/device?disconnected=1");
    } catch {
      setError("기기 연결 해제를 확인하지 못했습니다.");
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
        <h2>나만의 기기</h2>
        <p className="hint">개인 연결을 마친 기기에서만 열립니다. 기기 잠금과 Face ID를 사용해 주세요. 웹사이트 데이터를 지우면 다시 연결해야 합니다.</p>
        <p className="hint">계정과 클라우드 기록은 그대로 유지합니다. 이 기기의 연결을 해제해도 기록은 삭제되지 않습니다.</p>
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
        이 기기 연결 해제
      </button>
    </section>
  );
}

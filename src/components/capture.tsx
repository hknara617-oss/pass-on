"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  CaptureFailure,
  persistCapture,
  type CaptureDraft,
  type CaptureMedia,
} from "@/lib/records";
import type { Child } from "@/lib/types";
import { Status } from "./auth-ui";

export function Capture({
  children: initialChildren,
  userId,
}: {
  children: Child[];
  userId: string;
}) {
  const [children, setChildren] = useState(initialChildren),
    [childId, setChildId] = useState(initialChildren[0]?.id || "");
  const [childName, setChildName] = useState(""),
    [text, setText] = useState(""),
    [url, setUrl] = useState(""),
    [quote, setQuote] = useState("");
  const [showLink, setShowLink] = useState(false),
    [media, setMedia] = useState<CaptureMedia[]>([]);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false),
    [recording, setRecording] = useState(false),
    [partial, setPartial] = useState(false);
  const draft = useRef<CaptureDraft | null>(null),
    recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    photoInput = useRef<HTMLInputElement>(null),
    audioInput = useRef<HTMLInputElement>(null);
  const dirty = !!text || !!url || !!quote || media.length > 0 || recording;
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(
    () => () => {
      if (recorder.current && recorder.current.state !== "inactive")
        recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );
  async function addChild(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !childName.trim()) return;
    setBusy(true);
    setError("");
    try {
      const { data, error } = await createClient()
        .from("children")
        .insert({ user_id: userId, name: childName.trim() })
        .select()
        .single();
      if (error) throw error;
      setChildren([data]);
      setChildId(data.id);
    } catch {
      setError("아이 이름을 저장하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }
  function addFile(
    file: File | Blob,
    type: "photo" | "audio",
    duration: number | null = null,
  ) {
    if (file.size > 25 * 1024 * 1024) {
      setError("첨부 하나의 크기는 25MB 이내로 선택해 주세요.");
      return;
    }
    if (!file.type.startsWith(type === "photo" ? "image/" : "audio/")) {
      setError("지원하는 사진 또는 음성 파일을 선택해 주세요.");
      return;
    }
    const subtype = file.type.split("/")[1]?.split(";")[0] || "bin";
    const extension =
      ({ jpeg: "jpg", mp4: "m4a", mpeg: "mp3" } as Record<string, string>)[
        subtype
      ] || subtype.replace(/[^a-z0-9]/gi, "");
    setMedia((previous) => [
      ...previous,
      {
        id: crypto.randomUUID(),
        type,
        file,
        mime: file.type,
        extension,
        duration,
      },
    ]);
    setSaved(false);
  }
  async function voice() {
    if (recording) {
      recorder.current?.stop();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      audioInput.current?.click();
      return;
    }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const supported = [
        "audio/mp4",
        "audio/webm;codecs=opus",
        "audio/webm",
      ].find((t) => MediaRecorder.isTypeSupported(t));
      const r = new MediaRecorder(
        stream.current,
        supported ? { mimeType: supported } : undefined,
      );
      recorder.current = r;
      const chunks: BlobPart[] = [];
      const started = Date.now();
      r.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      r.onstop = () => {
        stream.current?.getTracks().forEach((t) => t.stop());
        setRecording(false);
        addFile(
          new Blob(chunks, { type: r.mimeType }),
          "audio",
          Math.round((Date.now() - started) / 1000),
        );
      };
      r.start();
      setRecording(true);
      setError("");
    } catch {
      stream.current?.getTracks().forEach((t) => t.stop());
      setError(
        "마이크를 열지 못했습니다. 음성 파일 첨부를 이용할 수 있습니다.",
      );
    }
  }
  async function save() {
    if (busy || recording) return;
    setBusy(true);
    setError("");
    setSaved(false);
    if (!draft.current)
      draft.current = {
        id: crypto.randomUUID(),
        linkId: crypto.randomUUID(),
        childId,
        text,
        url,
        quote,
        createdAt: new Date().toISOString(),
      };
    try {
      await persistCapture(createClient(), userId, draft.current, media);
      draft.current = null;
      setText("");
      setUrl("");
      setQuote("");
      setMedia([]);
      setShowLink(false);
      setPartial(false);
      setSaved(true);
    } catch (e) {
      setPartial(e instanceof CaptureFailure);
      setError(e instanceof Error ? e.message : "저장하지 못했습니다.");
      if (!(e instanceof CaptureFailure)) draft.current = null;
    } finally {
      setBusy(false);
    }
  }
  if (!children.length)
    return (
      <section className="capture-wrap">
        <h1>누구에게 남길까요?</h1>
        <form onSubmit={addChild}>
          <label htmlFor="child-name">아이 이름</label>
          <input
            id="child-name"
            required
            maxLength={50}
            value={childName}
            onChange={(e) => setChildName(e.target.value)}
          />
          <button className="primary" disabled={busy}>
            시작하기
          </button>
          <Status error={error} />
        </form>
      </section>
    );
  return (
    <section className="capture-wrap">
      <h1 className="sr-only">남기기</h1>
      <div className="recipient">
        <label className="sr-only" htmlFor="recipient">
          받는 아이
        </label>
        <select
          id="recipient"
          className="recipient-chip"
          value={childId}
          disabled={busy || partial}
          onChange={(e) => setChildId(e.target.value)}
        >
          {children.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}에게
            </option>
          ))}
        </select>
      </div>
      <p className="capture-lead">이건 내 아이에게 남기고 싶다.</p>
      <label className="sr-only" htmlFor="capture-text">
        남기고 싶은 말
      </label>
      <textarea
        id="capture-text"
        className="capture-text"
        placeholder="지금, 남기고 싶은 것은..."
        value={text}
        maxLength={100000}
        disabled={busy || partial}
        onChange={(e) => {
          setText(e.target.value);
          setSaved(false);
        }}
      />
      <div className="attach-row">
        <button
          className="secondary"
          disabled={busy || partial || recording}
          onClick={() => photoInput.current?.click()}
        >
          사진
        </button>
        <button
          className={`secondary ${recording ? "recording" : ""}`}
          disabled={busy || partial}
          onClick={voice}
        >
          {recording ? "녹음 마치기" : "목소리"}
        </button>
        <button
          className="secondary"
          disabled={busy || partial}
          onClick={() => setShowLink(true)}
        >
          링크
        </button>
        <button
          className="text-link"
          disabled={busy || partial || recording}
          onClick={() => audioInput.current?.click()}
        >
          음성 파일
        </button>
      </div>
      <input
        ref={photoInput}
        className="sr-only"
        type="file"
        accept="image/*"
        aria-label="사진 첨부"
        multiple
        onChange={(e) => {
          Array.from(e.target.files || []).forEach((f) => addFile(f, "photo"));
          e.target.value = "";
        }}
      />
      <input
        ref={audioInput}
        className="sr-only"
        type="file"
        accept="audio/*"
        aria-label="음성 파일 첨부"
        onChange={(e) => {
          if (e.target.files?.[0]) addFile(e.target.files[0], "audio");
          e.target.value = "";
        }}
      />
      {recording && (
        <p role="status" className="error">
          녹음 중입니다.
        </p>
      )}
      {media.map((m) => (
        <MediaPreview
          key={m.id}
          item={m}
          disabled={busy || partial}
          remove={() => setMedia((old) => old.filter((x) => x.id !== m.id))}
        />
      ))}
      {showLink && (
        <div className="card">
          <label htmlFor="link-url">링크</label>
          <input
            id="link-url"
            type="url"
            placeholder="https://"
            value={url}
            disabled={busy || partial}
            onChange={(e) => setUrl(e.target.value)}
          />
          <label htmlFor="link-note">남기고 싶은 구절이나 이유</label>
          <textarea
            id="link-note"
            value={quote}
            disabled={busy || partial}
            onChange={(e) => setQuote(e.target.value)}
          />
        </div>
      )}
      <div className="capture-foot">
        <button
          className="primary save"
          onClick={save}
          disabled={busy || recording || !dirty}
        >
          {busy
            ? "저장 확인 중..."
            : partial
              ? "같은 기록으로 다시 저장"
              : "남기기"}
        </button>
      </div>
      <Status error={error} message={saved ? "남겼습니다." : undefined} />
      {saved && (
        <Link className="text-link centered" href="/archive">
          내가 남긴 것 보기
        </Link>
      )}
      {partial && (
        <p className="hint">
          다시 저장할 때 같은 기록을 이어서 저장합니다. 완료될 때까지 이 화면을
          유지해 주세요.
        </p>
      )}
    </section>
  );
}
function MediaPreview({
  item,
  remove,
  disabled,
}: {
  item: CaptureMedia;
  remove: () => void;
  disabled: boolean;
}) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const u = URL.createObjectURL(item.file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [item.file]);
  return (
    <div className="card media-preview">
      {item.type === "photo" ? (
        <img src={url || undefined} alt="첨부할 사진" />
      ) : (
        <audio controls src={url || undefined} />
      )}
      <button className="text-link" onClick={remove} disabled={disabled}>
        첨부 빼기
      </button>
    </div>
  );
}

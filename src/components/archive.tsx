"use client";
import { useEffect, useRef, useState } from "react";
import type { Child, Entry, Attachment } from "@/lib/types";
import {
  formatDate,
  MEDIA_BUCKET,
  safeExternalUrl,
  visibleEntries,
} from "@/lib/records";
import { createClient } from "@/lib/supabase/client";
import { Status } from "./auth-ui";

export function Archive({
  entries,
  children,
  revisit = false,
}: {
  entries: Entry[];
  children: Child[];
  revisit?: boolean;
}) {
  const [childId, setChildId] = useState("all"),
    [deleted, setDeleted] = useState(false),
    [selected, setSelected] = useState<Entry | null>(null);
  const filtered = visibleEntries(entries, deleted).filter(
    (e) => childId === "all" || e.child_id === childId,
  );
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (selected && !dialog.current?.open) dialog.current?.showModal();
  }, [selected]);
  return (
    <section>
      <div className="list-head">
        <h1>{revisit ? "그때의 나" : "내가 남긴 것"}</h1>
        <p>
          {revisit
            ? "14일이 지난 기록을, 원할 때 다시 만납니다."
            : `${deleted ? "삭제 표시된 기록" : "아이에게 남긴 기록"} ${filtered.length}개`}
        </p>
      </div>
      <div className="filters">
        <label className="sr-only" htmlFor="child-filter">
          아이별 보기
        </label>
        <select
          id="child-filter"
          value={childId}
          onChange={(e) => setChildId(e.target.value)}
        >
          <option value="all">모든 아이</option>
          {children.map((c) => (
            <option value={c.id} key={c.id}>
              {c.name}에게
            </option>
          ))}
        </select>
        {!revisit && (
          <button className="text-link" onClick={() => setDeleted(!deleted)}>
            {deleted
              ? "남긴 기록 보기"
              : `삭제 표시된 기록 (${entries.filter((e) => e.is_deleted === true).length})`}
          </button>
        )}
      </div>
      {!filtered.length ? (
        <p className="empty">
          {revisit
            ? "아직 14일이 지난 기록이 없습니다."
            : "이곳에서 아이에게 남긴 기록을 만날 수 있어요."}
        </p>
      ) : (
        <div>
          {filtered.map((e) => (
            <button
              className="entry-row"
              onClick={() => setSelected(e)}
              key={e.id}
            >
              <div className="entry-icon" aria-hidden="true">
                {e.attachments.some((a) => a.type === "photo")
                  ? "사진"
                  : e.attachments.some((a) => a.type === "audio")
                    ? "목소리"
                    : e.link_attachments.length
                      ? "링크"
                      : "글"}
              </div>
              <div className="entry-main">
                <div className="entry-top">
                  <time dateTime={e.created_at}>
                    {formatDate(e.created_at)}
                  </time>
                  <span>
                    {children.find((c) => c.id === e.child_id)?.name || "아이"}
                    에게
                  </span>
                </div>
                <div className="entry-text">
                  {e.text ||
                    e.link_attachments[0]?.quote_or_note ||
                    e.link_attachments[0]?.metadata_title ||
                    "그때 남긴 기록"}
                </div>
                {!!e.attachments.length && (
                  <div className="entry-meta">
                    첨부 {e.attachments.length}개
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
      <dialog
        ref={dialog}
        className="entry-dialog"
        onClose={() => setSelected(null)}
      >
        {selected && (
          <>
            <div className="dialog-top">
              <span>
                {children.find((c) => c.id === selected.child_id)?.name ||
                  "아이"}
                에게
              </span>
              <button
                className="text-link"
                onClick={() => dialog.current?.close()}
              >
                닫기
              </button>
            </div>
            <EntryDetail key={selected.id} entry={selected} />
          </>
        )}
      </dialog>
    </section>
  );
}
function EntryDetail({ entry }: { entry: Entry }) {
  const [note, setNote] = useState(""),
    [notes, setNotes] = useState(entry.entry_notes),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !note.trim()) return;
    setBusy(true);
    setError("");
    try {
      const { data, error } = await createClient()
        .from("entry_notes")
        .insert({ entry_id: entry.id, text: note.trim() })
        .select()
        .single();
      if (error) throw error;
      setNotes((previous) => [...previous, data]);
      setNote("");
    } catch {
      setError("덧붙인 생각을 저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <p className="hint">
        {formatDate(entry.created_at)}
        {entry.is_deleted ? " · 삭제 표시된 기록" : ""}
      </p>
      {entry.attachments.map((a) => (
        <StoredMedia key={a.id} attachment={a} />
      ))}
      <div className="detail-text">{entry.text}</div>
      {entry.link_attachments.map((l) => (
        <div className="card" key={l.id}>
          {l.quote_or_note && <p className="detail-text">{l.quote_or_note}</p>}
          {safeExternalUrl(l.url) ? (
            <a
              href={safeExternalUrl(l.url)!}
              target="_blank"
              rel="noopener noreferrer"
              className="text-link"
            >
              {l.metadata_title || l.url}
            </a>
          ) : (
            <span>{l.url}</span>
          )}
        </div>
      ))}
      {notes.length > 0 && <h2>나중에 덧붙인 생각</h2>}
      {notes.map((n) => (
        <div className="card" key={n.id}>
          <time className="hint">{formatDate(n.created_at)}</time>
          <p className="detail-text">{n.text}</p>
        </div>
      ))}
      {entry.entry_revisions.length > 0 && (
        <details>
          <summary>이전 기록 ({entry.entry_revisions.length})</summary>
          {entry.entry_revisions.map((r) => (
            <div className="card" key={r.id}>
              <p className="hint">{formatDate(r.edited_at)}</p>
              <p className="detail-text">{r.original_text}</p>
            </div>
          ))}
        </details>
      )}
      {!entry.is_deleted && (
        <form onSubmit={addNote} className="note-form">
          <label htmlFor="note">지금의 생각 덧붙이기</label>
          <textarea
            id="note"
            maxLength={10000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button className="secondary" disabled={busy || !note.trim()}>
            {busy ? "저장 중..." : "덧붙이기"}
          </button>
          <Status error={error} />
        </form>
      )}
    </>
  );
}
function StoredMedia({ attachment }: { attachment: Attachment }) {
  const [url, setUrl] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    createClient()
      .storage.from(MEDIA_BUCKET)
      .createSignedUrl(attachment.storage_path, 3600)
      .then(({ data, error }) => {
        if (!active) return;
        if (error)
          setError("첨부를 불러오지 못했습니다. 기록을 다시 열어 주세요.");
        else setUrl(data.signedUrl);
      })
      .catch(() => {
        if (active) setError("첨부를 불러오지 못했습니다.");
      });
    return () => {
      active = false;
    };
  }, [attachment.storage_path]);
  return (
    <div className="stored-media">
      {error ? (
        <p role="alert">{error}</p>
      ) : !url ? (
        <p role="status">첨부를 불러오는 중...</p>
      ) : attachment.type === "photo" ? (
        <img
          src={url}
          alt="남긴 사진"
          onError={() => setError("사진을 표시하지 못했습니다.")}
        />
      ) : (
        <audio
          controls
          preload="metadata"
          src={url}
          onError={() => setError("음성을 불러오지 못했습니다.")}
        />
      )}
    </div>
  );
}

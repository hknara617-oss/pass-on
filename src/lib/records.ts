import type { SupabaseClient } from "@supabase/supabase-js";
import type { Child, Entry } from "./types";
export const MEDIA_BUCKET = "pass-on-media";
export const ENTRY_SELECT =
  "*, attachments(*), link_attachments(*), entry_notes(*), entry_revisions(*)";

export async function readChildren(
  client: SupabaseClient,
  userId: string,
): Promise<Child[]> {
  const { data, error } = await client
    .from("children")
    .select("*")
    .eq("user_id", userId)
    .order("created_at");
  if (error) throw error;
  return data || [];
}
export async function readEntries(
  client: SupabaseClient,
  userId: string,
): Promise<Entry[]> {
  const rows: Entry[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client
      .from("entries")
      .select(ENTRY_SELECT)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .order("id")
      .range(offset, offset + 499);
    if (error) throw error;
    rows.push(...((data as Entry[]) || []));
    if (!data || data.length < 500) return rows;
  }
}
export function visibleEntries(entries: Entry[], deleted = false) {
  return entries.filter((e) =>
    deleted ? e.is_deleted === true : e.is_deleted !== true,
  );
}
export function revisitEntries(entries: Entry[], now = Date.now()) {
  return visibleEntries(entries).filter(
    (e) => new Date(e.created_at).getTime() <= now - 14 * 24 * 60 * 60 * 1000,
  );
}
export function safeExternalUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const u = new URL(value);
    return ["https:", "http:"].includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
}
export function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

export type CaptureMedia = {
  id: string;
  type: "photo" | "audio";
  file: Blob;
  mime: string;
  extension: string;
  duration: number | null;
};
export type CaptureDraft = {
  id: string;
  childId: string;
  text: string;
  url: string;
  quote: string;
  linkId: string;
  createdAt: string;
};
export class CaptureFailure extends Error {
  constructor(
    public entryId: string,
    public entryExists: boolean,
  ) {
    super(
      entryExists
        ? "글은 저장되었지만 첨부 저장을 확인하지 못했습니다. 이 화면에서 다시 시도해 주세요."
        : "저장 여부를 확인하지 못했습니다. 이 화면에서 다시 시도해 주세요.",
    );
  }
}
export async function persistCapture(
  client: SupabaseClient,
  userId: string,
  draft: CaptureDraft,
  media: CaptureMedia[],
) {
  if (!draft.childId) throw new Error("받는 아이를 선택해 주세요.");
  const url = draft.url ? safeExternalUrl(draft.url) : null;
  if (draft.url && !url)
    throw new Error("http 또는 https 링크를 입력해 주세요.");
  if (!draft.text.trim() && !media.length && !url && !draft.quote.trim())
    throw new Error("남길 내용을 입력해 주세요.");
  if (media.some((m) => m.file.size > 25 * 1024 * 1024))
    throw new Error("첨부 하나의 크기는 25MB 이내로 선택해 주세요.");
  const children = await readChildren(client, userId);
  if (!children.some((c) => c.id === draft.childId))
    throw new Error("받는 아이를 확인하지 못했습니다.");
  let entryExists = false;
  try {
    const existing = await client
      .from("entries")
      .select("id")
      .eq("id", draft.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (!existing.data) {
      const kinds = [
        draft.text.trim() ? "text" : null,
        ...media.map((m) => (m.type === "audio" ? "voice" : "photo")),
        url || draft.quote.trim() ? "link" : null,
      ].filter(Boolean);
      const source = new Set(kinds).size > 1 ? "mixed" : kinds[0];
      const inserted = await client
        .from("entries")
        .insert({
          id: draft.id,
          user_id: userId,
          child_id: draft.childId,
          text: draft.text.trim() || null,
          capture_source: source,
          created_at: draft.createdAt,
          timezone: "Asia/Seoul",
          is_deleted: false,
        });
      if (inserted.error) throw inserted.error;
    }
    entryExists = true;
    for (const item of media) {
      const existingAttachment = await client
        .from("attachments")
        .select("id")
        .eq("id", item.id)
        .eq("entry_id", draft.id)
        .maybeSingle();
      if (existingAttachment.error) throw existingAttachment.error;
      if (existingAttachment.data) continue;
      const path = `${userId}/${draft.id}/${item.id}.${item.extension}`;
      const uploaded = await client.storage
        .from(MEDIA_BUCKET)
        .upload(path, item.file, { contentType: item.mime, upsert: false });
      // Retrying the same immutable path is safe after an ambiguous network result.
      if (uploaded.error) {
        const previous = await client.storage.from(MEDIA_BUCKET).download(path);
        if (
          previous.error ||
          !previous.data ||
          previous.data.size !== item.file.size
        )
          throw uploaded.error;
        const [a, b] = await Promise.all([
          previous.data.arrayBuffer(),
          item.file.arrayBuffer(),
        ]);
        const [ha, hb] = await Promise.all([
          crypto.subtle.digest("SHA-256", a),
          crypto.subtle.digest("SHA-256", b),
        ]);
        if (new Uint8Array(ha).some((n, i) => n !== new Uint8Array(hb)[i]))
          throw uploaded.error;
      }
      const result = await client
        .from("attachments")
        .insert({
          id: item.id,
          entry_id: draft.id,
          type: item.type,
          storage_path: path,
          mime_type: item.mime,
          duration_seconds: item.duration,
          file_size_bytes: item.file.size,
        });
      if (result.error) throw result.error;
    }
    if (url || draft.quote.trim()) {
      const existingLink = await client
        .from("link_attachments")
        .select("id")
        .eq("id", draft.linkId)
        .eq("entry_id", draft.id)
        .maybeSingle();
      if (existingLink.error) throw existingLink.error;
      if (!existingLink.data) {
        const added = await client
          .from("link_attachments")
          .insert({
            id: draft.linkId,
            entry_id: draft.id,
            url,
            quote_or_note: draft.quote.trim() || null,
          });
        if (added.error) throw added.error;
      }
    }
    const verified = await client
      .from("entries")
      .select(ENTRY_SELECT)
      .eq("id", draft.id)
      .eq("user_id", userId)
      .single();
    if (verified.error) throw verified.error;
    const entry = verified.data as Entry;
    if (
      !media.every((m) => entry.attachments.some((a) => a.id === m.id)) ||
      ((url || draft.quote.trim()) &&
        !entry.link_attachments.some((l) => l.id === draft.linkId))
    )
      throw new Error("Save verification failed");
    return entry;
  } catch {
    throw new CaptureFailure(draft.id, entryExists);
  }
}

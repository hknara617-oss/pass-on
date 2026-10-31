import type { Child, Entry } from "./types";
export function recipientLabel(id: string | null, children: Child[]) {
  if (!id) return "아직 정하지 않음";
  const person = children.find(c => c.id === id);
  return person ? `${person.name}에게` : "받는 사람 미확인";
}
const normalize = (value: string) => value.normalize("NFKC").toLocaleLowerCase("ko-KR").trim();
export function matchesEntry(entry: Entry, query: string, children: Child[]) {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const haystack = normalize([
    entry.text || "", recipientLabel(entry.child_id, children),
    ...entry.link_attachments.flatMap(l => [l.url || "", l.quote_or_note || "", l.metadata_title || ""]),
    ...entry.entry_notes.map(n => n.text),
  ].join(" "));
  return words.every(w => haystack.includes(w));
}
export function monthGroups(entries: Entry[]) {
  const groups = new Map<string, Entry[]>();
  const ordered = [...entries].sort((a,b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id));
  for (const entry of ordered) {
    const label = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", timeZone: "Asia/Seoul" }).format(new Date(entry.created_at));
    groups.set(label, [...(groups.get(label) || []), entry]);
  }
  return [...groups].map(([label, rows]) => ({ label, rows }));
}
export function clock(seconds: number) {
  const value = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return `${String(Math.floor(value / 60)).padStart(2,"0")}:${String(value % 60).padStart(2,"0")}`;
}
export function entryKind(entry: Entry): "photo" | "mic" | "link" | "write" {
  return entry.attachments.some(a=>a.type==="photo") ? "photo" : entry.attachments.some(a=>a.type==="audio") ? "mic" : entry.link_attachments.length ? "link" : "write";
}
export function recordExcerpt(entry: Entry) {
  return entry.text || entry.link_attachments[0]?.quote_or_note || entry.link_attachments[0]?.metadata_title || (entryKind(entry)==="mic" ? "그날의 목소리" : entryKind(entry)==="photo" ? "그날의 한 장면" : "남겨둔 기록");
}

import type { Child, Entry } from "./types";
export type MediaFilter = "all" | "text" | "photo" | "audio" | "link";
export function includesMedia(entry:Entry, filter:MediaFilter) {
  if(filter==="all")return true;
  if(filter==="text")return !!entry.text?.trim();
  if(filter==="link")return entry.link_attachments.length>0;
  return entry.attachments.some(a=>a.type===filter);
}
export function rememberedRecipient(value:string|null, children:Child[]):string {
  if(value==="")return "";
  return value && children.some(c=>c.id===value) ? value : children[0]?.id || "";
}
export function noteUrl(id:string) { return `/archive?entry=${encodeURIComponent(id)}`; }
export function shortDate(value:string) {
  return new Intl.DateTimeFormat("ko-KR",{month:"long",day:"numeric",timeZone:"Asia/Seoul"}).format(new Date(value));
}
export function elapsedDays(value:string,now=Date.now()) {return Math.max(0,Math.floor((now-new Date(value).getTime())/86400000));}

"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Child, Entry, Attachment } from "@/lib/types";
import { assignRecipient, formatDate, MEDIA_BUCKET, safeExternalUrl, visibleEntries } from "@/lib/records";
import { entryKind, matchesEntry, monthGroups, recipientLabel, recordExcerpt } from "@/lib/experience";
import { createClient } from "@/lib/supabase/client";
import { Status } from "./auth-ui";
import { Icon } from "./icons";
export function Archive({entries,children,revisit=false}:{entries:Entry[];children:Child[];revisit?:boolean}) {
  const [rows,setRows]=useState(entries), [childId,setChildId]=useState("all"), [deleted,setDeleted]=useState(false), [query,setQuery]=useState("");
  const [selected,setSelected]=useState<Entry|null>(null), [detailDirty,setDetailDirty]=useState(false), [detailBusy,setDetailBusy]=useState(false);
  const dialog=useRef<HTMLDialogElement>(null), title=useRef<HTMLHeadingElement>(null), opener=useRef<HTMLButtonElement|null>(null);
  useEffect(()=>{setRows(entries);},[entries]);
  useEffect(()=>{if(selected&&!dialog.current?.open){dialog.current?.showModal();title.current?.focus();}},[selected]);
  const filtered=visibleEntries(rows,deleted).filter(e=>(childId==="all"||(childId==="unassigned"?!e.child_id:e.child_id===childId))&&matchesEntry(e,query,children));
  const grouped=monthGroups(filtered), scoped=!!query.trim()||childId!=="all";
  function close(){if(detailBusy)return;if(detailDirty&&!confirm("아직 저장하지 않은 생각이 있어요. 닫을까요?"))return;dialog.current?.close();}
  function update(entry:Entry){setRows(old=>old.map(e=>e.id===entry.id?entry:e));setSelected(entry);}
  return <section>
    <div className="quiet-list-head"><p className="eyebrow">{revisit?"THEN & NOW":"KEPT, NOT FORGOTTEN"}</p><h1>{revisit?"그때의 나":"내가 남긴 것"}</h1><p>{revisit?"14일이 지난 기록을, 읽고 싶은 날에.":"지나간 순간이, 여기 남아 있어요."}</p></div>
    <label className="search-box"><Icon name="search"/><span className="sr-only">기록 속 단어 찾기</span><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="기록 속 단어 찾기" maxLength={200}/>{query&&<button className="icon-button" type="button" aria-label="검색어 지우기" onClick={()=>setQuery("")}><Icon name="close" size={18}/></button>}</label>
    <div className="archive-controls"><label className="sr-only" htmlFor="child-filter">받는 사람별 보기</label><select id="child-filter" value={childId} onChange={e=>setChildId(e.target.value)}><option value="all">모든 기록</option><option value="unassigned">받는 사람 미지정</option>{children.map(c=><option key={c.id} value={c.id}>{c.name}에게</option>)}</select><p role="status" aria-live="polite">{deleted?"삭제 표시 · ":""}{filtered.length}개의 기록</p></div>
    {!filtered.length?<div className="quiet-empty"><Icon name={revisit?"time":"archive"} size={28}/><h2>{scoped?"찾는 기록이 보이지 않아요":deleted?"삭제 표시된 기록이 없어요":revisit?"조금 지난 나를 만나는 곳":"첫 순간을 남겨볼까요?"}</h2><p>{scoped?"다른 단어로 찾거나, 받는 사람을 바꿔보세요.":deleted?"원래 보관함으로 돌아가면 기록을 볼 수 있어요.":revisit?"기록을 남긴 지 14일이 지나면 여기에 보여요. 지금은 오늘을 남겨두세요.":"한 문장, 사진 한 장, 짧은 목소리면 충분해요."}</p>{scoped?<button className="text-link" onClick={()=>{setQuery("");setChildId("all");}}>검색 조건 지우기</button>:deleted?<button className="text-link" onClick={()=>setDeleted(false)}>남긴 기록으로 돌아가기</button>:<Link href="/capture" className="text-link">지금 남기기 <Icon name="arrow" size={16}/></Link>}</div>:grouped.map(group=><section key={group.label} aria-label={group.label}><h2 className="month-heading">{group.label}</h2>{group.rows.map(e=><button className="quiet-entry entry-row" key={e.id} onClick={event=>{opener.current=event.currentTarget;setDetailDirty(false);setDetailBusy(false);setSelected(e);}}><span className="entry-icon"><Icon name={entryKind(e)} size={19}/></span><span className="entry-main"><span className="entry-top"><time dateTime={e.created_at}>{formatDate(e.created_at)}</time><span>{recipientLabel(e.child_id,children)}</span></span><span className="entry-text">{recordExcerpt(e)}</span>{(e.attachments.length>0||e.entry_notes.length>0)&&<span className="entry-meta">{e.attachments.length>0?`첨부 ${e.attachments.length}개`:""}{e.attachments.length>0&&e.entry_notes.length>0?" · ":""}{e.entry_notes.length>0?`덧붙인 생각 ${e.entry_notes.length}개`:""}</span>}</span></button>)}</section>)}
    {!revisit&&<details className="archive-options"><summary>보관함 옵션</summary><button className="text-link" onClick={()=>{setDeleted(v=>!v);setQuery("");}}>{deleted?"남긴 기록 보기":`삭제 표시된 기록 보기 (${rows.filter(e=>e.is_deleted===true).length})`}</button><p className="hint">삭제 표시된 기록도 원본과 함께 보관하며, 내보내기에 포함됩니다.</p></details>}
    <dialog ref={dialog} className="entry-dialog" aria-labelledby="record-title" onCancel={e=>{e.preventDefault();close();}} onClose={()=>{setSelected(null);setDetailDirty(false);setDetailBusy(false);opener.current?.focus();}}>
      {selected&&<><div className="dialog-top"><span>{recipientLabel(selected.child_id,children)}</span><button className="icon-button" aria-label="기록 닫기" disabled={detailBusy} onClick={close}><Icon name="close"/></button></div><div className="dialog-body"><p className="eyebrow">{formatDate(selected.created_at)}</p><h2 id="record-title" ref={title} tabIndex={-1}>그날 남겨둔 나</h2><EntryDetail key={selected.id} entry={selected} children={children} onUpdate={update} onDirty={setDetailDirty} onBusy={setDetailBusy}/></div></>}
    </dialog>
  </section>;
}
function EntryDetail({entry,children,onUpdate,onDirty,onBusy}:{entry:Entry;children:Child[];onUpdate:(e:Entry)=>void;onDirty:(dirty:boolean)=>void;onBusy:(busy:boolean)=>void}){
  const [note,setNote]=useState(""),[busy,setBusy]=useState(false),[pending,setPending]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
  const [recipient,setRecipient]=useState(entry.child_id||"");
  const lock=useRef(false),noteId=useRef<string|null>(null);
  useEffect(()=>{onDirty(!!note.trim()||recipient!==(entry.child_id||""));},[note,recipient,entry.child_id,onDirty]);
  function loading(value:boolean){lock.current=value;setBusy(value);onBusy(value);}
  async function addNote(e:React.FormEvent){
    e.preventDefault();if(lock.current||!note.trim())return;loading(true);setPending(true);setError("");setMessage("");
    if(!noteId.current)noteId.current=crypto.randomUUID();
    try{
      const client=createClient();
      const existing=await client.from("entry_notes").select("*").eq("id",noteId.current).eq("entry_id",entry.id).maybeSingle();
      if(existing.error)throw existing.error;
      let added=existing.data;
      if(!added){const result=await client.from("entry_notes").insert({id:noteId.current,entry_id:entry.id,text:note.trim()}).select().single();if(result.error)throw result.error;added=result.data;}
      if(!added||added.text!==note.trim())throw new Error("note verification");
      onUpdate({...entry,entry_notes:[...entry.entry_notes.filter(n=>n.id!==added.id),added]});setNote("");noteId.current=null;setPending(false);setMessage("지금의 생각을 덧붙였어요. 그날의 원문은 그대로예요.");
    }catch{setError("저장을 확인하지 못했어요. 내용을 유지한 채 ‘덧붙이기’를 다시 눌러 주세요.");}
    finally{loading(false);}
  }
  async function saveRecipient(){
    if(lock.current||recipient===(entry.child_id||""))return;loading(true);setError("");setMessage("");
    try{await assignRecipient(createClient(),entry.user_id,entry.id,recipient||null);onUpdate({...entry,child_id:recipient||null});setMessage("받는 사람을 기록했어요. 실제로 전송하지는 않았어요.");}catch(e){setError(e instanceof Error?e.message:"받는 사람을 저장하지 못했습니다.");}finally{loading(false);}
  }
  return <><span className="original-label"><Icon name="shield" size={13}/>원문 보관</span>{entry.is_deleted&&<p className="hint">삭제 표시된 기록입니다.</p>}{entry.text&&<div className="detail-text">{entry.text}</div>}{entry.attachments.map(a=><StoredMedia key={a.id} attachment={a}/>)}{entry.link_attachments.map(l=><div className="card" key={l.id}>{l.quote_or_note&&<p className="detail-text">{l.quote_or_note}</p>}{safeExternalUrl(l.url)?<a href={safeExternalUrl(l.url)!} target="_blank" rel="noopener noreferrer" className="text-link">{l.metadata_title||l.url}<Icon name="arrow" size={15}/></a>:<span>{l.url}</span>}</div>)}
    {entry.entry_notes.length>0&&<h3 className="month-heading">나중에 덧붙인 생각</h3>}{entry.entry_notes.map(n=><div className="card" key={n.id}><time className="hint" dateTime={n.created_at}>{formatDate(n.created_at)}</time><p className="detail-text">{n.text}</p></div>)}
    {entry.entry_revisions.length>0&&<details><summary>보존된 이전 원문 ({entry.entry_revisions.length})</summary>{entry.entry_revisions.map(r=><div className="card" key={r.id}><p className="hint">{formatDate(r.edited_at)}</p><p className="detail-text">{r.original_text}</p></div>)}</details>}
    {!entry.is_deleted&&<><form onSubmit={addNote} className="note-form"><label htmlFor="note">지금의 생각 덧붙이기</label><p className="hint">그날의 말은 고치지 않고, 오늘의 나를 더해요.</p><textarea id="note" maxLength={10000} value={note} disabled={busy||pending} onChange={e=>{setNote(e.target.value);setMessage("");}} placeholder="다시 보니, 지금은 이런 생각이 들어요."/><button className="secondary" disabled={busy||!note.trim()}>{busy?"저장 확인 중…":pending?"덧붙이기 다시 시도":"덧붙이기"}</button></form><details className="recipient-editor"><summary>받는 사람 정하기 · 자동 전달 없음</summary><label htmlFor="record-recipient">이 기록을 누구에게 남길까요?</label><select id="record-recipient" value={recipient} disabled={busy} onChange={e=>setRecipient(e.target.value)}><option value="">나중에 정하기</option>{children.map(c=><option key={c.id} value={c.id}>{c.name}에게</option>)}</select><button className="text-link" disabled={busy||recipient===(entry.child_id||"")} onClick={()=>void saveRecipient()}>받는 사람 저장</button><p className="hint">이름을 지정해도 기록은 나만 볼 수 있어요.</p></details></>}
    <Status error={error} message={message}/>
  </>;
}
function StoredMedia({attachment}:{attachment:Attachment}){
  const [url,setUrl]=useState(""),[error,setError]=useState(""),[retry,setRetry]=useState(0);
  useEffect(()=>{let active=true;setError("");setUrl("");createClient().storage.from(MEDIA_BUCKET).createSignedUrl(attachment.storage_path,3600).then(({data,error})=>{if(!active)return;if(error||!data)setError("첨부를 불러오지 못했어요.");else setUrl(data.signedUrl);}).catch(()=>{if(active)setError("첨부를 불러오지 못했어요.");});return()=>{active=false;};},[attachment.storage_path,retry]);
  return <div className="stored-media">{error?<><p role="alert">{error}</p><button className="secondary" onClick={()=>setRetry(v=>v+1)}>첨부 다시 불러오기</button></>:!url?<p role="status" className="hint">원본을 불러오고 있어요…</p>:attachment.type==="photo"?<img src={url} alt="그날 남긴 사진" onError={()=>setError("사진을 표시하지 못했어요.")}/>:<audio controls preload="metadata" src={url} onError={()=>setError("음성을 불러오지 못했어요.")}/>}</div>;
}

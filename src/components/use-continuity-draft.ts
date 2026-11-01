"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {DraftConflict,hasDraft,listDrafts,readDraft,removeDraft,writeDraft,type DraftContents,type DraftSummary} from "@/lib/draft-vault";
import {safeExternalUrl,type CaptureDraft} from "@/lib/records";
export function useContinuityDraft(owner:string,value:DraftContents,restore:(value:DraftContents)=>void){
  const [ready,setReady]=useState(false),[status,setStatus]=useState<"idle"|"saving"|"saved"|"error"|"conflict">("idle"),[error,setError]=useState("");
  const [saved,setSaved]=useState<DraftSummary[]>([]),[recovering,setRecovering]=useState(false),[recovered,setRecovered]=useState(false);
  const live=useRef(value),apply=useRef(restore),slot=useRef({id:"",revision:null as number|null}),chain=useRef<Promise<void>>(Promise.resolve());
  const alive=useRef(false),generation=useRef(0),halt=useRef(false),last=useRef<DraftContents|null>(null),initialized=useRef(false);
  live.current=value;apply.current=restore;
  const refresh=useCallback(async()=>{try{const rows=await listDrafts(owner);if(alive.current)setSaved(rows.filter(r=>r.id!==slot.current.id));}catch(e){if(alive.current){setError(e instanceof Error?e.message:"기기 임시 보관을 읽지 못했어요.");setStatus("error");}}},[owner]);
  const enqueue=useCallback((contents:DraftContents)=>{
    if(halt.current||!slot.current.id)return chain.current;
    const serial=++generation.current,selected=slot.current;
    if(alive.current)setStatus(hasDraft(contents)?"saving":"idle");
    const task=chain.current.catch(()=>{}).then(async()=>{
      if(halt.current||selected!==slot.current)return;
      try{
        if(hasDraft(contents))selected.revision=await writeDraft(owner,selected.id,selected.revision,contents);
        else if(selected.revision!==null){await removeDraft(owner,selected.id,selected.revision);selected.revision=null;}
        last.current=contents;if(alive.current&&serial===generation.current){setStatus(hasDraft(contents)?"saved":"idle");setError("");}
      }catch(e){if(e instanceof DraftConflict)halt.current=true;if(alive.current){setStatus(e instanceof DraftConflict?"conflict":"error");setError(e instanceof Error?e.message:"기기 임시 보관을 확인하지 못했어요.");}}
    });chain.current=task;return task;
  },[owner]);
  useEffect(()=>{alive.current=true;if(!initialized.current){initialized.current=true;slot.current={id:crypto.randomUUID(),revision:null};void refresh().finally(()=>{if(alive.current)setReady(true);});}return()=>{alive.current=false;};},[refresh]);
  useEffect(()=>{if(!ready||recovering)return;if(last.current===value)return;void enqueue(value);},[ready,recovering,value.text,value.url,value.quote,value.childId,value.media,value.attempt,enqueue]);
  useEffect(()=>{const flush=()=>{if(document.visibilityState==="hidden"&&ready&&!recovering)void enqueue(live.current);};document.addEventListener("visibilitychange",flush);return()=>document.removeEventListener("visibilitychange",flush);},[ready,recovering,enqueue]);
  async function resume(id:string){
    if(recovering)return;setRecovering(true);await chain.current;
    try{const old=await readDraft(owner,id);slot.current={id:old.id,revision:old.revision};halt.current=false;last.current=old.contents;apply.current(old.contents);setRecovered(true);setStatus("saved");setError("");await refresh();}catch(e){setError(e instanceof Error?e.message:"초안을 복구하지 못했어요.");}finally{setRecovering(false);}
  }
  async function freeze(attempt:CaptureDraft){if(attempt.url&&!safeExternalUrl(attempt.url))throw new Error("http 또는 https 링크를 입력해 주세요.");const c={...live.current,attempt};live.current=c;await enqueue(c);if(halt.current)throw new DraftConflict();}
  async function complete(){
    await chain.current;const old=slot.current;halt.current=true;
    try{if(old.revision!==null)await removeDraft(owner,old.id,old.revision);}catch{if(alive.current)setError("서버 저장은 완료했지만 기기 초안 정리를 확인하지 못했어요. 다시 열면 같은 기록으로 확인합니다.");}
    slot.current={id:crypto.randomUUID(),revision:null};generation.current++;last.current=null;halt.current=false;if(alive.current){setStatus("idle");setRecovered(false);}void refresh();
  }
  async function newDraft(){await chain.current;slot.current={id:crypto.randomUUID(),revision:null};halt.current=false;last.current=null;setRecovered(false);setStatus("idle");setError("");await refresh();}
  async function discard(item:DraftSummary){await removeDraft(owner,item.id,item.revision);await refresh();}
  return {ready,status,error,saved,recovering,recovered,resume,freeze,complete,newDraft,discard,refresh,flush:()=>enqueue(live.current),safe:status==="saved"&&!recovering&&!!last.current&&last.current.text===value.text&&last.current.url===value.url&&last.current.quote===value.quote&&last.current.childId===value.childId&&last.current.media===value.media&&last.current.attempt===value.attempt};
}

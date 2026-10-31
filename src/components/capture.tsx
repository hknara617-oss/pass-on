"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { CaptureFailure, persistCapture, type CaptureDraft, type CaptureMedia } from "@/lib/records";
import { clock } from "@/lib/experience";
import type { Child } from "@/lib/types";
import { Status } from "./auth-ui";
import { Icon } from "./icons";
import { useUnsavedWarning } from "./use-unsaved-warning";
export function Capture({children: initialChildren, userId}:{children:Child[];userId:string}) {
  const [children,setChildren]=useState(initialChildren), [childId,setChildId]=useState(initialChildren[0]?.id || "");
  const [childName,setChildName]=useState(""), [addPerson,setAddPerson]=useState(false);
  const [text,setText]=useState(""), [url,setUrl]=useState(""), [quote,setQuote]=useState("");
  const [showLink,setShowLink]=useState(false), [media,setMedia]=useState<CaptureMedia[]>([]);
  const [busy,setBusy]=useState(false), [error,setError]=useState(""), [saved,setSaved]=useState(false), [partial,setPartial]=useState(false);
  const [recording,setRecording]=useState(false), [micPending,setMicPending]=useState(false), [elapsed,setElapsed]=useState(0), [offline,setOffline]=useState(false);
  const lock=useRef(false), mounted=useRef(true), started=useRef(0);
  const draft=useRef<CaptureDraft|null>(null), recorder=useRef<MediaRecorder|null>(null), stream=useRef<MediaStream|null>(null);
  const photoInput=useRef<HTMLInputElement>(null), audioInput=useRef<HTMLInputElement>(null), textarea=useRef<HTMLTextAreaElement>(null);
  const dirty=!!text || !!url || !!quote || media.length>0 || recording || partial;
  const hasContent=!!text.trim() || !!url.trim() || !!quote.trim() || media.length>0;
  const disabled=busy || partial;
  useUnsavedWarning(dirty);
  useEffect(()=>{
    const update=()=>setOffline(!navigator.onLine); update();
    window.addEventListener("online",update); window.addEventListener("offline",update);
    return ()=>{window.removeEventListener("online",update);window.removeEventListener("offline",update);};
  },[]);
  useEffect(()=>{
    if(textarea.current){textarea.current.style.height="auto";textarea.current.style.height=`${Math.min(430,Math.max(190,textarea.current.scrollHeight))}px`;}
  },[text]);
  useEffect(()=>{
    mounted.current=true;
    return ()=>{mounted.current=false;if(recorder.current && recorder.current.state!=="inactive"){recorder.current.onstop=null;recorder.current.stop();}stream.current?.getTracks().forEach(t=>t.stop());};
  },[]);
  useEffect(()=>{
    if(!recording)return;
    const id=setInterval(()=>{const seconds=Math.floor((Date.now()-started.current)/1000);setElapsed(seconds);if(seconds>=300 && recorder.current?.state==="recording")recorder.current.stop();},250);
    return ()=>clearInterval(id);
  },[recording]);
  async function addChild(e:React.FormEvent){
    e.preventDefault();if(lock.current || !childName.trim())return;lock.current=true;setBusy(true);setError("");
    try{const {data,error}=await createClient().from("children").insert({user_id:userId,name:childName.trim()}).select().single();if(error)throw error;setChildren(old=>[...old,data]);setChildId(data.id);setChildName("");setAddPerson(false);}catch{setError("이름을 저장하지 못했습니다. 작성 중인 내용은 그대로예요.");}finally{lock.current=false;setBusy(false);}
  }
  function addFile(file:File|Blob,type:"photo"|"audio",duration:number|null=null){
    if(!file.size){setError("빈 파일은 남길 수 없어요. 다른 파일을 선택해 주세요.");return;}
    if(file.size>25*1024*1024){setError("파일 하나는 25MB까지 첨부할 수 있어요.");return;}
    if(!file.type.startsWith(type==="photo"?"image/":"audio/")){setError("사진 또는 음성 파일을 선택해 주세요.");return;}
    const subtype=file.type.split("/")[1]?.split(";")[0]||"bin";
    const extension=({jpeg:"jpg",mp4:"m4a",mpeg:"mp3"} as Record<string,string>)[subtype]||subtype.replace(/[^a-z0-9]/gi,"");
    setMedia(old=>[...old,{id:crypto.randomUUID(),type,file,mime:file.type,extension,duration}]);setSaved(false);setError("");
  }
  async function voice(){
    if(recording){if(recorder.current?.state==="recording")recorder.current.stop();return;}
    if(micPending||disabled)return;
    if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){audioInput.current?.click();return;}
    setMicPending(true);setError("");
    try{
      const mic=await navigator.mediaDevices.getUserMedia({audio:true});
      if(!mounted.current){mic.getTracks().forEach(t=>t.stop());return;}
      stream.current=mic;
      const supported=["audio/mp4","audio/webm;codecs=opus","audio/webm"].find(t=>MediaRecorder.isTypeSupported(t));
      const r=new MediaRecorder(mic,supported?{mimeType:supported}:undefined);recorder.current=r;
      const chunks:BlobPart[]=[];let size=0;started.current=Date.now();setElapsed(0);
      r.ondataavailable=e=>{if(e.data.size){chunks.push(e.data);size+=e.data.size;if(size>=24*1024*1024&&r.state==="recording")r.stop();}};
      r.onerror=()=>{mic.getTracks().forEach(t=>t.stop());setRecording(false);setError("녹음을 마치지 못했어요. 음성 파일로도 첨부할 수 있습니다.");};
      r.onstop=()=>{mic.getTracks().forEach(t=>t.stop());if(!mounted.current)return;setRecording(false);addFile(new Blob(chunks,{type:r.mimeType}),"audio",Math.round((Date.now()-started.current)/1000));};
      r.start(1000);setRecording(true);setSaved(false);
    }catch{stream.current?.getTracks().forEach(t=>t.stop());setError("마이크 권한을 확인해 주세요. ‘음성 파일’로 첨부해도 괜찮아요.");}
    finally{if(mounted.current)setMicPending(false);}
  }
  async function save(){
    if(lock.current||recording||micPending||!hasContent)return;
    if(offline){setError("인터넷 연결 후 다시 남겨 주세요. 아직 서버에 저장되지 않았어요.");return;}
    lock.current=true;setBusy(true);setError("");setSaved(false);
    if(!draft.current)draft.current={id:crypto.randomUUID(),linkId:crypto.randomUUID(),childId:childId||null,text,url:url.trim(),quote,createdAt:new Date().toISOString()};
    try{await persistCapture(createClient(),userId,draft.current,media);draft.current=null;setText("");setUrl("");setQuote("");setMedia([]);setShowLink(false);setPartial(false);setSaved(true);}
    catch(e){setPartial(e instanceof CaptureFailure);setError(e instanceof Error?e.message:"저장하지 못했습니다.");if(!(e instanceof CaptureFailure))draft.current=null;}
    finally{lock.current=false;setBusy(false);}
  }
  return <section className="capture-wrap quiet-capture">
    <div className="page-intro"><p className="eyebrow">KEEP WHAT MATTERS</p><h1>지금의 나를,<br/>남겨두세요.</h1><p>잘 쓰지 않아도, 길지 않아도 괜찮아요.</p></div>
    {offline&&<p className="offline-note" role="status">인터넷이 끊겼어요. 작성은 가능하지만, 저장하려면 다시 연결해야 해요.</p>}
    {saved&&<div className="save-receipt" role="status"><span className="receipt-icon"><Icon name="check"/></span><div><strong>내 보관함에 남겼어요.</strong><p>원본을 저장했어요. 누구에게도 전송하지 않았어요.</p><Link href="/archive" prefetch={false}>방금 남긴 기록 보기 <Icon name="arrow" size={15}/></Link></div></div>}
    <div className="writing-paper">
      <div className="paper-top"><label htmlFor="recipient">누구에게</label><select id="recipient" value={childId} disabled={disabled||recording} onChange={e=>setChildId(e.target.value)}><option value="">나중에 정하기</option>{children.map(c=><option key={c.id} value={c.id}>{c.name}에게</option>)}</select><button className="icon-button" aria-label="받는 사람 추가" aria-expanded={addPerson} disabled={disabled||recording} onClick={()=>setAddPerson(v=>!v)}><Icon name="plus" size={18}/></button></div>
      {addPerson&&<form className="person-form" onSubmit={addChild}><label htmlFor="child-name">남기고 싶은 사람의 이름</label><div className="inline-form"><input id="child-name" maxLength={50} value={childName} disabled={busy} onChange={e=>setChildName(e.target.value)} placeholder="이름 또는 부르는 말" required/><button className="secondary" disabled={busy||!childName.trim()}>추가</button></div><p className="hint">이름만 기록해요. 초대나 메시지를 보내지 않습니다.</p></form>}
      <label className="sr-only" htmlFor="capture-text">남기고 싶은 말</label><textarea ref={textarea} id="capture-text" className="capture-text" placeholder={"오늘 있었던 일, 문득 든 생각.\n한 문장이면 충분해요."} value={text} maxLength={100000} disabled={disabled} onChange={e=>{setText(e.target.value);setSaved(false);}}/>
      <div className="capture-toolbar" aria-label="함께 남기기">
        <button disabled={disabled||recording||micPending} onClick={()=>photoInput.current?.click()}><Icon name="photo"/><span>사진</span></button>
        <button className={recording?"is-recording":""} disabled={disabled||micPending} onClick={()=>void voice()}><Icon name="mic"/><span>{micPending?"연결 중":recording?"녹음 마치기":"목소리"}</span></button>
        <button aria-expanded={showLink} disabled={disabled||recording} onClick={()=>setShowLink(true)}><Icon name="link"/><span>링크</span></button>
        <button disabled={disabled||recording||micPending} onClick={()=>audioInput.current?.click()}><Icon name="file"/><span>음성 파일</span></button>
      </div>
    </div>
    <input ref={photoInput} className="sr-only" tabIndex={-1} type="file" accept="image/*" aria-label="사진 첨부" multiple onChange={e=>{Array.from(e.target.files||[]).forEach(f=>addFile(f,"photo"));e.target.value="";}}/>
    <input ref={audioInput} className="sr-only" tabIndex={-1} type="file" accept="audio/*" aria-label="음성 파일 첨부" onChange={e=>{if(e.target.files?.[0])addFile(e.target.files[0],"audio");e.target.value="";}}/>
    {recording&&<div className="recording-strip"><span className="recording-dot"/><span role="status">목소리를 담고 있어요</span><time aria-label={`녹음 ${elapsed}초`}>{clock(elapsed)}</time><span className="hint">최대 5분</span></div>}
    {media.length>0&&<div className="attachment-list" aria-label="아직 저장하지 않은 첨부">{media.map(m=><MediaPreview key={m.id} item={m} disabled={disabled||recording} remove={()=>setMedia(old=>old.filter(x=>x.id!==m.id))}/>)}</div>}
    {showLink&&<div className="card link-editor"><div className="section-title"><h2>함께 남길 링크</h2><button className="icon-button" aria-label="링크 입력 닫기" disabled={disabled} onClick={()=>{if((url||quote)&&!confirm("아직 저장하지 않은 링크와 메모를 지울까요?"))return;setUrl("");setQuote("");setShowLink(false);}}><Icon name="close"/></button></div><label htmlFor="link-url">원래 주소</label><input id="link-url" type="url" inputMode="url" autoCapitalize="none" autoCorrect="off" placeholder="https://" value={url} disabled={disabled} onChange={e=>{setUrl(e.target.value);setSaved(false);}}/><label htmlFor="link-note">기억하고 싶은 구절이나 이유 <span className="optional">선택</span></label><textarea id="link-note" value={quote} disabled={disabled} onChange={e=>{setQuote(e.target.value);setSaved(false);}}/></div>}
    <div className="capture-foot quiet-save"><p className="save-state">{recording?"녹음을 마친 뒤 남길 수 있어요.":partial?"같은 기록으로 이어서 저장합니다.":hasContent?"아직 저장 전이에요.":"글, 사진, 목소리 중 하나면 충분해요."}</p><button className="primary save" onClick={()=>void save()} disabled={busy||recording||micPending||!hasContent}>{busy?"저장 확인 중…":partial?"이 기록 저장 다시 시도":"남기기"}<Icon name="arrow" size={18}/></button></div>
    <Status error={error}/>
    <p className="privacy-line"><Icon name="shield" size={15}/>나만 볼 수 있어요. 자동으로 전달되지 않아요.</p>
    {partial&&<p className="hint">완료될 때까지 이 화면을 유지해 주세요. 재시도해도 같은 기록을 덮어쓰거나 중복으로 만들지 않습니다.</p>}
  </section>;
}
function MediaPreview({item,remove,disabled}:{item:CaptureMedia;remove:()=>void;disabled:boolean}){
  const [url,setUrl]=useState("");useEffect(()=>{const u=URL.createObjectURL(item.file);setUrl(u);return()=>URL.revokeObjectURL(u);},[item.file]);
  return <div className="attachment-card">{item.type==="photo"?<img src={url||undefined} alt="첨부할 사진"/>:<div className="audio-preview"><span className="eyebrow">남길 목소리 {item.duration!==null&&clock(item.duration)}</span><audio controls preload="metadata" src={url||undefined}/></div>}<button className="icon-button" aria-label={item.type==="photo"?"이 사진 첨부 빼기":"이 음성 첨부 빼기"} onClick={remove} disabled={disabled}><Icon name="close" size={18}/></button></div>;
}

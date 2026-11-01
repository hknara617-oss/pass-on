"use client";
import {useEffect,useRef,useState} from "react";
import Link from "next/link";
import {createClient} from "@/lib/supabase/client";
import {CaptureFailure,persistCapture,type CaptureDraft,type CaptureMedia} from "@/lib/records";
import {clock} from "@/lib/experience";
import {noteUrl,rememberedRecipient} from "@/lib/signature";
import type {Child} from "@/lib/types";
import type {DraftContents} from "@/lib/draft-vault";
import {Status} from "./auth-ui";
import {Icon} from "./icons";
import {useUnsavedWarning} from "./use-unsaved-warning";
import {useContinuityDraft} from "./use-continuity-draft";
import {useVoiceStudio} from "./use-voice-studio";
import {DraftShelf} from "./draft-shelf";
export function Capture({children:initialChildren,userId}:{children:Child[];userId:string}){
  const [children,setChildren]=useState(initialChildren),[childId,setChildId]=useState(initialChildren[0]?.id||"");
  const [childName,setChildName]=useState(""),[addPerson,setAddPerson]=useState(false);
  const [text,setText]=useState(""),[url,setUrl]=useState(""),[quote,setQuote]=useState("");
  const [showLink,setShowLink]=useState(false),[media,setMedia]=useState<CaptureMedia[]>([]);
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[savedId,setSavedId]=useState(""),[partial,setPartial]=useState(false),[phase,setPhase]=useState("");
  const [offline,setOffline]=useState(false),[date,setDate]=useState("오늘"),[restoredMessage,setRestoredMessage]=useState("");
  const lock=useRef(false),selectionTouched=useRef(false),draft=useRef<CaptureDraft|null>(null);
  const photoInput=useRef<HTMLInputElement>(null),audioInput=useRef<HTMLInputElement>(null),textarea=useRef<HTMLTextAreaElement>(null),more=useRef<HTMLDetailsElement>(null);
  const contents:DraftContents={childId,text,url,quote,media,attempt:draft.current};
  const vault=useContinuityDraft(userId,contents,c=>{selectionTouched.current=true;draft.current=c.attempt;setChildId(c.childId);setText(c.text);setUrl(c.url);setQuote(c.quote);setMedia(c.media);setPartial(!!c.attempt);setShowLink(!!(c.url||c.quote));setSavedId("");setError("");setRestoredMessage(c.attempt?"저장 확인이 멈춘 기록을 가져왔어요. 같은 기록으로 다시 확인합니다.":"멈췄던 이야기를 그대로 가져왔어요.");});
  function addFile(file:File|Blob,type:"photo"|"audio",duration:number|null=null){
    if(!file.size){setError("빈 파일은 남길 수 없어요.");return;}if(file.size>25*1024*1024){setError("파일 하나는 25MB까지 첨부할 수 있어요.");return;}if(!file.type.startsWith(type==="photo"?"image/":"audio/")){setError("사진 또는 음성 파일을 선택해 주세요.");return;}
    const subtype=file.type.split("/")[1]?.split(";")[0]||"bin",extension=({jpeg:"jpg",mp4:"m4a",mpeg:"mp3"} as Record<string,string>)[subtype]||subtype.replace(/[^a-z0-9]/gi,"");
    setMedia(old=>[...old,{id:crypto.randomUUID(),type,file,mime:file.type,extension,duration}]);setSavedId("");setError("");setRestoredMessage("");
  }
  const voice=useVoiceStudio((file,seconds)=>addFile(file,"audio",seconds),setError);
  const dirty=!!text||!!url||!!quote||media.length>0||voice.active||partial;
  const hasContent=!!text.trim()||!!url.trim()||!!quote.trim()||media.length>0;
  const disabled=busy||partial||vault.recovering||!vault.ready||vault.status==="conflict";
  const person=children.find(c=>c.id===childId);
  useUnsavedWarning(voice.active||voice.working||(dirty&&!vault.safe));
  function remember(id:string){selectionTouched.current=true;setChildId(id);try{localStorage.setItem(`passon:recipient:${userId}`,id);}catch{}}
  useEffect(()=>{try{if(!selectionTouched.current)setChildId(rememberedRecipient(localStorage.getItem(`passon:recipient:${userId}`),initialChildren));}catch{}setDate(new Intl.DateTimeFormat("ko-KR",{month:"long",day:"numeric",weekday:"short",timeZone:"Asia/Seoul"}).format(new Date()));},[userId,initialChildren]);
  useEffect(()=>{const update=()=>setOffline(!navigator.onLine);update();window.addEventListener("online",update);window.addEventListener("offline",update);return()=>{window.removeEventListener("online",update);window.removeEventListener("offline",update);};},[]);
  useEffect(()=>{if(textarea.current){textarea.current.style.height="auto";textarea.current.style.height=`${Math.min(420,Math.max(196,textarea.current.scrollHeight))}px`;}},[text]);
  async function addChild(e:React.FormEvent){
    e.preventDefault();if(lock.current||!childName.trim())return;lock.current=true;setBusy(true);setError("");
    try{const {data,error}=await createClient().from("children").insert({user_id:userId,name:childName.trim()}).select().single();if(error)throw error;setChildren(old=>[...old,data]);remember(data.id);setChildName("");setAddPerson(false);}catch{setError("이름을 저장하지 못했어요. 작성 중인 내용은 그대로예요.");}finally{lock.current=false;setBusy(false);}
  }
  async function save(){
    if(lock.current||voice.active||voice.working||!hasContent||!vault.ready||vault.recovering||vault.status==="conflict")return;
    if(offline){await vault.flush();setError("초안은 기기 보관 상태를 확인해 주세요. 인터넷이 연결되면 ‘남기기’로 원본을 저장할 수 있어요.");return;}
    lock.current=true;setBusy(true);setError("");setSavedId("");setRestoredMessage("");setPhase("기기 초안 확인 중");
    if(!draft.current)draft.current={id:crypto.randomUUID(),linkId:crypto.randomUUID(),childId:childId||null,text,url:url.trim(),quote,createdAt:new Date().toISOString()};
    try{await vault.freeze(draft.current);setPhase(media.length?"첨부와 원본 저장 확인 중":"원본 저장 확인 중");const saved=await persistCapture(createClient(),userId,draft.current,media);await vault.complete();draft.current=null;setText("");setUrl("");setQuote("");setMedia([]);setShowLink(false);setPartial(false);setSavedId(saved.id);}
    catch(e){setPartial(e instanceof CaptureFailure);setError(e instanceof Error?e.message:"저장을 확인하지 못했어요.");if(!(e instanceof CaptureFailure))draft.current=null;}
    finally{lock.current=false;setBusy(false);setPhase("");}
  }
  async function fresh(){if(voice.active||voice.working||busy)return;if(partial){setError("저장 확인이 필요한 기록이에요. 먼저 같은 기록으로 재시도해 주세요.");return;}await vault.flush();if(hasContent&&!vault.safe){setError("현재 초안의 기기 보관을 먼저 확인해 주세요.");return;}await vault.newDraft();draft.current=null;setText("");setUrl("");setQuote("");setMedia([]);setShowLink(false);setSavedId("");setRestoredMessage("");textarea.current?.focus();}
  async function resume(id:string){if(voice.active||voice.working||busy)return;await vault.flush();await vault.resume(id);}
  const stateText=!vault.ready?"초안 보관함 확인 중":vault.recovering?"이야기를 가져오는 중":vault.status==="conflict"?"다른 화면의 초안과 충돌했어요":vault.status==="error"?"기기 임시 보관을 확인해 주세요":vault.status==="saving"?"기기에 보관 중…":hasContent&&vault.safe?"이 기기에 임시 보관됨":"나만의 기록, 언제든 이어서";
  return <section className="capture-wrap signature-capture continuity-capture">
    <div className="capture-heading"><span className="section-kicker"><span className="accent-dot"/>오늘의 기록</span><span className="today-date">{date}</span></div>
    <h1 className="capture-title">오늘의 한 조각<span>.</span></h1><p className="capture-subtitle">내일의 너에게, 지금의 나를.</p>
    {!hasContent&&vault.saved.length>0&&!vault.recovered&&<div className="resume-note"><span className="resume-symbol"><Icon name="time" size={21}/></span><div><strong>멈췄던 이야기가 있어요.</strong><p>{vault.saved[0].text.slice(0,42)||"사진과 목소리로 남기던 순간"}</p></div><button disabled={busy||voice.active||voice.working||vault.recovering} onClick={()=>void resume(vault.saved[0].id)}>이어서<Icon name="arrow" size={16}/></button></div>}
    {offline&&<p className="offline-note" role="status">지금은 오프라인이에요. 이 화면에서 쓴 초안은 기기에 보관하고, 원본 저장은 연결 후에 마쳐요.</p>}
    <div className="writing-paper"><div className="paper-top"><span className="recipient-avatar" aria-hidden="true">{person?.name.slice(0,1)||"나"}</span><label className="sr-only" htmlFor="recipient">받는 사람</label><select id="recipient" value={childId} disabled={disabled||voice.active||voice.working} onChange={e=>remember(e.target.value)}><option value="">받는 사람은 나중에</option>{children.map(c=><option key={c.id} value={c.id}>{c.name}에게</option>)}</select><button className="icon-button" aria-label="받는 사람 추가" aria-expanded={addPerson} disabled={disabled||voice.active||voice.working} onClick={()=>setAddPerson(v=>!v)}><Icon name="plus" size={18}/></button></div>
    {addPerson&&<form className="person-form" onSubmit={addChild}><label htmlFor="child-name">남기고 싶은 사람</label><div className="inline-form"><input id="child-name" maxLength={50} value={childName} disabled={busy} onChange={e=>setChildName(e.target.value)} placeholder="이름 또는 부르는 말" required/><button className="secondary" disabled={busy||!childName.trim()}>추가</button></div><p className="hint">이름만 기록해요. 초대나 메시지는 보내지 않아요.</p></form>}
    <div className="editor-surface"><label className="sr-only" htmlFor="capture-text">남기고 싶은 말</label><textarea ref={textarea} id="capture-text" className="capture-text" placeholder={"오늘 네게 남기고 싶은 말은…\n\n한 문장이어도 괜찮아."} value={text} maxLength={100000} disabled={disabled} onChange={e=>{setText(e.target.value);setSavedId("");setRestoredMessage("");}} onKeyDown={e=>{if(e.key==="Enter"&&(e.metaKey||e.ctrlKey)){e.preventDefault();void save();}}}/><span className="editor-corner" aria-hidden="true"><Icon name="write" size={17}/></span></div>
    <div className="capture-toolbar" aria-label="함께 남기기"><button className="tool-photo" disabled={disabled||voice.active||voice.working} onClick={()=>photoInput.current?.click()}><span><Icon name="photo" size={21}/></span>사진</button><button className={`tool-voice ${voice.active?"is-recording":""}`} disabled={disabled||voice.working} onClick={()=>{if(voice.active)voice.stop();else{setError("");void voice.start();}}}><span><Icon name="mic" size={21}/></span>{voice.working?"준비 중":voice.active?"녹음 마치기":"목소리"}</button><button className="tool-link" aria-expanded={showLink} disabled={disabled||voice.active||voice.working} onClick={()=>setShowLink(v=>!v)}><span><Icon name="link" size={21}/></span>링크</button><details ref={more} className="more-tools"><summary aria-label="첨부 더보기"><span aria-hidden="true">•••</span><span>더보기</span></summary><div className="tool-menu"><button disabled={disabled||voice.active||voice.working} onClick={()=>{if(more.current)more.current.open=false;audioInput.current?.click();}}><Icon name="file" size={18}/>음성 파일 첨부</button></div></details></div></div>
    <div className="draft-state-row"><span className={`draft-state is-${vault.status}`} data-draft-state={vault.status}><span className="draft-indicator"/>{stateText}</span><DraftShelf items={vault.saved} disabled={busy||voice.active||voice.working||vault.recovering} onResume={resume} onDiscard={vault.discard}/></div>
    {restoredMessage&&<p className="restore-message" role="status"><Icon name="check" size={15}/>{restoredMessage}</p>}
    {vault.error&&<div className="local-warning"><p role="alert">{vault.error}</p>{vault.status==="conflict"?<button className="text-link" onClick={()=>void vault.newDraft().then(()=>vault.flush())}>현재 내용을 별도 초안으로 보관</button>:<button className="text-link" disabled={busy} onClick={()=>void vault.flush()}>기기 보관 다시 시도</button>}</div>}
    <input ref={photoInput} className="sr-only" tabIndex={-1} type="file" accept="image/*" aria-label="사진 첨부" multiple onChange={e=>{Array.from(e.target.files||[]).forEach(f=>addFile(f,"photo"));e.target.value="";}}/><input ref={audioInput} className="sr-only" tabIndex={-1} type="file" accept="audio/*" aria-label="음성 파일 첨부" onChange={e=>{if(e.target.files?.[0])addFile(e.target.files[0],"audio");e.target.value="";}}/>
    {(voice.active||voice.state==="finishing")&&<section className="voice-studio" aria-label="목소리 녹음"><div className="voice-heading"><span><span className={`recording-dot ${voice.state==="paused"?"is-paused":""}`}/>{voice.state==="paused"?"잠시 멈췄어요":voice.state==="finishing"?"목소리를 정리하고 있어요":"지금의 목소리를 담고 있어요"}</span><time>{clock(voice.elapsed)}<small> / 05:00</small></time></div><div className="voice-meter" aria-hidden="true">{(voice.levels.length?voice.levels:Array(18).fill(4)).map((h,i)=><i key={i} style={{height:h}}/>)}</div><div className="voice-controls"><button className="secondary" disabled={voice.working} onClick={()=>voice.state==="paused"?voice.resume():voice.pause()}>{voice.state==="paused"?"녹음 계속하기":"녹음 잠시 멈추기"}</button><button className="voice-finish" disabled={voice.working} onClick={voice.stop}><Icon name="check" size={17}/>녹음 마치기</button></div><p>{voice.interrupted?"앱을 떠나 자동으로 멈췄어요. 계속하거나 마쳐 주세요.":"마치기를 누르면 기기 초안에 함께 보관해요."}</p></section>}
    {media.length>0&&<div className="attachment-list" aria-label="저장 전 첨부">{media.map(m=><MediaPreview key={m.id} item={m} disabled={disabled||voice.active||voice.working} remove={()=>setMedia(old=>old.filter(x=>x.id!==m.id))}/>)}</div>}
    {showLink&&<div className="card link-editor"><div className="section-title"><h2>함께 남길 링크</h2><button className="icon-button" aria-label="링크 입력 닫기" disabled={disabled} onClick={()=>{if((url||quote)&&!confirm("아직 원본으로 저장하지 않은 링크와 메모를 지울까요?"))return;setUrl("");setQuote("");setShowLink(false);}}><Icon name="close"/></button></div><label htmlFor="link-url">원래 주소</label><input id="link-url" type="url" inputMode="url" maxLength={10000} autoCapitalize="none" autoCorrect="off" placeholder="https://" value={url} disabled={disabled} onChange={e=>{setUrl(e.target.value);setSavedId("");}}/><label htmlFor="link-note">기억하고 싶은 구절 <span className="optional">선택</span></label><textarea id="link-note" maxLength={100000} value={quote} disabled={disabled} onChange={e=>{setQuote(e.target.value);setSavedId("");}}/></div>}
    {!showLink&&(url||quote)&&<button className="attached-link" onClick={()=>setShowLink(true)}><Icon name="link" size={16}/>첨부한 링크 확인</button>}
    <div className="capture-foot quiet-save"><div className="save-state" aria-live="polite">{savedId?<span className="saved-state"><Icon name="check" size={16}/>이 순간이 원본으로 남았어요.</span>:voice.active?"녹음을 마친 뒤 남길 수 있어요.":partial?"이전 시도와 같은 기록으로 저장을 확인해요.":hasContent?"‘남기기’를 누르면 서버에 원본으로 보관해요.":"글, 사진, 목소리. 하나면 충분해요."}</div><button className="primary save" onClick={()=>void save()} disabled={busy||voice.active||voice.working||!hasContent||!vault.ready||vault.recovering||vault.status==="conflict"}>{busy?<><span className="spinner"/>{phase}</>:partial?"이 기록 저장 다시 시도":<><span>남기기</span><Icon name="arrow" size={20}/></>}</button></div>
    <Status error={error}/>{savedId?<div className="saved-next sealed-receipt"><span className="seal-mark"><Icon name="check" size={22}/></span><div><Link href={noteUrl(savedId)} prefetch={false}>방금 남긴 기록 보기<Icon name="arrow" size={16}/></Link><span>원문 그대로. 누구에게도 전송하지 않았어요.</span></div></div>:<p className="privacy-line"><Icon name="shield" size={13}/>나만 볼 수 있어요. 자동으로 전달되지 않아요.</p>}
    {hasContent&&!partial&&<button className="fresh-draft" disabled={busy||voice.active||voice.working||!vault.safe} onClick={()=>void fresh()}>이 초안은 두고, 새로 쓰기</button>}
  </section>;
}
function MediaPreview({item,remove,disabled}:{item:CaptureMedia;remove:()=>void;disabled:boolean}){
  const [url,setUrl]=useState("");useEffect(()=>{const u=URL.createObjectURL(item.file);setUrl(u);return()=>URL.revokeObjectURL(u);},[item.file]);
  return <div className="attachment-card">{item.type==="photo"?<img src={url||undefined} alt="첨부할 사진"/>:<div className="audio-preview"><span>남길 목소리 {item.duration!==null&&clock(item.duration)}</span><audio controls preload="metadata" src={url||undefined}/></div>}<button className="icon-button" aria-label={item.type==="photo"?"이 사진 첨부 빼기":"이 음성 첨부 빼기"} onClick={remove} disabled={disabled}><Icon name="close" size={18}/></button></div>;
}

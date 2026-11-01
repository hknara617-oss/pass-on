"use client";
import {useEffect,useRef,useState} from "react";
import type {Entry} from "@/lib/types";
import {MEDIA_BUCKET} from "@/lib/records";
import {clock} from "@/lib/experience";
import {createClient} from "@/lib/supabase/client";
import {Icon} from "./icons";
// Fetch a short-lived private URL only when the tile approaches the viewport.
export function MemoryThumbnail({entry}:{entry:Entry}) {
  const photo=entry.attachments.find(a=>a.type==="photo");
  const audio=entry.attachments.find(a=>a.type==="audio");
  const target=useRef<HTMLSpanElement>(null);
  const [near,setNear]=useState(false),[url,setUrl]=useState(""),[failed,setFailed]=useState(false);
  useEffect(()=>{const el=target.current;if(!el)return;if(!window.IntersectionObserver){setNear(true);return;}const observer=new IntersectionObserver(entries=>{if(entries.some(x=>x.isIntersecting)){setNear(true);observer.disconnect();}},{rootMargin:"250px"});observer.observe(el);return()=>observer.disconnect();},[]);
  useEffect(()=>{if(!near||!photo)return;let active=true;setFailed(false);setUrl("");createClient().storage.from(MEDIA_BUCKET).createSignedUrl(photo.storage_path,600).then(({data,error})=>{if(!active)return;if(error||!data)setFailed(true);else setUrl(data.signedUrl);}).catch(()=>{if(active)setFailed(true);});return()=>{active=false;};},[near,photo?.storage_path]);
  if(photo)return <span ref={target} className="memory-thumb is-photo">{url&&!failed?<img src={url} alt="" loading="lazy" decoding="async" onError={()=>setFailed(true)}/>:<Icon name="photo" size={26}/>}<span className="media-badge"><Icon name="photo" size={12}/>{entry.attachments.filter(a=>a.type==="photo").length}</span></span>;
  if(audio)return <span ref={target} className="memory-thumb is-audio"><span className="audio-symbol"><Icon name="mic" size={22}/></span><span className="waveform" aria-hidden="true">{[14,23,35,19,42,28,48,22,34,17,27,12].map((h,i)=><i key={i} style={{height:h}}/>)}</span><span className="audio-duration">{audio.duration_seconds!==null?clock(audio.duration_seconds):"목소리 기록"}</span></span>;
  return <span ref={target} className={`memory-thumb ${entry.link_attachments.length?"is-link":"is-text"}`} aria-hidden="true">{entry.link_attachments.length?<Icon name="link" size={27}/>:<span className="quote-glyph">“</span>}<span className="paper-lines"><i/><i/><i/></span></span>;
}

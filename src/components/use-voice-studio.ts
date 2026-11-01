"use client";
import {useEffect,useRef,useState} from "react";
export function useVoiceStudio(onAudio:(file:Blob,seconds:number)=>void,onError:(text:string)=>void){
  const [state,setState]=useState<"idle"|"permission"|"recording"|"paused"|"finishing">("idle"),[elapsed,setElapsed]=useState(0),[levels,setLevels]=useState<number[]>([]),[interrupted,setInterrupted]=useState(false);
  const mounted=useRef(false),rec=useRef<MediaRecorder|null>(null),mic=useRef<MediaStream|null>(null),audio=useRef<AudioContext|null>(null),analyser=useRef<AnalyserNode|null>(null);
  const lastStart=useRef(0),duration=useRef(0),totalBytes=useRef(0),audioDone=useRef(onAudio),report=useRef(onError),ending=useRef(false);
  audioDone.current=onAudio;report.current=onError;
  function seconds(){return Math.floor((duration.current+(rec.current?.state==="recording"?performance.now()-lastStart.current:0))/1000);}
  function stop(){const r=rec.current;if(!r||r.state==="inactive"||ending.current)return;ending.current=true;if(r.state==="recording")duration.current+=performance.now()-lastStart.current;r.stop();setState("finishing");}
  function pause(){const r=rec.current;if(!r||r.state!=="recording")return;duration.current+=performance.now()-lastStart.current;r.pause();setState("paused");setLevels([]);}
  function resume(){const r=rec.current;if(!r||r.state!=="paused")return;lastStart.current=performance.now();r.resume();setState("recording");setInterrupted(false);}
  async function start(){
    if(rec.current?.state==="recording"||rec.current?.state==="paused"||state==="permission")return;
    if(!navigator.mediaDevices?.getUserMedia||!globalThis.MediaRecorder){report.current("이 브라우저에서는 직접 녹음할 수 없어요. 더보기에서 음성 파일을 첨부해 주세요.");return;}
    setState("permission");setInterrupted(false);ending.current=false;
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});if(!mounted.current){stream.getTracks().forEach(t=>t.stop());return;}mic.current=stream;
      const mime=["audio/mp4","audio/webm;codecs=opus","audio/webm"].find(v=>MediaRecorder.isTypeSupported(v));const recorder=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);rec.current=recorder;
      const chunks:BlobPart[]=[];duration.current=0;totalBytes.current=0;lastStart.current=performance.now();setElapsed(0);
      try{const context=new AudioContext();audio.current=context;const node=context.createAnalyser();node.fftSize=128;context.createMediaStreamSource(stream).connect(node);analyser.current=node;void context.resume().catch(()=>{});}catch{/* Meter is optional, recording is not. */}
      recorder.ondataavailable=e=>{if(e.data.size){chunks.push(e.data);totalBytes.current+=e.data.size;if(totalBytes.current>=24*1024*1024)stop();}};
      recorder.onstop=()=>{stream.getTracks().forEach(t=>t.stop());void audio.current?.close().catch(()=>{});audio.current=null;analyser.current=null;rec.current=null;if(!mounted.current)return;setState("idle");setLevels([]);setInterrupted(false);const blob=new Blob(chunks,{type:recorder.mimeType||mime||"audio/webm"});if(blob.size)audioDone.current(blob,Math.max(1,Math.round(duration.current/1000)));else report.current("담긴 소리를 확인하지 못했어요. 다시 녹음해 주세요.");};
      recorder.onerror=()=>{if(mounted.current)report.current("녹음이 중단됐어요. 담긴 소리가 있으면 첨부에서 확인해 주세요.");if(recorder.state!=="inactive")stop();else{stream.getTracks().forEach(t=>t.stop());void audio.current?.close().catch(()=>{});if(mounted.current)setState("idle");}};
      stream.getAudioTracks().forEach(t=>t.onended=()=>{if(recorder.state!=="inactive")stop();});
      recorder.start(1000);setState("recording");
    }catch{mic.current?.getTracks().forEach(t=>t.stop());if(mounted.current){setState("idle");report.current("마이크 권한을 확인해 주세요. 더보기에서 음성 파일을 첨부해도 괜찮아요.");}}
  }
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;if(rec.current){rec.current.onstop=null;rec.current.ondataavailable=null;if(rec.current.state!=="inactive")rec.current.stop();}mic.current?.getTracks().forEach(t=>t.stop());void audio.current?.close().catch(()=>{});};},[]);
  useEffect(()=>{if(state!=="recording"&&state!=="paused")return;const timer=setInterval(()=>{const s=seconds();setElapsed(s);if(s>=300){stop();return;}const node=analyser.current;if(node&&rec.current?.state==="recording"){const data=new Uint8Array(node.frequencyBinCount);node.getByteFrequencyData(data);setLevels(Array.from({length:18},(_,i)=>Math.max(4,Math.round(data[i*2]/255*42))));}},100);return()=>clearInterval(timer);},[state]);
  useEffect(()=>{const hidden=()=>{if(document.visibilityState==="hidden"&&rec.current?.state==="recording"){pause();setInterrupted(true);}};document.addEventListener("visibilitychange",hidden);return()=>document.removeEventListener("visibilitychange",hidden);},[]);
  return {state,elapsed,levels,interrupted,start,stop,pause,resume,active:state==="recording"||state==="paused",working:state==="permission"||state==="finishing"};
}

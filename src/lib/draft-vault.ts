import type { CaptureDraft, CaptureMedia } from "./records";
// Device-local recovery, NOT a cloud backup or an offline authentication bypass.
export type DraftContents = { childId: string; text: string; url: string; quote: string; media: CaptureMedia[]; attempt: CaptureDraft | null };
export type DraftSummary = { id: string; revision: number; updatedAt: number; text: string; mediaCount: number; pending: boolean };
export type RecoveredDraft = { id: string; revision: number; updatedAt: number; contents: DraftContents };
type Box = { iv: Uint8Array<ArrayBuffer>; bytes: ArrayBuffer };
type Row = Box & { key: string; owner: string; id: string; revision: number; updatedAt: number; mediaKeys: string[] };
type Packed = Omit<DraftContents,"media"> & { media: Omit<CaptureMedia,"file">[] };
export class DraftConflict extends Error { constructor(){super("다른 화면에서 이 초안을 수정했어요. 현재 내용은 새 초안으로 분리해 주세요.");} }
const DB = "passon-private-drafts-v1";
let connection: Promise<IDBDatabase> | null = null;
function database(): Promise<IDBDatabase> {
  if (!globalThis.indexedDB || !globalThis.crypto?.subtle) return Promise.reject(new Error("이 환경에서는 기기 임시 보관을 사용할 수 없어요."));
  if (!connection) connection = new Promise((resolve,reject)=>{
    const request = indexedDB.open(DB,1);
    request.onupgradeneeded=()=>{const db=request.result;db.createObjectStore("keys");const store=db.createObjectStore("drafts",{keyPath:"key"});store.createIndex("owner","owner");db.createObjectStore("media",{keyPath:"key"});};
    request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();connection=null;};resolve(db);};
    request.onerror=()=>{connection=null;reject(request.error);};
    request.onblocked=()=>{connection=null;reject(new Error("기기 보관함을 다른 창에서 사용 중이에요."));};
  });
  return connection;
}
function result<T>(request: IDBRequest<T>): Promise<T> { return new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);}); }
function done(tx:IDBTransaction):Promise<void>{return new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error("기기 보관 실패"));tx.onabort=()=>reject(tx.error||new Error("기기 보관 취소"));});}
function scope(owner:string,id:string){if(!owner||!id||owner.includes(":" )||id.includes(":"))throw new Error("Invalid draft scope");return `${owner}:${id}`;}
async function deviceKey(owner:string,create:boolean):Promise<CryptoKey|null>{
  const db=await database();const existing=await result<CryptoKey|undefined>(db.transaction("keys").objectStore("keys").get(owner));
  if(existing)return existing;if(!create)return null;
  const generated=await crypto.subtle.generateKey({name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
  // Recheck under the write transaction: simultaneous tabs must not replace a key.
  const tx=db.transaction("keys","readwrite"), finish=done(tx),store=tx.objectStore("keys");let key=generated;
  const req=store.get(owner);req.onsuccess=()=>{if(req.result)key=req.result;else store.add(generated,owner);};await finish;return key;
}
async function encrypt(key:CryptoKey,aad:string,bytes:ArrayBuffer):Promise<Box>{const iv=crypto.getRandomValues(new Uint8Array(12));return {iv,bytes:await crypto.subtle.encrypt({name:"AES-GCM",iv,additionalData:new TextEncoder().encode(aad)},key,bytes)};}
async function decrypt(key:CryptoKey,aad:string,box:Box){return crypto.subtle.decrypt({name:"AES-GCM",iv:new Uint8Array(box.iv),additionalData:new TextEncoder().encode(aad)},key,box.bytes);}
export function hasDraft(c:DraftContents){return !!(c.text||c.url||c.quote||c.media.length||c.attempt);}
export function validateDraft(c:DraftContents){
  if(typeof c.text!=="string"||c.text.length>100000||typeof c.url!=="string"||c.url.length>10000||typeof c.quote!=="string"||c.quote.length>100000||!Array.isArray(c.media)||c.media.length>40)throw new Error("초안 크기를 확인해 주세요.");
  if(new Set(c.media.map(m=>m.id)).size!==c.media.length)throw new Error("중복 첨부입니다.");
  if(c.media.some(m=>!(m.file instanceof Blob)||m.file.size>25*1024*1024)||c.media.reduce((n,m)=>n+m.file.size,0)>80*1024*1024)throw new Error("기기 임시 보관은 첨부 합계 80MB까지예요. 원본 저장은 별도로 시도할 수 있어요.");
}
async function unpack(row:Row,key:CryptoKey):Promise<Packed>{const raw=JSON.parse(new TextDecoder().decode(await decrypt(key,row.key,row))) as Packed;if(typeof raw.text!=="string"||!Array.isArray(raw.media))throw new Error("보관한 초안을 읽지 못했어요.");return raw;}
export async function listDrafts(owner:string):Promise<DraftSummary[]>{
  const db=await database();const rows=await result<Row[]>(db.transaction("drafts").objectStore("drafts").index("owner").getAll(owner));if(!rows.length)return [];
  const key=await deviceKey(owner,false);if(!key)throw new Error("이 기기의 초안 키를 읽지 못했어요. 저장소를 지우지 마세요.");
  return (await Promise.all(rows.map(async row=>{const c=await unpack(row,key);return {id:row.id,revision:row.revision,updatedAt:row.updatedAt,text:c.text||c.quote||c.url,mediaCount:c.media.length,pending:!!c.attempt};}))).sort((a,b)=>b.updatedAt-a.updatedAt);
}
export async function readDraft(owner:string,id:string):Promise<RecoveredDraft>{
  const db=await database(),row=await result<Row|undefined>(db.transaction("drafts").objectStore("drafts").get(scope(owner,id)));if(!row||row.owner!==owner)throw new Error("초안을 찾지 못했어요.");
  const key=await deviceKey(owner,false);if(!key)throw new Error("초안 키를 읽지 못했어요.");const packed=await unpack(row,key);
  const media=await Promise.all(packed.media.map(async item=>{const mk=`${row.key}:${item.id}`;const box=await result<Box|undefined>(db.transaction("media").objectStore("media").get(mk));if(!box)throw new Error("첨부 복구를 확인하지 못했어요. 초안을 지우지 마세요.");return {...item,file:new Blob([await decrypt(key,mk,box)],{type:item.mime})};}));
  const contents={...packed,media};validateDraft(contents);return {id:row.id,revision:row.revision,updatedAt:row.updatedAt,contents};
}
export async function writeDraft(owner:string,id:string,expected:number|null,contents:DraftContents):Promise<number>{
  validateDraft(contents);const db=await database(),key=await deviceKey(owner,true);if(!key)throw new Error("기기 키를 만들지 못했어요.");const sk=scope(owner,id);
  const old=await result<Row|undefined>(db.transaction("drafts").objectStore("drafts").get(sk));
  if((old?.revision??null)!==expected)throw new DraftConflict();
  const mediaKeys=contents.media.map(m=>`${sk}:${m.id}`),existing=new Set(old?.mediaKeys||[]);
  const boxes=await Promise.all(contents.media.filter(m=>!existing.has(`${sk}:${m.id}`)).map(async m=>{const mk=`${sk}:${m.id}`;return {key:mk,...await encrypt(key,mk,await m.file.arrayBuffer())};}));
  const packed:Packed={...contents,media:contents.media.map(({file,...m})=>m)};
  const box=await encrypt(key,sk,new TextEncoder().encode(JSON.stringify(packed)).buffer);
  const revision=(expected??0)+1,tx=db.transaction(["drafts","media"],"readwrite"),finish=done(tx);let conflict=false;
  const store=tx.objectStore("drafts"),check=store.get(sk);
  check.onsuccess=()=>{
    const live=check.result as Row|undefined;
    if((live?.revision??null)!==expected){conflict=true;tx.abort();return;}
    boxes.forEach(b=>tx.objectStore("media").put(b));
    for(const mk of live?.mediaKeys||[])if(!mediaKeys.includes(mk))tx.objectStore("media").delete(mk);
    store.put({key:sk,owner,id,revision,updatedAt:Date.now(),mediaKeys,...box} satisfies Row);
  };
  try{await finish;}catch(e){if(conflict)throw new DraftConflict();throw e;}return revision;
}
export async function removeDraft(owner:string,id:string,expected:number):Promise<void>{
  const db=await database(),sk=scope(owner,id),tx=db.transaction(["drafts","media"],"readwrite"),finish=done(tx);let conflict=false;
  const req=tx.objectStore("drafts").get(sk);req.onsuccess=()=>{const row=req.result as Row|undefined;if(!row)return;if(row.revision!==expected){conflict=true;tx.abort();return;}row.mediaKeys.forEach(k=>tx.objectStore("media").delete(k));tx.objectStore("drafts").delete(sk);};
  try{await finish;}catch(e){if(conflict)throw new DraftConflict();throw e;}
}

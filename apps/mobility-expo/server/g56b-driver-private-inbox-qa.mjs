/**
 * G56B A38 — Driver-only inbox adapter. QA only; no HTTP runtime.
 * Requires independent JWT verifier, provider revocation, exclusive Driver
 * role and SQL gateway with one-use capability. Cursor is opaque HMAC-bound.
 */
import {createHmac,timingSafeEqual} from 'node:crypto';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id=x=>typeof x==='string'&&UUID.test(x);
const safe=x=>Number.isSafeInteger(x)&&x>=0;
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const exact=(x,keys)=>plain(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const fail=(status,code)=>Object.freeze({status,body:Object.freeze({code,qaOnly:true})});
const TICKET=['ticket','operation','expiresAtMs','productionEnabled','qaOnly'];
const RAW=['ownerId','revision','generatedAt','expiresAt','items','hasMore','nextPosition','productionEnabled','qaOnly'];
const ROW=['conversationId','serviceKind','serviceId','counterpartRole','state',
 'assignmentVerified','canSend','revision','updatedAt','unreadCount'];
const older=(a,b)=>a.updatedAt<b.updatedAt||
 (a.updatedAt===b.updatedAt&&a.conversationId<b.conversationId);
const sign=(key,body)=>createHmac('sha256',key).update(body).digest('base64url');
function decode(secret,text,scope,now){
 if(typeof text!=='string'||text.length>2048||
  !/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]{43}$/.test(text))return null;
 const [body,mac]=text.split('.');
 const expected=Buffer.from(sign(secret,body),'base64url');
 const observed=Buffer.from(mac,'base64url');
 if(observed.length!==expected.length||!timingSafeEqual(expected,observed)||
  observed.toString('base64url')!==mac)return null;
 try{
  const bytes=Buffer.from(body,'base64url');
  if(bytes.toString('base64url')!==body)return null;
  const decoded=JSON.parse(bytes.toString('utf8'));
  if(!exact(decoded,['scope','revision','beforeMs','beforeId','expiresAt'])||
   JSON.stringify(decoded.scope)!==JSON.stringify(scope)||
   !safe(decoded.revision)||decoded.revision<1||
   !safe(decoded.beforeMs)||!id(decoded.beforeId)||
   !safe(decoded.expiresAt)||decoded.expiresAt<=now||
   decoded.expiresAt>now+60000)return null;
  return decoded;
 }catch{return null;}
}
const encode=(secret,scope,revision,position,until)=>{
 const body=Buffer.from(JSON.stringify({
  scope,revision,beforeMs:position.updatedAt,
  beforeId:position.conversationId,expiresAt:until
 })).toString('base64url');
 return body+'.'+sign(secret,body);
};
function trusted(raw,driver,limit,at,position){
 if(!exact(raw,RAW)||raw.ownerId!==driver||!safe(raw.revision)||
  raw.revision<1||!safe(raw.generatedAt)||raw.generatedAt>at||
  !safe(raw.expiresAt)||raw.expiresAt<=at||raw.expiresAt>at+60000||
  !Array.isArray(raw.items)||raw.items.length>limit||
  typeof raw.hasMore!=='boolean'||raw.productionEnabled!==false||
  raw.qaOnly!==true||(position&&raw.revision!==position.revision))return false;
 const ids=new Set(),services=new Set();
 for(let i=0;i<raw.items.length;i++){
  const m=raw.items[i];
  if(!exact(m,ROW)||!id(m.conversationId)||!id(m.serviceId)||
   !['RIDE','DELIVERY','MERCHANT_ORDER'].includes(m.serviceKind)||
   m.counterpartRole!=='passenger'||m.state!=='ACTIVE'||
   m.assignmentVerified!==true||m.canSend!==true||
   !safe(m.revision)||m.revision<1||!safe(m.unreadCount)||
   !safe(m.updatedAt)||m.updatedAt>at||ids.has(m.conversationId)||
   services.has(m.serviceKind+':'+m.serviceId)||
   (i>0&&!older(m,raw.items[i-1]))||
   (position&&!older(m,{
    updatedAt:position.beforeMs,conversationId:position.beforeId
   })))return false;
  ids.add(m.conversationId);
  services.add(m.serviceKind+':'+m.serviceId);
 }
 if(raw.hasMore){
  const last=raw.items.at(-1);
  return !!last&&exact(raw.nextPosition,['updatedAt','conversationId'])&&
   raw.nextPosition.updatedAt===last.updatedAt&&
   raw.nextPosition.conversationId===last.conversationId;
 }
 return raw.nextPosition===null;
}
export function createG56BDriverPrivateInboxQa({
 environment,localQaOnly,liveEnabled,cursorSecret,
 verifyAccessToken,verifySessionNotRevoked,resolveExclusiveRole,
 allowRequest,mintOwnerTicket,executeScopedTicket,now=Date.now
}={}){
 if(environment!=='isolated_staging'||localQaOnly!==true||liveEnabled!==false||
  !Buffer.isBuffer(cursorSecret)||cursorSecret.length<32||
  [verifyAccessToken,verifySessionNotRevoked,resolveExclusiveRole,
   allowRequest,mintOwnerTicket,executeScopedTicket,now].some(f=>typeof f!=='function'))
  throw Error('G56B requires isolated Driver QA and separate trusted authorities');
 const secret=Buffer.from(cursorSecret);
 return Object.freeze({async handle(req){
  if(!exact(req,['bearer','cursor','limit'])||
   typeof req.bearer!=='string'||req.bearer.length<20||
   req.bearer.length>8192||!(req.cursor===null||typeof req.cursor==='string')||
   !Number.isSafeInteger(req.limit)||req.limit<1||req.limit>100)
   return fail(400,'INVALID_DRIVER_INBOX_REQUEST');
  const started=now();
  if(!safe(started))return fail(503,'CLOCK_UNAVAILABLE');
  let actor;
  try{actor=await verifyAccessToken(req.bearer);}
  catch{return fail(401,'UNVERIFIED_JWT');}
  if(!plain(actor)||!id(actor.id)||!id(actor.sessionId)||
   !safe(actor.tokenIatMs)||actor.tokenIatMs>started||
   !safe(actor.expiresAtMs)||actor.expiresAtMs<=started||
   actor.is_anonymous===true)return fail(401,'UNVERIFIED_JWT');
  try{
   if(await verifySessionNotRevoked({userId:actor.id,sessionId:actor.sessionId,at:started})!==true)
    return fail(401,'REVOKED_SESSION');
  }catch{return fail(503,'PROVIDER_UNAVAILABLE');}
  let role;
  try{role=await resolveExclusiveRole(actor.id);}
  catch{return fail(503,'ROLE_UNAVAILABLE');}
  if(role!=='driver')return fail(403,'EXCLUSIVE_DRIVER_REQUIRED');
  const scope={driverId:actor.id,sessionId:actor.sessionId,tokenIatMs:actor.tokenIatMs};
  const position=req.cursor===null?null:decode(secret,req.cursor,scope,started);
  if(req.cursor!==null&&!position)return fail(409,'STALE_OR_FOREIGN_DRIVER_INBOX_CURSOR');
  try{
   if(allowRequest({actorId:actor.id,operation:'DRIVER_INBOX'})!==true)
    return fail(429,'DRIVER_INBOX_RATE_LIMIT');
  }catch{return fail(503,'LIMITER_UNAVAILABLE');}
  let cap;
  try{cap=await mintOwnerTicket({operation:'DRIVER_INBOX',
   actorId:actor.id,sessionId:actor.sessionId,tokenIatMs:actor.tokenIatMs});}
  catch{return fail(503,'SCOPED_MINT_UNAVAILABLE');}
  const afterMint=now();
  if(!safe(afterMint)||afterMint<started||actor.expiresAtMs<=afterMint||
   !exact(cap,TICKET)||!id(cap.ticket)||cap.operation!=='DRIVER_INBOX'||
   cap.qaOnly!==true||cap.productionEnabled!==false||
   !safe(cap.expiresAtMs)||cap.expiresAtMs<=afterMint||
   cap.expiresAtMs>afterMint+20000)
   return fail(503,'UNTRUSTED_INBOX_CAPABILITY');
  let answer;
  try{
   answer=await executeScopedTicket({operation:'DRIVER_INBOX',ticket:cap.ticket,
    expectedRevision:position?.revision??null,
    beforeMs:position?.beforeMs??null,beforeId:position?.beforeId??null,
    limit:req.limit});
  }catch{return fail(503,'SCOPED_INBOX_UNAVAILABLE');}
  const done=now();
  if(!safe(done)||done<afterMint)return fail(503,'CLOCK_UNAVAILABLE');
  if(done>=actor.expiresAtMs)return fail(401,'SESSION_EXPIRED');
  if(!plain(answer))return fail(503,'SCOPED_INBOX_UNAVAILABLE');
  if(answer.error){
   const code=answer.error.code;
   return fail(code==='G5611'?401:code==='G5613'?403:
    ['G5615','G5619'].includes(code)?409:
    code==='G5612'?400:503,'DRIVER_INBOX_DENIED');
  }
  if(!trusted(answer.data,actor.id,req.limit,done,position))
   return fail(503,'UNTRUSTED_DRIVER_INBOX');
  const row=answer.data;
  const until=Math.min(row.expiresAt,actor.expiresAtMs,done+60000);
  if(until<=done)return fail(401,'SESSION_EXPIRED');
  const nextCursor=row.hasMore?encode(secret,scope,row.revision,row.nextPosition,until):null;
  return Object.freeze({status:200,body:Object.freeze({
   ownerId:actor.id,revision:row.revision,generatedAt:row.generatedAt,
   expiresAt:until,items:row.items,nextCursor,
   productionEnabled:false,qaOnly:true
  })});
 }});
}

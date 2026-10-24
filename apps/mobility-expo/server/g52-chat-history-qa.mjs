/**
 * QORE G52 A33: QA-only signed message history gateway for Cliente B R13.
 * Provider token, exclusive Passenger role, G42 session and assignment
 * must all be independently validated. Owner-only RPC never mounted HTTP.
 */
import {createHmac,timingSafeEqual} from 'node:crypto';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN=/^[A-Za-z0-9_-]{40,340}\.[A-Za-z0-9_-]{43}$/;
const id=x=>typeof x==='string'&&UUID.test(x);
const safe=x=>Number.isSafeInteger(x)&&x>=0;
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const exact=(o,n)=>plain(o)&&Object.keys(o).length===n.length&&n.every(k=>Object.hasOwn(o,k));
const fail=(status,code)=>Object.freeze({status,body:Object.freeze({code,qaOnly:true})});
const SQL=['conversationId','serviceId','serviceKind','ownerId','counterpartRole',
 'assignmentVerified','state','revision','generatedAt','expiresAt',
 'messages','hasMore','nextPosition','canSend','productionEnabled','qaOnly'];
const ROW=['messageId','senderRole','body','createdAt','revision'];
const OPEN=['conversationId','serviceKind','serviceId','serverStored','qaOnly'];
const contentOk=body=>typeof body==='string'&&body.length>=1&&body.length<=500&&
 body===body.trim()&&!/[\u0000-\u001f\u007f<>\u202a-\u202e\u2066-\u2069\u200e\u200f]/u.test(body)&&
 !/https?:\/\/|www\./iu.test(body)&&
 !/[\w.+-]+@[\w.-]+\.[a-z]{2,}/iu.test(body)&&
 !/(?:\+?\d[\s().-]*){7,}/u.test(body);
function validatePage(x,{serviceKind,serviceId,actor,conversation,limit,at}){
 if(!exact(x,SQL)||!id(x.conversationId)||x.conversationId!==conversation||
  x.serviceKind!==serviceKind||x.serviceId!==serviceId||x.ownerId!==actor||
  x.counterpartRole!=='driver'||x.assignmentVerified!==true||
  x.state!=='ACTIVE'||x.canSend!==true||x.productionEnabled!==false||
  x.qaOnly!==true||!safe(x.revision)||x.revision<1||
  !safe(x.generatedAt)||x.generatedAt>at||x.generatedAt<at-300000||
  !safe(x.expiresAt)||x.expiresAt<=at||x.expiresAt>at+300000||
  !Array.isArray(x.messages)||x.messages.length>limit||
  typeof x.hasMore!=='boolean'||(x.messages.length===0&&x.hasMore))
  return false;
 const seen=new Set();
 for(let i=0;i<x.messages.length;i++){
  const m=x.messages[i];
  if(!exact(m,ROW)||!id(m.messageId)||
   !['passenger','driver'].includes(m.senderRole)||
   !contentOk(m.body)||!safe(m.createdAt)||m.createdAt>at||
   !safe(m.revision)||m.revision<2||m.revision>x.revision||
   seen.has(m.messageId)||
   (i>0&&m.createdAt>x.messages[i-1].createdAt))return false;
  seen.add(m.messageId);
 }
 if(x.hasMore)return x.messages.length===limit&&
  exact(x.nextPosition,['beforeSeq'])&&safe(x.nextPosition.beforeSeq)&&
  x.nextPosition.beforeSeq>0;
 return x.nextPosition===null;
}
function createCodec(secret){
 if(!Buffer.isBuffer(secret)||secret.length<32)throw Error('G52 requires 32 random key bytes');
 const key=Buffer.from(secret);
 const sign=s=>createHmac('sha256',key).update(s).digest('base64url');
 return Object.freeze({
  encode(values){const body=Buffer.from(JSON.stringify(values)).toString('base64url');
   const token=body+'.'+sign(body);
   if(token.length>384)throw Error('G52 cursor exceeds B contract');
   return token;
  },
  decode(token,actor,session,iat,kind,service,at){
   if(typeof token!=='string'||token.length>384||!TOKEN.test(token))throw Error('INVALID_CURSOR');
   const [body,mac]=token.split('.');
   if(Buffer.from(body,'base64url').toString('base64url')!==body||
    Buffer.from(mac,'base64url').toString('base64url')!==mac)throw Error('INVALID_CURSOR');
   const actual=Buffer.from(mac,'base64url'),expected=Buffer.from(sign(body),'base64url');
   if(actual.length!==expected.length||!timingSafeEqual(actual,expected))
    throw Error('INVALID_CURSOR');
   const raw=Buffer.from(body,'base64url').toString('utf8');
   const v=JSON.parse(raw);
   if(!Array.isArray(v)||v.length!==10||v[0]!==1||
    v[1]!==actor||v[2]!==session||v[3]!==iat||
    v[4]!==kind||v[5]!==service||!id(v[6])||
    !safe(v[7])||v[7]<1||!safe(v[8])||v[8]<1||
    !safe(v[9])||v[9]<=at||v[9]>at+300000||
    JSON.stringify(v)!==raw)throw Error('INVALID_CURSOR');
   return {conversationId:v[6],revision:v[7],beforeSeq:v[8]};
  }
 });
}
export function createG52ChatHistoryQa({
 environment,localQaOnly,liveEnabled,cursorSecret,verifyAccessToken,
 verifySessionNotRevoked,resolveExclusiveRole,allowRequest,rpc,now=Date.now
}={}){
 if(environment!=='isolated_staging'||localQaOnly!==true||liveEnabled!==false||
  [verifyAccessToken,verifySessionNotRevoked,resolveExclusiveRole,
   allowRequest,rpc,now].some(x=>typeof x!=='function'))
  throw Error('G52 requires isolated QA and trusted actor sources');
 const codec=createCodec(cursorSecret);
 return Object.freeze({async handle(req){
  if(!exact(req,['bearer','serviceKind','serviceId','cursor',
   'limit','expectedConversationId'])||
   typeof req.bearer!=='string'||req.bearer.length<20||req.bearer.length>8192||
   !['RIDE','DELIVERY','MERCHANT_ORDER'].includes(req.serviceKind)||
   !id(req.serviceId)||!(req.cursor===null||typeof req.cursor==='string')||
   !(req.expectedConversationId===null||id(req.expectedConversationId))||
   !Number.isSafeInteger(req.limit)||req.limit<1||req.limit>100)
   return fail(400,'INVALID_HISTORY_REQUEST');
  const started=now();
  if(!safe(started))return fail(503,'CLOCK_UNAVAILABLE');
  let identity;
  try{identity=await verifyAccessToken(req.bearer);}catch{return fail(401,'UNVERIFIED_JWT');}
  if(!plain(identity)||!id(identity.id)||!id(identity.sessionId)||
   !safe(identity.tokenIatMs)||identity.tokenIatMs>started||
   !safe(identity.expiresAtMs)||identity.expiresAtMs<=started||
   identity.is_anonymous===true)return fail(401,'UNVERIFIED_JWT');
  try{
   if(await verifySessionNotRevoked({userId:identity.id,
    sessionId:identity.sessionId,at:started})!==true)return fail(401,'SESSION_REVOKED');
  }catch{return fail(503,'PROVIDER_UNAVAILABLE');}
  let role;
  try{role=await resolveExclusiveRole(identity.id);}catch{return fail(503,'ROLE_UNAVAILABLE');}
  if(role!=='passenger')return fail(403,'PASSENGER_ONLY');
  let cursor=null;
  try{
   if(req.cursor!==null)cursor=codec.decode(req.cursor,identity.id,
    identity.sessionId,identity.tokenIatMs,req.serviceKind,req.serviceId,started);
  }catch{return fail(400,'INVALID_OR_EXPIRED_HISTORY_CURSOR');}
  if(cursor&&req.expectedConversationId&&
   cursor.conversationId!==req.expectedConversationId)
   return fail(409,'CONVERSATION_PIN_MISMATCH');
  try{
   if(allowRequest({userId:identity.id,operation:'CHAT_HISTORY'})!==true)
    return fail(429,'HISTORY_RATE_LIMIT');
  }catch{return fail(503,'LIMITER_UNAVAILABLE');}
  let conversation=cursor?.conversationId;
  if(!conversation){
   let opened;
   try{
    opened=await rpc('mobility_stage_g50_open_owner_qa',{
     _kind:req.serviceKind,_service:req.serviceId,_actor:identity.id,
     _session:identity.sessionId,_iat:identity.tokenIatMs
    });
   }catch{return fail(503,'CHAT_STORAGE_UNAVAILABLE');}
   if(opened?.error)return fail(opened.error.code==='G5001'?401:
    opened.error.code==='G5003'?403:opened.error.code==='G5004'?409:503,
    'CHAT_OPEN_DENIED');
   const o=opened?.data;
   if(!exact(o,OPEN)||!id(o.conversationId)||
    o.serviceKind!==req.serviceKind||o.serviceId!==req.serviceId||
    o.serverStored!==true||o.qaOnly!==true)return fail(503,'CHAT_OPEN_UNTRUSTED');
   conversation=o.conversationId;
   if(req.expectedConversationId&&conversation!==req.expectedConversationId)
    return fail(409,'CONVERSATION_ROTATED');
  }
  let result;
  try{
   result=await rpc('mobility_stage_g52_history_owner_qa',{
    _conversation:conversation,_actor:identity.id,_session:identity.sessionId,
    _iat:identity.tokenIatMs,_expected_revision:cursor?.revision??null,
    _before_seq:cursor?.beforeSeq??null,_limit:req.limit
   });
  }catch{return fail(503,'CHAT_STORAGE_UNAVAILABLE');}
  if(result?.error){
   return fail(result.error.code==='G5001'?401:
    ['G5003','G5203'].includes(result.error.code)?403:
    ['G5004','G5204','G5209'].includes(result.error.code)?409:
    result.error.code==='G5202'?400:503,
    result.error.code==='G5209'?'HISTORY_REVISION_CHANGED':'CHAT_HISTORY_DENIED');
  }
  const completed=now(),x=result?.data;
  if(!safe(completed)||completed<started)return fail(503,'CLOCK_UNAVAILABLE');
  if(!validatePage(x,{serviceKind:req.serviceKind,serviceId:req.serviceId,
   actor:identity.id,conversation,limit:req.limit,at:completed})||
   (cursor&&x.revision!==cursor.revision))
   return fail(503,'UNTRUSTED_HISTORY_RECEIPT');
  const expiry=Math.min(x.expiresAt,identity.expiresAtMs);
  if(expiry<=completed)return fail(401,'SESSION_EXPIRED');
  let nextCursor=null;
  try{
   if(x.hasMore)nextCursor=codec.encode([1,identity.id,identity.sessionId,
    identity.tokenIatMs,req.serviceKind,req.serviceId,conversation,
    x.revision,x.nextPosition.beforeSeq,expiry]);
  }catch{return fail(503,'CURSOR_ENCODING_FAILURE');}
  return Object.freeze({status:200,body:Object.freeze({
   conversationId:conversation,serviceId:req.serviceId,serviceKind:req.serviceKind,
   ownerId:identity.id,counterpartRole:'driver',assignmentVerified:true,
   state:'ACTIVE',revision:x.revision,generatedAt:x.generatedAt,
   expiresAt:expiry,messages:x.messages,nextCursor,
   canSend:true,productionEnabled:false
  })});
 }});
}

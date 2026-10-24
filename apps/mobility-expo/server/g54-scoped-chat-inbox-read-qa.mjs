/**
 * G54 / A36: Passenger inbox and read receipts through one-use NOLOGIN
 * delegated SQL only. All callbacks are isolated synthetic QA sources.
 * No HTTP/remote Auth/real SQL identity is configured here.
 */
import {createG51ChatInboxQa} from './g51-chat-inbox-qa.mjs';
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid=x=>typeof x==='string'&&ID.test(x);
const safe=x=>Number.isSafeInteger(x)&&x>=0;
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 Object.getPrototypeOf(x)===Object.prototype;
const exact=(v,fields)=>plain(v)&&Object.keys(v).length===fields.length&&
 fields.every(field=>Object.hasOwn(v,field));
const denied=(status,code)=>Object.freeze({status,body:Object.freeze({code,qaOnly:true})});
const TICKET=['ticket','operation','expiresAtMs','productionEnabled','qaOnly'];
const READ=['conversationId','readThrough','qaOnly'];
function validTicket(v,operation,at){
 return exact(v,TICKET)&&uuid(v.ticket)&&v.operation===operation&&
  v.productionEnabled===false&&v.qaOnly===true&&safe(v.expiresAtMs)&&
  v.expiresAtMs>at&&v.expiresAtMs<=at+20000;
}
function validateOptions(x){
 if(x.environment!=='isolated_staging'||x.localQaOnly!==true||
  x.liveEnabled!==false||[
   x.verifyAccessToken,x.verifySessionNotRevoked,x.resolveExclusiveRole,
   x.allowRequest,x.mintOwnerTicket,x.executeScopedTicket,x.now
  ].some(f=>typeof f!=='function'))
  throw Error('G54 requires isolated trusted identity and one-use SQL authority');
}
/**
 * Reuse existing G51 HMAC pagination, B DTO validation and JWT/session gates.
 * The only SQL RPC name allowed is translated to G54 minted capability.
 */
export function createG54ScopedInboxQa({
 environment,localQaOnly,liveEnabled,cursorSecret,verifyAccessToken,
 verifySessionNotRevoked,resolveExclusiveRole,allowRequest,
 mintOwnerTicket,executeScopedTicket,now=Date.now
}={}){
 const cfg={environment,localQaOnly,liveEnabled,verifyAccessToken,
  verifySessionNotRevoked,resolveExclusiveRole,allowRequest,
  mintOwnerTicket,executeScopedTicket,now};
 validateOptions(cfg);
 return createG51ChatInboxQa({
  ...cfg,cursorSecret,
  rpc:async(name,args)=>{
   if(name!=='mobility_stage_g51_passenger_inbox_owner_qa'||
    !exact(args,['_actor','_session','_iat','_expected_revision',
     '_before_ms','_before_id','_limit'])||
    !uuid(args._actor)||!uuid(args._session)||!safe(args._iat))
    throw Error('G54 refuses owner SQL outside scoped inbox');
   const minted=await mintOwnerTicket({
    operation:'CHAT_INBOX',actorId:args._actor,sessionId:args._session,
    tokenIatMs:args._iat,conversationId:null
   });
   if(!validTicket(minted,'CHAT_INBOX',now()))
    throw Error('G54 invalid minted inbox ticket');
   // Delegated principal sees only opaque UUID and pagination, never actor.
   return executeScopedTicket({operation:'CHAT_INBOX',ticket:minted.ticket,
    expectedRevision:args._expected_revision,beforeMs:args._before_ms,
    beforeId:args._before_id,limit:args._limit});
  }
 });
}
/** G54 Passenger-only markRead, exact inputs, never use a caller actor UUID. */
export function createG54ScopedReadReceiptQa({
 environment,localQaOnly,liveEnabled,verifyAccessToken,
 verifySessionNotRevoked,resolveExclusiveRole,allowRequest,
 mintOwnerTicket,executeScopedTicket,now=Date.now
}={}){
 validateOptions({environment,localQaOnly,liveEnabled,verifyAccessToken,
  verifySessionNotRevoked,resolveExclusiveRole,allowRequest,
  mintOwnerTicket,executeScopedTicket,now});
 return Object.freeze({async handle(req){
  if(!exact(req,['bearer','conversationId','throughSeq'])||
   typeof req.bearer!=='string'||req.bearer.length<20||req.bearer.length>8192||
   !uuid(req.conversationId)||!safe(req.throughSeq))
   return denied(400,'INVALID_READ_RECEIPT');
  const started=now();
  if(!safe(started))return denied(503,'CLOCK_UNAVAILABLE');
  let actor;
  try{actor=await verifyAccessToken(req.bearer);}
  catch{return denied(401,'UNVERIFIED_JWT');}
  if(!plain(actor)||!uuid(actor.id)||!uuid(actor.sessionId)||
   !safe(actor.tokenIatMs)||actor.tokenIatMs>started||
   !safe(actor.expiresAtMs)||actor.expiresAtMs<=started||
   actor.is_anonymous===true)return denied(401,'UNVERIFIED_JWT');
  try{
   if(await verifySessionNotRevoked({
    userId:actor.id,sessionId:actor.sessionId,at:started})!==true)
    return denied(401,'REVOKED_SESSION');
  }catch{return denied(503,'PROVIDER_UNAVAILABLE');}
  let role;
  try{role=await resolveExclusiveRole(actor.id);}
  catch{return denied(503,'ROLE_UNAVAILABLE');}
  if(role!=='passenger')return denied(403,'PASSENGER_ONLY');
  try{
   if(allowRequest({actorId:actor.id,operation:'CHAT_READ'})!==true)
    return denied(429,'READ_RATE_LIMITED');
  }catch{return denied(503,'LIMITER_UNAVAILABLE');}
  let ticket;
  try{ticket=await mintOwnerTicket({
   operation:'CHAT_READ',actorId:actor.id,sessionId:actor.sessionId,
   tokenIatMs:actor.tokenIatMs,conversationId:req.conversationId
  });}catch{return denied(503,'TICKET_MINT_UNAVAILABLE');}
  const afterMint=now();
  if(!safe(afterMint)||afterMint<started||
   !validTicket(ticket,'CHAT_READ',afterMint))
   return denied(503,'INVALID_SCOPED_TICKET');
  if(actor.expiresAtMs<=afterMint)return denied(401,'SESSION_EXPIRED');
  let receipt;
  try{receipt=await executeScopedTicket({
   operation:'CHAT_READ',ticket:ticket.ticket,throughSeq:req.throughSeq
  });}catch{return denied(503,'SCOPED_READ_DB_UNAVAILABLE');}
  const completed=now();
  if(!safe(completed)||completed<afterMint)return denied(503,'CLOCK_UNAVAILABLE');
  if(actor.expiresAtMs<=completed)return denied(401,'SESSION_EXPIRED');
  if(!plain(receipt))return denied(503,'SCOPED_READ_DB_UNAVAILABLE');
  if(receipt.error){
   const code=receipt.error.code;
   return denied(['G5401','G5001'].includes(code)?401:
    ['G5403','G5003'].includes(code)?403:
    ['G5404','G5004','G5405'].includes(code)?409:
    ['G5402','G5102'].includes(code)?400:503,
   code==='G5102'?'WATERMARK_AHEAD':'SCOPED_READ_DENIED');
  }
  const out=receipt.data;
  if(!exact(out,READ)||out.conversationId!==req.conversationId||
   !safe(out.readThrough)||out.readThrough<req.throughSeq||out.qaOnly!==true)
   return denied(503,'UNTRUSTED_READ_RECEIPT');
  return Object.freeze({status:200,body:Object.freeze({...out})});
 }});
}

/**
 * G50 A31: PRIVATE chat QA-only server adapter. Not an HTTPS/runtime endpoint.
 * Actor, role and session from verified providers/DB; never from client body.
 * Every SQL operation must hold G42 session lock and validate assignment within
 * the same DB transaction. The injected owner RPC is allowed ONLY in QA.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid=x=>typeof x==='string'&&UUID.test(x);
const safe=n=>Number.isSafeInteger(n)&&n>=0;
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const exact=(o,keys)=>plain(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
const response=(status,code)=>({status,body:{code,qaOnly:true}});
const OPEN=['conversationId','serviceKind','serviceId','serverStored','qaOnly'];
const SENT=['conversationId','messageId','seq','senderId','body','createdAt','serverStored','qaOnly'];
const PAGE=['conversationId','messages','nextAfter','hasMore','qaOnly'];
const MSG=['messageId','seq','senderId','body','createdAt','serverStored'];
const validMessage=x=>exact(x,MSG)&&uuid(x.messageId)&&uuid(x.senderId)&&safe(x.seq)&&x.seq>0&&
 typeof x.body==='string'&&x.body.length>=1&&x.body.length<=2000&&
 typeof x.createdAt==='string'&&!Number.isNaN(Date.parse(x.createdAt))&&x.serverStored===true;
function validReceipt(operation,x,request,actorId){
 if(operation==='OPEN')return exact(x,OPEN)&&uuid(x.conversationId)&&x.serviceKind===request.serviceKind&&
  x.serviceId===request.serviceId&&x.serverStored===true&&x.qaOnly===true;
 if(operation==='SEND')return exact(x,SENT)&&uuid(x.conversationId)&&
  x.conversationId===request.conversationId&&uuid(x.messageId)&&
  x.senderId===actorId&&safe(x.seq)&&x.seq>0&&x.body===request.body&&
  typeof x.createdAt==='string'&&!Number.isNaN(Date.parse(x.createdAt))&&
  x.serverStored===true&&x.qaOnly===true;
 return exact(x,PAGE)&&x.conversationId===request.conversationId&&
  Array.isArray(x.messages)&&x.messages.length<=request.limit&&
  x.messages.every(validMessage)&&x.messages.every((m,i)=>m.seq>request.after&&
   (i===0||m.seq>x.messages[i-1].seq))&&
  safe(x.nextAfter)&&x.nextAfter===(x.messages.at(-1)?.seq??request.after)&&
  typeof x.hasMore==='boolean'&&x.qaOnly===true;
}
export function createG50PrivateChatQa({
 environment,localQaOnly,liveEnabled,verifyAccessToken,
 verifySessionNotRevoked,resolveExclusiveRole,allowRequest,rpc,now=Date.now
}={}){
 if(environment!=='isolated_staging'||localQaOnly!==true||liveEnabled!==false||
  [verifyAccessToken,verifySessionNotRevoked,resolveExclusiveRole,allowRequest,rpc,now]
   .some(x=>typeof x!=='function'))throw Error('G50 QA-only trust sources required');
 return Object.freeze({async handle(request){
  if(!plain(request)||typeof request.bearer!=='string'||request.bearer.length<20||
   request.bearer.length>8192||!['OPEN','SEND','PAGE'].includes(request.operation))
   return response(400,'INVALID_REQUEST');
  const {operation}=request;
  let args;
  if(operation==='OPEN'){
   if(!exact(request,['bearer','operation','serviceKind','serviceId'])||
    !['RIDE','DELIVERY'].includes(request.serviceKind)||!uuid(request.serviceId))
    return response(400,'INVALID_OPEN');
   args={_kind:request.serviceKind,_service:request.serviceId};
  }else if(operation==='SEND'){
   if(!exact(request,['bearer','operation','conversationId','requestKey','body'])||
    !uuid(request.conversationId)||!uuid(request.requestKey)||
    typeof request.body!=='string'||request.body.trim()===''||
    request.body.length>2000||request.body.length<1||
    Buffer.byteLength(request.body,'utf8')>8000)
    return response(400,'INVALID_MESSAGE');
   args={_conversation:request.conversationId,
    _request:request.requestKey,_body:request.body};
  }else{
   if(!exact(request,['bearer','operation','conversationId','after','limit'])||
    !uuid(request.conversationId)||!safe(request.after)||
    !Number.isSafeInteger(request.limit)||request.limit<1||request.limit>100)
    return response(400,'INVALID_PAGE');
   args={_conversation:request.conversationId,_after:request.after,_limit:request.limit};
  }
  let identity;
  try{identity=await verifyAccessToken(request.bearer);}catch{return response(401,'UNVERIFIED_SESSION');}
  const at=now();
  if(!plain(identity)||!uuid(identity.id)||!uuid(identity.sessionId)||
   !safe(identity.tokenIatMs)||!safe(identity.expiresAtMs)||
   !safe(at)||identity.tokenIatMs>at||identity.expiresAtMs<=at||
   identity.is_anonymous===true)
   return response(401,'UNVERIFIED_SESSION');
  try{
   if(await verifySessionNotRevoked({userId:identity.id,
    sessionId:identity.sessionId,at})!==true)
    return response(401,'REVOKED_SESSION');
  }catch{return response(503,'PROVIDER_UNAVAILABLE');}
  let role;
  try{role=await resolveExclusiveRole(identity.id);}catch{return response(503,'ROLE_AUTHORITY_UNAVAILABLE');}
  if(!['driver','passenger'].includes(role))return response(403,'ROLE_DENIED');
  try{
   if(allowRequest({userId:identity.id,operation})!==true)return response(429,'CHAT_RATE_LIMIT');
  }catch{return response(503,'LIMITER_UNAVAILABLE');}
  const names={OPEN:'mobility_stage_g50_open_owner_qa',
   SEND:'mobility_stage_g50_send_owner_qa',
   PAGE:'mobility_stage_g50_page_owner_qa'};
  let result;
  try{
   result=await rpc(names[operation],{...args,_actor:identity.id,
    _session:identity.sessionId,_iat:identity.tokenIatMs});
  }catch{return response(503,'CHAT_STORAGE_UNAVAILABLE');}
  if(!plain(result))return response(503,'CHAT_STORAGE_UNAVAILABLE');
  if(result.error){
   const code=result.error.code;
   return response(code==='G5001'?401:code==='G5003'?403:
    code==='G5004'?409:code==='G5009'?409:
    code==='G5002'?400:503,'CHAT_'+String(code||'DB_ERROR').slice(0,20));
  }
  if(!validReceipt(operation,result.data,request,identity.id))
   return response(503,'CHAT_RECEIPT_UNTRUSTED');
  return {status:200,body:Object.freeze({...result.data})};
 }});
}

/**
 * G51 A32 — HMAC-bound private Passenger chat inbox, QA-only.
 * Tokens bind actor+session+token iat+DB revision+keyset+expiry.
 * The SQL owner-only functions are NEVER exposed as HTTP endpoints.
 */
import {createHmac,timingSafeEqual} from 'node:crypto';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid=x=>typeof x==='string'&&UUID.test(x);
const integer=x=>Number.isSafeInteger(x)&&x>=0;
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const exact=(o,k)=>plain(o)&&Object.keys(o).length===k.length&&k.every(x=>Object.hasOwn(o,x));
const ROW=['conversationId','serviceId','serviceKind','state','assignmentVerified',
 'counterpartRole','revision','unreadCount','updatedAt','canSend'];
const SQL=['ownerId','generatedAt','expiresAt','revision','items','hasMore','nextPosition','productionEnabled','qaOnly'];
const CURSOR=/^[A-Za-z0-9_-]{40,320}\.[A-Za-z0-9_-]{43}$/;
const error=(status,code)=>Object.freeze({status,body:Object.freeze({code,qaOnly:true})});
const older=(a,b)=>a.updatedAt<b.updatedAt||(a.updatedAt===b.updatedAt&&
 a.conversationId<b.conversationId);
function validateDb(value,actor,at,limit){
 if(!exact(value,SQL)||value.ownerId!==actor||!integer(value.generatedAt)||
  !integer(value.expiresAt)||value.generatedAt>at||value.generatedAt<at-300000||
  value.expiresAt<=at||value.expiresAt>at+300000||
  !integer(value.revision)||value.revision<1||
  !Array.isArray(value.items)||value.items.length>limit||
  typeof value.hasMore!=='boolean'||value.productionEnabled!==false||
  value.qaOnly!==true)return false;
 const seen=new Set(),services=new Set();
 for(let i=0;i<value.items.length;i++){
  const row=value.items[i];
  if(!exact(row,ROW)||!uuid(row.conversationId)||!uuid(row.serviceId)||
   !['RIDE','DELIVERY','MERCHANT_ORDER'].includes(row.serviceKind)||
   row.state!=='ACTIVE'||row.assignmentVerified!==true||
   row.counterpartRole!=='driver'||row.canSend!==true||
   !integer(row.revision)||row.revision<1||row.revision>value.revision||
   !integer(row.unreadCount)||!integer(row.updatedAt)||row.updatedAt>at||
   seen.has(row.conversationId)||
   services.has(row.serviceKind+':'+row.serviceId)||
   (i>0&&!older(row,value.items[i-1])))return false;
  seen.add(row.conversationId);services.add(row.serviceKind+':'+row.serviceId);
 }
 if(value.hasMore){
  const last=value.items.at(-1);
  return !!last&&exact(value.nextPosition,['updatedAt','conversationId'])&&
   value.nextPosition.updatedAt===last.updatedAt&&
   value.nextPosition.conversationId===last.conversationId;
 }
 return value.nextPosition===null;
}
function makeCodec(secret){
 if(!Buffer.isBuffer(secret)||secret.length<32)throw Error('G51 HMAC secret must be >=32 random bytes');
 const key=Buffer.from(secret);
 const sign=body=>createHmac('sha256',key).update(body).digest('base64url');
 return Object.freeze({
  encode(fields){
   const body=Buffer.from(JSON.stringify(fields)).toString('base64url');
   return body+'.'+sign(body);
  },
  decode(cursor,actor,session,iat,now){
   if(typeof cursor!=='string'||!CURSOR.test(cursor))throw Error('BAD_CURSOR');
   const [body,mac]=cursor.split('.');
   const expected=Buffer.from(sign(body),'base64url');
   const actual=Buffer.from(mac,'base64url');
   if(actual.length!==expected.length||!timingSafeEqual(actual,expected))
    throw Error('BAD_CURSOR');
   const decoded=Buffer.from(body,'base64url');
   if(decoded.toString('base64url')!==body)throw Error('BAD_CURSOR');
   const v=JSON.parse(decoded.toString('utf8'));
   if(!Array.isArray(v)||v.length!==8||v[0]!==1||v[1]!==actor||
    v[2]!==session||v[3]!==iat||!integer(v[4])||v[4]<1||
    !integer(v[5])||!uuid(v[6])||!integer(v[7])||
    v[7]<=now||v[7]>now+300000)throw Error('BAD_CURSOR');
   return {revision:v[4],beforeMs:v[5],beforeId:v[6]};
  }
 });
}
export function createG51ChatInboxQa({
 environment,localQaOnly,liveEnabled,cursorSecret,verifyAccessToken,
 verifySessionNotRevoked,resolveExclusiveRole,allowRequest,rpc,now=Date.now
}={}){
 if(environment!=='isolated_staging'||localQaOnly!==true||liveEnabled!==false||
  [verifyAccessToken,verifySessionNotRevoked,resolveExclusiveRole,allowRequest,rpc,now]
   .some(x=>typeof x!=='function'))throw Error('G51 requires complete isolated QA identity');
 const codec=makeCodec(cursorSecret);
 return Object.freeze({async handle(req){
  if(!exact(req,['bearer','cursor','limit'])||typeof req.bearer!=='string'||
   req.bearer.length<20||req.bearer.length>8192||
   !(req.cursor===null||typeof req.cursor==='string')||
   !Number.isSafeInteger(req.limit)||req.limit<1||req.limit>100)
   return error(400,'INVALID_INBOX_REQUEST');
  const at=now();
  if(!integer(at))return error(503,'CLOCK_UNAVAILABLE');
  let identity;
  try{identity=await verifyAccessToken(req.bearer);}
  catch{return error(401,'UNVERIFIED_JWT');}
  if(!plain(identity)||!uuid(identity.id)||!uuid(identity.sessionId)||
   !integer(identity.tokenIatMs)||identity.tokenIatMs>at||
   !integer(identity.expiresAtMs)||identity.expiresAtMs<=at||
   identity.is_anonymous===true)return error(401,'UNVERIFIED_JWT');
  try{
   if(await verifySessionNotRevoked({userId:identity.id,
    sessionId:identity.sessionId,at})!==true)return error(401,'REVOKED_SESSION');
  }catch{return error(503,'PROVIDER_UNAVAILABLE');}
  let role;
  try{role=await resolveExclusiveRole(identity.id);}
  catch{return error(503,'ROLE_AUTHORITY_UNAVAILABLE');}
  if(role!=='passenger')return error(403,'PASSENGER_REQUIRED');
  let position=null;
  try{
   if(req.cursor!==null)position=codec.decode(req.cursor,identity.id,
    identity.sessionId,identity.tokenIatMs,at);
  }catch{return error(400,'CURSOR_EXPIRED_OR_INVALID');}
  try{
   if(allowRequest({actorId:identity.id,operation:'CHAT_INBOX'})!==true)
    return error(429,'INBOX_RATE_LIMIT');
  }catch{return error(503,'LIMITER_UNAVAILABLE');}
  let res;
  try{
   res=await rpc('mobility_stage_g51_passenger_inbox_owner_qa',{
    _actor:identity.id,_session:identity.sessionId,_iat:identity.tokenIatMs,
    _expected_revision:position?.revision??null,
    _before_ms:position?.beforeMs??null,_before_id:position?.beforeId??null,
    _limit:req.limit
   });
  }catch{return error(503,'CHAT_DB_UNAVAILABLE');}
  if(!plain(res))return error(503,'CHAT_DB_UNAVAILABLE');
  if(res.error){
   return error(res.error.code==='G5101'?401:
    res.error.code==='G5103'?403:
    res.error.code==='G5109'?409:
    res.error.code==='G5102'?400:503,
    res.error.code==='G5109'?'INBOX_REVISION_CHANGED':'INBOX_ACCESS_DENIED');
  }
  const data=res.data;
  if(!validateDb(data,identity.id,at,req.limit)||
   (position!==null&&data.revision!==position.revision)||
   (position!==null&&data.items.some(item=>!older(item,{
    updatedAt:position.beforeMs,conversationId:position.beforeId}))))
   return error(503,'UNTRUSTED_INBOX_RECEIPT');
  const nextCursor=data.hasMore?codec.encode([1,identity.id,identity.sessionId,
   identity.tokenIatMs,data.revision,data.nextPosition.updatedAt,
   data.nextPosition.conversationId,Math.min(data.expiresAt,identity.expiresAtMs)]):null;
  return Object.freeze({status:200,body:Object.freeze({
   ownerId:data.ownerId,generatedAt:data.generatedAt,expiresAt:data.expiresAt,
   revision:data.revision,items:data.items,nextCursor,productionEnabled:false
  })});
 }});
}

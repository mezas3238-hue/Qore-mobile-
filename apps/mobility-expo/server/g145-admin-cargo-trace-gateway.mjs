/**
 * G145: original, price-consented DELIVERY_AUTO / DELIVERY_MOTO Admin trace.
 * HTTPS frontend remains OFF until external attestation. This QA route reads
 * PostgreSQL source only, with provider-backed Admin revocation and AAL2.
 */
const PATH=/^\/v1\/staging\/admin\/services\/(DELIVERY_AUTO|DELIVERY_MOTO)\/([0-9a-f-]{36})\/trace$/i;
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const ROOT=['mode','viewerId','serviceId','serviceKind','bookingRequestKey',
 'quoteId','status','revision','observedAt','expiresAt','serverPersisted',
 'productionEnabled','assignment','events','ledger'];
const EVT=['eventId','serviceId','sequence','status','at'];
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(o,keys)=>obj(o)&&Object.keys(o).length===keys.length&&
 keys.every(k=>Object.hasOwn(o,k));
const id=x=>typeof x==='string'&&UUID.test(x)&&x===x.toLowerCase();
const time=x=>Number.isSafeInteger(x)&&x>=0;
const deny=(status,code)=>Object.freeze({status,body:Object.freeze({
 code,qaOnly:true,productionEnabled:false
})});
export function createG145AdminCargoTraceGateway({
 environment,qaOnly,liveEnabled,verifyAccessToken,
 verifySessionNotRevoked,loadExclusiveBackofficeRole,
 verifyBackofficeMfa,allowRequest,loadCargoTraceReceipt,now=Date.now
}={}){
 if(environment!=='isolated_staging'||qaOnly!==true||liveEnabled!==false||
  [verifyAccessToken,verifySessionNotRevoked,loadExclusiveBackofficeRole,
   verifyBackofficeMfa,allowRequest,loadCargoTraceReceipt,now]
   .some(f=>typeof f!=='function'))throw Error('G145 verified Admin trust required');
 return async({method,path,headers={},body}={})=>{
  const match=method==='GET'&&typeof path==='string'?PATH.exec(path):null;
  if(!match||!id(match[2].toLowerCase())||body!=null)
   return deny(404,'G145_TRACE_ROUTE_INVALID');
  if(typeof headers.authorization!=='string'||headers.Authorization!==undefined
   ||headers.cookie!==undefined)return deny(401,'G145_ADMIN_BEARER_REQUIRED');
  const token=/^Bearer ([A-Za-z0-9._~-]{20,7900})$/.exec(headers.authorization)?.[1];
  if(!token)return deny(401,'G145_ADMIN_BEARER_REQUIRED');
  const at=now();
  if(!time(at))return deny(503,'G145_CLOCK_UNAVAILABLE');
  let user;
  try{user=await verifyAccessToken(token);}catch{return deny(401,'G145_AUTH_INVALID');}
  if(!obj(user)||!id(user.id??'')||!id(user.sessionId??'')||
   user.is_anonymous!==false||!time(user.expiresAtMs)||user.expiresAtMs<=at)
   return deny(401,'G145_AUTH_INVALID');
  try{
   if(await verifySessionNotRevoked({
    userId:user.id,sessionId:user.sessionId,at})!==true)
    return deny(401,'G145_SESSION_REVOKED');
  }catch{return deny(503,'G145_REVOKE_UNAVAILABLE');}
  let role;
  try{role=await loadExclusiveBackofficeRole(user.id);}
  catch{return deny(503,'G145_ROLE_UNAVAILABLE');}
  if(role!=='admin')return deny(403,'G145_EXCLUSIVE_ADMIN_REQUIRED');
  let mfa;
  try{mfa=await verifyBackofficeMfa({
   token,userId:user.id,sessionId:user.sessionId,requiredLevel:'aal2',at
  });}catch{return deny(503,'G145_MFA_UNAVAILABLE');}
  if(!obj(mfa)||mfa.verifiedByProvider!==true||
   mfa.assuranceLevel!=='aal2'||mfa.userId!==user.id||
   mfa.sessionId!==user.sessionId||!time(mfa.verifiedAtMs)||
   mfa.verifiedAtMs>at||at-mfa.verifiedAtMs>43200000||
   !time(mfa.expiresAtMs)||mfa.expiresAtMs<=at||
   mfa.expiresAtMs>user.expiresAtMs)
   return deny(403,'G145_AAL2_REQUIRED');
  try{
   if(allowRequest({userId:user.id,operation:'admin.cargo.trace.read'})!==true)
    return deny(429,'G145_RATE_LIMIT');
  }catch{return deny(503,'G145_LIMITER_UNAVAILABLE');}
  const kind=match[1].toUpperCase(),deliveryId=match[2].toLowerCase();
  let data;
  try{data=await loadCargoTraceReceipt({actorId:user.id,deliveryId});}
  catch{return deny(503,'G145_SQL_UNAVAILABLE');}
  if(data===null)return deny(404,'G145_PRICE_CONSENTED_SERVICE_NOT_FOUND');
  const clock=now();
  const isCancelled=data?.status==='cancelled';
  const completed=data?.status==='delivered';
  const expectedLength=completed?4:isCancelled?2:1;
  const timeline=completed?['requested','accepted','picked_up','delivered']:
   isCancelled?['requested','cancelled']:['requested'];
  if(!exact(data,ROOT)||data.mode!=='STAGING_DEMO_ONLY'||
   data.productionEnabled!==false||data.serverPersisted!==true||
   data.viewerId!==user.id||data.serviceId!==deliveryId||
   data.serviceKind!==kind||!id(data.bookingRequestKey)||
   !id(data.quoteId)||!['requested','cancelled','delivered'].includes(data.status)||
   data.revision!==expectedLength||!time(data.observedAt)||
   data.observedAt>clock||clock-data.observedAt>30000||
   !time(data.expiresAt)||data.expiresAt<=clock||
   data.expiresAt>clock+60000||
   !exact(data.assignment,['state','legalGate'])||
   (completed?(data.assignment.state!=='QA_COMPLETED'||
    data.assignment.legalGate!=='EXTERNAL_NOT_CERTIFIED'):
    (data.assignment.state!=='NOT_ASSIGNABLE'||
     data.assignment.legalGate!=='G38_BLOCKED'))||data.ledger!==null||
   !Array.isArray(data.events)||data.events.length!==expectedLength||
   data.events.some((e,i)=>!exact(e,EVT)||!id(e.eventId)||
    e.serviceId!==deliveryId||e.sequence!==i+1||
    e.status!==timeline[i]||!time(e.at)||
    e.at>data.observedAt||i>0&&e.at<data.events[i-1].at))
   return deny(503,'G145_SOURCE_PROVENANCE_INVALID');
  return Object.freeze({status:200,body:Object.freeze({...data})});
 };
}

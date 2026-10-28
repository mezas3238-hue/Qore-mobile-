/** G146: original G45 commerce order trace; no quote, PSP or settlement invented.
 * Only independently attested Admin AAL2 may read disposable PG16.
 */
const PATH=/^\/v1\/staging\/admin\/services\/COMMERCE\/([0-9a-f-]{36})\/trace$/i;
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const ROOT=['mode','viewerId','serviceId','serviceKind','bookingRequestKey',
 'quoteId','status','revision','observedAt','expiresAt','serverPersisted',
 'productionEnabled','assignment','events','ledger'];
const COMMERCE_ROOT=[...ROOT,'branchId','vehicleKind','orderSubtotalGs'];
const EVENT=['eventId','serviceId','sequence','status','at'];
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(o,keys)=>obj(o)&&Object.keys(o).length===keys.length&&
 keys.every(k=>Object.hasOwn(o,k));
const id=x=>typeof x==='string'&&UUID.test(x)&&x===x.toLowerCase();
const time=x=>Number.isSafeInteger(x)&&x>=0;
const deny=(status,code)=>({status,body:{code,qaOnly:true,productionEnabled:false}});
export function createG146AdminCommerceTraceGateway({
 environment,qaOnly,liveEnabled,verifyAccessToken,
 verifySessionNotRevoked,loadExclusiveBackofficeRole,
 verifyBackofficeMfa,allowRequest,loadCommerceTraceReceipt,now=Date.now
}={}){
 if(environment!=='isolated_staging'||qaOnly!==true||liveEnabled!==false||
  [verifyAccessToken,verifySessionNotRevoked,loadExclusiveBackofficeRole,
   verifyBackofficeMfa,allowRequest,loadCommerceTraceReceipt,now]
   .some(f=>typeof f!=='function'))throw Error('G146 verified Admin trust required');
 return async({method,path,headers={},body}={})=>{
  const found=method==='GET'&&typeof path==='string'?PATH.exec(path):null;
  if(!found||!id(found[1].toLowerCase())||body!=null)
   return deny(404,'G146_TRACE_ROUTE_INVALID');
  if(typeof headers.authorization!=='string'||headers.Authorization!==undefined||
   headers.cookie!==undefined)return deny(401,'G146_BEARER_REQUIRED');
  const token=/^Bearer ([A-Za-z0-9._~-]{20,7900})$/.exec(headers.authorization)?.[1];
  if(!token)return deny(401,'G146_BEARER_REQUIRED');
  const at=now();if(!time(at))return deny(503,'G146_CLOCK_UNAVAILABLE');
  let user;
  try{user=await verifyAccessToken(token);}
  catch{return deny(401,'G146_AUTH_INVALID');}
  if(!obj(user)||!id(user.id??'')||!id(user.sessionId??'')||
   user.is_anonymous!==false||!time(user.expiresAtMs)||user.expiresAtMs<=at)
   return deny(401,'G146_AUTH_INVALID');
  try{
   if(await verifySessionNotRevoked({
    userId:user.id,sessionId:user.sessionId,at})!==true)
    return deny(401,'G146_SESSION_REVOKED');
  }catch{return deny(503,'G146_REVOCATION_UNAVAILABLE');}
  let role;
  try{role=await loadExclusiveBackofficeRole(user.id);}
  catch{return deny(503,'G146_ROLE_UNAVAILABLE');}
  if(role!=='admin')return deny(403,'G146_ADMIN_REQUIRED');
  let mfa;
  try{mfa=await verifyBackofficeMfa({
   token,userId:user.id,sessionId:user.sessionId,requiredLevel:'aal2',at
  });}catch{return deny(503,'G146_MFA_UNAVAILABLE');}
  if(!obj(mfa)||mfa.verifiedByProvider!==true||
   mfa.assuranceLevel!=='aal2'||mfa.userId!==user.id||
   mfa.sessionId!==user.sessionId||!time(mfa.verifiedAtMs)||
   mfa.verifiedAtMs>at||at-mfa.verifiedAtMs>43200000||
   !time(mfa.expiresAtMs)||mfa.expiresAtMs<=at||
   mfa.expiresAtMs>user.expiresAtMs)
   return deny(403,'G146_AAL2_REQUIRED');
  try{
   if(allowRequest({userId:user.id,operation:'admin.commerce.trace.read'})!==true)
    return deny(429,'G146_RATE_LIMIT');
  }catch{return deny(503,'G146_LIMITER_UNAVAILABLE');}
  const orderId=found[1].toLowerCase();
  let d;
  try{d=await loadCommerceTraceReceipt({actorId:user.id,orderId});}
  catch{return deny(503,'G146_SQL_UNAVAILABLE');}
  if(d===null)return deny(404,'G146_ORIGINAL_ORDER_NOT_FOUND');
  const clock=now(),cancelled=d?.status==='cancelled',count=cancelled?2:1;
  if(!exact(d,COMMERCE_ROOT)||d.mode!=='STAGING_DEMO_ONLY'||
   d.productionEnabled!==false||d.serverPersisted!==true||
   d.viewerId!==user.id||d.serviceId!==orderId||
   d.serviceKind!=='COMMERCE'||!id(d.bookingRequestKey)||
   !id(d.branchId)||!['AUTO','MOTO'].includes(d.vehicleKind)||
   !time(d.orderSubtotalGs)||d.orderSubtotalGs<100||d.orderSubtotalGs>50000000||
   d.quoteId!==null||!['requested','cancelled'].includes(d.status)||
   d.revision!==count||!time(d.observedAt)||
   d.observedAt>clock||clock-d.observedAt>30000||
   !time(d.expiresAt)||d.expiresAt<=clock||d.expiresAt>clock+60000||
   !exact(d.assignment,['state','legalGate'])||
   d.assignment.state!=='NOT_ASSIGNABLE'||
   d.assignment.legalGate!=='G38_BLOCKED'||d.ledger!==null||
   !Array.isArray(d.events)||d.events.length!==count||
   d.events.some((e,i)=>!exact(e,EVENT)||!id(e.eventId)||
    e.serviceId!==orderId||e.sequence!==i+1||
    e.status!==(i===0?'requested':'cancelled')||!time(e.at)||
    e.at>d.observedAt||i>0&&e.at<d.events[i-1].at))
   return deny(503,'G146_SOURCE_PROVENANCE_INVALID');
  return {status:200,body:d};
 };
}

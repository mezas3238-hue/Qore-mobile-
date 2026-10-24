/**
 * G64 / A53: private QA decision recovery gateway (POST is READ-ONLY SQL).
 * No production mount, no owner DB credentials exposed, no redo of acceptance.
 * The injected readStoredDecision must invoke the owner-only G64 PostgreSQL
 * function with server-verified actor/session and exact decision key.
 */
export const G64_DRIVER_OFFER_RECOVERY_LIVE_ENABLED=false;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN=/^Bearer ([A-Za-z0-9._~-]{20,7900})$/;
const ROUTES=new Map([
 ['/v1/staging/driver/offers/reconcile','AUTO_RIDE'],
 ['/v1/staging/courier/delivery-offers/reconcile','DELIVERY']
]);
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 Object.getPrototypeOf(x)===Object.prototype;
const exact=(x,keys)=>plain(x)&&Object.keys(x).length===keys.length&&
 keys.every(k=>Object.hasOwn(x,k));
const RESULT=['state','offerId','requestKey','kind','action','outcome',
 'receiptId','serverPersisted','liveEnabled','pushDelivered',
 'qaOnly','productionEnabled','retrySafe','reconcileAgain'];
const UNKNOWN=['state','qaOnly','productionEnabled','retrySafe','reconcileAgain'];
const error=(status,code)=>Object.freeze({status,body:Object.freeze({
 code,qaOnly:true,retrySafe:false
})});
export function createG64PrivateDriverDecisionReconcileQa({
 environment,localQaOnly,liveEnabled,
 verifyAccessToken,verifySessionNotRevoked,resolveExclusiveRole,
 allowRequest,readStoredDecision,now=Date.now
}={}){
 if(environment!=='isolated_staging'||localQaOnly!==true||
  liveEnabled!==false||
  [verifyAccessToken,verifySessionNotRevoked,resolveExclusiveRole,
   allowRequest,readStoredDecision,now].some(f=>typeof f!=='function'))
  throw Error('G64 must run only with independent QA auth and SQL authorities');
 return async({method,path,headers,body}={})=>{
  const kind=ROUTES.get(path);
  if(method!=='POST'||!kind)return error(404,'G64_ROUTE_NOT_FOUND');
  if(!exact(body,['offerId','requestKey','action'])||
   !UUID.test(body.offerId)||!UUID.test(body.requestKey)||
   !['accept','decline'].includes(body.action))
   return error(400,'G64_INVALID_REQUEST');
  const auth=typeof headers?.authorization==='string'?
   TOKEN.exec(headers.authorization):null;
  if(!auth||headers?.Authorization!==undefined||headers?.cookie!==undefined)
   return error(401,'G64_BEARER_REQUIRED');
  let identity;
  try{identity=await verifyAccessToken(auth[1]);}catch{
   return error(401,'G64_IDENTITY_NOT_VERIFIED');
  }
  const at=now();
  if(!exact(identity,['id','sessionId','tokenIatMs','expiresAtMs','is_anonymous'])||
   !UUID.test(identity.id)||!UUID.test(identity.sessionId)||
   !Number.isSafeInteger(identity.tokenIatMs)||identity.tokenIatMs>at||
   !Number.isSafeInteger(identity.expiresAtMs)||identity.expiresAtMs<=at||
   identity.is_anonymous!==false)
   return error(401,'G64_IDENTITY_NOT_VERIFIED');
  try{
   if(await verifySessionNotRevoked({
    userId:identity.id,sessionId:identity.sessionId,at})!==true)
    return error(401,'G64_SESSION_REVOKED');
  }catch{return error(503,'G64_AUTH_UNAVAILABLE');}
  try{
   if(await resolveExclusiveRole(identity.id)!=='driver')
    return error(403,'G64_DRIVER_REQUIRED');
  }catch{return error(503,'G64_ROLE_UNAVAILABLE');}
  try{
   if(allowRequest({actorId:identity.id,operation:'offer_reconcile'})!==true)
    return error(429,'G64_RATE_LIMITED');
  }catch{return error(503,'G64_LIMITER_UNAVAILABLE');}
  let found;
  try{
   found=await readStoredDecision(Object.freeze({
    kind,offerId:body.offerId,actorId:identity.id,
    sessionId:identity.sessionId,tokenIatMs:identity.tokenIatMs,
    requestKey:body.requestKey,action:body.action
   }));
  }catch{
   // A SQL failure is not proof of rollback or permission to retry.
   return error(503,'G64_SQL_RESULT_UNKNOWN');
  }
  if(exact(found,UNKNOWN)&&found.state==='NOT_YET_OBSERVED'&&
   found.qaOnly===true&&found.productionEnabled===false&&
   found.retrySafe===false&&found.reconcileAgain===true)
   return error(503,'G64_NOT_YET_OBSERVED');
  if(!exact(found,RESULT)||found.state!=='COMMITTED'||
   found.kind!==kind||found.offerId!==body.offerId||
   found.requestKey!==body.requestKey||found.action!==body.action||
   found.outcome!==(body.action==='accept'?'accepted':'declined')||
   !UUID.test(found.receiptId)||found.serverPersisted!==true||
   found.liveEnabled!==false||found.pushDelivered!==false||
   found.qaOnly!==true||found.productionEnabled!==false||
   found.retrySafe!==false||found.reconcileAgain!==false||
   (body.action==='decline'&&found.receiptId!==body.offerId))
   return error(503,'G64_UNTRUSTED_SQL_RECEIPT');
  return Object.freeze({status:200,body:Object.freeze({
   mode:'STAGING_DEMO_ONLY',state:'COMMITTED',kind,action:body.action,
   offerId:body.offerId,requestKey:body.requestKey,
   outcome:found.outcome,receiptId:found.receiptId,
   serverPersisted:true,liveEnabled:false,pushDelivered:false,
   qaOnly:true,productionEnabled:false,retrySafe:false
  })});
 };
}

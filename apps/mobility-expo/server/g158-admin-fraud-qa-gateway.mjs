/** G158: immutable original G157 allegations -> A Admin GET. Never sanctions. */
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const PATH='/v1/staging/admin/fraud/verified-reports';
const TARGET=new Set(['DRIVER','COURIER','MERCHANT','CLIENT']);
const TIER=new Set(['SINGLE_SOURCE_REVIEW','MULTI_SOURCE_REVIEW']);
const exact=(x,keys)=>x!==null&&typeof x==='object'&&!Array.isArray(x)
 &&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const deny=(status,code)=>({status,body:{code,qaOnly:true,productionEnabled:false}});
export function createG158AdminFraudQaGateway({
 environment,qaOnly,liveEnabled,verifyAccessToken,verifySessionNotRevoked,
 loadExclusiveBackofficeRole,verifyBackofficeMfa,authorizePermission,
 allowRequest,loadFraudReviewQueue,now=Date.now
}={}){
 if(environment!=='isolated_staging'||qaOnly!==true||liveEnabled!==false||
  [verifyAccessToken,verifySessionNotRevoked,loadExclusiveBackofficeRole,
   verifyBackofficeMfa,authorizePermission,allowRequest,loadFraudReviewQueue,now]
    .some(x=>typeof x!=='function'))throw Error('G158 independent private Admin authorities required');
 return async({method,path,headers={},body}={})=>{
  if(method!=='GET'||path!==PATH||body!=null)return deny(404,'G158_ROUTE_DENIED');
  if(headers.cookie!==undefined||headers.Authorization!==undefined||
    typeof headers.authorization!=='string')return deny(401,'G158_BEARER_REQUIRED');
  const token=/^Bearer ([A-Za-z0-9._~-]{20,7900})$/.exec(headers.authorization)?.[1];
  if(!token)return deny(401,'G158_BEARER_REQUIRED');
  const at=now();
  if(!Number.isSafeInteger(at)||at<=0)return deny(503,'G158_CLOCK_UNAVAILABLE');
  let actor;
  try{actor=await verifyAccessToken(token);}catch{return deny(401,'G158_INVALID_TOKEN');}
  if(!actor||!UUID.test(actor.id??'')||!UUID.test(actor.sessionId??'')||
   actor.is_anonymous!==false||!Number.isSafeInteger(actor.expiresAtMs)||
   actor.expiresAtMs<=at)return deny(401,'G158_INVALID_SESSION');
  let revoked,role,scope,mfa;
  try{revoked=await verifySessionNotRevoked({
   userId:actor.id,sessionId:actor.sessionId,at
  });}catch{return deny(503,'G158_REVOCATION_AUTHORITY_UNAVAILABLE');}
  if(revoked!==true)return deny(401,'G158_SESSION_REVOKED');
  try{role=await loadExclusiveBackofficeRole(actor.id);}
  catch{return deny(503,'G158_ROLE_AUTHORITY_UNAVAILABLE');}
  if(role!=='admin')return deny(403,'G158_ADMIN_ONLY');
  try{scope=await authorizePermission({userId:actor.id,scope:'admin.incidents.read'});}
  catch{return deny(503,'G158_SCOPE_AUTHORITY_UNAVAILABLE');}
  if(scope!==true)return deny(403,'G158_SCOPE_DENIED');
  try{mfa=await verifyBackofficeMfa({
   token,userId:actor.id,sessionId:actor.sessionId,requiredLevel:'aal2',at
  });}catch{return deny(503,'G158_MFA_AUTHORITY_UNAVAILABLE');}
  if(!mfa||mfa.verifiedByProvider!==true||mfa.assuranceLevel!=='aal2'
   ||mfa.userId!==actor.id||mfa.sessionId!==actor.sessionId||
   !Number.isSafeInteger(mfa.verifiedAtMs)||mfa.verifiedAtMs>at||
   at-mfa.verifiedAtMs>43200000||!Number.isSafeInteger(mfa.expiresAtMs)
   ||mfa.expiresAtMs<=at||mfa.expiresAtMs>actor.expiresAtMs)
   return deny(403,'G158_PROVIDER_AAL2_REQUIRED');
  try{
   if(allowRequest({userId:actor.id,operation:'admin.fraud.review.read'})!==true)
    return deny(429,'G158_RATE_LIMIT');
  }catch{return deny(503,'G158_RATE_AUTHORITY_UNAVAILABLE');}
  let rows;
  try{rows=await loadFraudReviewQueue({actorId:actor.id,limit:50});}
  catch{return deny(503,'G158_SOURCE_UNAVAILABLE');}
  if(!exact(rows,['qaOnly','productionEnabled','automaticSuspension',
    'dispatchPenaltyApplied','findingEstablished','hasMore','items'])||
   rows.qaOnly!==true||rows.productionEnabled!==false||
   rows.automaticSuspension!==false||rows.dispatchPenaltyApplied!==false||
   rows.findingEstablished!==false||typeof rows.hasMore!=='boolean'||
   !Array.isArray(rows.items)||rows.items.length>50||
   rows.hasMore&&rows.items.length!==50)return deny(503,'G158_UNTRUSTED_SOURCE');
  const keys=['ratedKind','ratedId','recentReports','independentReporters',
   'distinctServices','reviewTier','allegationOnly'];
  const seen=new Set();
  for(const x of rows.items){
   if(!exact(x,keys)||!TARGET.has(x.ratedKind)||!UUID.test(x.ratedId??'')||
    seen.has(x.ratedKind+':'+x.ratedId)||
    ![x.recentReports,x.independentReporters,x.distinctServices]
     .every(y=>Number.isSafeInteger(y)&&y>=1)||
    x.independentReporters>x.recentReports||
    x.distinctServices>x.recentReports||!TIER.has(x.reviewTier)||
    x.allegationOnly!==true||
    (x.reviewTier==='MULTI_SOURCE_REVIEW')!==
    (x.recentReports>=3&&x.independentReporters>=3&&x.distinctServices>=3))
    return deny(503,'G158_UNTRUSTED_SOURCE');
   seen.add(x.ratedKind+':'+x.ratedId);
  }
  // AAL2 + session and RBAC recheck after sensitive PostgreSQL read.
  try{
   if(await verifySessionNotRevoked({
    userId:actor.id,sessionId:actor.sessionId,at:now()
   })!==true)return deny(401,'G158_SESSION_REVOKED');
  }catch{return deny(503,'G158_REVOCATION_AUTHORITY_UNAVAILABLE');}
  return {status:200,body:{...rows,viewerId:actor.id,serverPersisted:true,
   observedAt:at,expiresAt:at+30000,scope:'admin.incidents.read'}};
 };
}

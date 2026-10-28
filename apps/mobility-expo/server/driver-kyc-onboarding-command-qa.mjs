/**
 * Trusted backend Driver KYC onboarding: evaluate independent documents and
 * selfie, then call the G42-locked atomic PostgreSQL owner-only command.
 * No photo upload or facial matching is performed by this QA-only module.
 */
import {evaluateDriverAutoApproval} from './driver-kyc-auto-approval-qa.mjs';
export const DRIVER_KYC_AUTOAPPROVAL_LIVE_ENABLED=false;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN=/^Bearer ([A-Za-z0-9._~-]{20,7900})$/;
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 Object.getPrototypeOf(x)===Object.prototype;
const exact=(x,fields)=>plain(x)&&Object.keys(x).length===fields.length&&
 fields.every(k=>Object.hasOwn(x,k));
const fail=(status,code)=>Object.freeze({status,body:Object.freeze({
 code,qaOnly:true,productionEnabled:false,accountCommerciallyEnabled:false,
 retrySafe:false
})});
export function createDriverKycOnboardingCommandQa({
 environment,localQaOnly,liveEnabled,
 verifyAccessToken,verifySessionNotRevoked,resolveExclusiveDriverRole,
 readAttestedDocuments,readAttestedFace,readAttestedVehicle,approveAtomicOwnerOnly,
 allowRequest,now=Date.now
}={}){
 if(environment!=='isolated_staging'||localQaOnly!==true||
 liveEnabled!==false||[
 verifyAccessToken,verifySessionNotRevoked,resolveExclusiveDriverRole,
 readAttestedDocuments,readAttestedFace,readAttestedVehicle,approveAtomicOwnerOnly,
 allowRequest,now
 ].some(f=>typeof f!=='function'))
 throw Error('KYC command requires a trusted, isolated server and SQL');
 return async({method,path,headers,body}={})=>{
  if(method!=='POST'||path!=='/v1/staging/driver/onboarding/review')
   return fail(404,'KYC_ROUTE_NOT_FOUND');
  if(!exact(body,['requestKey','vehicleId','vehicleKind'])||
   !UUID.test(body.requestKey??'')||!UUID.test(body.vehicleId??'')||
   !['AUTO','MOTO'].includes(body.vehicleKind))
   return fail(400,'KYC_INVALID_REQUEST');
  const bearer=typeof headers?.authorization==='string'&&
   headers.Authorization===undefined&&headers.cookie===undefined?
   TOKEN.exec(headers.authorization):null;
  if(!bearer)return fail(401,'KYC_AUTH_REQUIRED');
  let user;
  try{user=await verifyAccessToken(bearer[1]);}
  catch{return fail(401,'KYC_AUTH_FAILED');}
  const at=now();
  if(!exact(user,['id','sessionId','tokenIatMs','expiresAtMs','is_anonymous'])||
   !UUID.test(user.id)||!UUID.test(user.sessionId)||
   !Number.isSafeInteger(at)||at<0||
   !Number.isSafeInteger(user.tokenIatMs)||user.tokenIatMs>at||
   !Number.isSafeInteger(user.expiresAtMs)||user.expiresAtMs<=at||
   user.is_anonymous!==false)
   return fail(401,'KYC_AUTH_FAILED');
  try{
   if(await verifySessionNotRevoked({userId:user.id,sessionId:user.sessionId,at})!==true)
    return fail(401,'KYC_SESSION_REVOKED');
   if(await resolveExclusiveDriverRole(user.id)!=='driver')
    return fail(403,'KYC_DRIVER_ONLY');
   if(allowRequest({actorId:user.id,operation:'driver_onboarding_review'})!==true)
    return fail(429,'KYC_RATE_LIMIT');
  }catch{return fail(503,'KYC_AUTHORITY_UNAVAILABLE');}
  let documents,face,vehicle;
  try{
   [documents,face,vehicle]=await Promise.all([
    readAttestedDocuments({driverId:user.id,vehicleId:body.vehicleId}),
    readAttestedFace({driverId:user.id,vehicleId:body.vehicleId}),
    readAttestedVehicle({driverId:user.id,vehicleId:body.vehicleId})
   ]);
  }catch{return fail(503,'KYC_VERIFIERS_UNAVAILABLE');}
  const result=evaluateDriverAutoApproval({
   driverId:user.id,vehicleId:body.vehicleId,vehicleKind:body.vehicleKind,
   documents,face,vehicle,now:at
  });
  if(result.eligibleForAutomaticApproval!==true)
   return Object.freeze({status:202,body:Object.freeze({
    mode:'STAGING_DEMO_ONLY',reviewState:result.reviewState,
    missingKinds:result.missingKinds,needsReview:result.needsReview,
    accountApproved:false,driverEligible:false,qaOnly:true,
    productionEnabled:false
   })});
  // The backend cannot grant approval just from a Node boolean. The SQL
  // command MUST independently revalidate the same eight records, vehicle
  // and G42 session under locks. Unknown COMMIT => no automatic retry.
  let persisted;
  try{
   persisted=await approveAtomicOwnerOnly({
    driverId:user.id,vehicleId:body.vehicleId,
    sessionId:user.sessionId,tokenIatMs:user.tokenIatMs,
    requestKey:body.requestKey
   });
  }catch{return fail(503,'KYC_SQL_OUTCOME_UNKNOWN');}
  if(!exact(persisted,['mode','decisionId','onboardingApprovedInQa',
   'commercialDriverEligible','productionEnabled'])||
   persisted.mode!=='ISOLATED_QA_ONLY'||!UUID.test(persisted.decisionId??'')||
   persisted.onboardingApprovedInQa!==true||
   persisted.commercialDriverEligible!==false||
   persisted.productionEnabled!==false)
   return fail(503,'KYC_UNTRUSTED_SQL_RECEIPT');
  return Object.freeze({status:200,body:Object.freeze({
   mode:'STAGING_DEMO_ONLY',
   reviewState:'QA_ONBOARDING_APPROVED',
   onboardingApprovedInQa:true,
   accountCommerciallyEnabled:false,
   driverEligible:false,
   qaOnly:true,productionEnabled:false
  })});
 };
}

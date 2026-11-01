/**
 * G282 — scoped, pending-only vehicle application over the existing G4 runtime.
 * G247 provider + SQL G42 must BOTH attest the original Driver's session.
 * No KYC, GPS consent, Admin review, materialization, payment or LIVE ride.
 */
import {parseDraft,assertStagingRef} from './g2-staging-vehicle-gateway.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PATH='/v1/staging/vehicle-applications';
const reply=(status,body)=>({status,body});
const bearer=headers=>{
 const value=headers?.authorization??headers?.Authorization;
 if(typeof value!=='string'||value.length>8192)return null;
 return /^Bearer ([A-Za-z0-9._~-]{20,7900})$/.exec(value)?.[1]??null;
};
export function createG282PendingVehicleGateway({
 projectRef,verifyDriverSession,authorizeDriver,allowRequest,submitPending
}={}){
 assertStagingRef(projectRef);
 if(![verifyDriverSession,authorizeDriver,allowRequest,submitPending]
  .every(fn=>typeof fn==='function'))
  throw Error('G282 trusted provider and transactional DB required');
 return async({method,path,headers,body}={})=>{
  if(method!=='POST'||path!==PATH)
   return reply(404,{error:'Not found'});
  const validated=parseDraft(body);
  if(!validated)return reply(400,{error:'Invalid vehicle pending draft'});
  const token=bearer(headers);
  if(!token)return reply(401,{error:'Verified Driver session required'});
  let scope;
  try{scope=await verifyDriverSession(token);}catch{
   return reply(401,{error:'Current provider session required'});
  }
  if(!scope||typeof scope!=='object'||Array.isArray(scope)||
    !UUID.test(scope.id??'')||!UUID.test(scope.sessionId??'')||
    !Number.isSafeInteger(scope.tokenIatMs)||scope.tokenIatMs<=0||
    scope.is_anonymous!==false)
   return reply(401,{error:'Current provider session required'});
  try{
   if(await authorizeDriver(scope.id)!==true)
    return reply(403,{error:'Exclusive Driver role required'});
  }catch{return reply(503,{error:'Driver role authority unavailable'});}
  try{
   if(allowRequest({userId:scope.id,operation:'vehicle_draft'})!==true)
    return reply(429,{error:'Driver request limit exceeded'});
  }catch{return reply(503,{error:'Driver limiter unavailable'});}
  try{
   // Original Auth provider session locked INSIDE G282 SQL mutation.
   const applicationId=await submitPending({
    _driver:scope.id,_session:scope.sessionId,_iat_ms:scope.tokenIatMs,
    _request:validated.requestKey,_kind:validated.kind,
    _service:validated.service,_municipality:validated.municipalityCode,
    _plate:validated.plate,_brand:validated.brand,
    _model:validated.model,_year:validated.year,
    _capacity:validated.passengerCapacity
   });
   if(typeof applicationId!=='string'||!UUID.test(applicationId))
    throw Error('Missing SQL receipt');
   return reply(202,{mode:'STAGING_DEMO_ONLY',applicationId,
    status:'pending',evidenceVerified:false,driverEligible:false,
    commercialEnabled:false});
  }catch{
   return reply(409,{error:'Vehicle application not accepted by G42 and compliance SQL'});
  }
 };
}

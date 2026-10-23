/** JWT-bound, read-only Driver KYC license review status (NOT eligibility). */
import {assertStagingRef} from './g2-staging-vehicle-gateway.mjs';
export const G20_LICENSE_READINESS_LIVE_ENABLED=false;
const PATH='/v1/staging/driver/license-readiness';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const response=(status,body)=>({status,body});
function bearer(headers){
 const value=headers?.authorization??headers?.Authorization;
 return typeof value==='string'&&value.length<8000?
  /^Bearer ([A-Za-z0-9._~-]{20,7900})$/.exec(value)?.[1]??null:null;
}
const confirmed=u=>plain(u)&&typeof u.id==='string'&&UUID.test(u.id)&&
 u.is_anonymous!==true&&
 (typeof u.email_confirmed_at==='string'||typeof u.phone_confirmed_at==='string');
export function createDriverKycReadinessGateway({
 projectRef,verifyAccessToken,authorizeDriver,allowRequest,currentLicenseApproved
}={}){
 assertStagingRef(projectRef);
 if(![verifyAccessToken,authorizeDriver,allowRequest,currentLicenseApproved]
   .every(fn=>typeof fn==='function'))
  throw Error('G20 requires trusted Driver KYC dependencies');
 return async({method,path,headers,body}={})=>{
  if(method!=='GET'||path!==PATH)return response(404,{error:'Not found'});
  if(body!==undefined&&body!==null)
   return response(400,{error:'GET body forbidden'});
  const token=bearer(headers);
  if(!token)return response(401,{error:'Verified Driver session required'});
  let user;
  try{user=await verifyAccessToken(token);}
  catch{return response(401,{error:'Driver session verification failed'});}
  if(!confirmed(user))
   return response(401,{error:'Confirmed Driver account required'});
  try{
   if(await authorizeDriver(user.id)!==true)
    return response(403,{error:'Driver role required'});
  }catch{return response(503,{error:'Driver role lookup unavailable'});}
  try{
   if(allowRequest({userId:user.id,operation:'driver_kyc_readiness'})!==true)
    return response(429,{error:'Driver readiness rate limited'});
  }catch{return response(503,{error:'Rate limiter unavailable'});}
  try{
   const ready=await currentLicenseApproved({driverId:user.id});
   if(typeof ready!=='boolean')throw Error('Untrusted KYC status');
   return response(200,{
    mode:'STAGING_DEMO_ONLY',
    currentLicenseApproved:ready,
    driverEligible:false,
    liveOperationsEnabled:false,
    verificationScope:'CURRENT_LICENSE_REVIEW_ONLY'
   });
  }catch{return response(503,{error:'Driver license readiness unavailable'});}
 };
}

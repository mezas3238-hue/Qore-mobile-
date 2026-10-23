/** G18 local QA ONLY — auditable passenger-default -> DRIVER-only onboarding.
 * Registration is not a license, location consent, insurance or LIVE dispatch.
 */
import {assertStagingRef} from './g2-staging-vehicle-gateway.mjs';
export const G18_ENROLLMENT_LIVE_ENABLED=false;
const PATH='/v1/staging/driver/enrollment';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 (Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);
const bearer=headers=>{
 const h=headers?.authorization??headers?.Authorization;
 return typeof h==='string'&&h.length<8000?
  /^Bearer ([A-Za-z0-9._~-]{20,7900})$/.exec(h)?.[1]??null:null;
};
const reply=(status,body)=>({status,body});
export function createDriverEnrollmentGateway({
 projectRef,verifyAccessToken,authorizeNewDriver,allowRequest,enroll
}={}){
 assertStagingRef(projectRef);
 if(![verifyAccessToken,authorizeNewDriver,allowRequest,enroll]
  .every(x=>typeof x==='function'))
  throw Error('Trusted G18 Driver enrollment dependencies required');
 return async({method,path,headers,body}={})=>{
  if(method!=='POST'||path!==PATH)return reply(404,{error:'Not found'});
  if(!plain(body)||Object.keys(body).length!==2||
    typeof body.requestKey!=='string'||!UUID.test(body.requestKey)||
    body.driverConsent!==true)
   return reply(400,{error:'Explicit Driver onboarding consent and requestKey required'});
  const token=bearer(headers);
  if(!token)return reply(401,{error:'Verified identity required'});
  let user;
  try{user=await verifyAccessToken(token);}catch{
   return reply(401,{error:'Session not confirmed'});
  }
  if(!plain(user)||typeof user.id!=='string'||!UUID.test(user.id)||
    user.is_anonymous===true||
    !(typeof user.email_confirmed_at==='string'||
      typeof user.phone_confirmed_at==='string'))
   return reply(401,{error:'Confirmed identity required'});
  try{
   if(await authorizeNewDriver(user.id)!==true)
    return reply(403,{error:'Driver-only enrollment identity required'});
  }catch{return reply(503,{error:'Driver enrollment policy unavailable'});}
  try{
   if(allowRequest({userId:user.id,operation:'driver_enrollment'})!==true)
    return reply(429,{error:'Driver enrollment request rate limited'});
  }catch{return reply(503,{error:'Driver enrollment limiter unavailable'});}
  try{
   const result=await enroll({driverId:user.id,requestKey:body.requestKey,
    consent:true});
   if(typeof result!=='string'||!UUID.test(result))
    throw Error('No confirmed enrollment receipt');
   return reply(202,{mode:'STAGING_DEMO_ONLY',enrollmentId:result,
    status:'pending_compliance',driverEligible:false,
    liveOperationsEnabled:false});
  }catch{return reply(409,{error:'Driver enrollment conflict or incomplete identity checks'});}
 };
}

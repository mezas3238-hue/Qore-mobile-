/** G16 STAGING Driver private inbox: both AUTO and courier offers, no push assumptions.
 * Caller cannot provide a driver ID; the verified Auth bearer fixes the actor.
 */
import {assertStagingRef} from './g2-staging-vehicle-gateway.mjs';
export const G16_DRIVER_INBOX_LIVE_ENABLED=false;
const PATH='/v1/staging/driver/inbox';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validId=x=>typeof x==='string'&&UUID.test(x);
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const answer=(status,body)=>({status,body});
const bearer=headers=>{
 const value=headers?.authorization??headers?.Authorization;
 return typeof value==='string'&&value.length<8000?
  /^Bearer ([A-Za-z0-9._~-]{20,7900})$/.exec(value)?.[1]??null:null;
};
const confirmed=user=>object(user)&&validId(user.id)&&user.is_anonymous!==true&&
 (typeof user.email_confirmed_at==='string'||typeof user.phone_confirmed_at==='string');
export function createDriverPrivateInboxGateway({
 projectRef,verifyAccessToken,authorizeDriver,allowRequest,listForDriver,now=Date.now,
 requireFreshSession=false,verifySessionNotRevoked
}={}){
 assertStagingRef(projectRef);
 if(![verifyAccessToken,authorizeDriver,allowRequest,listForDriver,now]
  .every(fn=>typeof fn==='function'))
  throw Error('Trusted G16 Driver gateway dependencies required');
 if(requireFreshSession===true&&typeof verifySessionNotRevoked!=='function')
  throw Error('G16 requires revocation authority for guarded Driver sessions');
 return async({method,path,headers,body}={})=>{
  if(method!=='GET'||path!==PATH)return answer(404,{error:'Not found'});
  if(body!==undefined&&body!==null)return answer(400,{error:'GET body unsupported'});
  const token=bearer(headers);
  if(!token)return answer(401,{error:'Verified driver session required'});
  let user;
  try{user=await verifyAccessToken(token);}catch{
   return answer(401,{error:'Driver session not confirmed'});
  }
  if(!confirmed(user))return answer(401,{error:'Confirmed driver identity required'});
  if(requireFreshSession===true){
   const at=now();
   if(!validId(user.sessionId)||!Number.isSafeInteger(user.expiresAtMs)||
    !Number.isSafeInteger(at)||user.expiresAtMs<=at)
    return answer(401,{error:'Driver session expired or incomplete'});
   try{
    if(await verifySessionNotRevoked({userId:user.id,sessionId:user.sessionId,at})!==true)
     return answer(401,{error:'Driver session revoked'});
   }catch{return answer(503,{error:'Driver session authority unavailable'});}
  }
  try{
   if(await authorizeDriver(user.id)!==true)
    return answer(403,{error:'Driver role required'});
  }catch{return answer(503,{error:'Driver authorization unavailable'});}
  try{
   if(allowRequest({userId:user.id,operation:'driver_private_inbox_poll'})!==true)
    return answer(429,{error:'Driver inbox rate limited'});
  }catch{return answer(503,{error:'Driver limiter unavailable'});}
  try{
   const at=now();
   if(!Number.isSafeInteger(at)||at<0)throw Error('Invalid server time');
   const snapshot=await listForDriver({driverId:user.id});
   if(!object(snapshot)||snapshot.ok!==true||snapshot.liveEnabled!==false||
      !Array.isArray(snapshot.offers)||snapshot.offers.length>10)
    throw Error('Invalid private inbox result');
   const seen=new Set(),offers=[];
   for(const row of snapshot.offers){
    if(!object(row)||!['AUTO_RIDE','DELIVERY'].includes(row.kind)||
       !validId(row.offerId)||!validId(row.serviceId)||
       !Number.isSafeInteger(row.expiresAtMs)||row.expiresAtMs<=at+3000||
       row.expiresAtMs>at+45000)
      throw Error('Invalid or expired offer');
    const unique=row.kind+':'+row.offerId;
    if(seen.has(unique))throw Error('Duplicate private offer');
    seen.add(unique);
    offers.push({kind:row.kind,offerId:row.offerId,
     serviceId:row.serviceId,expiresAtMs:row.expiresAtMs});
   }
   return answer(200,{mode:'STAGING_DEMO_ONLY',liveTripsEnabled:false,
    liveDeliveriesEnabled:false,offers,pushDelivered:false,deviceReceived:false,
    suggestedPollIntervalMs:5000});
  }catch{return answer(503,{error:'Private Driver inbox temporarily unavailable'});}
 };
}

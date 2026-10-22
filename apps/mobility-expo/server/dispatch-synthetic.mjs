/** QORE STAGING in-memory model, NOT durable or distributed. No real rides. */
export const DISPATCH_LIVE_ENABLED=false;
const fail=reason=>({ok:false,reason,liveEnabled:false});
export function createSyntheticDispatch({now=()=>Date.now()}={}){
 const rides=new Map();
 const validId=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{1,64}$/.test(x);
 const validTime=x=>Number.isSafeInteger(x)&&x>=0;
 function request({rideId,passengerId}){
  if(!validId(rideId)||!validId(passengerId)||rides.has(rideId))return fail('Invalid or duplicate request');
  rides.set(rideId,{rideId,passengerId,status:'searching',driverId:null,offers:new Map(),revision:0});
  return {ok:true,status:'searching',liveEnabled:false};
 }
 function offer({rideId,driverId,expiresAtMs}){
  const ride=rides.get(rideId),t=now();
  if(!ride||ride.status!=='searching'||!validId(driverId)||!validTime(t)||!validTime(expiresAtMs)||expiresAtMs<=t||expiresAtMs>t+30000||ride.offers.has(driverId))return fail('Offer not permitted');
  ride.offers.set(driverId,expiresAtMs);return {ok:true,liveEnabled:false};
 }
 function accept({rideId,driverId}){
  const ride=rides.get(rideId),t=now();
  if(!ride||ride.status!=='searching'||!validId(driverId)||!validTime(t)||!(ride.offers.get(driverId)>t))return fail('Offer expired or ride already assigned');
  ride.status='accepted';ride.driverId=driverId;ride.revision++;
  return {ok:true,status:'accepted',driverId,revision:ride.revision,liveEnabled:false};
 }
 function transition({rideId,actorId,event}){
  const ride=rides.get(rideId);
  if(!ride||!validId(actorId))return fail('Unknown ride or actor');
  const next={accepted:{arrive:'arriving',cancel:'cancelled'},arriving:{pickup:'in_progress',cancel:'cancelled'},in_progress:{complete:'completed',dispute:'disputed'}}[ride.status]?.[event];
  if(!next)return fail('Invalid transition');
  if(event==='cancel'&&actorId!==ride.passengerId&&actorId!==ride.driverId)return fail('Unauthorized cancellation');
  if(event!=='cancel'&&actorId!==ride.driverId)return fail('Only assigned driver may advance');
  ride.status=next;ride.revision++;
  return {ok:true,status:next,revision:ride.revision,liveEnabled:false};
 }
 function snapshot({rideId,actorId}){
  const ride=rides.get(rideId);
  if(!ride||![ride.passengerId,ride.driverId].includes(actorId))return fail('Access denied');
  return {ok:true,liveEnabled:false,rideId,status:ride.status,driverId:ride.driverId,revision:ride.revision};
 }
 return Object.freeze({request,offer,accept,transition,snapshot});
}

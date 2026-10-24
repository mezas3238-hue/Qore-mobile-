/**
 * G65: authenticated Driver AUTO trip status and lifecycle commands.
 * Host is pinned only by authorized STAGING integrator. No default runtime.
 * The original POST is never retried after uncertain outcome.
 */
import {resolveDriverStatusOrigin} from './driver-status-origin.mjs';
export const DRIVER_TRIP_LIFECYCLE_LIVE_ENABLED=false;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN=/^[A-Za-z0-9._~-]{20,7900}$/;
const NEXT=Object.freeze({accepted:'arrive',arriving:'pickup',
 in_progress:'complete',completed:null,cancelled:null});
const json=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 Object.getPrototypeOf(x)===Object.prototype;
const exact=(x,keys)=>json(x)&&Object.keys(x).length===keys.length&&
 keys.every(k=>Object.hasOwn(x,k));
const STATUS_KEYS=['mode','tripId','state','revision','nextEvent',
 'assignmentPersisted','qaOnly','productionEnabled','liveTripsEnabled',
 'gpsVerified','passengerContactVisible'];
const commandKeys=['mode','commercialRidesEnabled','tripId',
 'event','eventId','serverPersisted'];
function setup({apiOrigin,approvedStagingHost,allowedByOwner,
 accessToken,tripId,request}){
 if(typeof accessToken!=='string'||!TOKEN.test(accessToken)||
  typeof tripId!=='string'||!UUID.test(tripId)||
  typeof request!=='function')throw Error('G65 private Driver trip credentials required');
 return resolveDriverStatusOrigin({apiOrigin,approvedStagingHost,allowedByOwner});
}
export async function readPrivateDriverTripStatus({
 apiOrigin,approvedStagingHost=null,allowedByOwner=false,
 accessToken,tripId,request=fetch
}={}){
 const origin=setup({apiOrigin,approvedStagingHost,allowedByOwner,
  accessToken,tripId,request});
 let reply;
 try{reply=await request(origin+'/v1/staging/driver/trips/'+tripId+'/status',{
  method:'GET',cache:'no-store',credentials:'omit',redirect:'error',
  headers:{authorization:'Bearer '+accessToken,accept:'application/json'}
 });}catch{throw Error('G65 status unavailable');}
 if(reply?.status!==200||reply.redirected===true)
  throw Error('G65 assigned trip unverified');
 let value;
 try{value=await reply.json();}catch{throw Error('G65 bad status response');}
 if(!exact(value,STATUS_KEYS)||value.mode!=='STAGING_DEMO_ONLY'||
  value.tripId!==tripId||!Object.hasOwn(NEXT,value.state)||
  !Number.isSafeInteger(value.revision)||value.revision<2||
  value.nextEvent!==NEXT[value.state]||
  value.assignmentPersisted!==true||value.qaOnly!==true||
  value.productionEnabled!==false||value.liveTripsEnabled!==false||
  value.gpsVerified!==false||value.passengerContactVisible!==false)
  throw Error('G65 untrusted assigned trip state');
 return Object.freeze({tripId,phase:value.state,
  revision:value.revision,nextEvent:value.nextEvent,
  qaOnly:true,productionEnabled:false});
}
export async function transitionPrivateDriverTrip({
 apiOrigin,approvedStagingHost=null,allowedByOwner=false,
 accessToken,tripId,event,eventKey,request=fetch
}={}){
 const origin=setup({apiOrigin,approvedStagingHost,allowedByOwner,
  accessToken,tripId,request});
 if(typeof eventKey!=='string'||!UUID.test(eventKey)||
  !['arrive','pickup','complete'].includes(event))
  throw Error('G65 invalid private lifecycle event');
 let reply;
 try{reply=await request(origin+'/v1/staging/trips/'+tripId+'/transition',{
  method:'POST',cache:'no-store',credentials:'omit',redirect:'error',
  headers:{authorization:'Bearer '+accessToken,
   accept:'application/json','content-type':'application/json'},
  body:JSON.stringify({event,eventKey})
 });}catch{throw Error('G65 transition UNKNOWN_COMMIT; do not retry');}
 if(reply?.status!==200||reply.redirected===true)
  throw Error('G65 transition not confirmed; do not retry');
 let value;
 try{value=await reply.json();}catch{
  throw Error('G65 transition invalid receipt; do not retry');
 }
 if(!exact(value,commandKeys)||value.mode!=='STAGING_DEMO_ONLY'||
  value.commercialRidesEnabled!==false||value.tripId!==tripId||
  value.event!==event||typeof value.eventId!=='string'||
  !UUID.test(value.eventId)||value.serverPersisted!==true)
  throw Error('G65 transition receipt untrusted; do not retry');
 return Object.freeze({tripId,event,receiptId:value.eventId,
  serverPersisted:true,qaOnly:true,productionEnabled:false});
}

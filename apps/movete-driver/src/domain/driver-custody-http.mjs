/**
 * G66 Courier delivery HTTPS adapter; explicit authorized staging origin only.
 * No Client import, no service role keys and no independently forged proof ID.
 */
import {resolveDriverStatusOrigin} from './driver-status-origin.mjs';
import {readG178BoundedDriverLifecycleJson} from './g178-bounded-driver-lifecycle-json.mjs';
export const DRIVER_CUSTODY_LIVE_ENABLED=false;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN=/^[A-Za-z0-9._~-]{20,7900}$/;
const NEXT=Object.freeze({accepted:'pickup',picked_up:'deliver',
 delivered:null,disputed:'return',returned:null,cancelled:null});
const plain=o=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&
 Object.getPrototypeOf(o)===Object.prototype;
const exact=(o,keys)=>plain(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
function origin({apiOrigin,approvedStagingHost=null,allowedByOwner=false,
 accessToken,deliveryId,request}){
 if(!TOKEN.test(accessToken??'')||!UUID.test(deliveryId??'')||
  typeof request!=='function')throw Error('G66 Courier identity or delivery invalid');
 return resolveDriverStatusOrigin({apiOrigin,approvedStagingHost,allowedByOwner});
}
const statusFields=['mode','deliveryId','state','revision','nextEvent',
 'assignmentPersisted','proofVerified','qaOnly','productionEnabled',
 'liveDeliveriesEnabled','senderContactVisible','gpsVerified'];
const receiptFields=['mode','deliveryId','event','eventId','serverPersisted',
 'qaOnly','productionEnabled','liveDeliveriesEnabled','retrySafe'];
export async function readPrivateCourierCustody({
 apiOrigin,approvedStagingHost=null,allowedByOwner=false,
 accessToken,deliveryId,request=fetch,timeoutMs=8000
}={}){
 const base=origin({apiOrigin,approvedStagingHost,allowedByOwner,
  accessToken,deliveryId,request});
 let b;
 // G186: prevent a hung network/body reader or oversized private status
 // JSON from freezing the Driver's delivery screen. Never infer custody.
 try{b=await readG178BoundedDriverLifecycleJson({
  request,url:base+'/v1/staging/courier/deliveries/'+deliveryId+'/custody',
  timeoutMs,options:{method:'GET',cache:'no-store',credentials:'omit',redirect:'error',
   referrerPolicy:'no-referrer',
   headers:{authorization:'Bearer '+accessToken,accept:'application/json'}}
 });}catch{throw Error('G66 custody unavailable');}
 if(!exact(b,statusFields)||b.mode!=='STAGING_DEMO_ONLY'||
  b.deliveryId!==deliveryId||!Object.hasOwn(NEXT,b.state)||
  !Number.isSafeInteger(b.revision)||b.revision<2||
  b.nextEvent!==NEXT[b.state]||b.assignmentPersisted!==true||
  typeof b.proofVerified!=='boolean'||b.qaOnly!==true||
  b.productionEnabled!==false||b.liveDeliveriesEnabled!==false||
  b.senderContactVisible!==false||b.gpsVerified!==false||
  (['delivered','disputed','returned'].includes(b.state)&&b.proofVerified!==true))
  throw Error('G66 untrusted custody state');
 return Object.freeze({deliveryId,phase:b.state,revision:b.revision,
  nextEvent:b.nextEvent,proofVerified:b.proofVerified,
  qaOnly:true,productionEnabled:false});
}
/** Server-registered immutable proof. The UI may not call this with arbitrary
 * proofRef from text or a locally generated UUID. */
export async function transitionPrivateCourierCustody({
 apiOrigin,approvedStagingHost=null,allowedByOwner=false,
 accessToken,deliveryId,event,eventKey,proofRef=null,request=fetch,timeoutMs=8000
}={}){
 const base=origin({apiOrigin,approvedStagingHost,allowedByOwner,
  accessToken,deliveryId,request});
 if(!['pickup','deliver','return'].includes(event)||!UUID.test(eventKey??'')||
  (event==='deliver'?!UUID.test(proofRef??''):proofRef!==null))
  throw Error('G66 invalid custody transition');
 let b;
 // G186: timeout AFTER a PostgreSQL commit is an UNKNOWN outcome, not
 // permission to send a second pickup/deliver/return with a fresh key.
 // G66 controller recovers with GET of the original delivery + revision.
 try{b=await readG178BoundedDriverLifecycleJson({
  request,url:base+'/v1/staging/courier/deliveries/'+deliveryId+'/custody-transition',
  timeoutMs,options:{method:'POST',cache:'no-store',credentials:'omit',redirect:'error',
   referrerPolicy:'no-referrer',
   headers:{authorization:'Bearer '+accessToken,
    accept:'application/json','content-type':'application/json'},
   body:JSON.stringify({event,eventKey,...(event==='deliver'?{proofRef}:{})})}
 });}catch{throw Error('G66 UNKNOWN_COMMIT, no automatic replay');}
 if(!exact(b,receiptFields)||b.mode!=='STAGING_DEMO_ONLY'||
  b.deliveryId!==deliveryId||b.event!==event||!UUID.test(b.eventId??'')||
  b.serverPersisted!==true||b.qaOnly!==true||b.productionEnabled!==false||
  b.liveDeliveriesEnabled!==false||b.retrySafe!==false)
  throw Error('G66 custody receipt untrusted');
 return Object.freeze({deliveryId,event,receiptId:b.eventId,
  serverPersisted:true,qaOnly:true,productionEnabled:false});
}

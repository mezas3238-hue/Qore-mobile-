/**
 * G66 Courier delivery HTTPS adapter; explicit authorized staging origin only.
 * No Client import, no service role keys and no independently forged proof ID.
 */
import {resolveDriverStatusOrigin} from './driver-status-origin.mjs';
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
 accessToken,deliveryId,request=fetch
}={}){
 const base=origin({apiOrigin,approvedStagingHost,allowedByOwner,
  accessToken,deliveryId,request});
 let res;
 try{res=await request(base+'/v1/staging/courier/deliveries/'+deliveryId+'/custody',{
  method:'GET',cache:'no-store',credentials:'omit',redirect:'error',
  headers:{authorization:'Bearer '+accessToken,accept:'application/json'}
 });}catch{throw Error('G66 custody unavailable');}
 if(res?.status!==200||res.redirected===true)
  throw Error('G66 assigned custody not verified');
 let b;try{b=await res.json()}catch{throw Error('G66 invalid custody JSON')}
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
 accessToken,deliveryId,event,eventKey,proofRef=null,request=fetch
}={}){
 const base=origin({apiOrigin,approvedStagingHost,allowedByOwner,
  accessToken,deliveryId,request});
 if(!['pickup','deliver','return'].includes(event)||!UUID.test(eventKey??'')||
  (event==='deliver'?!UUID.test(proofRef??''):proofRef!==null))
  throw Error('G66 invalid custody transition');
 let res;
 try{res=await request(base+'/v1/staging/courier/deliveries/'+deliveryId+'/custody-transition',{
  method:'POST',cache:'no-store',credentials:'omit',redirect:'error',
  headers:{authorization:'Bearer '+accessToken,
   accept:'application/json','content-type':'application/json'},
  body:JSON.stringify({event,eventKey,...(event==='deliver'?{proofRef}:{})})
 });}catch{throw Error('G66 UNKNOWN_COMMIT, no automatic replay');}
 if(res?.status!==200||res.redirected===true)
  throw Error('G66 custody result not confirmed');
 let b;try{b=await res.json()}catch{throw Error('G66 custody receipt invalid')}
 if(!exact(b,receiptFields)||b.mode!=='STAGING_DEMO_ONLY'||
  b.deliveryId!==deliveryId||b.event!==event||!UUID.test(b.eventId??'')||
  b.serverPersisted!==true||b.qaOnly!==true||b.productionEnabled!==false||
  b.liveDeliveriesEnabled!==false||b.retrySafe!==false)
  throw Error('G66 custody receipt untrusted');
 return Object.freeze({deliveryId,event,receiptId:b.eventId,
  serverPersisted:true,qaOnly:true,productionEnabled:false});
}

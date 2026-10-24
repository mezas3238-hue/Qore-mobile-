/** Movete Fácil Driver — STAGING QA private offer decisions.
 * Only a server-verified bearer may authorize the action. The client cannot
 * send driver/courier identity, tariff, GPS, passenger details or role.
 * Caller retains requestKey across retries after uncertain network outcomes.
 */
import {resolveDriverStatusOrigin} from './driver-status-origin.mjs';
export const DRIVER_OFFER_DECISIONS_LIVE_ENABLED=false;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BEARER=/^[A-Za-z0-9._~-]{20,7900}$/;
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const route={AUTO_RIDE:'/v1/staging/driver/offers/',DELIVERY:'/v1/staging/courier/delivery-offers/'};
export async function decidePrivateDriverOffer({
 apiOrigin,accessToken,kind,offerId,requestKey,action,
 approvedStagingHost=null,allowedByOwner=false,request=fetch
}={}){
 if(typeof apiOrigin!=='string'||typeof accessToken!=='string'||!BEARER.test(accessToken)||
   !Object.hasOwn(route,kind)||typeof offerId!=='string'||!UUID.test(offerId)||
   typeof requestKey!=='string'||!UUID.test(requestKey)||
   !['accept','decline'].includes(action)||typeof request!=='function')
  throw Error('Invalid private Driver decision configuration');
 const origin=resolveDriverStatusOrigin({apiOrigin,approvedStagingHost,allowedByOwner});
 let response;
 try{
  response=await request(origin+route[kind]+action,{
   method:'POST',cache:'no-store',credentials:'omit',redirect:'error',
   headers:{authorization:'Bearer '+accessToken,
    accept:'application/json','content-type':'application/json'},
   body:JSON.stringify({offerId,requestKey})
  });
 }catch{throw Error('Private Driver decision uncertain; verify server state before retrying');}
 if(response?.status===401)throw Error('Driver session expired');
 if(response?.status===403)throw Error('Driver role not authorized');
 if(response?.status===409)throw Error('Offer expired, assigned or decision conflicted; resync required');
 if(response?.status!==200)throw Error('Driver decision unconfirmed; resync required');
 let value;
 try{value=await response.json();}catch{
  throw Error('Driver decision confirmation invalid; resync required');
 }
 if(!obj(value)||value.mode!=='STAGING_DEMO_ONLY'||value.outcome!==(action==='accept'?'accepted':'declined')||
   value.pushDelivered!==false||
   (kind==='AUTO_RIDE'&&value.commercialRidesEnabled!==false)||
   (kind==='DELIVERY'&&(value.liveDeliveriesEnabled!==false||value.serverPersisted!==true)))
  throw Error('Driver decision confirmation invalid; resync required');
 const receipt=action==='accept'?value.eventId:value.offerId;
 if(typeof receipt!=='string'||!UUID.test(receipt)||
    (action==='decline'&&receipt!==offerId))
  throw Error('Driver decision receipt invalid; resync required');
 return Object.freeze({kind,action,outcome:value.outcome,
  receiptId:receipt,liveEnabled:false,
  // Persisted decision != arrival of a push or passenger notification.
  pushDelivered:false});
}

/**
 * G64: separate read-only consultation of a possibly committed offer action.
 * Never calls the original accept/decline endpoint and never accepts an
 * absent/unknown row as proof that a retry is safe.
 */
export async function reconcilePrivateDriverOffer({
 apiOrigin,approvedStagingHost=null,allowedByOwner=false,
 accessToken,kind,offerId,requestKey,action,request=fetch
}={}){
 if(typeof apiOrigin!=='string'||typeof accessToken!=='string'||
  !BEARER.test(accessToken)||!Object.hasOwn(route,kind)||
  typeof offerId!=='string'||!UUID.test(offerId)||
  typeof requestKey!=='string'||!UUID.test(requestKey)||
  !['accept','decline'].includes(action)||typeof request!=='function')
  throw Error('G64 invalid Driver decision reconciliation request');
 const origin=resolveDriverStatusOrigin({
  apiOrigin,approvedStagingHost,allowedByOwner});
 let response;
 try{
  response=await request(origin+route[kind]+'reconcile',{
   method:'POST',redirect:'error',credentials:'omit',cache:'no-store',
   headers:{authorization:'Bearer '+accessToken,
    accept:'application/json','content-type':'application/json'},
   body:JSON.stringify({offerId,requestKey,action})
  });
 }catch{throw Error('G64 decision outcome unknown; do not repeat original action');}
 if(response?.status!==200)
  throw Error('G64 decision not authoritatively confirmed; do not retry');
 let value;
 try{value=await response.json();}catch{
  throw Error('G64 decision receipt invalid; do not retry');
 }
 const keys=['mode','state','kind','action','offerId','requestKey',
  'outcome','receiptId','serverPersisted','liveEnabled','pushDelivered',
  'qaOnly','productionEnabled','retrySafe'];
 if(!obj(value)||Object.keys(value).length!==keys.length||
  !keys.every(k=>Object.hasOwn(value,k))||
  value.mode!=='STAGING_DEMO_ONLY'||value.state!=='COMMITTED'||
  value.kind!==kind||value.action!==action||value.offerId!==offerId||
  value.requestKey!==requestKey||
  value.outcome!==(action==='accept'?'accepted':'declined')||
  typeof value.receiptId!=='string'||!UUID.test(value.receiptId)||
  (action==='decline'&&value.receiptId!==offerId)||
  value.serverPersisted!==true||value.liveEnabled!==false||
  value.pushDelivered!==false||value.qaOnly!==true||
  value.productionEnabled!==false||value.retrySafe!==false)
  throw Error('G64 untrusted decision receipt; do not retry');
 return Object.freeze({kind,action,outcome:value.outcome,
  receiptId:value.receiptId,serverPersisted:true,
  liveEnabled:false,pushDelivered:false});
}

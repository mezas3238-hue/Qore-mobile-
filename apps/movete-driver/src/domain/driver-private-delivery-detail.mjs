/** Existing Backend A G10 private offer detail. STAGING/QA only. */
import {resolveDriverStatusOrigin} from './driver-status-origin.mjs';
const ID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const TOKEN=/^[A-Za-z0-9._~-]{20,7900}$/;
const keys=['mode','liveDeliveriesEnabled','offerId','deliveryId','vehicleId',
 'vehicleKind','category','grams','dimensionsCm','pickupTag','deliveryTag',
 'expiresAtMs','confirmedAcceptance'];
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,k)=>plain(x)&&Object.keys(x).length===k.length&&k.every(n=>Object.hasOwn(x,n));
export async function readDriverPrivateDeliveryDetail({
 apiOrigin,approvedStagingHost=null,allowedByOwner=false,accessToken,
 offerId,request=fetch,now=Date.now
}={}){
 if(!ID.test(offerId??'')||typeof accessToken!=='string'
  ||!TOKEN.test(accessToken)||typeof request!=='function')
  throw Error('PRIVATE_OFFER_AUTH_REQUIRED');
 const base=resolveDriverStatusOrigin({apiOrigin,approvedStagingHost,allowedByOwner});
 let response;
 try{response=await request(base+'/v1/staging/courier/delivery-offers/'+offerId,{
  method:'GET',cache:'no-store',credentials:'omit',redirect:'error',
  headers:{authorization:'Bearer '+accessToken,accept:'application/json'}
 });}catch{throw Error('PRIVATE_OFFER_UNAVAILABLE');}
 if(response?.status!==200||response.redirected===true)
  throw Error('PRIVATE_OFFER_NOT_FOUND');
 const len=response.headers?.get?.('content-length');
 if(len!=null&&(!/^\d+$/.test(len)||Number(len)>4096))
  throw Error('PRIVATE_OFFER_TOO_LARGE');
 let data;try{data=await response.json();}catch{throw Error('PRIVATE_OFFER_BAD_JSON');}
 const at=now();
 if(!exact(data,keys)||data.mode!=='STAGING_DEMO_ONLY'
  ||data.liveDeliveriesEnabled!==false||data.offerId!==offerId
  ||!ID.test(data.deliveryId??'')||!ID.test(data.vehicleId??'')
  ||!['MOTO','AUTO'].includes(data.vehicleKind)
  ||typeof data.category!=='string'||!/^[A-Z0-9_]{1,32}$/.test(data.category)
  ||!Number.isSafeInteger(data.grams)||data.grams<1||data.grams>1000000
  ||!exact(data.dimensionsCm,['length','width','height'])
  ||!['length','width','height'].every(k=>
   Number.isSafeInteger(data.dimensionsCm[k])&&data.dimensionsCm[k]>0
   &&data.dimensionsCm[k]<=500)
  ||typeof data.pickupTag!=='string'||data.pickupTag.length>64
  ||typeof data.deliveryTag!=='string'||data.deliveryTag.length>64
  ||!Number.isSafeInteger(data.expiresAtMs)
  ||data.expiresAtMs<=at+3000||data.expiresAtMs>at+45000
  ||data.confirmedAcceptance!==false)
  throw Error('PRIVATE_OFFER_INVALID_RECEIPT');
 // PII and vehicleId/tags are intentionally removed before entering UI.
 return Object.freeze({
  offerId,deliveryId:data.deliveryId,
  vehicleKind:data.vehicleKind,category:data.category,grams:data.grams,
  dimensionsCm:Object.freeze({...data.dimensionsCm}),
  expiresAtMs:data.expiresAtMs,qaOnly:true,productionEnabled:false
 });
}

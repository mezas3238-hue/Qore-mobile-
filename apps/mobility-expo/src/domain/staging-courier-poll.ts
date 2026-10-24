/**
 * G15 courier inbox — a single LOCAL QA read, NOT a background poller.
 * The caller must supply a verified existing Auth access token. Do not store
 * or expose the token in logs. No LIVE dispatch, GPS, push or payment.
 */
export const COURIER_POLL_LIVE_ENABLED=false as const;
export type PrivateCourierOffer=Readonly<{
 offerId:string;deliveryId:string;expiresAtMs:number;
}>;
type JsonResponse={status:number;json():Promise<unknown>};
type RequestFn=(url:string,options:RequestInit)=>Promise<JsonResponse>;
type PollOptions={
 baseUrl:string;accessToken:string;request?:RequestFn;now?:()=>number;
};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bearer=/^[A-Za-z0-9._~-]{20,7900}$/;
const object=(x:unknown):x is Record<string,unknown> =>
 x!==null&&typeof x==='object'&&!Array.isArray(x);
export async function readStagingCourierOffers({
 baseUrl,accessToken,request=fetch,now=Date.now
}:PollOptions):Promise<ReadonlyArray<PrivateCourierOffer>>{
 if(typeof baseUrl!=='string'||typeof accessToken!=='string'||
   !bearer.test(accessToken)||typeof request!=='function'||typeof now!=='function')
  throw Error('G15 local courier polling configuration invalid');
 let base:URL;
 try{base=new URL(baseUrl);}catch{throw Error('G15 local endpoint invalid');}
 if(base.protocol!=='http:'||base.hostname!=='127.0.0.1'||
   !base.port||base.pathname!=='/'||base.search||base.hash||
   base.username||base.password)
  throw Error('G15 refuses non-loopback polling');
 const at=now();
 if(!Number.isSafeInteger(at)||at<0)throw Error('G15 local clock invalid');
 let response:JsonResponse;
 try{
  response=await request(base.origin+'/v1/staging/courier/delivery-offers',{
   method:'GET',cache:'no-store',credentials:'omit',
   headers:{authorization:'Bearer '+accessToken,accept:'application/json'}
  });
 }catch{throw Error('G15 private courier polling unavailable');}
 if(response.status===401)throw Error('G15 verified session expired');
 if(response.status!==200)throw Error('G15 private courier polling unavailable');
 let body:unknown;
 try{body=await response.json();}catch{
  throw Error('G15 private courier snapshot invalid');
 }
 if(!object(body)||body.mode!=='STAGING_DEMO_ONLY'||
    body.liveDeliveriesEnabled!==false||body.deviceReceived!==false||
    body.pushDelivered!==false||body.suggestedPollIntervalMs!==5000||
    !Array.isArray(body.offers)||body.offers.length>5)
  throw Error('G15 private courier snapshot invalid');
 const seen=new Set<string>(),offers:PrivateCourierOffer[]=[];
 for(const item of body.offers){
  if(!object(item)||Object.keys(item).length!==3||
    typeof item.offerId!=='string'||!UUID.test(item.offerId)||
    typeof item.deliveryId!=='string'||!UUID.test(item.deliveryId)||
    typeof item.expiresAtMs!=='number'||!Number.isSafeInteger(item.expiresAtMs)||
    item.expiresAtMs<=at+3000||item.expiresAtMs>at+45000||
    seen.has(item.offerId))
   throw Error('G15 private courier snapshot invalid');
  seen.add(item.offerId);
  offers.push(Object.freeze({offerId:item.offerId,
   deliveryId:item.deliveryId,expiresAtMs:item.expiresAtMs}));
 }
 return Object.freeze(offers);
}

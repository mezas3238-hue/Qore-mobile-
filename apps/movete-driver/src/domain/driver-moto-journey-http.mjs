/**
 * G188: original G169/G118 MOTO Driver lifecycle, private QA-only.
 * No MOTO offer creation, no municipal legal waiver, no GPS or payments.
 * The URL bookingKey never authorizes access: independent IdP, G71 and
 * owner-scoped G169 SQL decide each read and step on the backend.
 */
import {resolveDriverStatusOrigin} from './driver-status-origin.mjs';
import {readG178BoundedDriverLifecycleJson} from './g178-bounded-driver-lifecycle-json.mjs';
export const DRIVER_MOTO_JOURNEY_LIVE_ENABLED=false;
const ID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const TOKEN=/^[A-Za-z0-9._~-]{20,7900}$/;
const NEXT=Object.freeze({accepted:'arriving',arriving:'in_progress',
 in_progress:'completed',completed:null});
const REV=Object.freeze({accepted:2,arriving:3,in_progress:4,completed:5});
const exact=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)
 &&Object.getPrototypeOf(v)===Object.prototype
 &&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const FIELDS=['mode','qaOnly','productionEnabled','serviceKind','tripId',
 'bookingKey','tripState','tripRevision','nextState','serverPersisted',
 'gpsVerified','pspCollected'];
function authorize({apiOrigin,approvedStagingHost,allowedByOwner,
 accessToken,bookingKey,request}){
 if(!ID.test(bookingKey??'')||!TOKEN.test(accessToken??'')||
  typeof request!=='function')throw Error('G188 verified Driver MOTO scope required');
 return resolveDriverStatusOrigin({apiOrigin,approvedStagingHost,allowedByOwner});
}
function checked(response,bookingKey){
 if(!exact(response,FIELDS)||response.mode!=='STAGING_DEMO_ONLY'||
  response.qaOnly!==true||response.productionEnabled!==false||
  response.serviceKind!=='MOTO_RIDE'||response.bookingKey!==bookingKey||
  !ID.test(response.tripId??'')||!Object.hasOwn(NEXT,response.tripState)||
  response.tripRevision!==REV[response.tripState]||
  response.nextState!==NEXT[response.tripState]||
  response.serverPersisted!==true||response.gpsVerified!==false||
  response.pspCollected!==false)
  throw Error('G188 untrusted original Driver MOTO state');
 return Object.freeze({bookingKey,tripId:response.tripId,
  status:response.tripState,revision:response.tripRevision,
  nextState:response.nextState,qaOnly:true,productionEnabled:false});
}
export async function readDriverMotoJourney({
 apiOrigin,approvedStagingHost=null,allowedByOwner=false,
 accessToken,bookingKey,request=fetch,timeoutMs=8000
}={}){
 const origin=authorize({apiOrigin,approvedStagingHost,allowedByOwner,
  accessToken,bookingKey,request});
 try{
  const result=await readG178BoundedDriverLifecycleJson({
   request,url:origin+'/v1/staging/driver/moto/bookings/'+bookingKey+'/status',
   timeoutMs,options:{method:'GET',cache:'no-store',credentials:'omit',
    redirect:'error',referrerPolicy:'no-referrer',
    headers:{authorization:'Bearer '+accessToken,accept:'application/json'}}
  });
  return checked(result,bookingKey);
 }catch{throw Error('G188 original Driver MOTO status unavailable');}
}
export async function advanceDriverMotoJourney({
 apiOrigin,approvedStagingHost=null,allowedByOwner=false,
 accessToken,bookingKey,expectedRevision,nextState,commandKey,
 request=fetch,timeoutMs=8000
}={}){
 const origin=authorize({apiOrigin,approvedStagingHost,allowedByOwner,
  accessToken,bookingKey,request});
 const prior=Object.keys(NEXT).find(x=>REV[x]===expectedRevision);
 if(!prior||NEXT[prior]!==nextState||!ID.test(commandKey??''))
  throw Error('G188 invalid original MOTO revision/command');
 let result;
 try{
  result=await readG178BoundedDriverLifecycleJson({
   request,url:origin+'/v1/staging/driver/moto/bookings/'+bookingKey+'/advance',
   timeoutMs,options:{method:'POST',cache:'no-store',credentials:'omit',
    redirect:'error',referrerPolicy:'no-referrer',
    headers:{authorization:'Bearer '+accessToken,accept:'application/json',
     'content-type':'application/json'},
    body:JSON.stringify({expectedRevision,nextState,commandKey})}
  });
 }catch{throw Error('G188 original MOTO POST outcome UNKNOWN; never replay');}
 const receipt=checked(result,bookingKey);
 if(receipt.revision!==expectedRevision+1||receipt.status!==nextState)
  throw Error('G188 MOTO revision mismatch; never replay');
 return receipt;
}

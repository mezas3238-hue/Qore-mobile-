/**
 * G106 Driver crash/logout recovery. GET only, HTTPS with explicit trusted
 * STAGING host, never stores tokens or infers an assignment from the phone.
 */
import {resolveDriverStatusOrigin} from './driver-status-origin.mjs';
export const DRIVER_CURRENT_TRIP_LIVE_ENABLED=false;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN=/^[A-Za-z0-9._~-]{20,7900}$/;
const ACTIVE=new Set(['accepted','arriving','in_progress']);
const exact=(x,keys)=>x!==null&&typeof x==='object'&&!Array.isArray(x)
 &&Object.getPrototypeOf(x)===Object.prototype
 &&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
export async function readDriverCurrentTrip({
 apiOrigin,approvedStagingHost=null,allowedByOwner=false,
 accessToken,request=fetch,timeoutMs=8000,maxBytes=4096
}={}){
 if(typeof accessToken!=='string'||!TOKEN.test(accessToken)||
 typeof request!=='function')throw Error('G106 verified Driver Auth required');
 const origin=resolveDriverStatusOrigin({apiOrigin,approvedStagingHost,
  allowedByOwner});
 // G106 is the recovery authority after an AUTO accept and restart.
 // Neither a hung GET nor JSON decoder may lock the app indefinitely.
 const ctl=new AbortController();
 const duration=Number.isSafeInteger(timeoutMs)&&timeoutMs>=100
  &&timeoutMs<=30000?timeoutMs:8000;
 const limit=Number.isSafeInteger(maxBytes)&&maxBytes>=512
  &&maxBytes<=32768?maxBytes:4096;
 let timer;
 const deadline=new Promise((_,reject)=>{
  timer=setTimeout(()=>{
   ctl.abort();reject(Error('G106 Driver trip recovery unavailable'));
  },duration);
 });
 const within=promise=>Promise.race([promise,deadline]);
 let data;
 try{
  const response=await within(request(origin+'/v1/staging/driver/trips/current',{
   method:'GET',cache:'no-store',credentials:'omit',redirect:'error',
   referrerPolicy:'no-referrer',signal:ctl.signal,
   headers:{authorization:'Bearer '+accessToken,accept:'application/json'}
  }));
  if(response?.status!==200||response.redirected===true)
   throw Error('G106 Driver assignment unverified');
  const contentType=response.headers?.get?.('content-type');
  if(contentType!=null&&!/^application\/json(?:\s*;|$)/i.test(contentType))
   throw Error('G106 invalid recovery response');
  const length=response.headers?.get?.('content-length');
  if(length!=null&&(!/^[0-9]+$/.test(length)||Number(length)>limit))
   throw Error('G106 invalid recovery response');
  data=await within(response.json());
  // The transport may omit Content-Length. Reject a forged oversized JSON
  // before any private assignment reaches Driver state.
  const raw=JSON.stringify(data);
  if(typeof raw!=='string'||new TextEncoder().encode(raw).byteLength>limit)
   throw Error('G106 invalid recovery response');
 }catch{
  throw Error('G106 Driver trip recovery unavailable');
 }finally{clearTimeout(timer);}
 if(!exact(data,['mode','activeTrip','liveTripsEnabled','qaOnly',
   'productionEnabled'])||
  data.mode!=='STAGING_DEMO_ONLY'||data.liveTripsEnabled!==false||
  data.qaOnly!==true||data.productionEnabled!==false)
  throw Error('G106 unsafe recovery response');
 const trip=data.activeTrip;
 if(trip===null)return null;
 if(!exact(trip,['tripId','status','revision'])||!UUID.test(trip.tripId)||
   !ACTIVE.has(trip.status)||!Number.isSafeInteger(trip.revision)||
   trip.revision<2)
  throw Error('G106 untrusted active trip');
 return Object.freeze({tripId:trip.tripId,status:trip.status,
  revision:trip.revision});
}

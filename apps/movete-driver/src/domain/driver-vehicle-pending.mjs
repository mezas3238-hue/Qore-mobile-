/**
 * G287 Native Driver -> approved Railway STAGING vehicle draft, pending only.
 * Never imports a service role, user-supplied endpoint, Owner approval or KYC.
 * Caller preserves the same requestKey on uncertain network outcomes.
 */
import {assertDriverApprovedStagingOrigin} from './driver-chat-https-staging.mjs';

const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const TOKEN=/^[A-Za-z0-9._~-]{20,7900}$/;
const PATH='/v1/staging/vehicle-applications';
const SERVICES={AUTO:new Set(['economico','confort','xl']),
 MOTO:new Set(['moto_pasajero'])};
const validObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)
 &&Object.getPrototypeOf(x)===Object.prototype;
const exact=(o,names)=>validObject(o)&&Object.keys(o).length===names.length&&
 names.every(k=>Object.hasOwn(o,k));
const failed=code=>Object.freeze({ok:false,code,commercialEnabled:false});
export function validateDriverPendingVehicleDraft(draft){
 const names=['kind','service','plate','brand','model',
  'year','passengerCapacity'];
 if(!exact(draft,names))return false;
 const {kind,service,plate,brand,model,year,passengerCapacity}=draft;
 if(!Object.hasOwn(SERVICES,kind)||!SERVICES[kind].has(service)||
  typeof plate!=='string'||!/^[A-Z0-9-]{4,12}$/.test(plate)||
  typeof brand!=='string'||brand.trim()!==brand||brand.length<2||brand.length>80||
  typeof model!=='string'||model.trim()!==model||model.length<1||model.length>80||
  !Number.isSafeInteger(year)||year<1995||year>new Date().getUTCFullYear()+1||
  !Number.isSafeInteger(passengerCapacity)||passengerCapacity<1||passengerCapacity>8||
  (kind==='MOTO'&&passengerCapacity!==1)||
  (kind==='AUTO'&&passengerCapacity<(service==='xl'?6:3)))
  return false;
 return true;
}
export async function submitDriverPendingVehicle({
 draft,requestKey,auth,apiOrigin,approvedStagingHost,
 allowedByOwner=false,liveEnabled=false,request=fetch,timeoutMs=12000
}={}){
 if(allowedByOwner!==true||liveEnabled!==false)
  return failed('STAGING_VEHICLE_DRAFT_DISABLED');
 let origin;
 try{origin=assertDriverApprovedStagingOrigin({apiOrigin,approvedStagingHost});}
 catch{return failed('STAGING_ORIGIN_NOT_PINNED');}
 if(!validateDriverPendingVehicleDraft(draft)||!UUID.test(requestKey??''))
  return failed('INVALID_REAL_VEHICLE_DRAFT');
 if(!auth||typeof auth.getSession!=='function'||typeof request!=='function')
  return failed('VERIFIED_DRIVER_SESSION_UNAVAILABLE');
 let session;
 try{session=await auth.getSession();}
 catch{return failed('VERIFIED_DRIVER_SESSION_UNAVAILABLE');}
 if(session?.role!=='driver'||!UUID.test(session.userId??'')||
   typeof session.accessToken!=='string'||!TOKEN.test(session.accessToken))
  return failed('VERIFIED_DRIVER_SESSION_UNAVAILABLE');
 const controller=new AbortController();
 let timer;
 const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{
  controller.abort();reject(Error('timeout'));
 },timeoutMs>=100&&timeoutMs<=30000?timeoutMs:12000);});
 try{
  const response=await Promise.race([request(origin+PATH,{
   method:'POST',cache:'no-store',redirect:'error',credentials:'omit',
   referrerPolicy:'no-referrer',signal:controller.signal,
   headers:{authorization:'Bearer '+session.accessToken,
    'content-type':'application/json',accept:'application/json'},
   body:JSON.stringify({requestKey,...draft})
  }),deadline]);
  if(response?.redirected===true)return failed('STAGING_REDIRECT_DENIED');
  if(response?.status===401)return failed('DRIVER_SESSION_REVOKED');
  if(response?.status===403)return failed('DRIVER_ROLE_DENIED');
  if(response?.status===400)return failed('VEHICLE_FIELDS_REJECTED');
  if(response?.status===429)return failed('VEHICLE_RATE_LIMIT');
  if(response?.status===409)return failed('VEHICLE_PENDING_CONFLICT');
  if(response?.status!==202)return failed('VEHICLE_RECEIPT_UNCONFIRMED');
  const type=response.headers?.get?.('content-type');
  if(type!=null&&!/^application\/json(?:\s*;|$)/i.test(type))
   return failed('VEHICLE_RECEIPT_INVALID');
  const rawLength=response.headers?.get?.('content-length');
  if(rawLength!==null&&rawLength!==undefined&&
   (!/^\d+$/.test(rawLength)||Number(rawLength)>4096))
   return failed('VEHICLE_RECEIPT_INVALID');
  const data=await Promise.race([response.json(),deadline]);
  if(!exact(data,['mode','applicationId','status','evidenceVerified',
    'driverEligible','commercialEnabled'])||
   data.mode!=='STAGING_DEMO_ONLY'||!UUID.test(data.applicationId??'')||
   data.status!=='pending'||data.evidenceVerified!==false||
   data.driverEligible!==false||data.commercialEnabled!==false||
   JSON.stringify(data).length>4096)return failed('VEHICLE_RECEIPT_INVALID');
  return Object.freeze({ok:true,applicationId:data.applicationId,
   status:'pending',driverEligible:false,commercialEnabled:false});
 }catch{return failed('VEHICLE_RECEIPT_UNCONFIRMED');}
 finally{clearTimeout(timer);}
}

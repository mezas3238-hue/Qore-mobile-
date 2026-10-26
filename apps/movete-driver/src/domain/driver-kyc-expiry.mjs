/**
 * Driver KYC expiry/renewal status, HTTPS STAGING. A local screen notification
 * does NOT grant commercial dispatch. No push/background service is installed.
 */
import {resolveDriverStatusOrigin} from './driver-status-origin.mjs';
export const DRIVER_KYC_EXPIRY_LIVE_ENABLED=false;
export const KYC_DOCUMENT_LABELS=Object.freeze({
 licencia:'registro o licencia de conducir',
 identidad_frente:'cédula de identidad (frente)',
 identidad_dorso:'cédula de identidad (dorso)',
 cedula_verde:'cédula verde del vehículo',
 habilitacion:'habilitación del vehículo',
 seguro:'seguro del vehículo',
 inspeccion:'inspección técnica del vehículo',
 rostro_selfie:'verificación de rostro'
});
const KINDS=new Set(Object.keys(KYC_DOCUMENT_LABELS));
const STATES=new Set(['BLOCKED_EXPIRED','BLOCKED_REVIEW','SUSPENDED','READY_QA']);
const KEYS=['mode','state','expiredKinds','renewalRequiredKinds','expiringSoonKinds',
 'nearestExpiryAtMs','accountBlocked','qaOnboardingActive','commercialDispatchAuthorized',
 'qaOnly','productionEnabled'];
const TOKEN=/^[A-Za-z0-9._~-]{20,7900}$/;
const exact=(x,keys)=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const kinds=v=>Array.isArray(v)&&v.length<=8&&new Set(v).size===v.length&&
 v.every(s=>KINDS.has(s));
export function assertDriverKycExpirySnapshot(data,now=Date.now()){
 if(!exact(data,KEYS)||data.mode!=='STAGING_DEMO_ONLY'||
  !STATES.has(data.state)||!kinds(data.expiredKinds)||
  !kinds(data.renewalRequiredKinds)||!kinds(data.expiringSoonKinds)||
  !(data.nearestExpiryAtMs===null||
   Number.isSafeInteger(data.nearestExpiryAtMs)&&data.nearestExpiryAtMs>now)||
  typeof data.accountBlocked!=='boolean'||
  typeof data.qaOnboardingActive!=='boolean'||
  data.accountBlocked===data.qaOnboardingActive||
  data.qaOnboardingActive!==(data.state==='READY_QA')||
  data.commercialDispatchAuthorized!==false||
  data.qaOnly!==true||data.productionEnabled!==false||
  (data.state==='BLOCKED_EXPIRED'&&data.expiredKinds.length===0)||
  (data.state==='READY_QA'&&data.renewalRequiredKinds.length!==0)||
  !data.expiredKinds.every(k=>data.renewalRequiredKinds.includes(k)))
   throw Error('UNTRUSTED_DRIVER_DOCUMENT_VALIDITY');
 return Object.freeze({...data,
  expiredKinds:Object.freeze([...data.expiredKinds]),
  renewalRequiredKinds:Object.freeze([...data.renewalRequiredKinds]),
  expiringSoonKinds:Object.freeze([...data.expiringSoonKinds])});
}
export async function readDriverKycExpiry({
 apiOrigin,accessToken,approvedStagingHost=null,
 allowedByOwner=false,request=fetch,now=Date.now
}={}){
 if(typeof accessToken!=='string'||!TOKEN.test(accessToken)||
  typeof request!=='function'||typeof now!=='function')
  throw Error('DRIVER_PRIVATE_SESSION_REQUIRED');
 const origin=resolveDriverStatusOrigin({
  apiOrigin,approvedStagingHost,allowedByOwner});
 let response;
 try{
  response=await request(origin+'/v1/staging/driver/kyc/validity',{
   method:'GET',cache:'no-store',credentials:'omit',
   headers:{authorization:'Bearer '+accessToken,accept:'application/json'}
  });
 }catch{throw Error('DRIVER_DOCUMENT_VALIDITY_UNAVAILABLE');}
 if(response?.status!==200)throw Error('DRIVER_DOCUMENT_VALIDITY_UNAVAILABLE');
 let data;
 try{data=await response.json();}catch{
  throw Error('UNTRUSTED_DRIVER_DOCUMENT_VALIDITY');
 }
 return assertDriverKycExpirySnapshot(data,now());
}
export function driverKycScreenNotice(data){
 if(!data)return Object.freeze({severity:'warning',
  text:'No se puede comprobar la vigencia documental. La cuenta permanece bloqueada hasta verificar el servidor.'});
 const labels=list=>list.map(k=>KYC_DOCUMENT_LABELS[k]).join(', ');
 if(data.state==='SUSPENDED')return Object.freeze({severity:'warning',
  text:'La cuenta está suspendida por una revisión administrativa. Renovar documentos no elimina esta suspensión; contactá a soporte.'});
 if(data.state==='BLOCKED_EXPIRED')return Object.freeze({severity:'warning',
  text:'Tu documento ha vencido: '+labels(data.expiredKinds)+'. La cuenta está bloqueada. Renovalo, enviá fotos nuevas y esperá su verificación para volver a habilitar el acceso.'});
 if(data.state==='BLOCKED_REVIEW')return Object.freeze({severity:'warning',
  text:'Tu cuenta está bloqueada mientras se verifican los documentos: '+labels(data.renewalRequiredKinds)+'. Subí los documentos renovados; la habilitación se recuperará automáticamente cuando el servidor confirme su validez.'});
 if(data.expiringSoonKinds.length)return Object.freeze({severity:'warning',
  text:'Próximo vencimiento: '+labels(data.expiringSoonKinds)+'. Renovalo antes de que venza para evitar un bloqueo.'});
 return Object.freeze({severity:'info',
  text:'Tu expediente está vigente en las pruebas de STAGING. Esto no habilita servicios comerciales.'});
}

// C / #17: fresh, verified KYC before each explicit offer acceptance.
// This browser/device-side fence is NOT commercial authorization.
// Never expose bearer, userId or document data in the result.
const DRIVER_ID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const validDriver=s=>s&&s.role==='driver'&&DRIVER_ID.test(s.userId??'')
 &&typeof s.accessToken==='string'&&/^[A-Za-z0-9._~-]{20,7900}$/.test(s.accessToken);
export async function verifyDriverKycForOffer({
 getSession,readStatus,isCurrent=()=>true,now=Date.now
}={}){
 const reject=code=>Object.freeze({ok:false,code});
 if([getSession,readStatus,isCurrent,now].some(fn=>typeof fn!=='function'))
  return reject('KYC_NOT_CONFIGURED');
 try{
  const before=await getSession();
  if(!isCurrent()||!validDriver(before))return reject('DRIVER_SESSION_REQUIRED');
  const data=assertDriverKycExpirySnapshot(
   await readStatus({accessToken:before.accessToken}),now());
  const after=await getSession();
  if(!isCurrent()||!validDriver(after)||after.userId!==before.userId
   ||after.accessToken!==before.accessToken)return reject('STALE_DRIVER_SESSION');
  if(data.state!=='READY_QA'||data.accountBlocked!==false
   ||data.qaOnboardingActive!==true)return reject('DOCUMENTS_BLOCKED');
  return Object.freeze({ok:true,code:'READY_QA'});
 }catch{return reject('KYC_READ_UNVERIFIED');}
}

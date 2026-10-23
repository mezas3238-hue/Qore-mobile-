import {readContinuation} from './page-cursor.mjs';
/**
 * Proyección de lectura Admin WEB, nunca autorización.
 * DTO propuesto para A; no sustituye políticas RLS, JWT, MFA ni audit trail.
 * Rechaza claves no reconocidas para evitar exposición incidental de PII.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid=x=>typeof x==='string'&&UUID.test(x);
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,allowed)=>obj(x)&&Object.keys(x).every(k=>allowed.includes(k));
const statuses=new Set(['pending','under_review','rejected','approved','expired']);
const docStates=new Set(['missing','pending','valid','expired','rejected']);
const kinds=new Set(['AUTO','MOTO_DELIVERY']);
const exactTop=['scope','revision','generatedAt','expiresAt','items','nextCursor'];
const exactItem=['vehicleId','vehicleKind','applicationStatus','licenseStatus','insuranceStatus','inspectionStatus','reviewRevision'];
export function projectKycQueue(data,{role,now=Date.now()}={}){
 if(role!=='admin'||!exact(data,exactTop)
   ||data.scope!=='admin.kyc.read'||!Number.isSafeInteger(data.revision)||data.revision<0
   ||!Number.isSafeInteger(data.generatedAt)||data.generatedAt>now||data.generatedAt<now-300000
   ||!Number.isSafeInteger(data.expiresAt)||data.expiresAt<=now||data.expiresAt>now+300000
   ||!Array.isArray(data.items)||data.items.length>100||!readContinuation(data).ok)return null;
 const seen=new Set(),rows=[];
 for(const v of data.items){
  if(!exact(v,exactItem)||!exactItem.every(k=>Object.hasOwn(v,k))
    ||!uuid(v.vehicleId)||seen.has(v.vehicleId)
    ||!kinds.has(v.vehicleKind)||!statuses.has(v.applicationStatus)
    ||!docStates.has(v.licenseStatus)||!docStates.has(v.insuranceStatus)
    ||!docStates.has(v.inspectionStatus)
    ||!Number.isSafeInteger(v.reviewRevision)||v.reviewRevision<0)return null;
  seen.add(v.vehicleId);
  rows.push(Object.freeze({...v}));
 }
 return Object.freeze({revision:data.revision,generatedAt:data.generatedAt,expiresAt:data.expiresAt,
  items:Object.freeze(rows),nextCursor:readContinuation(data).nextCursor});
}
export function createKycQueueStore({now=()=>Date.now()}={}){
 let queue=null;
 function replace(payload,role){
  queue=projectKycQueue(payload,{role,now:now()});
  return queue!==null;
 }
 function current(){
  if(!queue||queue.expiresAt<=now()){queue=null;return null;}
  return queue;
 }
 function clear(){queue=null;}
 return Object.freeze({replace,current,clear});
}

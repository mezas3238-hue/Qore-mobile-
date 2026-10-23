import {createAdminSessionController} from './admin-session.mjs';
import {createKycQueueStore} from './kyc-queue.mjs';
import {createOwnerFinanceStore} from './owner-finance.mjs';
import {createZoneOverviewStore} from './zone-overview.mjs';
import {createIncidentQueueStore} from './incidents-overview.mjs';

/**
 * Composición web B11: ninguna sesión/cola real se crea por defecto.
 * Exige proveedor Auth de A con MFA comprobada, no un toggle de navegador.
 * Las operaciones de escritura siguen bajo validación y autorización de A.
 */
const fail=code=>({ok:false,code});
export function createAdminExperience({authProvider=null,gateway=null,now=()=>Date.now()}={}){
 const queue=createKycQueueStore({now});
 const finance=createOwnerFinanceStore({now});
 const zones=createZoneOverviewStore({now});
 const incidents=createIncidentQueueStore({now});
 let session;
 const listeners=new Set();
 const notify=()=>{for(const callback of listeners){try{callback();}catch{/* no filtrar secretos */}}};
 const clearPrivate=()=>{queue.clear();finance.clear();zones.clear();incidents.clear();};
 session=createAdminSessionController({provider:authProvider,clearSensitive:clearPrivate,now});
 function snapshot(){
  const current=session.publicSession();
  if(!current){clearPrivate();return Object.freeze({authenticated:false,account:null,kyc:null,finance:null,zones:null,incidents:null,actionsEnabled:false});}
  return Object.freeze({
   authenticated:true,
   account:Object.freeze({subject:current.subject,role:current.role,mfaVerified:true}),
   kyc:current.role==='admin'?queue.current():null,
   finance:current.role==='owner'?finance.current(current):null,
   zones:current.role==='admin'?zones.current(current.role):null,
   incidents:current.role==='admin'?incidents.current(current.role):null,
   // La UI nunca habilita acciones por permisos locales.
   actionsEnabled:false
  });
 }
 function readKyc(dto){
  const current=session.publicSession();
  if(!current){queue.clear();notify();return false;}
  const accepted=queue.replace(dto,current.role);
  notify();
  return accepted;
 }
 function readFinance(dto){
  const current=session.publicSession();
  if(!current||current.role!=='owner'){finance.clear();notify();return false;}
  const accepted=finance.replace(dto,current);
  notify();return accepted;
 }
 function readZones(dto){
  const current=session.publicSession();
  if(!current||current.role!=='admin'){zones.clear();notify();return false;}
  const accepted=zones.replace(dto,current.role);
  notify();return accepted;
 }
 function readIncidents(dto){
  const current=session.publicSession();
  if(!current||current.role!=='admin'){incidents.clear();notify();return false;}
  const accepted=incidents.replace(dto,current.role);
  notify();return accepted;
 }
 async function reviewVehicle(dto){
  // No inferir permisos/contrato desde una sesión en browser.
  const current=session.publicSession();
  if(!current){clearPrivate();notify();return fail('ADMIN_AUTH_REQUIRED');}
  if(current.role!=='admin')return fail('FORBIDDEN');
  if(!gateway||typeof gateway.isConfigured!=='function'||gateway.isConfigured()!==true
   ||typeof gateway.reviewVehicle!=='function')return fail('ADMIN_CONTRACT_PENDING');
  const sessionRevision=session.revision();
  let response;
  try{response=await gateway.reviewVehicle(dto);}
  catch{response=fail('NETWORK_OR_TIMEOUT');}
  const after=session.publicSession();
  // Un ACK viejo de una cuenta ya cerrada o sustituida no puede confirmar
  // una operación administrativa sobre la nueva sesión.
  if(!after||after.subject!==current.subject||after.role!==current.role||session.revision()!==sessionRevision){
   clearPrivate();notify();return fail('STALE_SESSION_RESPONSE');
  }
  // Ningún resultado de revisión se refleja optimistamente en lista.
  // Se requiere nueva lectura servidor con revisión más reciente.
  queue.clear();
  if(!response||response.ok!==true){
   if(response?.code==='AUTH_REQUIRED'||response?.code==='FORBIDDEN')session.clear();
   notify();return fail(response?.code||'REVIEW_NOT_CONFIRMED');
  }
  notify();return {ok:true,refreshRequired:true};
 }
 return Object.freeze({
  subscribe:callback=>{
   if(typeof callback!=='function')return ()=>{};
   listeners.add(callback);return ()=>{listeners.delete(callback);};
  },
  refreshSession:async()=>{const result=await session.refresh();notify();return result;},
  logout:async()=>{clearPrivate();const result=await session.logout();notify();return result;},
  clear:()=>{session.clear();notify();},
  readKyc,readFinance,readZones,readIncidents,reviewVehicle,snapshot
 });
}

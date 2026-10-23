import {createAdminSessionController} from './admin-session.mjs';
import {createKycQueueStore} from './kyc-queue.mjs';
import {createOwnerFinanceStore} from './owner-finance.mjs';
import {createZoneOverviewStore} from './zone-overview.mjs';
import {createIncidentQueueStore} from './incidents-overview.mjs';
import {createAuditFeedStore} from './audit-feed.mjs';
import {createAdminReadGateway} from './admin-read-gateway.mjs';
import {createPageNavigator,readContinuation} from './page-cursor.mjs';
import {createIncidentTriageG41Gateway} from './incident-g41-gateway.mjs';
import {createGlobalTriageFlow} from './incident-g41-flow.mjs';

/**
 * Composición web B11: ninguna sesión/cola real se crea por defecto.
 * Exige proveedor Auth de A con MFA comprobada, no un toggle de navegador.
 * Las operaciones de escritura siguen bajo validación y autorización de A.
 */
const fail=code=>({ok:false,code});
export function createAdminExperience({authProvider=null,gateway=null,readGatewayOptions=null,triageGatewayOptions=null,now=()=>Date.now()}={}){
 const queue=createKycQueueStore({now});
 const finance=createOwnerFinanceStore({now});
 const zones=createZoneOverviewStore({now});
 const incidents=createIncidentQueueStore({now});
 const audit=createAuditFeedStore({now});
 const pages=createPageNavigator();
 let session,globalTriage;
 const listeners=new Set();
 const notify=()=>{for(const callback of listeners){try{callback();}catch{/* no filtrar secretos */}}};
 const clearPrivate=()=>{queue.clear();finance.clear();zones.clear();incidents.clear();audit.clear();pages.clear();globalTriage?.clear();};
 session=createAdminSessionController({provider:authProvider,clearSensitive:clearPrivate,now});
 const readGateway=readGatewayOptions?createAdminReadGateway({
  ...readGatewayOptions,
  now,
  getSession:()=>{
   const value=session.getSessionForGateway();
   return value?{...value,subject:session.publicSession()?.subject,authRevision:session.revision()}:null;
  },
  onSessionInvalid:()=>{session.clear();notify();}
 }):null;

 // G41 sigue UNMOUNTED en A. Sin STAGING real verificado no existe GET.
 const triageGateway=triageGatewayOptions?createIncidentTriageG41Gateway({
  ...triageGatewayOptions,now,
  getSession:()=>{
   const value=session.getSessionForGateway();
   return value?{...value,subject:session.publicSession()?.subject,
    authRevision:session.revision()}:null;
  },
  onSessionInvalid:()=>{session.clear();notify();}
 }):null;
 globalTriage=createGlobalTriageFlow({
  gateway:triageGateway,
  getActor:async()=>{
   const current=session.publicSession();
   return current?{...current,authRevision:session.revision()}:null;
  },now
 });
 async function loadGlobalIncidentTriage(options={}){
  const user=session.publicSession();
  if(!user)return fail('ADMIN_AUTH_REQUIRED');
  if(user.role!=='admin')return fail('FORBIDDEN');
  const result=await globalTriage.load(options);
  notify();return result;
 }

 const stores=Object.freeze({kyc:queue,finance,zones,incidents,audit});
 const reading=new Set();
 function snapshot(){
  const current=session.publicSession();
  if(!current){clearPrivate();return Object.freeze({authenticated:false,account:null,kyc:null,finance:null,zones:null,incidents:null,audit:null,globalTriage:null,
   pagination:Object.freeze({kyc:pages.get('kyc'),zones:pages.get('zones'),
    incidents:pages.get('incidents'),audit:pages.get('audit')}),
   actionsEnabled:false});}
  return Object.freeze({
   authenticated:true,
   account:Object.freeze({subject:current.subject,role:current.role,mfaVerified:true}),
   kyc:current.role==='admin'?queue.current():null,
   finance:current.role==='owner'?finance.current(current):null,
   zones:current.role==='admin'?zones.current(current.role):null,
   incidents:current.role==='admin'?incidents.current(current.role):null,
   audit:current.role==='admin'?audit.current(current.role):null,
   globalTriage:current.role==='admin'?globalTriage.snapshot():null,
   pagination:Object.freeze({
    kyc:pages.get('kyc'),zones:pages.get('zones'),
    incidents:pages.get('incidents'),audit:pages.get('audit')
   }),
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
 function readAudit(dto){
  const current=session.publicSession();
  if(!current||current.role!=='admin'){audit.clear();notify();return false;}
  const accepted=audit.replace(dto,current.role);
  notify();return accepted;
 }
 async function syncFromServer(operation,direction='refresh'){
  if(!Object.hasOwn(stores,operation))return fail('UNKNOWN_READ_OPERATION');
  const current=session.publicSession();
  if(!current)return fail('ADMIN_AUTH_REQUIRED');
  const required=operation==='finance'?'owner':'admin';
  if(current.role!==required)return fail('FORBIDDEN');
  const store=stores[operation];
  if(!readGateway||!readGateway.isConfigured(operation)){
   return fail('READ_CONTRACT_NOT_CERTIFIED');
  }
  if(reading.has(operation))return fail('READ_IN_FLIGHT');
  const request=pages.request(operation,direction);
  if(!request.ok)return fail(request.code);
  reading.add(operation);
  const tokenEpoch=session.revision();
  try{
   let result;
   try{result=await readGateway.read(operation,{cursor:request.cursor});}
   catch{result=fail('NETWORK_OR_TIMEOUT');}
   const latest=session.publicSession();
   if(!latest||latest.subject!==current.subject||latest.role!==current.role
      ||session.revision()!==tokenEpoch){
    // No borrar datos de la nueva cuenta: su sesión podría ser válida.
    return fail('STALE_SESSION_RESPONSE');
   }
   if(!result||result.ok!==true){
    store.clear();pages.clear(operation);notify();
    return fail(result?.code||'READ_UNAVAILABLE');
   }
   const accepted=operation==='finance'?store.replace(result.data,latest)
     :store.replace(result.data,latest.role);
   const continuation=readContinuation(result.data);
   const pageValid=operation==='finance'||(continuation.ok
     &&pages.commit(operation,direction,request.cursor,continuation.nextCursor));
   if(!accepted||!pageValid){
    store.clear();pages.clear(operation);notify();
    return fail('INVALID_READ_DTO');
   }
   notify();
   return Object.freeze({ok:true});
  }finally{reading.delete(operation);}
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
  readKyc,readFinance,readZones,readIncidents,readAudit,
  isReadConfigured:operation=>Boolean(readGateway?.isConfigured(operation)),
  syncFromServer,reviewVehicle,loadGlobalIncidentTriage,snapshot
 });
}

import {createAdminSessionController} from './admin-session.mjs';
import {createKycQueueStore} from './kyc-queue.mjs';
import {createOwnerFinanceStore} from './owner-finance.mjs';
import {createZoneOverviewStore} from './zone-overview.mjs';
import {createIncidentQueueStore} from './incidents-overview.mjs';
import {createAuditFeedStore} from './audit-feed.mjs';
import {createAdminReadGateway} from './admin-read-gateway.mjs';
import {createF1AutoRideAuditGateway} from './f1-auto-ride-audit-gateway.mjs';
import {createServiceTraceGateway} from './service-trace-gateway.mjs';
import {createF1AdminTripIntegrityFence} from './f1-admin-trip-integrity-fence.mjs';
import {createPageNavigator,readContinuation} from './page-cursor.mjs';
import {createIncidentTriageG41Gateway} from './incident-g41-gateway.mjs';
import {createGlobalTriageFlow} from './incident-g41-flow.mjs';

/**
 * Composición web B11: ninguna sesión/cola real se crea por defecto.
 * Exige proveedor Auth de A con MFA comprobada, no un toggle de navegador.
 * Las operaciones de escritura siguen bajo validación y autorización de A.
 */
const fail=code=>({ok:false,code});
export function createAdminExperience({authProvider=null,gateway=null,readGatewayOptions=null,triageGatewayOptions=null,f1RideAuditOptions=null,serviceTraceOptions=null,now=()=>Date.now()}={}){
 const queue=createKycQueueStore({now});
 const finance=createOwnerFinanceStore({now});
 const zones=createZoneOverviewStore({now});
 const incidents=createIncidentQueueStore({now});
 const audit=createAuditFeedStore({now});
 const pages=createPageNavigator();
 const f1Integrity=createF1AdminTripIntegrityFence();
 let session,globalTriage,f1AuditGateway=null,f1Audit=null,f1AuditBusy=false,f1AuditGeneration=0,f1AuditError=null;
 let traceGateway=null,trace=null,traceError=null,traceBusy=false,traceEpoch=0;
 // No second KYC decision after an unknown/accepted POST until an
 // authoritative NEWER server page has been read for the same Admin.
 let reviewInFlight=false,reviewNeedsReconciliation=false,reviewRevisionFloor=-1;
 const listeners=new Set();
 const notify=()=>{for(const callback of listeners){try{callback();}catch{/* no filtrar secretos */}}};
 const clearPrivate=()=>{queue.clear();finance.clear();zones.clear();incidents.clear();audit.clear();pages.clear();globalTriage?.clear();
  f1AuditGeneration++;f1Audit=null;f1AuditBusy=false;f1AuditError=null;
  f1AuditGateway?.cancelPending();
  traceEpoch++;trace=null;traceError=null;traceBusy=false;
  traceGateway?.cancelPending();
  f1Integrity.clear();
  reviewInFlight=false;reviewNeedsReconciliation=false;reviewRevisionFloor=-1;};
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

 // F1 Admin read-only is independent of Passenger privileges and G73.
 // No endpoint is mounted by A yet: this remains OFF in default runtime.
 f1AuditGateway=f1RideAuditOptions?createF1AutoRideAuditGateway({
  ...f1RideAuditOptions,now,
  getSession:()=>{
   const privateValue=session.getSessionForGateway();
   return privateValue?{...privateValue,authRevision:session.revision()}:null;
  },
  onSessionInvalid:()=>{session.clear();notify();}
 }):null;
 traceGateway=serviceTraceOptions?createServiceTraceGateway({
  ...serviceTraceOptions,now,
  getSession:()=>{
   const current=session.getSessionForGateway();
   return current?{...current,authRevision:session.revision()}:null;
  },
  onSessionInvalid:()=>{session.clear();notify();}
 }):null;
 async function loadServiceTrace(kind,id){
  const actor=session.publicSession();
  if(!actor||actor.role!=='admin'||actor.mfaVerified!==true)
   return fail('ADMIN_AUTH_REQUIRED');
  if(!traceGateway?.isConfigured())return fail('TRACE_CONTRACT_PENDING');
  if(traceBusy)return fail('TRACE_IN_FLIGHT');
  const run=++traceEpoch,revision=session.revision();
  trace=null;traceError=null;traceBusy=true;notify();
  try{
   const outcome=await traceGateway.read(kind,id);
   const next=session.publicSession();
   if(run!==traceEpoch||!next||next.subject!==actor.subject
    ||next.role!==actor.role||session.revision()!==revision)
    return fail('STALE_SESSION_RESPONSE');
   if(!outcome.ok){
    traceError=outcome.code??'TRACE_UNAVAILABLE';notify();
    return fail(traceError);
   }
   trace=outcome.data;notify();
   return {ok:true,qaOnly:true,productionEnabled:false};
  }finally{if(run===traceEpoch){traceBusy=false;notify();}}
 }
 function clearServiceTrace(){
  traceEpoch++;trace=null;traceError=null;traceBusy=false;
  traceGateway?.cancelPending();notify();
 }
 function traceSnapshot(actor){
  const authorized=actor?.role==='admin'&&actor?.mfaVerified===true;
  if(trace&&trace.expiresAt<=now())trace=null;
  return Object.freeze({contractReady:Boolean(authorized&&traceGateway?.isConfigured()),
   loading:Boolean(authorized&&traceBusy),item:authorized?trace:null,
   error:authorized?traceError:null,qaOnly:true,productionEnabled:false});
 }
 async function loadF1RideAudit(tripId){
  const current=session.publicSession();
  if(!current||current.role!=='admin'||current.mfaVerified!==true)
   return fail('ADMIN_AUTH_REQUIRED');
  if(!f1AuditGateway?.isConfigured())
   return fail('F1_ADMIN_CONTRACT_PENDING');
  if(f1AuditBusy)return fail('F1_ADMIN_READ_IN_FLIGHT');
  const generation=++f1AuditGeneration,epoch=session.revision();
  f1AuditBusy=true;f1AuditError=null;f1Audit=null;notify();
  try{
   const result=await f1AuditGateway.read(tripId);
   const latest=session.publicSession();
   if(generation!==f1AuditGeneration||!latest
    ||latest.subject!==current.subject||latest.role!==current.role
    ||session.revision()!==epoch)return fail('STALE_SESSION_RESPONSE');
   if(!result?.ok){
    f1AuditError=typeof result?.code==='string'
     ?result.code:'F1_ADMIN_READ_UNAVAILABLE';notify();
    return fail(f1AuditError);
   }
   // A valid G75 200 may still be older than this Admin's previous
   // observation of the exact same trip. Never display a rollback.
   const integrity=f1Integrity.observe(result.data);
   if(!integrity.ok){
    f1AuditError=integrity.code;f1Audit=null;notify();
    return fail(integrity.code);
   }
   f1Audit=result.data;notify();
   return Object.freeze({ok:true,qaOnly:true,productionEnabled:false});
  }finally{
   if(generation===f1AuditGeneration){f1AuditBusy=false;notify();}
  }
 }
 function clearF1RideAudit(){
  f1AuditGeneration++;f1Audit=null;f1AuditBusy=false;f1AuditError=null;
  f1AuditGateway?.cancelPending();notify();
 }
 function f1AuditSnapshot(user){
  const authorized=user?.role==='admin'&&user?.mfaVerified===true;
  const current=f1Audit&&f1Audit.expiresAt>now()?f1Audit:null;
  if(f1Audit&&!current)f1Audit=null;
  return Object.freeze({contractReady:Boolean(authorized&&f1AuditGateway?.isConfigured()),
   loading:Boolean(authorized&&f1AuditBusy),
   item:authorized?current:null,
   error:authorized?f1AuditError:null,qaOnly:true,productionEnabled:false});
 }
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
  const pending=globalTriage.load(options);
  notify();
  const result=await pending;
  notify();return result;
 }

 const stores=Object.freeze({kyc:queue,finance,zones,incidents,audit});
 const reading=new Set();
 function snapshot(){
  const current=session.publicSession();
  if(!current){clearPrivate();return Object.freeze({authenticated:false,account:null,kyc:null,finance:null,zones:null,incidents:null,audit:null,globalTriage:null,f1RideAudit:f1AuditSnapshot(null),serviceTrace:traceSnapshot(null),merchantCases:null,merchantCaseContractReady:false,
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
   f1RideAudit:f1AuditSnapshot(current),
   serviceTrace:traceSnapshot(current),
   // R43 aislado: no convertir G41/seguridad genérica en casos comerciales.
   // El endpoint MerchantSupport A todavía no existe ni está certificado.
   merchantCases:null,merchantCaseContractReady:false,
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
   if(operation==='kyc'&&reviewNeedsReconciliation){
    // A stale GET, even from the same account, cannot resolve a lost ACK.
    if(!Number.isSafeInteger(result.data?.revision)
     ||result.data.revision<=reviewRevisionFloor){
     store.clear();pages.clear(operation);notify();
     return fail('KYC_REVIEW_REVISION_NOT_ADVANCED');
    }
    reviewNeedsReconciliation=false;reviewRevisionFloor=-1;
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
  if(reviewInFlight)return fail('ADMIN_REVIEW_IN_FLIGHT');
  if(reviewNeedsReconciliation)return fail('KYC_REVIEW_RECONCILIATION_REQUIRED');
  const sessionRevision=session.revision();
  const baseline=queue.current()?.revision??-1;
  // Mark in flight BEFORE invoking any async transport.
  reviewInFlight=true;
  let response;
  try{response=await gateway.reviewVehicle(dto);}
  catch{response=fail('NETWORK_OR_TIMEOUT');}
  const after=session.publicSession();
  // The session controller already purges on logout/token rotation.
  // A late ACK must not purge a newer Admin's valid private state.
  if(!after||after.subject!==current.subject||after.role!==current.role
   ||session.revision()!==sessionRevision){
   notify();return fail('STALE_SESSION_RESPONSE');
  }
  reviewInFlight=false;
  reviewNeedsReconciliation=true;
  reviewRevisionFloor=baseline;
  // Receipt, timeout, 409, and unknown outcome all require a newer
  // read from the authoritative server; never repeat the POST blindly.
  queue.clear();pages.clear('kyc');
  if(!response||response.ok!==true){
   if(response?.code==='AUTH_REQUIRED'||response?.code==='FORBIDDEN'){
    session.clear();notify();return fail(response.code);
   }
   const known=new Set(['NETWORK_OR_TIMEOUT','CONFLICT','RATE_LIMITED',
    'SERVICE_UNAVAILABLE','REVIEW_NOT_CONFIRMED']);
   notify();return fail(known.has(response?.code)?response.code:'REVIEW_NOT_CONFIRMED');
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
  syncFromServer,reviewVehicle,loadGlobalIncidentTriage,
  loadF1RideAudit,clearF1RideAudit,loadServiceTrace,clearServiceTrace,snapshot
 });
}

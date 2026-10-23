import {createClientSessionController} from './client-session.mjs';
import {createClientMutationController} from './client-mutations.mjs';
import {createQuoteViewStore} from './quote-view.mjs';
import {createClientHistoryStore} from './history-feed.mjs';
import {createClientHistoryGateway} from './client-history-gateway.mjs';
import {createRiderStatusGateway} from './ride-status-gateway.mjs';
import {createFareQuoteGateway} from './fare-quote-gateway.mjs';
import {createFareQuoteFlow} from './fare-quote-flow.mjs';
import {createRideCancellationGateway,createRideCancellationController} from './ride-cancellation.mjs';
import {createRiderPollingCoordinator} from './rider-polling.mjs';
import {createRiderStatusStore} from './rider-status.mjs';
import {createIncidentG40Gateway} from './incident-g40-gateway.mjs';
import {createIncidentReportFlow} from './incident-report-flow.mjs';
import {createCommerceCatalogFlow} from './commerce-catalog-flow.mjs';
import {createCommerceCatalogPager} from './commerce-catalog-pages.mjs';

/**
 * Composición sin estado persistente de la app Cliente. Une los contratos
 * internos B03/B04/B05/B06/B09 manteniendo fail-closed por defecto.
 *
 * Inyectar un gateway NO lo certifica ni despliega. Backend A conserva
 * autenticación real, autorización, revisión, precios y acceso a terceros.
 */
const fail=code=>({ok:false,code});
export function createClientExperience({authProvider=null,gateway=null,historyGatewayOptions=null,cancelGatewayOptions=null,statusGatewayOptions=null,fareGatewayOptions=null,incidentGatewayOptions=null,commerceCatalogGateway=null,
 commerceCatalogPageGateway=null,now=()=>Date.now()}={}){
 const quote=createQuoteViewStore({now});
 const history=createClientHistoryStore({now});
 const riderStore=createRiderStatusStore({now});
 let commerceFlow,commercePager;
 let mutations,tracking,cancellation,fareFlow,incidentFlow;
 let historyLoading=false,historyLoadError=null;
 const seenCursors=new Set();
 const observers=new Set();
 const notify=()=>{for(const fn of observers){try{fn();}catch{/* listener UI aislado */}}};
 const clearPrivate=()=>{
  if(mutations)mutations.clear();
  if(tracking)tracking.stop();
  if(cancellation)cancellation.clear();
  if(fareFlow)fareFlow.clear();
  if(incidentFlow)incidentFlow.clear();
  if(commerceFlow)commerceFlow.clear();
  if(commercePager)commercePager.clear();
  quote.clear();
  history.clear();
  historyLoading=false;historyLoadError=null;seenCursors.clear();
 };
 const session=createClientSessionController({provider:authProvider,clearPrivateState:clearPrivate,now});
 const actor=()=>session.publicSession();
 const actorSession=()=>{
  const user=actor();
  return user?{...user,sessionRevision:session.privacyRevision()}:null;
 };
 const cancelGateway=cancelGatewayOptions?createRideCancellationGateway({
  ...cancelGatewayOptions,now,
  getSession:()=>{
   const privateSession=session.getSessionForGateway();
   const visible=actor();
   return privateSession&&visible?{...privateSession,subject:visible.subject,
    authRevision:session.revision(),sessionRevision:session.privacyRevision()}:null;
  },
  onSessionInvalid:()=>{session.clear();notify();}
 }):null;
 cancellation=createRideCancellationController({
  gateway:cancelGateway,getSession:async()=>actorSession()
 });


 // G40 no está montado por A: inyección explícita, sin red por defecto.
 const incidentGateway=incidentGatewayOptions?createIncidentG40Gateway({
  ...incidentGatewayOptions,now,
  getSession:()=>{
   const privateSession=session.getSessionForGateway(),visible=actor();
   return privateSession&&visible?{...privateSession,subject:visible.subject,
    authRevision:session.revision(),sessionRevision:session.privacyRevision()}:null;
  },
  onSessionInvalid:()=>{session.clear();notify();}
 }):null;
 incidentFlow=createIncidentReportFlow({
  gateway:incidentGateway,getActor:async()=>actorSession(),now
 });
 function prepareIncidentReport(request){
  const user=actor();
  if(!user)return fail('AUTH_REQUIRED');
  return incidentFlow.prepare({request,subject:user.subject,
   sessionRevision:session.privacyRevision()});
 }

 // El contrato de lectura del comprador aún NO existe en OpenAPI A G41.
 // Solo una implementación certificada inyectada habilitará este flujo.
 commerceFlow=createCommerceCatalogFlow({
  gateway:commerceCatalogGateway,getActor:async()=>actorSession(),now
 });
 // Paginación de descubrimiento SOLO LECTURA, independiente del carrito.
 // OFF por defecto; el backend A todavía no ha publicado GET Buyer.
 commercePager=createCommerceCatalogPager({
  gateway:commerceCatalogPageGateway,getActor:async()=>actorSession(),now
 });
 const historyGateway=historyGatewayOptions?createClientHistoryGateway({
  ...historyGatewayOptions,now,
  getSession:()=>{
   const privateSession=session.getSessionForGateway();
   const visible=actor();
   return privateSession&&visible?{...privateSession,subject:visible.subject,
    authRevision:session.revision(),sessionRevision:session.privacyRevision()}:null;
  },
  onSessionInvalid:()=>{session.clear();notify();}
 }):null;

 const fareGateway=fareGatewayOptions?createFareQuoteGateway({
  ...fareGatewayOptions,now,
  getSession:()=>{
   const privateSession=session.getSessionForGateway();
   const visible=actor();
   return privateSession&&visible?{...privateSession,subject:visible.subject,
    authRevision:session.revision(),sessionRevision:session.privacyRevision()}:null;
  },
  onSessionInvalid:()=>{session.clear();notify();}
 }):null;
 fareFlow=createFareQuoteFlow({gateway:fareGateway,getActor:async()=>actorSession(),
  onAccept:(dto,subject,id)=>{
   const user=actor();
   return Boolean(user&&user.subject===subject&&tracking.snapshot().tripId===id
    &&quote.show(dto,subject));
  }
 });
 const statusGateway=statusGatewayOptions?createRiderStatusGateway({
  ...statusGatewayOptions,now,
  getSession:()=>{
   const privateSession=session.getSessionForGateway();
   const visible=actor();
   return privateSession&&visible?{...privateSession,subject:visible.subject,
    authRevision:session.revision(),sessionRevision:session.privacyRevision()}:null;
  },
  onSessionInvalid:()=>{session.clear();notify();}
 }):null;
 // Todas las operaciones genéricas continúan en el gateway existente;
 // únicamente rideStatus usa el contrato tipado y fail-closed.
 const trackGateway=statusGateway?{
  send:(operation,args)=>operation==='rideStatus'
   ?statusGateway.fetchStatus(args?.id)
   :gateway?.send?.(operation,args)??fail('GATEWAY_UNAVAILABLE')
 }:gateway;
 mutations=createClientMutationController({gateway,getSession:async()=>actorSession()});
 tracking=createRiderPollingCoordinator({
  gateway:trackGateway,getSession:async()=>actor(),store:riderStore,now
 });
 function discardPreparedMutation({operation,requestKey}={}){
  if(!actor())return fail('AUTH_REQUIRED');
  const current=mutations.publicState();
  // Nunca limpiar una operación enviada, ambigua o ya reconocida;
  // la conciliación server-side es obligatoria primero.
  if(current.phase!=='ready')return fail('NOT_UNSENT_REQUEST');
  if(current.operation!==operation||current.requestKey!==requestKey)
   return fail('REQUEST_ID_MISMATCH');
  mutations.clear();return {ok:true};
 }
 function prepare(operation,body){
  const user=actor();
  if(!user)return fail('AUTH_REQUIRED');
  return mutations.prepare({operation,body,subject:user.subject,
   sessionRevision:session.privacyRevision()});
 }
 function startTracking(tripId){
  const user=actor();
  if(!user)return fail('AUTH_REQUIRED');
  const oldTrip=tracking.snapshot().tripId;
  const result=tracking.begin(tripId,user.subject);
  if(result.ok&&oldTrip!==tripId){
   cancellation.clear();fareFlow.clear();
   // Un viaje nuevo invalida precios de otro sujeto, pero conserva
   // cotizaciones verificadas que pertenecen EXACTAMENTE al mismo tripId.
   if(quote.current()?.subjectId!==tripId)quote.clear();
  }
  return result;
 }
 async function syncTracking(){
  if(!actor()){clearPrivate();return fail('AUTH_REQUIRED');}
  return tracking.tick();
 }
 function prepareCancelRide({tripId,requestKey}={}){
  const user=actor();
  if(!user)return fail('AUTH_REQUIRED');
  if(!cancelGateway?.isConfigured())return fail('CANCEL_CONTRACT_PENDING');
  const active=tracking.snapshot();
  if(active.tripId!==tripId||!['searching','assigned','arriving'].includes(active.state))
   return fail('CANCEL_REQUIRES_ACTIVE_RIDE');
  return cancellation.prepare({tripId,requestKey,subject:user.subject,
   sessionRevision:session.privacyRevision()});
 }
 function prepareServerFare({tripId,requestKey}={}){
  const user=actor();
  if(!user)return fail('AUTH_REQUIRED');
  if(!fareGateway?.isConfigured())return fail('FARE_CONTRACT_PENDING');
  const tracked=tracking.snapshot();
  if(tracked.tripId!==tripId||!tracked.subscriptionActive||tracked.revision<1
   ||!['searching','assigned','arriving'].includes(tracked.state))
   return fail('FARE_REQUIRES_SERVER_TRIP');
  return fareFlow.prepare({tripId,requestKey,subject:user.subject,
   sessionRevision:session.privacyRevision()});
 }
 function acceptQuote(dto){
  const user=actor();
  if(!user){quote.clear();return false;}
  return quote.show(dto,user.subject);
 }
 function acceptHistory(dto,{append=false}={}){
  const user=actor();
  if(!user){history.clear();return false;}
  return history.consume(dto,user.subject,{append});
 }
 async function loadHistoryPage({reset=false}={}){
  const user=actor();
  if(!user)return fail('AUTH_REQUIRED');
  if(!historyGateway?.isConfigured())return fail('HISTORY_CONTRACT_PENDING');
  if(historyLoading)return fail('HISTORY_READ_IN_FLIGHT');
  const current=history.current(user.subject);
  // Una página vencida cancela la cadena anterior de cursores.
  // Iniciar nueva secuencia con cursor vacío y titular actual.
  if(!current){seenCursors.clear();}
  if(!reset&&current&&current.nextCursor===null)return fail('NO_ADDITIONAL_PAGE');
  const cursor=reset?null:current?.nextCursor??null;
  if(cursor!==null&&seenCursors.has(cursor))return fail('CURSOR_REPEATED');
  const capturedEpoch=session.revision(),capturedSubject=user.subject;
  historyLoading=true;historyLoadError=null;notify();
  try{
   let answer;
   try{answer=await historyGateway.fetchPage(cursor);}
   catch{answer=fail('NETWORK_OR_TIMEOUT');}
   const latest=actor();
   if(!latest||latest.subject!==capturedSubject
    ||session.revision()!==capturedEpoch)
    return fail('STALE_SESSION_RESPONSE');
   if(!answer?.ok){
    historyLoadError=answer?.code??'HISTORY_UNAVAILABLE';
    // Un cursor revocado o expirado invalida el snapshot enlazado
    // a ese ancla; el pasajero debe reconsultar primera página.
    if(historyLoadError==='INVALID_OR_EXPIRED_CURSOR'){
     history.clear();seenCursors.clear();
    }
    notify();
    return fail(historyLoadError);
   }
   const next=answer.data?.nextCursor;
   if(typeof next==='string'&&(next===cursor||seenCursors.has(next))){
    historyLoadError='CURSOR_REPEATED';
    notify();
    return fail('CURSOR_REPEATED');
   }
   const accepted=history.consume(answer.data,capturedSubject,{append:!reset&&current!==null});
   if(!accepted){
    seenCursors.clear();historyLoadError='INVALID_HISTORY_DTO';notify();
    return fail('INVALID_HISTORY_DTO');
   }
   if(reset)seenCursors.clear();
   if(cursor!==null)seenCursors.add(cursor);
   historyLoadError=null;notify();
   return {ok:true,hasNext:next!==null,loaded:answer.data.items.length};
  }finally{
   if(session.revision()===capturedEpoch){
    historyLoading=false;notify();
   }
  }
 }
 function snapshot(){
  const user=actor();
  if(!user){
   clearPrivate();
   return Object.freeze({authenticated:false,account:null,mutation:mutations.publicState(),
    privateViewRevision:session.privacyRevision(),tracking:tracking.snapshot(),quote:null,history:null,
    historyLoading:false,historyLoadError:null,historyConfigured:Boolean(historyGateway?.isConfigured()),
    cancellation:cancellation.snapshot(),fareRequest:fareFlow.snapshot(),
    incidentReport:incidentFlow.snapshot(),commerce:commerceFlow.snapshot(),
    commercePager:commercePager.snapshot()});
  }
  return Object.freeze({
   authenticated:true,
   account:Object.freeze({subject:user.subject,role:'passenger'}),
   privateViewRevision:session.privacyRevision(),
   mutation:mutations.publicState(),
   tracking:tracking.snapshot(),
   quote:quote.current(),
   history:history.current(user.subject),
   historyLoading,historyLoadError,
   historyConfigured:Boolean(historyGateway?.isConfigured()),
   cancellation:cancellation.snapshot(),fareRequest:fareFlow.snapshot(),
   incidentReport:incidentFlow.snapshot(),commerce:commerceFlow.snapshot(),
   commercePager:commercePager.snapshot()
  });
 }
 async function signOut(){
  clearPrivate();
  return session.logout();
 }
 return Object.freeze({
  subscribe(listener){
   if(typeof listener!=='function')return ()=>{};
   observers.add(listener);return ()=>observers.delete(listener);
  },
  refreshSession:async()=>{const result=await session.refresh();notify();return result;},
  signOut:async()=>{const result=await signOut();notify();return result;},
  clear:()=>{session.clear();clearPrivate();notify();},
  loadCommerceCatalog:async branchId=>{const p=commerceFlow.loadCatalog(branchId);notify();const r=await p;notify();return r;},
  loadCommercePage:async args=>{const p=commercePager.load(args);notify();const r=await p;notify();return r;},
  clearCommercePage:()=>{commercePager.clear();notify();},
  setCommerceQuantity:(itemId,quantity)=>{if(!actor())return fail('AUTH_REQUIRED');const r=commerceFlow.changeQuantity(itemId,quantity);notify();return r;},
  selectCommerceVehicle:vehicle=>{if(!actor())return fail('AUTH_REQUIRED');const r=commerceFlow.changeVehicle(vehicle);notify();return r;},
  previewCommerceOrder:key=>{if(!actor())return fail('AUTH_REQUIRED');return commerceFlow.preview(key);},
  clearCommerce:()=>{commerceFlow.clear();notify();},
  prepareIncidentReport:request=>{const result=prepareIncidentReport(request);notify();return result;},
  discardIncidentReport:()=>{const result=incidentFlow.discard();notify();return result;},
  submitIncidentReport:async()=>{const result=await incidentFlow.submit();notify();return result;},
  retryIncidentReport:async()=>{const result=await incidentFlow.retry();notify();return result;},
  refreshIncidentStatus:async()=>{const result=await incidentFlow.refresh();notify();return result;},
  prepareRide:body=>{const result=prepare('rideRequest',body);notify();return result;},
  discardPreparedMutation:args=>{const result=discardPreparedMutation(args);notify();return result;},
  prepareDelivery:body=>{const result=prepare('deliveryRequest',body);notify();return result;},
  prepareFare:body=>{const result=prepare('fareQuote',body);notify();return result;},
  prepareServerFare:args=>{const result=prepareServerFare(args);notify();return result;},
  submitServerFare:async()=>{const result=await fareFlow.submit();notify();return result;},
  retryServerFare:async()=>{const result=await fareFlow.retry();notify();return result;},
  prepareSimulatedPayment:body=>{const result=prepare('paymentAuthorize',body);notify();return result;},
  submit:async()=>{const result=await mutations.submit();notify();return result;},
  retry:async()=>{const result=await mutations.retry();notify();return result;},
  startTracking:tripId=>{const result=startTracking(tripId);notify();return result;},
  syncTracking:async()=>{const result=await syncTracking();notify();return result;},
  connectionLost:()=>{tracking.connectionLost();notify();},
  acceptQuote:dto=>{const result=acceptQuote(dto);notify();return result;},
  acceptHistory:(dto,options)=>{const result=acceptHistory(dto,options);notify();return result;},
  loadHistoryPage,
  prepareCancelRide:args=>{const result=prepareCancelRide(args);notify();return result;},
  submitCancelRide:async()=>{
   const result=await cancellation.submit();notify();
   // La escritura no actualiza el estado del viaje. Incluso ante un 409,
   // consultar GET autoritativo antes de informar al pasajero.
   if(result.ok||result.code==='CONFLICT_RELOAD_TRIP'){
    const refresh=await syncTracking();notify();
    return Object.freeze({...result,refreshAttempted:true,statusRefreshed:refresh.ok===true});
   }
   return result;
  },
  retryCancelRide:async()=>{
   const result=await cancellation.retry();notify();
   if(result.ok||result.code==='CONFLICT_RELOAD_TRIP'){
    const refresh=await syncTracking();notify();
    return Object.freeze({...result,refreshAttempted:true,statusRefreshed:refresh.ok===true});
   }
   return result;
  },
  snapshot
 });
}

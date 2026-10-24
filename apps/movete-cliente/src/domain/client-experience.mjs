import {createClientSessionController} from './client-session.mjs';
import {createPassengerBookingStagingGateway} from './passenger-booking-staging-gateway.mjs';
import {createClientMutationController} from './client-mutations.mjs';
import {createQuoteViewStore} from './quote-view.mjs';
import {createClientHistoryStore} from './history-feed.mjs';
import {createSenderCustodyFlow} from './sender-custody-flow.mjs';
import {createSenderCustodyHttpGateway} from './sender-custody-http-gateway.mjs';
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
import {createG44BranchDirectory} from './g44-branch-directory.mjs';
import {createG44BuyerCatalogAdapter} from './g44-buyer-contract.mjs';
import {createG44BuyerHttpGateway} from './g44-buyer-http-gateway.mjs';
import {createPassengerChatFlow} from './passenger-chat-flow.mjs';
import {createPassengerChatPushHintStore} from './passenger-chat-push-hint.mjs';
import {createPassengerChatInbox} from './passenger-chat-inbox.mjs';
import {createG51ChatInboxHttpGateway} from './g51-chat-inbox-http-gateway.mjs';
import {createG52ChatHistoryHttpGateway} from './g52-chat-history-http-gateway.mjs';
import {createG53ChatSendHttpGateway} from './g53-chat-send-http-gateway.mjs';

/**
 * Composición sin estado persistente de la app Cliente. Une los contratos
 * internos B03/B04/B05/B06/B09 manteniendo fail-closed por defecto.
 *
 * Inyectar un gateway NO lo certifica ni despliega. Backend A conserva
 * autenticación real, autorización, revisión, precios y acceso a terceros.
 */
const fail=code=>({ok:false,code});
export function createClientExperience({authProvider=null,gateway=null,
 bookingHttpOptions=null,senderCustodyOptions=null,senderCustodyHttpOptions=null,historyGatewayOptions=null,cancelGatewayOptions=null,statusGatewayOptions=null,fareGatewayOptions=null,incidentGatewayOptions=null,commerceCatalogGateway=null,
 commerceCatalogPageGateway=null,g44BranchDirectoryOptions=null,
 g44BuyerHttpOptions=null,chatGateway=null,chatInboxGateway=null,
 g51ChatInboxHttpOptions=null,g52ChatHistoryHttpOptions=null,
 g53ChatSendHttpOptions=null,now=()=>Date.now()}={}){
 const quote=createQuoteViewStore({now});
 const history=createClientHistoryStore({now});
 const riderStore=createRiderStatusStore({now});
 const chatHintStore=createPassengerChatPushHintStore({now});
 let commerceFlow,commercePager,branchDirectory,g44Http=null,chatFlow,chatInbox;
 let mutations,tracking,cancellation,fareFlow,incidentFlow,senderCustody=null;
 let historyLoading=false,historyLoadError=null;
 let custodyAnchor=null;
 const seenCursors=new Set();
 const observers=new Set();
 const notify=()=>{for(const fn of observers){try{fn();}catch{/* listener UI aislado */}}};
 const clearPrivate=()=>{
  if(mutations)mutations.clear();
  if(tracking)tracking.stop();
  if(cancellation)cancellation.clear();
  if(fareFlow)fareFlow.clear();
  if(incidentFlow)incidentFlow.clear();
  if(senderCustody)senderCustody.clear();
  custodyAnchor=null;
  if(commerceFlow)commerceFlow.clear();
  if(commercePager)commercePager.clear();
  if(branchDirectory)branchDirectory.clear();
  if(g44Http)g44Http.cancelPending();
  if(chatFlow)chatFlow.clear();
  if(chatInbox)chatInbox.clear();
  chatHintStore.clear();
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
 // G68 is Passenger/sender-only; G66 remains strictly Driver-private.
 // A G68 has ONLY a Node/SQL QA handler, not deployed HTTPS. The gateway
 // requires separately verified opt-ins and is never wired by default.
 const senderCustodyHttp=senderCustodyHttpOptions?createSenderCustodyHttpGateway({
  ...senderCustodyHttpOptions,now,
  getSession:()=>{
   const privateSession=session.getSessionForGateway(),user=actor();
   return privateSession&&user?{...privateSession,subject:user.subject,
    authRevision:session.revision(),sessionRevision:session.privacyRevision()}:null;
  },
  onSessionInvalid:()=>{session.clear();notify();}
 }):null;
 // Two competing injection paths are a configuration error: fail closed.
 const custodyConfig=senderCustodyHttpOptions
  ?(!senderCustodyOptions&&senderCustodyHttp?.isConfigured()?{
    enabled:true,contractCertified:true,stagingRuntimeVerified:true,
    readOwnDelivery:senderCustodyHttp.readOwnDelivery
   }:{})
  :(senderCustodyOptions??{});
 senderCustody=createSenderCustodyFlow({
  ...custodyConfig,now,
  getSession:()=>{
   const privateSession=session.getSessionForGateway(),user=actor();
   return privateSession&&user?{...privateSession,role:'passenger',
    subject:user.subject,sessionRevision:session.privacyRevision()}:null;
  }
 });
 // Chat Cliente ↔ Driver/MOTO delivery, sujeto a asignación certificada por A.
 // No hay transporte habilitado hasta que A implemente Auth + conversaciones.
 // El reader G52 se inyecta SOLO por configuración STAGING explícita.
 // GET no implica permiso de POST: chatFlow mantiene sendReady=false.
 const g52HistoryHttp=g52ChatHistoryHttpOptions?createG52ChatHistoryHttpGateway({
  ...g52ChatHistoryHttpOptions,now,
  getSession:()=>{
   const privateSession=session.getSessionForGateway(),visible=actor();
   return privateSession&&visible?{...privateSession,subject:visible.subject,
    authRevision:session.revision(),sessionRevision:session.privacyRevision()}:null;
  },
  onSessionInvalid:()=>{session.clear();notify();}
 }):null;
 // Escritura G53 NO se deduce de GET G52: dos runtime gates y el
 // MISMO origen fijado deben estar certificados. Exponer sendMessage solo
 // cuando la pareja está completa, o el UI podría anunciar POST falso.
 const g53SendHttp=g53ChatSendHttpOptions?createG53ChatSendHttpGateway({
  ...g53ChatSendHttpOptions,now,
  getSession:()=>{
   const privateSession=session.getSessionForGateway(),visible=actor();
   return privateSession&&visible?{...privateSession,subject:visible.subject,
    authRevision:session.revision(),sessionRevision:session.privacyRevision()}:null;
  },
  onSessionInvalid:()=>{session.clear();notify();}
 }):null;
 const g53MaySend=g52HistoryHttp?.isConfigured()===true
  &&g53SendHttp?.isConfigured()===true
  &&g52ChatHistoryHttpOptions?.origin===g53ChatSendHttpOptions?.origin
  &&g52ChatHistoryHttpOptions?.pinnedOrigin===g53ChatSendHttpOptions?.pinnedOrigin;
 const combinedChatGateway=g53MaySend?Object.freeze({
  ...g52HistoryHttp,
  sendMessage:args=>g53SendHttp.sendMessage(args),
  cancelPending:()=>{g52HistoryHttp.cancelPending();g53SendHttp.cancelPending();}
 }):g52HistoryHttp;
 chatFlow=createPassengerChatFlow({gateway:chatGateway??combinedChatGateway,
  getActor:async()=>actorSession(),now});
 // G51 está descrito por A pero NO montado. Solo una configuración
 // explícita de HTTPS, Auth y gates certificados habilita su transporte.
 const g51InboxHttp=g51ChatInboxHttpOptions?createG51ChatInboxHttpGateway({
  ...g51ChatInboxHttpOptions,now,
  getSession:()=>{
   const privateSession=session.getSessionForGateway(),visible=actor();
   return privateSession&&visible?{...privateSession,subject:visible.subject,
    authRevision:session.revision(),sessionRevision:session.privacyRevision()}:null;
  },
  onSessionInvalid:()=>{session.clear();notify();}
 }):null;
 chatInbox=createPassengerChatInbox({gateway:chatInboxGateway??g51InboxHttp,
  getActor:async()=>actorSession(),now});
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
 // HTTP G44 REAL solo con tres gates, Auth de sesión y HTTPS STAGING pinned.
 // Inyectar opciones no certifica contratos ni permite activar usuarios reales.
 g44Http=g44BuyerHttpOptions?createG44BuyerHttpGateway({
  ...g44BuyerHttpOptions,now,
  getSession:()=>{
   const privateSession=session.getSessionForGateway();
   const visible=actor();
   return privateSession&&visible?{...privateSession,subject:visible.subject,
    authRevision:session.revision(),sessionRevision:session.privacyRevision()}:null;
  },
  onSessionInvalid:()=>{session.clear();notify();}
 }):null;
 const g44Ready=g44Http?.isConfigured()===true;
 const g44CatalogAdapter=g44Http?createG44BuyerCatalogAdapter({
  enabled:g44Ready,contractCertified:g44Ready,stagingRuntimeVerified:g44Ready,
  readBuyerCatalog:g44Http.readBuyerCatalog,now
 }):null;
 commercePager=createCommerceCatalogPager({
  gateway:commerceCatalogPageGateway??g44CatalogAdapter,
  getActor:async()=>actorSession(),now
 });
 branchDirectory=createG44BranchDirectory({
  ...(g44BranchDirectoryOptions??(g44Http?{
   enabled:g44Ready,contractCertified:g44Ready,stagingRuntimeVerified:g44Ready,
   readBuyerBranches:g44Http.readBuyerBranches
  }:{})),getActor:async()=>actorSession(),now
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
 // R56: real HTTP booking is opt-in and checked against a STRICT G11 QA
 // receipt. Generic 201 never certifies an actual trip or delivery.
 // No booking is wired in the default ClientRuntimeProvider.
 const bookingGateway=bookingHttpOptions?createPassengerBookingStagingGateway({
  ...bookingHttpOptions,now,
  getSession:()=>{
   const privateSession=session.getSessionForGateway(),visible=actor();
   return privateSession&&visible?{...privateSession,subject:visible.subject,
    authRevision:session.revision(),sessionRevision:session.privacyRevision()}:null;
  },
  onSessionInvalid:()=>{session.clear();notify();}
 }):null;
 mutations=createClientMutationController({
  gateway:bookingGateway??gateway,getSession:async()=>actorSession()
 });
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
 // F1: QA persisted booking -> authoritative Passenger GET. Never infer
 // assignment, commercial status, or fare from HTTP 201 alone.
 function rideContinuation(){
  const user=actor(),receipt=mutations.verifiedRide();
  const canVerify=Boolean(user&&receipt&&receipt.subject===user.subject
   &&receipt.sessionRevision===session.privacyRevision()
   &&bookingGateway?.isConfigured()===true
   &&statusGateway?.isConfigured()===true);
  return Object.freeze({canVerify,tripId:canVerify?receipt.tripId:null,
   qaOnly:true,productionEnabled:false});
 }
 async function continueVerifiedRide(){
  const receipt=mutations.verifiedRide(),scope=rideContinuation(),user=actor();
  if(!scope.canVerify||!receipt||!user)
   return fail('RIDE_CONTINUATION_NOT_CERTIFIED');
  const privacy=session.privacyRevision(),key=receipt.requestKey;
  const started=startTracking(receipt.tripId);
  if(!started.ok)return started;
  notify();
  const check=await syncTracking();
  const current=actor(),still=mutations.verifiedRide();
  if(!check.ok||!current||current.subject!==user.subject
   ||session.privacyRevision()!==privacy||!still
   ||still.requestKey!==key||still.tripId!==receipt.tripId
   ||tracking.snapshot().tripId!==receipt.tripId){
   // Never leave an unverified trip connected, even after HTTP 200.
   tracking.stopIfMatching(receipt.tripId,user.subject);
   notify();
   return fail('RIDE_STATUS_NOT_VERIFIED');
  }
  notify();
  return Object.freeze({ok:true,tripId:receipt.tripId,
   serverRevision:tracking.snapshot().revision,
   qaOnly:true,productionEnabled:false});
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
 // Custody is only visible while the exact delivery remains in an unexpired,
 // owner-scoped history window and at the revision that authorized its read.
 // Rejecting an anchor also invalidates outstanding async custody GETs.
 function guardCustodyScope(){
  if(!custodyAnchor)return true;
  const user=actor(),page=user?history.current(user.subject):null;
  const stored=senderCustody.snapshot();
  const item=page?.items.find(x=>x.kind==='DELIVERY'
   &&x.serviceId===custodyAnchor.deliveryId);
  if(!user||user.subject!==custodyAnchor.subject
   ||(stored.deliveryId!==null&&stored.deliveryId!==custodyAnchor.deliveryId)
   ||!item||item.revision!==custodyAnchor.historyRevision){
   senderCustody.clear();custodyAnchor=null;return false;
  }
  return true;
 }
 function acceptHistory(dto,{append=false}={}){
  const user=actor();
  if(!user){history.clear();senderCustody.clear();custodyAnchor=null;return false;}
  // Replacing the server page revokes previous proof, even for the same ID.
  if(!append){senderCustody.clear();custodyAnchor=null;}
  const accepted=history.consume(dto,user.subject,{append});
  if(!accepted){senderCustody.clear();custodyAnchor=null;}
  else guardCustodyScope();
  return accepted;
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
  if(reset){senderCustody.clear();custodyAnchor=null;}
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
    senderCustody.clear();custodyAnchor=null;
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
    seenCursors.clear();historyLoadError='INVALID_HISTORY_DTO';
    senderCustody.clear();custodyAnchor=null;notify();
    return fail('INVALID_HISTORY_DTO');
   }
   if(reset)seenCursors.clear();
   if(cursor!==null)seenCursors.add(cursor);
   guardCustodyScope();
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
  guardCustodyScope();
  // Revocación de la certificación de chat invalida también hints
  // previamente aceptados, no solo la conversación. No reanimar avisos.
  const chatCertified=chatFlow.isConfigured();
  if(!chatCertified)chatHintStore.clear();
  if(!user){
   clearPrivate();
   return Object.freeze({authenticated:false,account:null,mutation:mutations.publicState(),
    bookingRecovery:Object.freeze({readReady:false,productionEnabled:false}),
    rideContinuation:Object.freeze({canVerify:false,tripId:null,qaOnly:true,productionEnabled:false}),
    privateViewRevision:session.privacyRevision(),tracking:tracking.snapshot(),quote:null,history:null,
    senderCustody:Object.freeze({...senderCustody.snapshot(),
     readReady:false,deliveryId:null,state:null,proofVerified:false}),
    historyLoading:false,historyLoadError:null,historyConfigured:Boolean(historyGateway?.isConfigured()),
    cancellation:cancellation.snapshot(),fareRequest:fareFlow.snapshot(),
    incidentReport:incidentFlow.snapshot(),commerce:commerceFlow.snapshot(),
    commercePager:commercePager.snapshot(),branchDirectory:branchDirectory.snapshot(),
    chat:chatFlow.snapshot(),chatInbox:chatInbox.snapshot(),
    chatHints:Object.freeze([])});
  }
  return Object.freeze({
   authenticated:true,
   account:Object.freeze({subject:user.subject,role:'passenger'}),
   privateViewRevision:session.privacyRevision(),
   mutation:mutations.publicState(),
   bookingRecovery:Object.freeze({readReady:Boolean(bookingGateway?.reconciliationConfigured?.()),
    productionEnabled:false}),
   rideContinuation:rideContinuation(),
   tracking:tracking.snapshot(),
   quote:quote.current(),
   history:history.current(user.subject),
   senderCustody:senderCustody.snapshot(),
   historyLoading,historyLoadError,
   historyConfigured:Boolean(historyGateway?.isConfigured()),
   cancellation:cancellation.snapshot(),fareRequest:fareFlow.snapshot(),
   incidentReport:incidentFlow.snapshot(),commerce:commerceFlow.snapshot(),
   commercePager:commercePager.snapshot(),branchDirectory:branchDirectory.snapshot(),
   chat:chatFlow.snapshot(),chatInbox:chatInbox.snapshot(),
   chatHints:chatCertified?chatHintStore.snapshot(user.subject):Object.freeze([])
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
  loadBuyerBranches:async args=>{const p=branchDirectory.load(args);notify();const r=await p;notify();return r;},
  clearBuyerBranches:()=>{branchDirectory.clear();notify();},
  openChat:async args=>{const p=chatFlow.open(args);notify();const r=await p;notify();return r;},
  sendChat:async args=>{const p=chatFlow.send(args);notify();const r=await p;notify();return r;},
  retryChat:async()=>{const p=chatFlow.retryPending();notify();const r=await p;notify();return r;},
  loadChatInbox:async args=>{
   const p=chatInbox.load(args);notify();
   const r=await p;
   if(r?.ok===true){
    // Reasignación POSITIVA confirmada por G51: mismo servicio activo
    // pero conversationId diferente. Invalidar inmediatamente el historial,
    // draft privado (view key) y pending ACK del hilo anterior.
    // La AUSENCIA en una página paginada NO demuestra revocación.
    const current=chatFlow.snapshot(),inbox=chatInbox.snapshot();
    if(inbox.readReady&&!inbox.loading&&!inbox.stale
     &&current.conversationId&&current.serviceId&&current.serviceKind
     &&inbox.items.some(item=>item.serviceKind===current.serviceKind
      &&item.serviceId===current.serviceId
      &&item.conversationId!==current.conversationId)){
     chatFlow.clear();
     chatHintStore.clear();
    }
   }
   notify();return r;
  },
  clearChatInbox:()=>{chatInbox.clear();notify();},
  // El hint Push no contiene texto del remitente ni concede acceso al hilo.
  acceptChatPushHint:dto=>{
   const user=actor();
   if(!user||!chatFlow.isConfigured()){
    chatHintStore.clear();return false;
   }
   const result=chatHintStore.accept(dto,user.subject);
   if(result.ok===true)notify();
   return result.ok===true;
  },
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
  reconcileBooking:async()=>{
   const pending=mutations.reconcileBooking();notify();
   const result=await pending;notify();return result;
  },
  startTracking:tripId=>{const result=startTracking(tripId);notify();return result;},
  continueVerifiedRide,
  syncTracking:async()=>{const result=await syncTracking();notify();return result;},
  connectionLost:()=>{tracking.connectionLost();notify();},
  acceptQuote:dto=>{const result=acceptQuote(dto);notify();return result;},
  acceptHistory:(dto,options)=>{const result=acceptHistory(dto,options);notify();return result;},
  loadHistoryPage,
  readOwnDeliveryCustody:async deliveryId=>{
   const user=actor();
   if(!user)return fail('AUTH_REQUIRED');
   const page=history.current(user.subject);
   const item=page?.items.find(x=>x.kind==='DELIVERY'&&x.serviceId===deliveryId);
   if(!item){
    senderCustody.clear();custodyAnchor=null;notify();
    return fail('SENDER_DELIVERY_NOT_IN_OWN_HISTORY');
   }
   if(senderCustody.snapshot().loading)return fail('SENDER_CUSTODY_READ_IN_FLIGHT');
   const subject=user.subject,rev=session.privacyRevision();
   custodyAnchor=Object.freeze({deliveryId,subject,historyRevision:item.revision});
   const operation=senderCustody.refresh(deliveryId,subject,rev);
   notify();
   const result=await operation;
   const latest=actor();
   if(!latest||latest.subject!==subject||session.privacyRevision()!==rev){
    senderCustody.clear();custodyAnchor=null;notify();
    return fail('STALE_CUSTODY_RESPONSE');
   }
   if(!guardCustodyScope()){notify();return fail('SENDER_CUSTODY_HISTORY_REVOKED');}
   notify();return result;
  },
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

import {createClientSessionController} from './client-session.mjs';
import {createPassengerBookingStagingGateway} from './passenger-booking-staging-gateway.mjs';
import {createG121DeliveryRegistrationGateway} from './g121-delivery-registration-gateway.mjs';
import {createG5G121VerifiedDeliveryBookingGateway} from './g5-g121-verified-delivery-booking-gateway.mjs';
import {createG122DeliveryPriceConsentFlow} from './g122-delivery-price-consent-flow.mjs';
import {createG5DurableDeliveryRecovery} from './g5-durable-delivery-recovery.mjs';
import {releaseTerminalDeliveryKeys} from './g68-terminal-delivery-release.mjs';
import {createClientMutationController} from './client-mutations.mjs';
import {createQuoteViewStore} from './quote-view.mjs';
import {createClientHistoryStore} from './history-feed.mjs';
import {createSenderCustodyFlow} from './sender-custody-flow.mjs';
import {createSenderCustodyHttpGateway} from './sender-custody-http-gateway.mjs';
import {createClientHistoryGateway} from './client-history-gateway.mjs';
import {createRiderStatusGateway} from './ride-status-gateway.mjs';
import {createFareQuoteGateway} from './fare-quote-gateway.mjs';
import {createFareQuoteFlow} from './fare-quote-flow.mjs';
import {createF1AutoPrequoteConsent} from './f1-auto-prequote-consent.mjs';
import {createF1AutoRouteQuoteIntake} from './f1-auto-route-quote-intake.mjs';
import {createF1G73HttpGateway} from './f1-g73-http-gateway.mjs';
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
import {createG100MotoPassengerFlow} from './g100-moto-passenger-flow.mjs';
import {createG101MotoPassengerHttpGateway} from './g101-moto-passenger-http-gateway.mjs';
import {createG119MotoStatusGateway} from './g119-moto-ride-status-gateway.mjs';

/**
 * Composición sin estado persistente de la app Cliente. Une los contratos
 * internos B03/B04/B05/B06/B09 manteniendo fail-closed por defecto.
 *
 * Inyectar un gateway NO lo certifica ni despliega. Backend A conserva
 * autenticación real, autorización, revisión, precios y acceso a terceros.
 */
const fail=code=>({ok:false,code});
export function createClientExperience({authProvider=null,gateway=null,
 bookingHttpOptions=null,deliveryRegistrationOptions=null,
 deliveryG5QaOptions=null,deliveryG122Options=null,deliveryRecoveryStore=null,deliveryQuoteKeyStore=null,motoPassengerOptions=null,motoPassengerHttpOptions=null,motoRideStatusOptions=null,motoRecoveryStore=null,autoPrequoteOptions=null,autoRouteIntakeOptions=null,autoG73HttpOptions=null,g95RecoveryStore=null,senderCustodyOptions=null,senderCustodyHttpOptions=null,historyGatewayOptions=null,cancelGatewayOptions=null,statusGatewayOptions=null,fareGatewayOptions=null,incidentGatewayOptions=null,commerceCatalogGateway=null,
 commerceCatalogPageGateway=null,g44BranchDirectoryOptions=null,
 g44BuyerHttpOptions=null,chatGateway=null,chatInboxGateway=null,
 g51ChatInboxHttpOptions=null,g52ChatHistoryHttpOptions=null,
 g53ChatSendHttpOptions=null,now=()=>Date.now()}={}){
 const deliveryRecovery=createG5DurableDeliveryRecovery({store:deliveryRecoveryStore,now});
 const quote=createQuoteViewStore({now});
 const history=createClientHistoryStore({now});
 const riderStore=createRiderStatusStore({now});
 const chatHintStore=createPassengerChatPushHintStore({now});
 let commerceFlow,commercePager,branchDirectory,g44Http=null,chatFlow,chatInbox,motoFlow=null,motoHttp=null,motoRideGateway=null;
 let mutations,tracking,cancellation,fareFlow,incidentFlow,senderCustody=null,prequoteAuto=null,autoRouteIntake=null,autoG73Http=null;
 let historyLoading=false,historyLoadError=null;
 let registrationEpoch=0,registration={busy:false,receipt:null};
 let terminalReleaseBusy=false;
 let g121Registration=null,g122Consent=null,g5QaGateway=null;
 let historyRideProof=null,recoveredRide=null,resumeBusy=false,resumeGeneration=0;
 let completedProof=null,completedBusy=false,completedEpoch=0;
 let dispatch={busy:false,data:null,error:null,scope:null},dispatchEpoch=0;
 let subsidyReceipt=null,subsidyEpoch=0,subsidyBusy=false;
 let financialAnchor=null,financial={busy:false,data:null,error:null},financialEpoch=0;
 let g95={phase:'idle',requestKey:null,scope:null,receipt:null,error:null};
 let g95Epoch=0,g95Restored=null,restoringG95=false;
 let motoRide={busy:false,data:null,error:null},motoRideEpoch=0;
 const G95_ID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
 const canSaveG95=Boolean(g95RecoveryStore&&['read','write','clear'].every(k=>typeof g95RecoveryStore[k]==='function'));
 const g93Required=autoG73HttpOptions?.subsidyContractCertified===true;
 const emptyDispatch=()=>Object.freeze({readReady:false,busy:false,error:null,
  tripId:null,tripState:null,dispatchState:null,attempts:null,
  offerPendingAcceptance:false,needsRideVerification:false,
  productionEnabled:false});
 let custodyAnchor=null;
 const seenCursors=new Set();
 const observers=new Set();
 const notify=()=>{for(const fn of observers){try{fn();}catch{/* listener UI aislado */}}};
 const clearPrivate=()=>{
  deliveryRecovery.clearMemory();
  terminalReleaseBusy=false;
  registrationEpoch++;registration={busy:false,receipt:null};
  g121Registration?.cancelPending();
  g5QaGateway?.cancelPending();
  g122Consent?.clear();
  g95Restored=null;
  g95Epoch++;g95={phase:'idle',requestKey:null,scope:null,receipt:null,error:null};
  subsidyEpoch++;subsidyReceipt=null;subsidyBusy=false;
  financialEpoch++;financialAnchor=null;financial={busy:false,data:null,error:null};
  dispatchEpoch++;dispatch={busy:false,data:null,error:null,scope:null};
  resumeGeneration++;resumeBusy=false;historyRideProof=null;recoveredRide=null;
  completedEpoch++;completedBusy=false;completedProof=null;
  motoRideEpoch++;motoRide={busy:false,data:null,error:null};
  motoRideGateway?.cancelPending();
  if(motoFlow)motoFlow.clear(true);
  if(motoHttp)motoHttp.cancelPending();
  if(mutations)mutations.clear();
  if(tracking)tracking.stop();
  if(cancellation)cancellation.clear();
  if(fareFlow)fareFlow.clear();
  if(prequoteAuto)prequoteAuto.clear();
   if(autoRouteIntake)autoRouteIntake.clear();
  if(autoG73Http)autoG73Http.cancelPending();
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
 // G101 now has five separate Passenger HTTP contracts, but is only
 // mounted over A's local disposable PG16 CI. External QA flags remain OFF.
 // Never combine custom injected MOTO transport with production-style HTTP.
 motoHttp=motoPassengerHttpOptions&&!motoPassengerOptions?
  createG101MotoPassengerHttpGateway({
   ...motoPassengerHttpOptions,now,
   getSession:()=>{
    const identity=actor(),token=session.getSessionForGateway();
    return identity&&token?{...token,subject:identity.subject,
     authRevision:session.revision(),
     sessionRevision:session.privacyRevision()}:null;
   },
   onSessionInvalid:()=>{session.clear();notify();}
  }):null;
 motoRideGateway=motoRideStatusOptions?createG119MotoStatusGateway({
  ...motoRideStatusOptions,now,
  getSession:()=>{
   const u=actor(),t=session.getSessionForGateway();
   return u&&t?{subject:u.subject,role:'passenger',
    token:t.token,expiresAt:t.expiresAt}:null;
  }
 }):null;
 motoFlow=createG100MotoPassengerFlow({
  ...(motoPassengerOptions??motoHttp?.flowOptions()??{}),
  recoveryStore:motoRecoveryStore,getActor:actorSession,now,onChange:notify
 });
 // F1 G73 canonical HTTP is OFF unless a *separately certified* HTTPS,
 // JWT, route provider, PostgreSQL and shared STAGING runtime is configured.
 // Explicit custom QA injection and a G73 HTTP runtime are mutually exclusive.
 autoG73Http=autoG73HttpOptions?createF1G73HttpGateway({
  ...autoG73HttpOptions,now,
  getSession:()=>{
   const token=session.getSessionForGateway(),user=actor();
   return token&&user?{...token,subject:user.subject,
    authRevision:session.revision(),sessionRevision:session.privacyRevision()}:null;
  },
  onSessionInvalid:()=>{session.clear();notify();}
 }):null;
 const g73Ready=autoG73Http?.isConfigured()===true
  &&!autoPrequoteOptions&&!autoRouteIntakeOptions;
 const optionsQuote=g73Ready?{
  enabled:true,quoteContractCertified:true,bookingContractCertified:true,
  reconciliationContractCertified:true,stagingRuntimeVerified:true,
  quoteGateway:scope=>autoG73Http.readQuote(scope),
  bookingGateway:scope=>autoG73Http.bookQuote(scope),
  reconciliationGateway:scope=>autoG73Http.reconcile(scope)
 }:(autoPrequoteOptions??{});
 prequoteAuto=createF1AutoPrequoteConsent({...optionsQuote,now,
  getActor:async()=>actorSession()});
 // The owner-scoped server route attestation must precede any displayed PYG.
 const optionsRoute=g73Ready?{
  enabled:true,routeContractCertified:true,stagingRuntimeVerified:true,
  routeGateway:scope=>autoG73Http.resolveRoute(scope)
 }:(autoRouteIntakeOptions??{});
 autoRouteIntake=createF1AutoRouteQuoteIntake({
  ...optionsRoute,now,quoteFlow:prequoteAuto,
  getActor:async()=>actorSession()
 });
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
 g121Registration=createG121DeliveryRegistrationGateway({
  ...(deliveryRegistrationOptions??{}),now,
  getSession:()=>{
   const privateSession=session.getSessionForGateway(),visible=actor();
   return privateSession&&visible?{...privateSession,subject:visible.subject,
    authRevision:session.revision(),sessionRevision:session.privacyRevision()}:null;
  },
  onSessionInvalid:()=>{session.clear();notify();}
 });
 // G122 is separate QA-only G7 quote and explicit price acceptance.
 g122Consent=createG122DeliveryPriceConsentFlow({
  ...(deliveryG122Options??{}),quoteKeyStore:deliveryQuoteKeyStore,now,
  getSession:()=>{
   const privateSession=session.getSessionForGateway(),visible=actor();
   return privateSession&&visible?{...privateSession,subject:visible.subject,
    authRevision:session.revision(),sessionRevision:session.privacyRevision()}:null;
  },
  onSessionInvalid:()=>{session.clear();notify();}
 });
 // B24: separate STAGING G5 POST + owner-scoped G121 GET.
 g5QaGateway=deliveryG5QaOptions&&g121Registration?.isConfigured()===true
  ?createG5G121VerifiedDeliveryBookingGateway({
  ...deliveryG5QaOptions,now,
  getSession:()=>{
   const token=session.getSessionForGateway(),user=actor();
   return token&&user?{...token,subject:user.subject,
    authRevision:session.revision(),sessionRevision:session.privacyRevision()}:null;
  },
  readG121:args=>g121Registration.read(args),
  onSessionInvalid:()=>{session.clear();notify();}
 }):null;
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
 const routedMutationGateway=g5QaGateway?.isConfigured()===true
  ?Object.freeze({
   isConfigured:()=>true,bookingReconciliationRequired:true,
   send:(operation,args)=>operation==='deliveryRequest'
    ?g5QaGateway.send(operation,args)
    :(bookingGateway??gateway)?.send?.(operation,args)??fail('NOT_CONFIGURED'),
   reconcile:(operation,args)=>operation==='deliveryRequest'
    ?g5QaGateway.reconcile(operation,args)
    :(bookingGateway?.reconcile?.(operation,args)??fail('BOOKING_RECONCILIATION_NOT_CERTIFIED'))
  }):bookingGateway??gateway;
 mutations=createClientMutationController({
  gateway:routedMutationGateway,getSession:async()=>actorSession()
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
   completedEpoch++;completedProof=null;
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
 // F1: both booking paths need the SAME authority chain:
 // own persisted receipt -> fresh Passenger GET -> tracking. Neither the UI
 // quote nor a generic HTTP 201 is enough. A still must certify the runtime.
 function currentBookingProof(){
  const user=actor(),privacy=session.privacyRevision();
  if(!user||statusGateway?.isConfigured()!==true)return null;
  const legacy=mutations.verifiedRide(),quoted=prequoteAuto.verifiedBooking();
  const legacyReady=Boolean(legacy&&legacy.subject===user.subject
   &&legacy.sessionRevision===privacy
   &&bookingGateway?.isConfigured()===true);
  const quotedReady=Boolean(quoted&&quoted.subject===user.subject
   &&quoted.sessionRevision===privacy
   &&prequoteAuto.isBookingConfigured()===true);
  // A single Passenger session cannot ambiguously resume two booked trips.
  if(legacyReady&&quotedReady&&legacy.tripId!==quoted.tripId)return null;
  return quotedReady?quoted:legacyReady?legacy:null;
 }
 function rideContinuation(){
  const user=actor(),receipt=currentBookingProof();
  const recoveredReady=Boolean(user&&recoveredRide
   &&recoveredRide.subject===user.subject
   &&recoveredRide.privateViewRevision===session.privacyRevision()
   &&statusGateway?.isConfigured()===true
   &&tracking.snapshot().subscriptionActive
   &&tracking.snapshot().tripId===recoveredRide.tripId);
  return Object.freeze({canVerify:Boolean(receipt)||recoveredReady,
   tripId:receipt?.tripId??(recoveredReady?recoveredRide.tripId:null),
   qaOnly:true,productionEnabled:false});
 }
 async function continueVerifiedRide(){
  const receipt=currentBookingProof(),scope=rideContinuation(),user=actor();
  if(!scope.canVerify||!receipt||!user||scope.tripId!==receipt.tripId)
   return fail('RIDE_CONTINUATION_NOT_CERTIFIED');
  const privacy=session.privacyRevision(),key=receipt.requestKey;
  const started=startTracking(receipt.tripId);
  if(!started.ok)return started;
  notify();
  const check=await syncTracking();
  const current=actor(),still=currentBookingProof(),tracked=tracking.snapshot();
  if(!check.ok||!current||current.subject!==user.subject
   ||session.privacyRevision()!==privacy||!still
   ||still.requestKey!==key||still.tripId!==receipt.tripId
   ||still.serverRevision!==receipt.serverRevision
   ||!tracked.subscriptionActive||tracked.tripId!==receipt.tripId
   ||!Number.isSafeInteger(tracked.revision)
   ||tracked.revision<receipt.serverRevision){
   // Even a syntactically valid HTTP 200 cannot resurrect an unverified ride.
   tracking.stopIfMatching(receipt.tripId,user.subject);
   notify();
   return fail('RIDE_STATUS_NOT_VERIFIED');
  }
  notify();
  return Object.freeze({ok:true,tripId:receipt.tripId,
   serverRevision:tracked.revision,
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
  // Injected snapshots never authorize recovering a Passenger ride.
  historyRideProof=null;completedProof=null;
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
  if(reset){senderCustody.clear();custodyAnchor=null;historyRideProof=null;}
  if(cursor!==null&&seenCursors.has(cursor))return fail('CURSOR_REPEATED');
  const capturedEpoch=session.revision(),capturedSubject=user.subject;
  historyRideProof=null;completedProof=null;
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
   historyRideProof=Object.freeze({subject:capturedSubject,
    privateViewRevision:session.privacyRevision(),readAt:now()});
   historyLoadError=null;notify();
   return {ok:true,hasNext:next!==null,loaded:answer.data.items.length};
  }finally{
   if(session.revision()===capturedEpoch){
    historyLoading=false;notify();
   }
  }
 }
 function rideHistoryRecovery(){
  const user=actor(),proof=historyRideProof;
  const page=user?history.current(user.subject):null;
  const ready=Boolean(user&&proof&&page
   &&proof.subject===user.subject
   &&proof.privateViewRevision===session.privacyRevision()
   &&now()>=proof.readAt&&now()-proof.readAt<300000
   &&historyGateway?.isConfigured()===true
   &&statusGateway?.isConfigured()===true&&!historyLoading);
  return Object.freeze({readReady:ready,busy:resumeBusy,
   qaOnly:true,productionEnabled:false});
 }
 /**
  * F1 recovery from the server's own-history, not from an injected DTO.
  * A second Passenger GET independently checks actual SQL trip state.
  */
 async function resumeRideFromHistory({tripId,expectedHistoryRevision}={}){
  if(resumeBusy)return fail('RIDE_RESUME_IN_FLIGHT');
  const user=actor(),eligibility=rideHistoryRecovery();
  if(!user||!eligibility.readReady)return fail('RIDE_HISTORY_NOT_CERTIFIED');
  if(typeof tripId!=='string'
   ||!/^([a-f0-9]{8}-)(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(tripId)
   ||!Number.isSafeInteger(expectedHistoryRevision)||expectedHistoryRevision<1)
   return fail('INVALID_RIDE_HISTORY_SCOPE');
  if(tracking.snapshot().subscriptionActive)return fail('RIDE_ALREADY_TRACKED');
  const page=history.current(user.subject);
  const record=page?.items.find(x=>x.kind==='RIDE'&&x.serviceId===tripId);
  if(!record||record.revision!==expectedHistoryRevision
   ||!['searching','assigned','in_progress'].includes(record.status))
   return fail('RIDE_NOT_ACTIVE_IN_OWN_HISTORY');
  const proof=historyRideProof,privacy=session.privacyRevision();
  const generation=++resumeGeneration;
  resumeBusy=true;notify();
  try{
   const start=startTracking(tripId);
   if(!start.ok)return start;
   const result=await syncTracking();
   const after=actor(),latest=after?history.current(after.subject):null;
   const newest=latest?.items.find(x=>x.kind==='RIDE'&&x.serviceId===tripId);
   const status=tracking.snapshot();
   if(!result.ok||!after||after.subject!==user.subject
    ||session.privacyRevision()!==privacy||generation!==resumeGeneration
    ||historyRideProof!==proof||!newest
    ||newest.revision!==expectedHistoryRevision
    ||!['searching','assigned','arriving','in_progress'].includes(status.state)
    ||!status.subscriptionActive||status.tripId!==tripId
    ||status.revision<expectedHistoryRevision){
    tracking.stopIfMatching(tripId,user.subject);
    return fail('RIDE_RESUME_NOT_VERIFIED');
   }
   recoveredRide=Object.freeze({tripId,subject:user.subject,
    privateViewRevision:privacy});
   return Object.freeze({ok:true,tripId,qaOnly:true,
    productionEnabled:false,serverRevision:status.revision});
  }finally{
   if(generation===resumeGeneration){resumeBusy=false;notify();}
  }
 }
 function completedRideHistory(){
  const user=actor(),tracked=tracking.snapshot(),continuation=rideContinuation();
  const fresh=Number.isSafeInteger(tracked.lastFetchedAt)
   &&tracked.lastFetchedAt<=now()&&now()-tracked.lastFetchedAt<=60000;
  const ready=Boolean(user&&historyGateway?.isConfigured()===true
   &&statusGateway?.isConfigured()===true
   &&continuation.canVerify&&continuation.tripId===tracked.tripId
   &&tracked.subscriptionActive&&tracked.state==='completed'
   &&Number.isSafeInteger(tracked.revision)&&tracked.revision>=1
   &&!tracked.syncing&&!historyLoading&&fresh);
  const page=ready?history.current(user.subject):null;
  const record=page?.items.find(x=>x.kind==='RIDE'
   &&x.serviceId===tracked.tripId&&x.status==='completed'
   &&x.revision>=tracked.revision);
  const verified=Boolean(ready&&completedProof
   &&completedProof.subject===user.subject
   &&completedProof.privateViewRevision===session.privacyRevision()
   &&completedProof.tripId===tracked.tripId
   &&completedProof.revision===tracked.revision
   &&completedProof.historyAnchor===historyRideProof&&record);
  return Object.freeze({readReady:ready,verifying:completedBusy,verified,
   tripId:ready?tracked.tripId:null,qaOnly:true,productionEnabled:false});
 }
 /**
  * F1: a completed status isn't proof of persistent history. Independently
  * confirm an owner-scoped read-only HTTP history response, not a mobile cache.
  * No billing, payouts, review posting or financial receipts are inferred.
  */
 async function verifyCompletedRideHistory(){
  if(completedBusy)return fail('COMPLETED_HISTORY_IN_FLIGHT');
  const user=actor(),before=tracking.snapshot();
  if(!user||!completedRideHistory().readReady)
   return fail('COMPLETED_HISTORY_NOT_READY');
  const generation=++completedEpoch,privacy=session.privacyRevision();
  completedBusy=true;completedProof=null;notify();
  const tripId=before.tripId,revision=before.revision;
  try{
   const loaded=await loadHistoryPage({reset:true});
   const after=actor(),tracked=tracking.snapshot();
   if(generation!==completedEpoch||!after||after.subject!==user.subject
    ||session.privacyRevision()!==privacy
    ||tracked.tripId!==tripId||tracked.state!=='completed'
    ||tracked.revision!==revision||!tracked.subscriptionActive)
    return fail('COMPLETED_HISTORY_STALE_RESPONSE');
   if(!loaded.ok)return fail('COMPLETED_HISTORY_UNVERIFIED');
   const page=history.current(user.subject);
   const row=page?.items.find(x=>x.kind==='RIDE'
    &&x.serviceId===tripId&&x.status==='completed'
    &&x.revision>=revision);
   if(!row||!historyRideProof)return fail('COMPLETED_HISTORY_NOT_CONFIRMED');
   completedProof=Object.freeze({subject:user.subject,
    privateViewRevision:privacy,tripId,revision,historyAnchor:historyRideProof});
   return Object.freeze({ok:true,tripId,qaOnly:true,productionEnabled:false});
  }finally{
   if(generation===completedEpoch){completedBusy=false;notify();}
  }
 }

 function dispatchProof(){
  const user=actor(),proof=prequoteAuto?.verifiedBooking();
  return g73Ready&&autoG73Http?.isConfigured()===true&&user&&proof
   &&proof.subject===user.subject
   &&proof.sessionRevision===session.privacyRevision()
   &&proof.qaOnly===true&&proof.productionEnabled===false?proof:null;
 }
 function autoDispatchSnapshot(){
  const proof=dispatchProof();
  if(!proof)return emptyDispatch();
  const own=dispatch.scope?.subject===proof.subject
   &&dispatch.scope?.requestKey===proof.requestKey
   &&dispatch.scope?.tripId===proof.tripId
   &&dispatch.scope?.sessionRevision===proof.sessionRevision;
  const data=own?dispatch.data:null;
  // G90 CLOSED is queue closure, NOT a verified Driver assignment.
  // Enable continuation only when this same booked trip has an independent
  // Passenger-owned G4 status reader. Never infer location/identity from G90.
  const continuation=rideContinuation(),tracked=tracking.snapshot();
  const expected={accepted:'assigned',arriving:'arriving',
   in_progress:'in_progress',completed:'completed'}[data?.tripState];
  const alreadyVerified=tracked.subscriptionActive===true
   &&tracked.tripId===proof.tripId&&tracked.state===expected;
  const needsRideVerification=Boolean(data?.dispatchState==='CLOSED'
   &&expected&&continuation.canVerify
   &&continuation.tripId===proof.tripId&&!alreadyVerified);
  return Object.freeze({readReady:true,busy:own&&dispatch.busy,
   error:own?dispatch.error:null,tripId:proof.tripId,
   tripState:data?.tripState??null,dispatchState:data?.dispatchState??null,
   attempts:data?.attempts??null,
   offerPendingAcceptance:data?.offerPendingAcceptance===true,
   needsRideVerification,productionEnabled:false});
 }
 async function refreshAutoDispatch(){
  const proof=dispatchProof();
  if(!proof)return fail('DISPATCH_BOOKING_NOT_VERIFIED');
  if(dispatch.busy)return fail('DISPATCH_READ_IN_FLIGHT');
  const scope={subject:proof.subject,sessionRevision:proof.sessionRevision,
   requestKey:proof.requestKey,tripId:proof.tripId};
  const epoch=++dispatchEpoch;
  dispatch={busy:true,data:null,error:null,scope};notify();
  let result;
  try{result=await autoG73Http.readDispatch({
   ownerId:scope.subject,sessionRevision:scope.sessionRevision,
   requestKey:scope.requestKey,tripId:scope.tripId
  });}catch{result=fail('NETWORK_OR_TIMEOUT');}
  const still=dispatchProof();
  if(epoch!==dispatchEpoch||!still||still.subject!==scope.subject
   ||still.sessionRevision!==scope.sessionRevision
   ||still.requestKey!==scope.requestKey||still.tripId!==scope.tripId){
   if(epoch===dispatchEpoch)
    dispatch={busy:false,data:null,error:null,scope:null};
   notify();return fail('STALE_SESSION_RESPONSE');
  }
  if(result?.ok!==true||result.qaOnly!==true||result.productionEnabled!==false){
   const error=result?.code??'DISPATCH_READ_FAILED';
   dispatch={busy:false,data:null,error,scope};notify();return fail(error);
  }
  dispatch={busy:false,data:result.data,error:null,scope};notify();
  return Object.freeze({ok:true,tripId:scope.tripId,
   dispatchState:result.data.dispatchState,qaOnly:true,productionEnabled:false});
 }
 function anchorAutoFinancialReceipt(){
  const proof=prequoteAuto.verifiedBooking(),u=actor(),receipt=subsidyReceipt;
  if(!g93Required||!proof||!u||!receipt||proof.subject!==u.subject
   ||proof.sessionRevision!==session.privacyRevision()
   ||receipt.subject!==u.subject||receipt.privacy!==session.privacyRevision()
   ||receipt.quoteId!==proof.quoteId||receipt.data.quoteId!==proof.quoteId
   ||receipt.data.ownerId!==u.subject)return false;
  const d=receipt.data;
  financialEpoch++;financial={busy:false,data:null,error:null};
  financialAnchor=Object.freeze({subject:u.subject,
   sessionRevision:session.privacyRevision(),requestKey:proof.requestKey,
   tripId:proof.tripId,quoteId:proof.quoteId,serverRevision:proof.serverRevision,
   customerPaysGs:d.customerPaysGs,driverReceivesGs:d.driverReceivesGs,
   customerSubsidyGs:d.customerSubsidyGs,platformRetainsGs:d.platformRetainsGs});
  return true;
 }
 function verifiedAutoFinancialScope(){
  const p=dispatchProof(),a=financialAnchor;
  if(!p||!a||autoG73Http?.isFinancialConfigured()!==true
   ||a.subject!==p.subject||a.sessionRevision!==p.sessionRevision
   ||a.requestKey!==p.requestKey||a.tripId!==p.tripId
   ||a.quoteId!==p.quoteId||a.serverRevision!==p.serverRevision)return null;
  return a;
 }
 function publicAutoFinance(){
  const s=verifiedAutoFinancialScope();
  const empty={readReady:false,busy:false,error:null,tripId:null,
   tripState:null,tripRevision:null,financialState:null,
   customerPaysGs:null,customerSubsidyGs:null,
   pspCollected:false,pspRefunded:false,qaOnly:true,productionEnabled:false};
  if(!s)return Object.freeze(empty);
  const d=financial.data;
  return Object.freeze({...empty,readReady:true,busy:financial.busy,
   error:financial.error,tripId:s.tripId,
   tripState:d?.tripState??null,tripRevision:d?.tripRevision??null,
   financialState:d?.financialState??null,customerPaysGs:d?.customerPaysGs??null,
   customerSubsidyGs:d?.customerSubsidyGs??null});
 }
 async function refreshAutoFinancialStatus(){
  const s=verifiedAutoFinancialScope();
  if(!s)return fail('G94_BOOKING_NOT_VERIFIED');
  if(financial.busy)return fail('G94_READ_IN_FLIGHT');
  const epoch=++financialEpoch;
  financial={busy:true,data:null,error:null};notify();
  let result;
  try{result=await autoG73Http.readFinancialStatus({
   ownerId:s.subject,sessionRevision:s.sessionRevision,requestKey:s.requestKey,
   quoteId:s.quoteId,tripId:s.tripId,serverRevision:s.serverRevision,
   customerPaysGs:s.customerPaysGs,driverReceivesGs:s.driverReceivesGs,
   customerSubsidyGs:s.customerSubsidyGs,platformRetainsGs:s.platformRetainsGs
  });}catch{result=fail('NETWORK_OR_TIMEOUT');}
  const latest=verifiedAutoFinancialScope();
  if(epoch!==financialEpoch||latest!==s){
   if(epoch===financialEpoch)financial={busy:false,data:null,error:null};
   notify();return fail('STALE_SESSION_RESPONSE');
  }
  if(result?.ok!==true||result.qaOnly!==true||result.productionEnabled!==false){
   const error=result?.code??'G94_UNVERIFIED_RECEIPT';
   financial={busy:false,data:null,error};notify();return fail(error);
  }
  financial={busy:false,data:result.data,error:null};notify();
  return Object.freeze({ok:true,tripId:s.tripId,
   financialState:result.data.financialState,qaOnly:true,productionEnabled:false});
 }
 function g95BookingScope(){
  if(autoG73Http?.isCancellationConfigured()!==true)return null;
  const proof=dispatchProof(),user=actor();
  if(proof)return Object.freeze({ownerId:proof.subject,sessionRevision:proof.sessionRevision,
   requestKey:proof.requestKey,tripId:proof.tripId,quoteId:proof.quoteId,
   routeId:proof.routeId,serverRevision:proof.serverRevision});
  return user&&g95Restored&&g95Restored.ownerId===user.subject
   &&g95Restored.sessionRevision===session.privacyRevision()?g95Restored:null;
 }
 // Fresh G4 status is required to SEND a cancellation, but once any POST was
 // attempted the private receipt GET must remain possible if tracking ages.
 function g95Scope(){
  const booking=g95BookingScope(),tracked=tracking.snapshot();
  if(!booking||!tracked.subscriptionActive||tracked.tripId!==booking.tripId
   ||!Number.isSafeInteger(tracked.revision)
   ||tracked.revision<booking.serverRevision
   ||!Number.isSafeInteger(tracked.lastFetchedAt)
   ||tracked.lastFetchedAt>now()||now()-tracked.lastFetchedAt>60000)return null;
  return Object.freeze({...booking,tripState:tracked.state});
 }
 function preparedG95Scope(){
  const s=g95BookingScope(),a=g95.scope;
  return s&&a&&a.ownerId===s.ownerId
   &&a.sessionRevision===s.sessionRevision&&a.requestKey===s.requestKey
   &&a.tripId===s.tripId&&a.quoteId===s.quoteId
   &&a.serverRevision===s.serverRevision?a:null;
 }
 function publicG95(){
  const fresh=g95Scope(),scope=preparedG95Scope(),same=Boolean(scope);
  return Object.freeze({
   contractReady:Boolean(fresh&&g95.phase==='idle'
    &&['searching','assigned','arriving'].includes(fresh.tripState)),
   phase:same?g95.phase:'idle',
   requiresReconciliation:same&&g95.phase==='ambiguous',
   canVerify:same&&g95.phase==='confirmed'
    &&g95.receipt?.financialState==='VOIDED_QA'
    &&verifiedAutoFinancialScope()!==null
    &&statusGateway?.isConfigured()===true,
   statusReadReady:same&&g95.phase==='confirmed'
    &&g95Restored!==null&&statusGateway?.isConfigured()===true
    &&g95.statusVerified!==true,
   statusIndependentlyVerified:same&&g95.statusVerified===true
    &&tracking.snapshot().subscriptionActive
    &&tracking.snapshot().tripId===scope?.tripId
    &&tracking.snapshot().state==='cancelled'
    &&tracking.snapshot().revision>=g95.receipt?.tripRevision,
   independentlyVerified:same&&g95.phase==='verified',
   tripId:fresh?.tripId??scope?.tripId??null,
   busy:same&&['sending','reconciling','verifying','checkingStatus'].includes(g95.phase),
   financialState:same?g95.receipt?.financialState??null:null,
   error:same?g95.error:null,qaOnly:true,productionEnabled:false});
 }
 function prepareG95Cancel({requestKey}={}){
  if(g95.phase!=='idle')return fail('G95_ALREADY_ATTEMPTED');
  const s=g95Scope();
  if(!s||!['searching','assigned','arriving'].includes(s.tripState))
   return fail('G95_VERIFIED_ACTIVE_AUTO_REQUIRED');
  if(typeof requestKey!=='string'||!G95_ID.test(requestKey)
   ||requestKey===s.requestKey)return fail('G95_INVALID_REQUEST_KEY');
  g95Epoch++;g95={phase:'ready',requestKey,scope:s,receipt:null,error:null};
  notify();return Object.freeze({ok:true,qaOnly:true,productionEnabled:false});
 }
 function abandonG95PreparedCancel(){
  if(g95.phase!=='ready')return fail('G95_CANNOT_DISCARD_AFTER_NETWORK');
  g95Epoch++;g95={phase:'idle',requestKey:null,scope:null,receipt:null,error:null};
  notify();return Object.freeze({ok:true,qaOnly:true,productionEnabled:false});
 }
 async function sendG95Cancel(){
  if(g95.phase!=='ready')return fail('G95_NOT_PREPARED');
  const s=preparedG95Scope();
  if(!s||!['searching','assigned','arriving'].includes(g95Scope()?.tripState))
   return fail('G95_FRESH_RIDE_REQUIRED');
  const seq=++g95Epoch,key=g95.requestKey;
  g95={...g95,phase:'sending',error:null};notify();
  if(g95RecoveryStore&&!canSaveG95){
   g95={...g95,phase:'ready',error:'G95_SECURE_STORE_UNAVAILABLE'};notify();
   return fail('G95_SECURE_STORE_UNAVAILABLE');
  }
  if(canSaveG95){
   const record={version:1,createdAt:now(),ownerId:s.ownerId,
    requestKey:s.requestKey,quoteId:s.quoteId,routeId:s.routeId,
    tripId:s.tripId,serverRevision:s.serverRevision,cancellationKey:key};
   try{await g95RecoveryStore.write(record);}
   catch{
    if(seq===g95Epoch){g95={...g95,phase:'ready',error:'G95_SECURE_SAVE_FAILED'};notify();}
    return fail('G95_SECURE_SAVE_FAILED');
   }
   if(seq!==g95Epoch||!preparedG95Scope())return fail('STALE_SESSION_RESPONSE');
  }
  let result;
  try{result=await autoG73Http.cancelAuto({...s,cancellationKey:key});}
  catch{result=fail('NETWORK_OR_TIMEOUT');}
  if(seq!==g95Epoch||!preparedG95Scope())return fail('STALE_SESSION_RESPONSE');
  if(result?.ok===true&&result.qaOnly===true&&result.productionEnabled===false){
   g95={...g95,phase:'confirmed',receipt:result.data,error:null};
   financialEpoch++;financial={busy:false,data:null,error:null};notify();
   return Object.freeze({ok:true,qaOnly:true,productionEnabled:false});
  }
  g95={...g95,phase:'ambiguous',error:'G95_GET_RECONCILIATION_REQUIRED'};
  notify();return fail('G95_GET_RECONCILIATION_REQUIRED');
 }
 async function restoreG95Cancellation(){
  if(!canSaveG95)return fail('G95_RECOVERY_NOT_CONFIGURED');
  if(restoringG95||g95.phase!=='idle')return fail('G95_RECOVERY_BUSY');
  const who=actor(),rev=session.privacyRevision();
  if(!who||autoG73Http?.isCancellationConfigured()!==true)
   return fail('G95_RECOVERY_AUTH_REQUIRED');
  restoringG95=true;
  const epoch=++g95Epoch;
  try{
   let saved;
   try{saved=await g95RecoveryStore.read();}
   catch{return fail('G95_SECURE_READ_FAILED');}
   if(epoch!==g95Epoch||actor()?.subject!==who.subject
    ||session.privacyRevision()!==rev)return fail('STALE_SESSION_RESPONSE');
   if(saved===null||saved===undefined)return fail('G95_NOT_SAVED');
   if(!saved||typeof saved!=='object'||Array.isArray(saved)
    ||Object.keys(saved).length!==9||saved.version!==1
    ||saved.ownerId!==who.subject
    ||!['requestKey','quoteId','routeId','tripId','cancellationKey']
      .every(k=>G95_ID.test(saved[k]??''))
    ||saved.requestKey===saved.cancellationKey
    ||!Number.isSafeInteger(saved.createdAt)||saved.createdAt>now()+60000
    ||saved.createdAt<now()-604800000
    ||!Number.isSafeInteger(saved.serverRevision)||saved.serverRevision<1)
    return fail('G95_SAVED_SCOPE_INVALID');
   const query={ownerId:who.subject,sessionRevision:rev,
    requestKey:saved.requestKey,routeId:saved.routeId,quoteId:saved.quoteId};
   let result;
   try{result=await autoG73Http.reconcile(query);}
   catch{result=fail('NETWORK_OR_TIMEOUT');}
   if(epoch!==g95Epoch||actor()?.subject!==who.subject
    ||session.privacyRevision()!==rev)return fail('STALE_SESSION_RESPONSE');
   if(result?.ok!==true||result.qaOnly!==true||result.productionEnabled!==false
    ||result.data.tripId!==saved.tripId
    ||result.data.revision!==saved.serverRevision)
    return fail('G95_BOOKING_NOT_REVALIDATED');
   const restored=Object.freeze({...query,tripId:saved.tripId,
    serverRevision:saved.serverRevision});
   g95Restored=restored;
   g95={phase:'ambiguous',requestKey:saved.cancellationKey,scope:restored,
    receipt:null,error:null};
   notify();return Object.freeze({ok:true,tripId:saved.tripId,
    requiresReconciliation:true,qaOnly:true,productionEnabled:false});
  }finally{restoringG95=false;}
 }
 async function reconcileG95Cancel(){
  if(g95.phase!=='ambiguous')return fail('G95_NO_AMBIGUITY');
  const s=preparedG95Scope();
  if(!s)return fail('G95_SCOPE_NOT_VERIFIED');
  const seq=++g95Epoch;
  g95={...g95,phase:'reconciling',error:null};notify();
  let result;
  try{result=await autoG73Http.readCancellation(s);}
  catch{result=fail('NETWORK_OR_TIMEOUT');}
  if(seq!==g95Epoch||!preparedG95Scope())return fail('STALE_SESSION_RESPONSE');
  if(result?.ok===true&&result.qaOnly===true&&result.productionEnabled===false
   &&result.data.cancellationKey===g95.requestKey){
   g95={...g95,phase:'confirmed',receipt:result.data,error:null};
   financialEpoch++;financial={busy:false,data:null,error:null};notify();
   return Object.freeze({ok:true,recoveredWithoutPost:true,
    qaOnly:true,productionEnabled:false});
  }
  g95={...g95,phase:'ambiguous',error:'G95_GET_STILL_UNCONFIRMED'};
  notify();return fail('G95_GET_STILL_UNCONFIRMED');
 }
 // R76: an independently authenticated G73 booking and G95 receipt can
 // authorize one private terminal G4 status GET after a native process restart.
 async function verifyRecoveredG95RideStatus(){
  if(g95.phase!=='confirmed'||g95.statusVerified===true||!g95.receipt)
   return fail('G95_G4_READ_NOT_READY');
  const scope=preparedG95Scope(),receipt=g95.receipt;
  if(!scope||g95Restored===null||scope!==g95Restored
   ||statusGateway?.isConfigured()!==true
   ||receipt.ownerId!==scope.ownerId
   ||receipt.tripId!==scope.tripId||receipt.bookingKey!==scope.requestKey
   ||receipt.quoteId!==scope.quoteId||receipt.financialState!=='VOIDED_QA')
   return fail('G95_G4_PROOF_NOT_READY');
  if(tracking.snapshot().subscriptionActive)
   return fail('G95_G4_ACTIVE_TRACKING_PRESENT');
  const epoch=++g95Epoch;
  g95={...g95,phase:'checkingStatus',error:null};notify();
  const started=startTracking(scope.tripId);
  if(!started.ok){
   g95={...g95,phase:'confirmed',error:'G95_G4_READ_UNAVAILABLE'};
   notify();return fail('G95_G4_READ_UNAVAILABLE');
  }
  let answer;
  try{answer=await syncTracking();}catch{answer=fail('NETWORK_OR_TIMEOUT');}
  const after=preparedG95Scope(),ride=tracking.snapshot();
  if(epoch!==g95Epoch||after!==scope){
   tracking.stopIfMatching(scope.tripId,scope.ownerId);
   return fail('STALE_SESSION_RESPONSE');
  }
  const fresh=Number.isSafeInteger(ride.lastFetchedAt)
   &&ride.lastFetchedAt<=now()&&now()-ride.lastFetchedAt<=60000;
  if(!answer?.ok||!fresh||!ride.subscriptionActive
   ||ride.tripId!==scope.tripId||ride.state!=='cancelled'
   ||ride.revision<receipt.tripRevision){
   tracking.stopIfMatching(scope.tripId,scope.ownerId);
   g95={...g95,phase:'confirmed',statusVerified:false,
    error:'G95_G4_CANCEL_NOT_VERIFIED'};
   notify();return fail('G95_G4_CANCEL_NOT_VERIFIED');
  }
  g95={...g95,phase:'confirmed',statusVerified:true,error:null};notify();
  return Object.freeze({ok:true,tripId:scope.tripId,verifiedBy:['G4'],
   financeVerified:false,pspRefunded:false,qaOnly:true,productionEnabled:false});
 }
 async function verifyG95Cancellation(){
  if(g95.phase!=='confirmed'||!g95.receipt)
   return fail('G95_CANCEL_RECEIPT_NOT_CONFIRMED');
  const scope=preparedG95Scope(),receipt=g95.receipt;
  if(!scope||receipt.ownerId!==scope.ownerId||receipt.tripId!==scope.tripId
   ||receipt.bookingKey!==scope.requestKey||receipt.quoteId!==scope.quoteId)
   return fail('G95_SCOPE_NOT_VERIFIED');
  if(receipt.financialState!=='VOIDED_QA'
   ||autoG73Http?.isFinancialConfigured()!==true
   ||statusGateway?.isConfigured()!==true)return fail('G95_RECONCILIATION_NOT_CERTIFIED');
  const epoch=++g95Epoch;
  g95={...g95,phase:'verifying',error:null};notify();
  const still=()=>epoch===g95Epoch&&preparedG95Scope()===scope;
  const uncertain=code=>{
   if(still()){
    g95={...g95,phase:'confirmed',error:code};notify();
   }
   return fail(code);
  };
  const refreshed=await syncTracking();
  if(!still())return fail('STALE_SESSION_RESPONSE');
  const ride=tracking.snapshot();
  if(!refreshed?.ok||!ride.subscriptionActive||ride.tripId!==scope.tripId
   ||ride.state!=='cancelled'||ride.revision<receipt.tripRevision)
   return uncertain('G95_G4_CANCEL_NOT_VERIFIED');
  const financeResult=await refreshAutoFinancialStatus();
  if(!still())return fail('STALE_SESSION_RESPONSE');
  const ledger=publicAutoFinance();
  if(!financeResult?.ok||ledger.tripId!==scope.tripId
   ||ledger.tripState!=='cancelled'
   ||ledger.tripRevision<receipt.tripRevision
   ||ledger.financialState!=='VOIDED_QA'
   ||ledger.customerPaysGs===null||ledger.pspCollected!==false
   ||ledger.pspRefunded!==false)return uncertain('G95_G94_REVERSAL_NOT_VERIFIED');
  g95={...g95,phase:'verified',error:null};notify();
  if(canSaveG95){try{await g95RecoveryStore.clear();}catch{/* backend proof remains authoritative */}}
  return Object.freeze({ok:true,tripId:scope.tripId,verifiedBy:['G4','G94'],
   qaOnly:true,productionEnabled:false,pspRefunded:false});
 }
 function verifiedAutoSubsidy(){
  const user=actor(),quote=prequoteAuto.snapshot().quote,proof=subsidyReceipt;
  if(!g93Required||!user||!quote||!proof||proof.subject!==user.subject
   ||proof.privacy!==session.privacyRevision()||proof.quoteId!==quote.quoteId
   ||proof.data.fareVersion!==quote.fareVersion
   ||proof.data.originalFareGs!==quote.amountGs
   ||proof.data.expiresAt<=now()||proof.data.expiresAt>quote.expiresAt)
   return null;
  return proof.data;
 }
 function publicAutoPrequote(){
  const base=prequoteAuto.snapshot(),proof=verifiedAutoSubsidy();
  return Object.freeze({...base,subsidyRequired:g93Required,
   subsidyAvailable:g93Required&&autoG73Http?.isSubsidyConfigured()===true,
   subsidyLoading:subsidyBusy,
   subsidy:proof?Object.freeze({
    quoteId:proof.quoteId,campaignId:proof.campaignId,
    originalFareGs:proof.originalFareGs,customerSubsidyGs:proof.customerSubsidyGs,
    customerPaysGs:proof.customerPaysGs,commissionBps:proof.commissionBps,
    subsidyBps:proof.subsidyBps,platformRetainsGs:proof.platformRetainsGs,
    fareVersion:proof.fareVersion,expiresAt:proof.expiresAt
   }):null});
 }

 function publicMotoRideStatus(){return Object.freeze({
  readReady:Boolean(motoRideGateway?.isConfigured()),busy:motoRide.busy,
  tripId:motoRide.data?.tripId??null,
  state:motoRide.data?.tripState??null,
  revision:motoRide.data?.tripRevision??null,
  financialState:motoRide.data?.financialState??null,
  commissionBps:motoRide.data?.commissionBps??null,
  customerPaysGs:motoRide.data?.customerPaysGs??null,
  driverIdentityExposed:false,gpsVerified:false,etaAvailable:false,
  error:motoRide.error,qaOnly:true,productionEnabled:false
 });}
 async function refreshMotoRideStatus({bookingKey}={}){
  const a=actor(),state=motoFlow.snapshot();
  if(!motoRideGateway?.isConfigured())return fail('G119_MOTO_STATUS_NOT_CERTIFIED');
  if(!a||!['booked','cancelled'].includes(state.phase)
   ||!G95_ID.test(bookingKey??'')||!G95_ID.test(state.tripId??''))
   return fail('G119_MOTO_BOOKING_REQUIRED');
  if(motoRide.busy)return fail('G119_MOTO_READ_IN_FLIGHT');
  const seq=++motoRideEpoch,scope=session.privacyRevision();
  const tripId=state.tripId,owner=a.subject;
  const floor=motoRide.data?.tripId===tripId?motoRide.data.tripRevision:1;
  motoRide={busy:true,data:null,error:null};notify();
  let result;try{result=await motoRideGateway.read({
   bookingKey,expectedTripId:tripId,minimumRevision:floor
  });}catch{result=fail('G119_NETWORK_UNAVAILABLE');}
  if(seq!==motoRideEpoch||session.privacyRevision()!==scope
   ||actor()?.subject!==owner)return fail('STALE_SESSION_RESPONSE');
  if(result?.ok!==true){
   motoRide={busy:false,data:null,error:result?.code??'G119_STATUS_UNAVAILABLE'};
   notify();return fail(motoRide.error);
  }
  motoRide={busy:false,data:result.data,error:null};notify();
  return Object.freeze({ok:true,qaOnly:true,productionEnabled:false});
 }
 function publicDeliveryRegistration(){
  const pending=mutations.publicState(),user=actor(),saved=registration.receipt;
  const belongs=Boolean(user&&pending.operation==='deliveryRequest'
   &&pending.requestKey&&saved?.requestKey===pending.requestKey
   &&saved.ownerId===user.subject
   &&saved.sessionRevision===session.privacyRevision());
  return Object.freeze({
   readReady:Boolean(user&&g121Registration?.isConfigured()),
   busy:Boolean(user&&registration.busy),
   deliveryId:belongs?saved.deliveryId:null,
   vehicleKind:belongs?saved.vehicleKind:null,
   revision:belongs?saved.revision:null,
   status:belongs?saved.status??'requested':null,
   terminal:belongs&&['delivered','returned','cancelled'].includes(saved.status),
   requestKey:belongs?saved.requestKey:null,
   registrationOnly:true,qaOnly:true,productionEnabled:false
  });
 }
 async function readUnconfirmedDeliveryRegistration(){
  const user=actor(),pending=mutations.publicState();
  if(!user)return fail('AUTH_REQUIRED');
  if(!g121Registration?.isConfigured())return fail('G121_NOT_CERTIFIED');
  if(!['failed','acknowledged'].includes(pending.phase)
   ||pending.operation!=='deliveryRequest'||!pending.requestKey)
   return fail('G121_NO_UNCONFIRMED_DELIVERY');
  if(registration.busy)return fail('G121_IN_FLIGHT');
  const epoch=++registrationEpoch,owner=user.subject;
  const sessionRevision=session.privacyRevision(),requestKey=pending.requestKey;
  registration={busy:true,receipt:null};notify();
  let result;
  try{result=await g121Registration.read({
   requestKey,expectedSubject:owner,expectedSessionRevision:sessionRevision
  });}catch{result=fail('G121_UNAVAILABLE');}
  const current=actor(),mutation=mutations.publicState();
  if(epoch!==registrationEpoch||!current||current.subject!==owner
   ||session.privacyRevision()!==sessionRevision
   ||mutation.operation!=='deliveryRequest'
   ||!['failed','acknowledged'].includes(mutation.phase)
   ||mutation.requestKey!==requestKey)return fail('STALE_SESSION_RESPONSE');
  if(result.ok){
   registration={busy:false,receipt:Object.freeze({
    requestKey,ownerId:owner,sessionRevision,
    deliveryId:result.deliveryId,vehicleKind:result.vehicleKind,revision:result.revision,
    status:result.status??'requested'
   })};
   // B23: after independent G121 ownership proof, restore only the
   // sealed original G7 quote key. This operation MUST NEVER send HTTP.
   if(g122Consent?.isConfigured()&&g122Consent.snapshot().phase==='idle'){
    try{await g122Consent.restoreOriginalQuote({
     ownerId:owner,requestKey,deliveryId:result.deliveryId,
     vehicleKind:result.vehicleKind,sessionRevision
    });}catch{}
    const latest=actor(),pendingNow=mutations.publicState();
    if(epoch!==registrationEpoch||!latest||latest.subject!==owner
     ||session.privacyRevision()!==sessionRevision
     ||pendingNow.requestKey!==requestKey)return fail('STALE_SESSION_RESPONSE');
   }
  }else registration={busy:false,receipt:null};
  notify();return result;
 }
 function publicTerminalRelease(){
  const verified=publicDeliveryRegistration();
  const user=actor(),custody=senderCustody?.snapshot();
  const pending=mutations.publicState();
  const page=user?history.current(user.subject):null;
  const item=page?.items.find(x=>x.kind==='DELIVERY'
   &&x.serviceId===verified.deliveryId);
  const terminal=verified.status==='delivered'||verified.status==='returned';
  const possible=Boolean(user&&terminal&&!terminalReleaseBusy
   &&['failed','acknowledged'].includes(pending.phase)
   &&pending.operation==='deliveryRequest'
   &&pending.requestKey===verified.requestKey
   &&item&&senderCustody?.isConfigured()===true
   &&custodyAnchor?.deliveryId===verified.deliveryId
   &&custodyAnchor?.subject===user.subject
   &&custodyAnchor?.historyRevision===item.revision
   &&custody?.deliveryId===verified.deliveryId
   &&custody.vehicleKind===verified.vehicleKind
   &&custody.state===verified.status&&custody.proofVerified===true
   &&Number.isSafeInteger(custody.revision)
   &&custody.revision>=verified.revision
   &&typeof deliveryRecoveryStore?.clearMatching==='function'
   &&typeof deliveryQuoteKeyStore?.clearMatching==='function');
  return Object.freeze({canFinalize:possible,busy:terminalReleaseBusy,
   deliveryId:possible?verified.deliveryId:null,
   qaOnly:true,productionEnabled:false,changesServer:false});
 }
 /**
  * Requires fresh G121 AND fresh G68 reads before deleting original keys.
  * This only unlocks another QA draft; no payment or server row is deleted.
  */
 async function finalizeDeliveredDeliveryQa(){
  const user=actor(),pending=mutations.publicState();
  const first=publicDeliveryRegistration();
  if(!user)return fail('AUTH_REQUIRED');
  if(terminalReleaseBusy)return fail('TERMINAL_RELEASE_IN_FLIGHT');
  if(!publicTerminalRelease().canFinalize)
   return fail('TERMINAL_PROOF_REQUIRED');
  const owner=user.subject,revision=session.privacyRevision();
  const key=first.requestKey,deliveryId=first.deliveryId,vehicleKind=first.vehicleKind;
  const page=history.current(owner);
  const item=page?.items.find(x=>x.kind==='DELIVERY'&&x.serviceId===deliveryId);
  if(!item||!key||!deliveryId||!vehicleKind)return fail('TERMINAL_HISTORY_REQUIRED');
  const sameScope=()=>{
   const nowUser=actor(),current=mutations.publicState();
   const historyPage=history.current(owner);
   const inHistory=historyPage?.items.some(x=>x.kind==='DELIVERY'
    &&x.serviceId===deliveryId&&x.revision===item.revision);
   return Boolean(nowUser&&nowUser.subject===owner
    &&session.privacyRevision()===revision&&inHistory
    &&current.operation==='deliveryRequest'
    &&current.requestKey===key
    &&['failed','acknowledged'].includes(current.phase));
  };
  terminalReleaseBusy=true;notify();
  try{
   const readback=await readUnconfirmedDeliveryRegistration();
   if(!readback.ok||!sameScope())
    return fail('TERMINAL_G121_UNVERIFIED');
   const authoritative=publicDeliveryRegistration();
   if(authoritative.deliveryId!==deliveryId
    ||authoritative.vehicleKind!==vehicleKind
    ||!['delivered','returned'].includes(authoritative.status))
    return fail('TERMINAL_PROOF_REQUIRED');
   custodyAnchor=Object.freeze({deliveryId,subject:owner,historyRevision:item.revision});
   const read=await senderCustody.refresh(deliveryId,owner,revision);
   if(!read.ok||!sameScope()||!guardCustodyScope())
    return fail('TERMINAL_G68_UNVERIFIED');
   const proof=senderCustody.snapshot();
   const released=await releaseTerminalDeliveryKeys({
    ownerId:owner,deliveryId,requestKey:key,vehicleKind,
    g121:authoritative,g68:proof,
    g5Store:deliveryRecoveryStore,g7Store:deliveryQuoteKeyStore,
    stillAuthorized:sameScope
   });
   if(!released.ok)return released;
   if(!sameScope())return fail('TERMINAL_SESSION_CHANGED');
   mutations.clear();deliveryRecovery.clearMemory();
   // Re-read the now-empty native record before enabling the next draft.
   const empty=await deliveryRecovery.restore(owner);
   if(empty.ok!==true||empty.restored===true)
    return fail('TERMINAL_SECURE_RECHECK_FAILED');
   registrationEpoch++;registration={busy:false,receipt:null};
   g122Consent?.clear();
   senderCustody.clear();custodyAnchor=null;
   return Object.freeze({ok:true,qaOnly:true,productionEnabled:false,
    localKeysReleased:true,deliveryId});
  }finally{terminalReleaseBusy=false;notify();}
 }
 function publicDeliveryPriceConsent(){
  const verified=publicDeliveryRegistration(),current=g122Consent?.snapshot();
  const anchored=Boolean(verified.deliveryId&&current?.deliveryId===verified.deliveryId
   &&current.vehicleKind===verified.vehicleKind);
  const ready=Boolean(verified.deliveryId&&g122Consent?.isConfigured());
  if(!anchored)return Object.freeze({contractReady:ready,phase:'idle',
   deliveryId:null,vehicleKind:null,quote:null,consentId:null,
   canQuote:ready,canRecoverQuote:false,canConfirm:false,unknown:false,qaOnly:true,
   productionEnabled:false,paymentAuthorized:false,dispatchEnabled:false});
  return Object.freeze({...current,contractReady:ready,
   canQuote:Boolean(current.canQuote&&ready),
   canRecoverQuote:Boolean(current.canRecoverQuote&&ready),
   canConfirm:Boolean(current.canConfirm&&ready)});
 }
 async function quoteRecoveredDelivery(quoteRequestKey){
  const user=actor(),verified=publicDeliveryRegistration();
  const pending=mutations.publicState();
  if(!user)return fail('AUTH_REQUIRED');
  if(!g122Consent?.isConfigured())return fail('G122_NOT_CERTIFIED');
  if(!verified.deliveryId||!verified.vehicleKind||!verified.requestKey
   ||!['failed','acknowledged'].includes(pending.phase)
   ||pending.operation!=='deliveryRequest'
   ||pending.requestKey!==verified.requestKey)
   return fail('DELIVERY_REGISTRATION_NOT_VERIFIED');
  const revision=session.privacyRevision(),owner=user.subject,key=verified.requestKey;
  const promise=g122Consent.quote({ownerId:owner,requestKey:key,
   deliveryId:verified.deliveryId,vehicleKind:verified.vehicleKind,
   sessionRevision:revision},quoteRequestKey);
  notify();const result=await promise;
  const after=actor(),still=publicDeliveryRegistration();
  if(!after||after.subject!==owner||session.privacyRevision()!==revision
   ||still.requestKey!==key||still.deliveryId!==verified.deliveryId)
   return fail('STALE_SESSION_RESPONSE');
  notify();return result;
 }
 async function recoverOriginalDeliveryQuote(){
  const user=actor(),verified=publicDeliveryRegistration();
  const pending=mutations.publicState(),scope=g122Consent?.snapshot();
  if(!user)return fail('AUTH_REQUIRED');
  if(!verified.deliveryId||!verified.vehicleKind||!verified.requestKey
   ||pending.operation!=='deliveryRequest'
   ||!['failed','acknowledged'].includes(pending.phase)
   ||pending.requestKey!==verified.requestKey
   ||scope?.deliveryId!==verified.deliveryId
   ||scope?.vehicleKind!==verified.vehicleKind
   ||scope?.canRecoverQuote!==true)
   return fail('G126_RECOVERY_SCOPE_UNVERIFIED');
  const revision=session.privacyRevision(),owner=user.subject,key=verified.requestKey;
  const promise=g122Consent.recoverOriginalQuote();
  notify();const result=await promise;
  const after=actor(),still=publicDeliveryRegistration();
  if(!after||after.subject!==owner||session.privacyRevision()!==revision
   ||still.requestKey!==key||still.deliveryId!==verified.deliveryId)
   return fail('STALE_SESSION_RESPONSE');
  notify();return result;
 }
 async function confirmRecoveredDeliveryQuote(args){
  const user=actor(),verified=publicDeliveryRegistration();
  const pending=mutations.publicState(),scope=g122Consent?.snapshot();
  if(!user)return fail('AUTH_REQUIRED');
  if(!verified.deliveryId||!verified.vehicleKind
   ||pending.operation!=='deliveryRequest'
   ||!['failed','acknowledged'].includes(pending.phase)
   ||pending.requestKey!==verified.requestKey
   ||scope?.deliveryId!==verified.deliveryId
   ||scope?.vehicleKind!==verified.vehicleKind)return fail('G122_SCOPE_CHANGED');
  const revision=session.privacyRevision(),owner=user.subject,key=verified.requestKey;
  const promise=g122Consent.confirm(args);
  notify();const result=await promise;
  const after=actor(),still=publicDeliveryRegistration();
  if(!after||after.subject!==owner||session.privacyRevision()!==revision
   ||still.requestKey!==key||still.deliveryId!==verified.deliveryId)
   return fail('STALE_SESSION_RESPONSE');
  notify();return result;
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
    deliveryRegistration:publicDeliveryRegistration(),
    deliveryRecovery:deliveryRecovery.snapshot(null),
    deliveryQaRegistration:Object.freeze({ready:false,commercialEnabled:false}),
    deliveryTerminalRelease:Object.freeze({canFinalize:false,busy:false,
     deliveryId:null,qaOnly:true,productionEnabled:false,changesServer:false}),
    deliveryPriceConsent:publicDeliveryPriceConsent(),
    rideContinuation:Object.freeze({canVerify:false,tripId:null,qaOnly:true,productionEnabled:false}),
    rideHistoryRecovery:Object.freeze({readReady:false,busy:false,qaOnly:true,productionEnabled:false}),
    completedRideHistory:Object.freeze({readReady:false,verifying:false,verified:false,tripId:null,qaOnly:true,productionEnabled:false}),
    privateViewRevision:session.privacyRevision(),tracking:tracking.snapshot(),quote:null,
    autoPrequote:publicAutoPrequote(),autoRouteQuote:autoRouteIntake.snapshot(),
    autoDispatch:emptyDispatch(),autoFinance:publicAutoFinance(),g95Cancellation:publicG95(),
    motoPassenger:motoFlow.snapshot(),motoRideStatus:publicMotoRideStatus(),history:null,
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
   bookingRecovery:Object.freeze({readReady:Boolean(bookingGateway?.reconciliationConfigured?.()||g5QaGateway?.isConfigured()),
    productionEnabled:false}),
   deliveryRegistration:publicDeliveryRegistration(),
   deliveryRecovery:deliveryRecovery.snapshot(user.subject),
   deliveryQaRegistration:Object.freeze({ready:Boolean(g5QaGateway?.isConfigured()),
    commercialEnabled:false}),
   deliveryTerminalRelease:publicTerminalRelease(),
   deliveryPriceConsent:publicDeliveryPriceConsent(),
   rideContinuation:rideContinuation(),
   rideHistoryRecovery:rideHistoryRecovery(),
   completedRideHistory:completedRideHistory(),
   tracking:tracking.snapshot(),
   quote:quote.current(),
   autoPrequote:publicAutoPrequote(),autoRouteQuote:autoRouteIntake.snapshot(),
   autoDispatch:autoDispatchSnapshot(),autoFinance:publicAutoFinance(),
   g95Cancellation:publicG95(),motoPassenger:motoFlow.snapshot(),
   motoRideStatus:publicMotoRideStatus(),
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
  let purged=!canSaveG95;
  if(canSaveG95){try{await g95RecoveryStore.clear();purged=true;}catch{}}
  let motoPurged=motoRecoveryStore===null;
  if(motoRecoveryStore&&typeof motoRecoveryStore.clear==='function'){
   try{await motoRecoveryStore.clear();motoPurged=true;}catch{}
  }
  const result=await session.logout();
  return purged&&motoPurged?result:Object.freeze({...result,
   ...(purged?{}:{g95SecurePurgeUnconfirmed:true}),
   ...(motoPurged?{}:{motoSecurePurgeUnconfirmed:true})});
 }
 return Object.freeze({
  subscribe(listener){
   if(typeof listener!=='function')return ()=>{};
   observers.add(listener);return ()=>observers.delete(listener);
  },
  refreshSession:async()=>{
   const previous=session.privacyRevision();
   const result=await session.refresh();
   if(result.ok===true&&session.privacyRevision()!==previous){
    // Bootstrapping solely at app mount misses later Passenger sign-in and
    // JWT rotation. Read persisted opaque keys at this Auth boundary.
    const scope=session.privacyRevision(),owner=result.subject;
    // Crash-safe unresolved G5 key restoration (no POST, address or JWT).
    if(deliveryRecovery.isConfigured()&&mutations.publicState().phase==='idle'){
     const restored=await deliveryRecovery.restore(owner);
     if(restored.ok===true&&restored.restored===true){
      const installed=mutations.restoreUnconfirmedDelivery({
       requestKey:restored.requestKey,subject:owner,sessionRevision:scope
      });
      if(!installed.ok)return fail('G5_RECOVERY_CONFLICT');
     }
    }
    if(motoRecoveryStore!==null&&motoFlow.snapshot().phase==='idle')
     await motoFlow.restore(); // GET only; any failure blocks the next POST.
    if(scope!==session.privacyRevision()||actor()?.subject!==owner){
     notify();return fail('STALE_SESSION_RESPONSE');
    }
   }
   notify();return result;
  },
  signOut:async()=>{const result=await signOut();notify();return result;},
  clear:()=>{session.clear();clearPrivate();notify();},
  requestMotoQuote:args=>motoFlow.requestQuote(args),
  acceptMotoQuote:args=>motoFlow.acceptQuote(args),
  bookMoto:args=>motoFlow.book(args),
  readMotoBooking:()=>motoFlow.readBooking(),
  cancelMoto:args=>motoFlow.cancel(args),
  readMotoCancellation:()=>motoFlow.readCancellation(),
  refreshMotoRideStatus,
  restoreMotoPassenger:()=>motoFlow.restore(),
  clearConfirmedMotoCancellation:()=>motoFlow.clearConfirmedCancellation(),
  // Quote discard is permitted before POST only; preserve any booked/unknown trip.
  resetMoto:()=>motoFlow.discardQuote(),
  discardMotoQuote:()=>motoFlow.discardQuote(),
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
  requestAutoQuote:async args=>{
   const user=actor(),mutation=mutations.publicState();
   if(!user)return fail('AUTH_REQUIRED');
   // Prequote cannot race an old request or ongoing verified tracking.
   if(mutation.phase!=='idle'||tracking.snapshot().subscriptionActive
    ||prequoteAuto.snapshot().phase!=='idle'||recoveredRide
    ||rideContinuation().canVerify)return fail('AUTO_QUOTE_CONFLICT');
   const request=autoRouteIntake.request({...args,
    ownerId:user.subject,sessionRevision:session.privacyRevision()});
   notify();
   const result=await request;notify();return result;
  },
  prepareAutoPrequote:args=>{const result=prequoteAuto.prepare(args);notify();return result;},
  loadAutoPrequote:async()=>{const p=prequoteAuto.load();notify();const r=await p;notify();return r;},
  loadAutoSubsidy:async()=>{
   if(!g93Required||autoG73Http?.isSubsidyConfigured()!==true)
    return fail('G93_SUBSIDY_NOT_CERTIFIED');
   const user=actor(),quote=prequoteAuto.snapshot().quote;
   if(!user||!quote||prequoteAuto.snapshot().phase!=='quoted'||subsidyBusy)
    return fail('G93_QUOTE_NOT_READY');
   const epoch=++subsidyEpoch,privacy=session.privacyRevision();
   subsidyReceipt=null;subsidyBusy=true;notify();
   try{
    const result=await autoG73Http.previewSubsidy({
     quoteId:quote.quoteId,originalAmountGs:quote.amountGs,
     quoteExpiresAt:quote.expiresAt,fareVersion:quote.fareVersion,
     ownerId:user.subject,sessionRevision:privacy
    });
    const latest=actor(),present=prequoteAuto.snapshot();
    if(epoch!==subsidyEpoch||!latest||latest.subject!==user.subject
     ||session.privacyRevision()!==privacy||present.phase!=='quoted'
     ||present.quote?.quoteId!==quote.quoteId
     ||present.quote?.fareVersion!==quote.fareVersion
     ||present.quote?.amountGs!==quote.amountGs)
     return fail('STALE_SESSION_RESPONSE');
    if(result?.ok!==true)return fail(result?.code??'G93_UNVERIFIED_RESPONSE');
    subsidyReceipt=Object.freeze({subject:user.subject,privacy,
     quoteId:quote.quoteId,data:result.data});
    return Object.freeze({ok:true,qaOnly:true,productionEnabled:false});
   }finally{if(epoch===subsidyEpoch){subsidyBusy=false;notify();}}
  },
  acceptAutoPrequote:args=>{
   if(g93Required){
    const receipt=verifiedAutoSubsidy();
    if(!receipt||receipt.campaignId!==args?.campaignId
     ||receipt.customerPaysGs!==args?.customerPaysGs)
     return fail('G93_SUBSIDY_PREVIEW_REQUIRED');
   }
   const result=prequoteAuto.accept(args);notify();return result;
  },
  reserveQuotedAuto:async args=>{
   if(g93Required&&!verifiedAutoSubsidy())
    return fail('G93_SUBSIDY_PREVIEW_REQUIRED');
   const p=prequoteAuto.reserve(args);notify();const result=await p;
   if(result.ok===true)anchorAutoFinancialReceipt();
   notify();return result;
  },
  reconcileQuotedAuto:async()=>{
   const p=prequoteAuto.reconcile();notify();const result=await p;
   if(result.ok===true)anchorAutoFinancialReceipt();
   notify();return result;
  },
  refreshAutoDispatch,refreshAutoFinancialStatus,
  prepareG95Cancel,abandonG95PreparedCancel,sendG95Cancel,reconcileG95Cancel,
  restoreG95Cancellation,
  verifyRecoveredG95RideStatus,verifyG95Cancellation,
  clearAutoPrequote:()=>{
   const result=prequoteAuto.discard();
   if(result.ok){subsidyEpoch++;subsidyReceipt=null;
    financialEpoch++;financialAnchor=null;financial={busy:false,data:null,error:null};}
   notify();return result;
  },
  prepareRide:body=>{const result=prepare('rideRequest',body);notify();return result;},
  discardPreparedMutation:args=>{const result=discardPreparedMutation(args);notify();return result;},
  prepareDelivery:body=>{
   const user=actor();
   if(deliveryRecovery.isConfigured()&&deliveryRecovery.snapshot(user?.subject).blocked)
    return fail('G5_RECOVERY_READBACK_REQUIRED');
   const result=prepare('deliveryRequest',body);notify();return result;
  },
  readUnconfirmedDeliveryRegistration,
  finalizeDeliveredDeliveryQa,
  quoteRecoveredDelivery,
  recoverOriginalDeliveryQuote,
  confirmRecoveredDeliveryQuote,
  prepareFare:body=>{const result=prepare('fareQuote',body);notify();return result;},
  prepareServerFare:args=>{const result=prepareServerFare(args);notify();return result;},
  submitServerFare:async()=>{const result=await fareFlow.submit();notify();return result;},
  retryServerFare:async()=>{const result=await fareFlow.retry();notify();return result;},
  prepareSimulatedPayment:body=>{const result=prepare('paymentAuthorize',body);notify();return result;},
  submit:async()=>{
   const requested=mutations.publicState(),user=actor();
   if(requested.phase==='ready'&&requested.operation==='deliveryRequest'){
    // Native runtime: secure durable key always mandatory before any G5 POST.
    // Existing isolated legacy gateway mocks without a native store retain
    // their own unit-test semantics; the shipped App injects SecureStore.
    if(!deliveryRecovery.isConfigured()){
     if(bookingGateway?.isConfigured()===true||g5QaGateway?.isConfigured()===true)
      return fail('G5_SECURE_STORE_REQUIRED');
    }else{
     if(bookingGateway?.isConfigured()!==true
      &&g5QaGateway?.isConfigured()!==true
      &&gateway?.isConfigured?.()!==true)
      return fail('G5_NOT_CERTIFIED');
     if(!user||typeof requested.requestKey!=='string')
      return fail('AUTH_REQUIRED');
    const revision=session.privacyRevision(),subject=user.subject,key=requested.requestKey;
    const saved=await deliveryRecovery.persist(subject,key);
    if(!saved.ok){notify();return saved;}
    const still=mutations.publicState(),after=actor();
    if(!after||after.subject!==subject||session.privacyRevision()!==revision
     ||still.phase!=='ready'||still.operation!=='deliveryRequest'
     ||still.requestKey!==key)return fail('STALE_SESSION_RESPONSE');
    }
   }
   const result=await mutations.submit();notify();return result;
  },
  retry:async()=>{const result=await mutations.retry();notify();return result;},
  reconcileBooking:async()=>{
   const pending=mutations.reconcileBooking();notify();
   const result=await pending;notify();return result;
  },
  startTracking:tripId=>{const result=startTracking(tripId);notify();return result;},
  continueVerifiedRide,
  resumeRideFromHistory,
  verifyCompletedRideHistory,
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

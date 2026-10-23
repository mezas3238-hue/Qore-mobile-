import {createClientSessionController} from './client-session.mjs';
import {createClientMutationController} from './client-mutations.mjs';
import {createQuoteViewStore} from './quote-view.mjs';
import {createClientHistoryStore} from './history-feed.mjs';
import {createClientHistoryGateway} from './client-history-gateway.mjs';
import {createRideCancellationGateway,createRideCancellationController} from './ride-cancellation.mjs';
import {createRiderPollingCoordinator} from './rider-polling.mjs';
import {createRiderStatusStore} from './rider-status.mjs';

/**
 * Composición sin estado persistente de la app Cliente. Une los contratos
 * internos B03/B04/B05/B06/B09 manteniendo fail-closed por defecto.
 *
 * Inyectar un gateway NO lo certifica ni despliega. Backend A conserva
 * autenticación real, autorización, revisión, precios y acceso a terceros.
 */
const fail=code=>({ok:false,code});
export function createClientExperience({authProvider=null,gateway=null,historyGatewayOptions=null,cancelGatewayOptions=null,now=()=>Date.now()}={}){
 const quote=createQuoteViewStore({now});
 const history=createClientHistoryStore({now});
 const riderStore=createRiderStatusStore({now});
 let mutations,tracking,cancellation;
 let historyLoading=false,historyLoadError=null;
 const seenCursors=new Set();
 const observers=new Set();
 const notify=()=>{for(const fn of observers){try{fn();}catch{/* listener UI aislado */}}};
 const clearPrivate=()=>{
  if(mutations)mutations.clear();
  if(tracking)tracking.stop();
  if(cancellation)cancellation.clear();
  quote.clear();
  history.clear();
  historyLoading=false;historyLoadError=null;seenCursors.clear();
 };
 const session=createClientSessionController({provider:authProvider,clearPrivateState:clearPrivate,now});
 const actor=()=>session.publicSession();
 const cancelGateway=cancelGatewayOptions?createRideCancellationGateway({
  ...cancelGatewayOptions,now,
  getSession:()=>{
   const privateSession=session.getSessionForGateway();
   const visible=actor();
   return privateSession&&visible?{...privateSession,subject:visible.subject,
    authRevision:session.revision()}:null;
  },
  onSessionInvalid:()=>{session.clear();notify();}
 }):null;
 cancellation=createRideCancellationController({
  gateway:cancelGateway,getSession:async()=>actor()
 });

 const historyGateway=historyGatewayOptions?createClientHistoryGateway({
  ...historyGatewayOptions,now,
  getSession:()=>{
   const privateSession=session.getSessionForGateway();
   const visible=actor();
   return privateSession&&visible?{...privateSession,subject:visible.subject,
    authRevision:session.revision()}:null;
  },
  onSessionInvalid:()=>{session.clear();notify();}
 }):null;

 mutations=createClientMutationController({gateway,getSession:async()=>actor()});
 tracking=createRiderPollingCoordinator({
  gateway,getSession:async()=>actor(),store:riderStore,now
 });
 function prepare(operation,body){
  const user=actor();
  if(!user)return fail('AUTH_REQUIRED');
  return mutations.prepare({operation,body,subject:user.subject});
 }
 function startTracking(tripId){
  const user=actor();
  if(!user)return fail('AUTH_REQUIRED');
  const oldTrip=tracking.snapshot().tripId;
  const result=tracking.begin(tripId,user.subject);
  if(result.ok&&oldTrip!==tripId)cancellation.clear();
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
  return cancellation.prepare({tripId,requestKey,subject:user.subject});
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
    tracking:tracking.snapshot(),quote:null,history:null,
    historyLoading:false,historyLoadError:null,historyConfigured:Boolean(historyGateway?.isConfigured()),
    cancellation:cancellation.snapshot()});
  }
  return Object.freeze({
   authenticated:true,
   account:Object.freeze({subject:user.subject,role:'passenger'}),
   mutation:mutations.publicState(),
   tracking:tracking.snapshot(),
   quote:quote.current(),
   history:history.current(user.subject),
   historyLoading,historyLoadError,
   historyConfigured:Boolean(historyGateway?.isConfigured()),
   cancellation:cancellation.snapshot()
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
  prepareRide:body=>{const result=prepare('rideRequest',body);notify();return result;},
  prepareDelivery:body=>{const result=prepare('deliveryRequest',body);notify();return result;},
  prepareFare:body=>{const result=prepare('fareQuote',body);notify();return result;},
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

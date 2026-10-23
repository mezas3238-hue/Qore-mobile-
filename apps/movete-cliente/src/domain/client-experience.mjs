import {createClientSessionController} from './client-session.mjs';
import {createClientMutationController} from './client-mutations.mjs';
import {createQuoteViewStore} from './quote-view.mjs';
import {createClientHistoryStore} from './history-feed.mjs';
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
export function createClientExperience({authProvider=null,gateway=null,now=()=>Date.now()}={}){
 const quote=createQuoteViewStore({now});
 const history=createClientHistoryStore({now});
 const riderStore=createRiderStatusStore({now});
 let mutations,tracking;
 const clearPrivate=()=>{
  if(mutations)mutations.clear();
  if(tracking)tracking.stop();
  quote.clear();
  history.clear();
 };
 const session=createClientSessionController({provider:authProvider,clearPrivateState:clearPrivate,now});
 const actor=()=>session.publicSession();
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
  return tracking.begin(tripId,user.subject);
 }
 async function syncTracking(){
  if(!actor()){clearPrivate();return fail('AUTH_REQUIRED');}
  return tracking.tick();
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
 function snapshot(){
  const user=actor();
  if(!user){
   clearPrivate();
   return Object.freeze({authenticated:false,account:null,mutation:mutations.publicState(),
    tracking:tracking.snapshot(),quote:null,history:null});
  }
  return Object.freeze({
   authenticated:true,
   account:Object.freeze({subject:user.subject,role:'passenger'}),
   mutation:mutations.publicState(),
   tracking:tracking.snapshot(),
   quote:quote.current(),
   history:history.current(user.subject)
  });
 }
 async function signOut(){
  clearPrivate();
  return session.logout();
 }
 return Object.freeze({
  refreshSession:session.refresh,
  signOut,
  clear:()=>{session.clear();clearPrivate();},
  prepareRide:body=>prepare('rideRequest',body),
  prepareDelivery:body=>prepare('deliveryRequest',body),
  prepareFare:body=>prepare('fareQuote',body),
  prepareSimulatedPayment:body=>prepare('paymentAuthorize',body),
  submit:mutations.submit,
  retry:mutations.retry,
  startTracking,
  syncTracking,
  connectionLost:tracking.connectionLost,
  acceptQuote,
  acceptHistory,
  snapshot
 });
}

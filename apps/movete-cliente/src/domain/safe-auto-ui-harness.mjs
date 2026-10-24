import {validateRideDraft} from './capabilities.mjs';
import {prepareLocalRideRequest} from './client-request-preparation.mjs';

/**
 * Harness headless de la UI AUTO para QA sintética. Recorre las mismas
 * fronteras públicas que la pantalla: revisar, preparar y descartar.
 * No añade endpoint, no simula precio y no puede iniciar dispatch.
 */
const fail=(code)=>Object.freeze({ok:false,code});
export function createSafeAutoUiHarness({client,requestKeyFactory}={}){
 if(!client||typeof client.snapshot!=='function')throw Error('CLIENT_REQUIRED');
 let pickup='',destination='',service='economico',reviewed=false,feedback='';
 let privateRevision=client.snapshot().privateViewRevision;
 function resetForm(){
  pickup='';destination='';service='economico';reviewed=false;feedback='';
 }
 function syncPrivacy(){
  const next=client.snapshot().privateViewRevision;
  if(next!==privateRevision){privateRevision=next;resetForm();}
 }
 function editable(){
  const mutation=client.snapshot().mutation;
  return mutation.phase==='idle';
 }
 function setRoute(origin,target){
  syncPrivacy();
  if(!editable())return fail('FORM_LOCKED');
  pickup=typeof origin==='string'?origin:'';
  destination=typeof target==='string'?target:'';
  reviewed=false;feedback='';return Object.freeze({ok:true});
 }
 function setService(value){
  syncPrivacy();
  if(!editable())return fail('FORM_LOCKED');
  if(!['economico','confort','xl'].includes(value))return fail('INVALID_SERVICE');
  service=value;reviewed=false;feedback='';return Object.freeze({ok:true});
 }
 function review(){
  syncPrivacy();
  if(!editable())return fail('FORM_LOCKED');
  const checked=validateRideDraft({pickup,destination,vehicleKind:'AUTO'});
  reviewed=checked.ok===true;
  feedback=reviewed?'LOCAL_REVIEW_ONLY':checked.reason;
  return reviewed?Object.freeze({ok:true}):fail('INVALID_ROUTE');
 }
 function prepare(){
  syncPrivacy();
  const view=client.snapshot();
  if(!view.authenticated)return fail('AUTH_REQUIRED');
  if(!reviewed)return fail('REVIEW_REQUIRED');
  if(!editable())return fail('FORM_LOCKED');
  const request=prepareLocalRideRequest({pickup,destination,service},requestKeyFactory);
  if(!request.ok)return fail('INVALID_REQUEST');
  const stored=client.prepareRide(request.body);
  if(!stored.ok)return stored;
  feedback='PREPARED_NOT_SENT';
  return Object.freeze({ok:true});
 }
 function discard(){
  syncPrivacy();
  const mutation=client.snapshot().mutation;
  if(mutation.phase!=='ready'||mutation.operation!=='rideRequest'||!mutation.requestKey)
   return fail('NO_UNSENT_RIDE_DRAFT');
  const result=client.discardPreparedMutation({operation:'rideRequest',
   requestKey:mutation.requestKey});
  if(result.ok){reviewed=false;feedback='DISCARDED_BEFORE_SEND';}
  return result;
 }
 function continueToQuoteAndDriver(){
  syncPrivacy();
  return fail('PREQUOTE_AND_DISPATCH_CONTRACT_PENDING');
 }
 function surface(){
  syncPrivacy();
  const view=client.snapshot(),mutation=view.mutation;
  const prepared=mutation.phase==='ready'&&mutation.operation==='rideRequest';
  const locked=mutation.phase!=='idle'&&!prepared;
  return Object.freeze({
   stage:prepared?'PREPARED_NOT_SENT':locked?'SERVER_RESULT_PENDING':reviewed?'REVIEWED_LOCAL':'EDITING',
   authenticated:view.authenticated,
   canEdit:mutation.phase==='idle',canPrepare:view.authenticated&&reviewed&&mutation.phase==='idle',
   canDiscard:prepared,canQuote:false,canSearchDriver:false,
   serverRequestSent:false,serverQuote:null,assignedDriver:null,gps:null,
   route:pickup&&destination?Object.freeze({pickup,destination,service}):null,
   feedback
  });
 }
 return Object.freeze({setRoute,setService,review,prepare,discard,
  continueToQuoteAndDriver,surface});
}


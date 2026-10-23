import {validateDeliveryForm} from './delivery-form.mjs';
import {prepareLocalDeliveryRequest} from './client-request-preparation.mjs';

/** Harness headless QA para la UI de envíos. No persiste destinatarios,
 * no consulta red y nunca interpreta un borrador como reparto solicitado. */
const fail=code=>Object.freeze({ok:false,code});
const blank=()=>({pickup:'',destination:'',vehicleKind:'MOTO',category:'PARCEL',
 weight:'',length:'',width:'',height:'',restricted:false});
export function createSafeDeliveryUiHarness({client,requestKeyFactory}={}){
 if(!client||typeof client.snapshot!=='function')throw Error('CLIENT_REQUIRED');
 let form=blank(),reviewed=false,feedback='';
 let privateRevision=client.snapshot().privateViewRevision;
 function clearForm(){form=blank();reviewed=false;feedback='';}
 function syncPrivacy(){
  const next=client.snapshot().privateViewRevision;
  if(next!==privateRevision){privateRevision=next;clearForm();}
 }
 const idle=()=>client.snapshot().mutation.phase==='idle';
 function edit(patch){
  syncPrivacy();
  if(!idle())return fail('FORM_LOCKED');
  if(!patch||typeof patch!=='object'||Array.isArray(patch))return fail('INVALID_FORM');
  form={...form,...patch};reviewed=false;feedback='';return Object.freeze({ok:true});
 }
 function review(){
  syncPrivacy();
  if(!idle())return fail('FORM_LOCKED');
  const numeric=[form.weight,form.length,form.width,form.height];
  if(numeric.some(value=>typeof value!=='string'||!/^[0-9]{1,6}$/.test(value.trim()))){
   reviewed=false;feedback='INVALID_INTEGER_DIMENSIONS';return fail(feedback);
  }
  const checked=validateDeliveryForm({pickup:form.pickup,destination:form.destination,
   vehicleKind:form.vehicleKind,category:form.category,grams:Number(form.weight),
   lengthCm:Number(form.length),widthCm:Number(form.width),heightCm:Number(form.height),
   restrictedItemDeclared:form.restricted});
  reviewed=checked.ok===true;feedback=reviewed?'LOCAL_REVIEW_ONLY':checked.reason;
  return reviewed?Object.freeze({ok:true}):fail('INVALID_DELIVERY');
 }
 function prepare(){
  syncPrivacy();
  const view=client.snapshot();
  if(!view.authenticated)return fail('AUTH_REQUIRED');
  if(!reviewed)return fail('REVIEW_REQUIRED');
  if(!idle())return fail('FORM_LOCKED');
  const request=prepareLocalDeliveryRequest(form,requestKeyFactory);
  if(!request.ok)return fail('INVALID_REQUEST');
  const stored=client.prepareDelivery(request.body);
  if(!stored.ok)return stored;
  feedback='PREPARED_NOT_SENT';return Object.freeze({ok:true});
 }
 function discard(){
  syncPrivacy();
  const mutation=client.snapshot().mutation;
  if(mutation.phase!=='ready'||mutation.operation!=='deliveryRequest'||!mutation.requestKey)
   return fail('NO_UNSENT_DELIVERY_DRAFT');
  const result=client.discardPreparedMutation({operation:'deliveryRequest',
   requestKey:mutation.requestKey});
  if(result.ok){reviewed=false;feedback='DISCARDED_BEFORE_SEND';}
  return result;
 }
 function continueToServer({online=true}={}){
  syncPrivacy();
  return fail(online===false?'OFFLINE_NO_REQUEST_SENT':'DELIVERY_CONTRACT_PENDING');
 }
 function surface(){
  syncPrivacy();
  const view=client.snapshot(),mutation=view.mutation;
  const prepared=mutation.phase==='ready'&&mutation.operation==='deliveryRequest';
  const locked=mutation.phase!=='idle'&&!prepared;
  return Object.freeze({
   stage:prepared?'PREPARED_NOT_SENT':locked?'SERVER_RESULT_PENDING':reviewed?'REVIEWED_LOCAL':'EDITING',
   authenticated:view.authenticated,canEdit:mutation.phase==='idle',
   canPrepare:view.authenticated&&reviewed&&mutation.phase==='idle',canDiscard:prepared,
   canRequestCourier:false,serverRequestSent:false,deliveryId:null,courier:null,gps:null,
   // La superficie de QA no modela nombre/teléfono del destinatario y por
   // diseño no puede exponerlos ni persistirlos.
   recipient:null,
   route:form.pickup&&form.destination?Object.freeze({pickup:form.pickup,
    destination:form.destination,vehicleKind:form.vehicleKind,category:form.category}):null,
   feedback
  });
 }
 return Object.freeze({edit,review,prepare,discard,continueToServer,surface});
}


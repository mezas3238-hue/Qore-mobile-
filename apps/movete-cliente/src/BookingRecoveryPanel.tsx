import React,{useRef,useState} from 'react';
import * as Crypto from 'expo-crypto';
import {Text} from 'react-native';
import {Action,Panel,styles} from './ClientUI';
import type {ClientExperience,ClientSnapshot} from './domain/client-experience.mjs';
import {projectBookingRecoveryUi} from './domain/booking-recovery-ui.mjs';

type Operation='rideRequest'|'deliveryRequest';
export function BookingRecoveryPanel({client,view,operation}:{
 client:ClientExperience;view:ClientSnapshot;operation:Operation
}){
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const lock=useRef(false);
 const presented=projectBookingRecoveryUi(view,view,{operation});
 const current=client.snapshot();
 const canReadG121=operation==='deliveryRequest'&&presented.ok
  &&['failed','acknowledged'].includes(presented.phase)
  &&view.deliveryRegistration?.readReady===true
  &&current.deliveryRegistration?.readReady===true
  &&view.account?.subject===current.account?.subject
  &&view.privateViewRevision===current.privateViewRevision
  &&view.mutation.requestKey===current.mutation.requestKey;
 if(!presented.ok||!presented.visible)return null;
 async function consult(){
  if(lock.current)return;
  // Reread right at the touch. A stale screen cannot inspect another
  // account, operation, requestKey, phase or JWT revision.
  const checked=projectBookingRecoveryUi(view,client.snapshot(),{operation});
  if(!checked.ok||!checked.canRead||checked.phase!=='failed'){
   setMessage('La sesión o solicitud cambió. Actualizá la pantalla antes de consultar.');
   return;
  }
  lock.current=true;setBusy(true);setMessage('');
  try{
   const result=await client.reconcileBooking();
   const latest=client.snapshot();
   if(!latest.authenticated||latest.account?.subject!==view.account?.subject
    ||latest.privateViewRevision!==view.privateViewRevision
    ||latest.mutation.operation!==operation
    ||latest.mutation.requestKey!==view.mutation.requestKey)
    return;
   setMessage(result.ok
    ?'El servidor confirmó un registro de QA. No hay viaje comercial, conductor ni cobro confirmado.'
    :'El resultado sigue sin confirmarse. No vuelvas a solicitar el servicio; la consulta no envió otra solicitud.');
  }catch{
   setMessage('No se pudo consultar el resultado. No se envió otra solicitud.');
  }finally{lock.current=false;setBusy(false);}
 }
 async function consultG121(){
  if(lock.current||!canReadG121)return;
  const latest=client.snapshot();
  if(latest.account?.subject!==view.account?.subject
   ||latest.privateViewRevision!==view.privateViewRevision
   ||latest.mutation.requestKey!==view.mutation.requestKey
   ||!['failed','acknowledged'].includes(latest.mutation.phase))return;
  lock.current=true;setBusy(true);setMessage('');
  try{
   const answer=await client.readUnconfirmedDeliveryRegistration();
   const after=client.snapshot();
   if(after.account?.subject!==view.account?.subject
    ||after.privateViewRevision!==view.privateViewRevision
    ||after.mutation.requestKey!==view.mutation.requestKey)return;
   setMessage(answer.ok
    ?'Solicitud de envío registrada en QA, sin precio, consentimiento, repartidor ni cobro.'
    :'No fue posible confirmar el registro. No volvimos a enviar tu solicitud.');
  }catch{setMessage('No fue posible consultar el servidor. No se envió otra solicitud.');}
  finally{lock.current=false;setBusy(false);}
 }
 async function quoteRegisteredDelivery(){
  if(lock.current||operation!=='deliveryRequest')return;
  const latest=client.snapshot(),reg=latest.deliveryRegistration;
  if(!latest.authenticated||latest.account?.subject!==view.account?.subject
   ||latest.privateViewRevision!==view.privateViewRevision
   ||!['failed','acknowledged'].includes(latest.mutation.phase)
   ||latest.mutation.operation!=='deliveryRequest'
   ||latest.mutation.requestKey!==view.mutation.requestKey
   ||reg.deliveryId!==view.deliveryRegistration.deliveryId
   ||!latest.deliveryPriceConsent.canQuote)return;
  lock.current=true;setBusy(true);setMessage('');
  try{
   const answer=await client.quoteRecoveredDelivery(Crypto.randomUUID());
   const after=client.snapshot();
   if(after.privateViewRevision!==view.privateViewRevision
    ||after.account?.subject!==view.account?.subject
    ||after.mutation.requestKey!==view.mutation.requestKey)return;
   setMessage(answer.ok
    ?'Tarifa de prueba consultada al servidor. Revisá el monto antes de confirmar.'
    :'No se pudo certificar la tarifa. No solicites otra cotización automáticamente.');
  }catch{setMessage('No fue posible confirmar la tarifa del servidor.');}
  finally{lock.current=false;setBusy(false);}
 }
 async function recoverG126OriginalDeliveryQuote(){
  if(lock.current||operation!=='deliveryRequest')return;
  const current=client.snapshot(),reg=current.deliveryRegistration,
   price=current.deliveryPriceConsent;
  if(!current.authenticated||current.account?.subject!==view.account?.subject
   ||current.privateViewRevision!==view.privateViewRevision
   ||!['failed','acknowledged'].includes(current.mutation.phase)
   ||current.mutation.operation!=='deliveryRequest'
   ||current.mutation.requestKey!==view.mutation.requestKey
   ||reg.deliveryId!==view.deliveryRegistration.deliveryId
   ||price.deliveryId!==reg.deliveryId
   ||price.vehicleKind!==reg.vehicleKind||!price.canRecoverQuote)return;
  lock.current=true;setBusy(true);setMessage('');
  try{
   const answer=await client.recoverOriginalDeliveryQuote();
   const after=client.snapshot();
   if(after.privateViewRevision!==view.privateViewRevision
    ||after.account?.subject!==view.account?.subject
    ||after.mutation.requestKey!==view.mutation.requestKey)return;
   setMessage(answer.ok
    ?'El servidor verificó la cotización original usando la misma clave. Revisá el precio antes de aceptar.'
    :'La cotización original sigue sin confirmarse. No se intentará crear otra tarifa.');
  }catch{setMessage('No se pudo recuperar la cotización original; se mantiene bloqueada.');}
  finally{lock.current=false;setBusy(false);}
 }
 async function acceptRegisteredDeliveryQuote(){
  if(lock.current||operation!=='deliveryRequest')return;
  const latest=client.snapshot(),price=latest.deliveryPriceConsent;
  if(!latest.authenticated||latest.account?.subject!==view.account?.subject
   ||latest.privateViewRevision!==view.privateViewRevision
   ||latest.mutation.requestKey!==view.mutation.requestKey
   ||!['failed','acknowledged'].includes(latest.mutation.phase)
   ||!price.canConfirm||!price.quote
   ||price.deliveryId!==view.deliveryRegistration.deliveryId
   ||price.quote.quoteId!==view.deliveryPriceConsent.quote?.quoteId
   ||price.quote.amountGs!==view.deliveryPriceConsent.quote.amountGs
   ||price.quote.fareVersion!==view.deliveryPriceConsent.quote.fareVersion)return;
  lock.current=true;setBusy(true);setMessage('');
  try{
   const answer=await client.confirmRecoveredDeliveryQuote({
    confirmationKey:Crypto.randomUUID(),
    acceptedTotalGs:price.quote.amountGs,
    acceptedFareVersion:price.quote.fareVersion
   });
   const after=client.snapshot();
   if(after.privateViewRevision!==view.privateViewRevision
    ||after.account?.subject!==view.account?.subject
    ||after.mutation.requestKey!==view.mutation.requestKey)return;
   setMessage(answer.ok
    ?'Se guardó tu aceptación de tarifa en QA. Sin cobro ni repartidor asignado.'
    :'No se puede confirmar tu aceptación. No la reenviaremos automáticamente.');
  }catch{setMessage('Aceptación de prueba incierta. No se enviará otra vez.');}
  finally{lock.current=false;setBusy(false);}
 }
 return <Panel>
  <Text accessibilityRole="header" style={styles.heading}>Estado de la solicitud anterior</Text>
  <Text accessibilityLiveRegion="polite" style={styles.text}>
   {presented.message}
  </Text>
  {canReadG121&&
   <Action label="Consultar registro de mi envío sin reenviar" busy={busy}
    disabled={busy} hint="Consulta G121, sin otro POST, cotización ni despacho."
    onPress={()=>{void consultG121();}}/>}
  {operation==='deliveryRequest'
   &&view.deliveryRegistration?.requestKey===view.mutation.requestKey
   &&view.deliveryRegistration?.deliveryId&&
   <Text accessibilityLiveRegion="polite" style={styles.small}>
    Registro verificado: {view.deliveryRegistration.vehicleKind==='MOTO'?'MOTO':'AUTO'}.
    Referencia {view.deliveryRegistration.deliveryId.slice(-8).toUpperCase()}.
    Precio y repartidor todavía no confirmados.
   </Text>}
  {operation==='deliveryRequest'
   &&view.deliveryRegistration?.deliveryId
   &&view.deliveryPriceConsent?.contractReady
   &&view.deliveryPriceConsent?.canQuote
   &&<Action label="Consultar tarifa certificada del envío (QA)"
     hint="Envía una sola petición de tarifa G7, no contrata ni despacha."
     busy={busy} disabled={busy} onPress={()=>{void quoteRegisteredDelivery();}}/>}
  {operation==='deliveryRequest'
   &&view.deliveryPriceConsent?.canRecoverQuote
   &&view.deliveryPriceConsent.deliveryId===view.deliveryRegistration?.deliveryId
   &&<Action label="Recuperar cotización original sin otra tarifa (QA)"
    hint="Una única consulta G126 usando la misma clave de G7, sin despacho ni cobro."
    disabled={busy} busy={busy}
    onPress={()=>{void recoverG126OriginalDeliveryQuote();}}/>}
  {operation==='deliveryRequest'&&view.deliveryPriceConsent?.quote
   &&view.deliveryPriceConsent.deliveryId===view.deliveryRegistration?.deliveryId
   &&<Text accessibilityLiveRegion="polite" style={styles.text}>
     Cotización QA: {view.deliveryPriceConsent.quote.amountGs.toLocaleString('es-PY')} Gs.
     Tarifa servidor versión {view.deliveryPriceConsent.quote.fareVersion}.
     No hay cargo a tu cuenta.
   </Text>}
  {operation==='deliveryRequest'&&view.deliveryPriceConsent?.canConfirm
   &&view.deliveryPriceConsent.quote
   &&view.deliveryPriceConsent.deliveryId===view.deliveryRegistration?.deliveryId
   &&<Action label="Acepto expresamente esta tarifa QA (sin pago)"
     hint="Graba una sola confirmación G122. No despacha repartidor ni cobra."
     busy={busy} disabled={busy}
     onPress={()=>{void acceptRegisteredDeliveryQuote();}}/>}
  {operation==='deliveryRequest'&&view.deliveryPriceConsent?.phase==='confirmed_qa'
   &&<Text accessibilityLiveRegion="polite" style={styles.small}>
     Aceptación de tarifa verificada en QA. No implica conductor asignado,
     recogida, servicio comercial ni autorización de pago.
   </Text>}
  {operation==='deliveryRequest'&&view.deliveryPriceConsent?.unknown
   &&<Text accessibilityRole="alert" style={styles.small}>
     El resultado de tarifa o confirmación es incierto. No se volverá
     a enviar la operación; se requiere conciliación certificada.
   </Text>}
  {presented.canRead&&presented.phase==='failed'&&
   <Action label={presented.actionLabel}
    hint="Consulta el resultado con la misma clave; nunca vuelve a enviar la solicitud."
    busy={busy} disabled={busy} onPress={()=>{void consult();}}/>}
  {message!==''&&<Text accessibilityLiveRegion="polite" style={styles.small}>{message}</Text>}
  <Text style={styles.small}>No hay reserva comercial, cobro ni conductor garantizados.
   Si la consulta no está certificada, la solicitud permanece bloqueada para evitar duplicados.</Text>
 </Panel>;
}

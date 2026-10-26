import React,{useRef,useState} from 'react';
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
  &&presented.phase==='failed'&&view.deliveryRegistration?.readReady===true
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
   ||latest.mutation.phase!=='failed')return;
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
  {presented.canRead&&presented.phase==='failed'&&
   <Action label={presented.actionLabel}
    hint="Consulta el resultado con la misma clave; nunca vuelve a enviar la solicitud."
    busy={busy} disabled={busy} onPress={()=>{void consult();}}/>}
  {message!==''&&<Text accessibilityLiveRegion="polite" style={styles.small}>{message}</Text>}
  <Text style={styles.small}>No hay reserva comercial, cobro ni conductor garantizados.
   Si la consulta no está certificada, la solicitud permanece bloqueada para evitar duplicados.</Text>
 </Panel>;
}

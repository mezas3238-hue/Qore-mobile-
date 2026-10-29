/** MOTO_RIDE Passenger: independent, local-only route review until A certifies API. */
import React,{useCallback,useRef,useState} from 'react';
import * as Crypto from 'expo-crypto';
import {AppState,ScrollView,Text,TextInput,View} from 'react-native';
import {useFocusEffect} from 'expo-router';
import {Action,Panel,styles} from '../src/ClientUI';
import {useClientView,usePassengerRideIntent} from '../src/ClientRuntime';
import {reviewMotoRideDraft} from '../src/domain/moto-ride-draft.mjs';

export default function PassengerMoto(){
 const {client,view}=useClientView();
 // Remount on subject/JWT revision: never preserve a previous rider's route.
 return <PrivateMoto key={view.privateViewRevision} revision={view.privateViewRevision}
  authenticated={view.authenticated} client={client} moto={view.motoPassenger}
  rideStatus={view.motoRideStatus}/>;
}
type Client=ReturnType<typeof useClientView>['client'];
type MotoView=ReturnType<typeof useClientView>['view']['motoPassenger'];
type MotoStatusView=ReturnType<typeof useClientView>['view']['motoRideStatus'];
function PrivateMoto({authenticated,client,moto,rideStatus,revision}:{
 authenticated:boolean;client:Client;moto:MotoView;rideStatus:MotoStatusView;revision:number;
}){
 const rideIntent=usePassengerRideIntent();
 const [origin,setOrigin]=useState(()=>rideIntent.read(revision,'MOTO')?.origin??'');
 const [destination,setDestination]=useState(()=>rideIntent.read(revision,'MOTO')?.destination??'');
 const [safetyAcknowledged,setSafetyAcknowledged]=useState(false);
 const [reviewed,setReviewed]=useState<ReturnType<typeof reviewMotoRideDraft>|null>(null);
 const [feedback,setFeedback]=useState('');
 const [sending,setSending]=useState(false);
 const [confirmBook,setConfirmBook]=useState(false);
 const [confirmCancel,setConfirmCancel]=useState(false);
 // G166: reflect current booking/session without recreating timers on
 // every status update. No background GPS, no POST and no push assumptions.
 const pollActive=useRef(false);
 const pollingContext=useRef({authenticated,phase:moto.phase,
  bookingKey:moto.bookingKey,tripId:moto.tripId,
  readReady:rideStatus.readReady,sending,terminal:rideStatus.tripId===moto.tripId
   &&['completed','cancelled'].includes(rideStatus.state??'')});
 pollingContext.current={authenticated,phase:moto.phase,
  bookingKey:moto.bookingKey,tripId:moto.tripId,
  readReady:rideStatus.readReady,sending,terminal:rideStatus.tripId===moto.tripId
   &&['completed','cancelled'].includes(rideStatus.state??'')};
 useFocusEffect(useCallback(()=>{
  let focused=true;
  const refresh=async()=>{
   const scope=pollingContext.current;
   if(!focused||AppState.currentState!=='active'||pollActive.current||
    !scope.authenticated||scope.phase!=='booked'||!scope.readReady||
    !scope.bookingKey||!scope.tripId||scope.sending||scope.terminal)return;
   pollActive.current=true;
   try{await client.refreshMotoRideStatus({bookingKey:scope.bookingKey});}
   catch{/* G119 already hides unverified responses; do not invent state */}
   finally{pollActive.current=false;}
  };
  void refresh();
  const timer=setInterval(()=>{void refresh();},5000);
  const change=AppState.addEventListener('change',state=>{
   if(state==='active')void refresh();
  });
  return ()=>{focused=false;clearInterval(timer);change.remove();};
 },[client]));
 // A reviewed route must not diverge from a priced or possibly booked quote.
 const canEdit=moto.phase==='idle'&&!sending;
 const quoteExpired=Boolean(moto.quote&&['quoted','accepted'].includes(moto.phase)
  &&moto.quote.expiresAt<=Date.now());
 function discardQuote(){
  if(sending)return;
  const result=client.discardMotoQuote();
  if(result.ok){
   setReviewed(null);setConfirmBook(false);
   setFeedback('Cotización MOTO descartada sin crear una reserva. Podés cambiar la ruta o elegir AUTO.');
  }else setFeedback('No se puede borrar una reserva enviada o de resultado incierto. Recuperá su estado antes de continuar.');
 }
 async function quoteMoto(){
  if(!authenticated||!moto.contractReady||!reviewed?.ok||sending||!canEdit)return;
  setSending(true);setFeedback('');
  try{
   const result=await client.requestMotoQuote({
    origin:reviewed.origin,destination:reviewed.destination,
    quoteRequestKey:Crypto.randomUUID(),safetyAcknowledged:true
   });
   setFeedback(result.ok?'Cotización MOTO validada por el servidor QA.':
    'Sin cotización verificada del servidor MOTO. No se mostrará precio.');
  }finally{setSending(false);}
 }
 async function bookMoto(){
  if(!moto.contractReady||moto.phase!=='accepted'||sending)return;
  setConfirmBook(false);setSending(true);
  try{const result=await client.bookMoto({bookingKey:Crypto.randomUUID()});
   setFeedback(result.ok?'Reserva MOTO registrada en QA; sin conductor asignado.':
    'Respuesta de reserva incierta: solo se admite lectura privada, no otro POST.');
  }finally{setSending(false);}
 }
 async function refreshMotoTracking(){
  if(!authenticated||sending||!moto.bookingKey
   ||!moto.tripId||!rideStatus.readReady)return;
  setSending(true);
  try{
   const result=await client.refreshMotoRideStatus({bookingKey:moto.bookingKey});
   setFeedback(result.ok?'Estado MOTO confirmado por PostgreSQL en QA.':
    'Estado MOTO sin confirmar: no mostramos una asignación, GPS ni ETA.');
  }finally{setSending(false);}
 }
 async function cancelMoto(){
  if(!moto.contractReady||moto.phase!=='booked'||sending)return;
  setConfirmCancel(false);setSending(true);
  try{const result=await client.cancelMoto({cancellationKey:Crypto.randomUUID()});
   setFeedback(result.ok?'Cancelación MOTO registrada en QA. No es reembolso PSP.':
    'Cancelación incierta. Consultá el recibo, sin repetir POST.');
  }finally{setSending(false);}
 }
 async function readBack(){
  if(!moto.needsReadback||sending)return;
  setSending(true);
  try{
   const result=moto.phase==='restoreUnknown'?await client.restoreMotoPassenger()
    :moto.phase==='bookingUnknown'?await client.readMotoBooking()
    :await client.readMotoCancellation();
   setFeedback(result.ok?'El servidor confirmó el comprobante MOTO original.':
    'El servidor aún no confirmó la operación; no enviaremos otro POST.');
  }finally{setSending(false);}
 }
 function edit(setter:(value:string)=>void,value:string){
  if(!canEdit)return;
  setter(value);setReviewed(null);
 }
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}
  contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled"
  keyboardDismissMode="on-drag">
  <View style={styles.hero}>
   <Text accessibilityRole="header" style={styles.heroText}>MOTO · Viaje de pasajeros</Text>
   <Text style={styles.heroSub}>Transporte de personas en motocicleta, separado de MOTO ENVÍOS. Laboratorio privado con reserva persistida; ningún motociclista se asigna sin autorización legal.</Text>
  </View>
  <Panel>
   <Text accessibilityRole="header" style={styles.heading}>Origen y destino</Text>
   <TextInput style={styles.field} value={origin} maxLength={120} editable={canEdit}
    accessibilityLabel="Origen del viaje MOTO"
    placeholder="¿Dónde te buscamos?"
    onChangeText={value=>edit(setOrigin,value)}/>
   <TextInput style={styles.field} value={destination} maxLength={120} editable={canEdit}
    accessibilityLabel="Destino del viaje MOTO"
    placeholder="¿A dónde vas?"
    onChangeText={value=>edit(setDestination,value)}/>
   <Text style={styles.small}>Las direcciones se envían al backend exclusivamente si confirmás una cotización con proveedor habilitado. Sin esa autorización permanecen en el formulario. No se publica GPS.</Text>
  </Panel>
  <Panel>
   <Text accessibilityRole="header" style={styles.heading}>Seguridad del pasajero</Text>
   <Text style={styles.text}>El servicio requiere motociclista autorizado, documentación y seguro válidos, casco homologado y verificación de las condiciones legales de cada zona. No garantizamos cobertura ni disponibilidad.</Text>
   <Action label={safetyAcknowledged?'Requisitos de seguridad: leídos':'Leer y reconocer requisitos de seguridad'}
    selected={safetyAcknowledged} secondary={!safetyAcknowledged} disabled={!canEdit}
    onPress={()=>{setSafetyAcknowledged(!safetyAcknowledged);setReviewed(null);}}/>
   <Text style={styles.small}>Reconocer estas condiciones no sustituye la comprobación legal del servidor, KYC, permiso de pasajeros o seguro.</Text>
  </Panel>
  <Panel>
   <Text accessibilityRole="header" style={styles.heading}>Revisá tu ruta MOTO</Text>
   <Action label="Revisar ruta local (sin reservar)" disabled={!canEdit} onPress={()=>
    setReviewed(reviewMotoRideDraft({origin,destination,safetyAcknowledged}))}/>
   {reviewed&&<View accessibilityLiveRegion="polite">
    {reviewed.ok?<Text style={styles.text}>Origen: {reviewed.origin}\nDestino: {reviewed.destination}\nModalidad: MOTO pasajeros (MOTO_RIDE). Ruta revisada solo en este teléfono.</Text>:
     <Text style={styles.text}>{reviewed.reason}</Text>}
   </View>}
   {!authenticated&&<Text style={styles.small}>Para contratar el servicio cuando se habilite, se exigirá identidad de pasajero validada.</Text>}
   {!moto.contractReady?<Action label="Cotizar MOTO — pendiente de API certificada" disabled
    hint="G100 existe en PostgreSQL de QA, todavía sin HTTPS legal/ruteo/driver verificado"
    onPress={()=>{}}/>:
    <Action label={sending?'Consultando…':'Cotizar MOTO con servidor'} disabled={sending||!reviewed?.ok||moto.phase!=='idle'}
     busy={sending} onPress={()=>{void quoteMoto();}}/>}
   {moto.quote&&<View>
    {quoteExpired&&<Text accessibilityRole="alert" style={styles.small}>Esta cotización ya venció. Descartala y pedí una nueva antes de contratar.</Text>}
    <Text style={styles.text}>Tarifa original: {moto.quote.originalFareGs.toLocaleString('es-PY')} Gs.</Text>
    <Text style={styles.text}>Subsidio al cliente (10 %): {moto.quote.customerSubsidyGs.toLocaleString('es-PY')} Gs.</Text>
    <Text style={styles.text}>Total para el cliente: {moto.quote.customerPaysGs.toLocaleString('es-PY')} Gs.</Text>
    <Text style={styles.small}>Comisión nominal {moto.quote.commissionBps/100} %; retención bruta {((moto.quote.commissionBps-1000)/100).toFixed(2)} %. Subsidio al pasajero fijo en 10 %. Tarifas provenientes del servidor QA.</Text>
    {moto.phase==='quoted'&&<Action label="Aceptar esta cotización MOTO" disabled={sending||quoteExpired}
     onPress={()=>{
      const result=client.acceptMotoQuote({quoteId:moto.quote!.quoteId,customerPaysGs:moto.quote!.customerPaysGs});
      setFeedback(result.ok?'Cotización aceptada; confirmá expresamente la reserva.':'La cotización cambió o venció.');
     }}/>}
    {moto.phase==='accepted'&&!confirmBook&&<Action label="Revisar reserva MOTO"
     disabled={sending||quoteExpired} onPress={()=>setConfirmBook(true)}/>}
    {moto.phase==='accepted'&&confirmBook&&<View>
     <Text style={styles.text}>¿Confirmás pedir MOTO por el total mostrado? Ningún conductor está asignado todavía.</Text>
     <Action label="Confirmar reserva MOTO QA" disabled={sending||quoteExpired} busy={sending}
      onPress={()=>{void bookMoto();}}/>
     <Action label="Volver sin reservar" secondary disabled={sending}
      onPress={()=>setConfirmBook(false)}/>
    </View>}
   </View>}
   {['quoted','accepted'].includes(moto.phase)&&<Action secondary
    label="Descartar cotización MOTO sin reservar" disabled={sending}
    onPress={discardQuote}/>}
   {moto.phase!=='idle'&&<Text style={styles.small}>La ruta y la aceptación de seguridad permanecen bloqueadas mientras exista una cotización o reserva. Descartá la cotización sin reservar para volver a editarlas.</Text>}
   {moto.phase==='booked'&&<View>
    <Text style={styles.text}>Reserva MOTO registrada en QA. La asignación y las transiciones dependen exclusivamente del servidor y sus permisos.</Text>
    {rideStatus.readReady&&moto.bookingKey&&
     <Action label={sending?'Consultando estado…':'Consultar estado MOTO en servidor'}
      disabled={sending||rideStatus.busy} busy={sending}
      onPress={()=>{void refreshMotoTracking();}}/>}
    {rideStatus.error&&<Text accessibilityRole="alert" style={styles.small}>No se pudo verificar el estado actualizado. Los datos anteriores se ocultan hasta recibir una revisión válida.</Text>}
    {rideStatus.tripId===moto.tripId&&rideStatus.state&&<View>
     <Text style={styles.text}>Estado certificado en PostgreSQL QA: {({
      searching:'Buscando motociclista autorizado',
      accepted:'Solicitud aceptada',arriving:'Motociclista en camino',
      in_progress:'En viaje',completed:'Viaje finalizado',
      cancelled:'Viaje cancelado'
     } as Record<string,string>)[rideStatus.state]??'Estado no reconocido'}</Text>
     <Text style={styles.small}>Revisión {rideStatus.revision??'—'} · Sin GPS ni ETA certificados ·
      No implica cobro ni liquidación real.</Text>
    </View>}
    {!confirmCancel?<Action label="Solicitar cancelación MOTO" secondary
     onPress={()=>setConfirmCancel(true)}/>:<View>
     <Text style={styles.text}>¿Confirmás cancelar esta reserva de MOTO?</Text>
     <Action label="Confirmar cancelación MOTO QA" disabled={sending} busy={sending}
      onPress={()=>{void cancelMoto();}}/>
     <Action label="Volver sin cancelar" secondary onPress={()=>setConfirmCancel(false)}/>
    </View>}
   </View>}
   {moto.needsReadback&&<Action label="Recuperar comprobante MOTO sin reenviar"
    disabled={sending} busy={sending} onPress={()=>{void readBack();}}/>}
   {moto.cancelled&&<View>
    <Text style={styles.text}>Viaje MOTO cancelado en QA, asiento revertido. No se efectuó reembolso bancario.</Text>
    <Action label="Cerrar comprobante MOTO cancelado y preparar otro viaje"
     secondary disabled={sending} onPress={()=>{void (async()=>{
      setSending(true);
      try{
       const result=await client.clearConfirmedMotoCancellation();
       if(result.ok){setReviewed(null);setConfirmBook(false);setConfirmCancel(false);}
       setFeedback(result.ok?'Cancelación cerrada en el teléfono; permanece el registro del servidor.':
        'No se pudo limpiar la clave segura. No se admite otra reserva.');
      }finally{setSending(false);}
     })();}}/>
   </View>}
   {feedback!==''&&<Text accessibilityRole="alert" style={styles.small}>{feedback}</Text>}
   <Text style={styles.small}>MOTO no está disponible comercialmente. G118/G119 certifican estados y lectura privada en PostgreSQL/HTTP de laboratorio; no existe asignación legal real, mapas, GPS, ETA, pagos ni despliegue aprobado.</Text>
  </Panel>
 </ScrollView>;
}

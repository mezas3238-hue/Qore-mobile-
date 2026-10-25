/** MOTO_RIDE Passenger: independent, local-only route review until A certifies API. */
import React,{useState} from 'react';
import * as Crypto from 'expo-crypto';
import {ScrollView,Text,TextInput,View} from 'react-native';
import {Action,Panel,styles} from '../src/ClientUI';
import {useClientView} from '../src/ClientRuntime';
import {reviewMotoRideDraft} from '../src/domain/moto-ride-draft.mjs';

export default function PassengerMoto(){
 const {client,view}=useClientView();
 // Remount on subject/JWT revision: never preserve a previous rider's route.
 return <PrivateMoto key={view.privateViewRevision} authenticated={view.authenticated}
  client={client} moto={view.motoPassenger}/>;
}
type Client=ReturnType<typeof useClientView>['client'];
type MotoView=ReturnType<typeof useClientView>['view']['motoPassenger'];
function PrivateMoto({authenticated,client,moto}:{
 authenticated:boolean;client:Client;moto:MotoView;
}){
 const [origin,setOrigin]=useState('');
 const [destination,setDestination]=useState('');
 const [safetyAcknowledged,setSafetyAcknowledged]=useState(false);
 const [reviewed,setReviewed]=useState<ReturnType<typeof reviewMotoRideDraft>|null>(null);
 const [feedback,setFeedback]=useState('');
 const [sending,setSending]=useState(false);
 const [confirmBook,setConfirmBook]=useState(false);
 const [confirmCancel,setConfirmCancel]=useState(false);
 async function quoteMoto(){
  if(!authenticated||!moto.contractReady||!reviewed?.ok||sending)return;
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
 async function cancelMoto(){
  if(!moto.contractReady||moto.phase!=='booked'||sending)return;
  setConfirmCancel(false);setSending(true);
  try{const result=await client.cancelMoto({cancellationKey:Crypto.randomUUID()});
   setFeedback(result.ok?'Cancelación MOTO registrada en QA. No es reembolso PSP.':
    'Cancelación incierta. Consultá el recibo, sin repetir POST.');
  }finally{setSending(false);}
 }
 async function readBack(){
  if(!moto.contractReady||!moto.needsReadback||sending)return;
  setSending(true);
  try{
   const result=moto.phase==='bookingUnknown'
    ?await client.readMotoBooking():await client.readMotoCancellation();
   setFeedback(result.ok?'El servidor confirmó el comprobante MOTO original.':
    'El servidor aún no confirmó la operación; no enviaremos otro POST.');
  }finally{setSending(false);}
 }
 function edit(setter:(value:string)=>void,value:string){
  setter(value);setReviewed(null);
 }
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}
  contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled"
  keyboardDismissMode="on-drag">
  <View style={styles.hero}>
   <Text accessibilityRole="header" style={styles.heroText}>MOTO · Viaje de pasajeros</Text>
   <Text style={styles.heroSub}>Transporte de personas en motocicleta, separado de MOTO ENVÍOS. Preparación privada; sin reserva ni búsqueda de motociclista todavía.</Text>
  </View>
  <Panel>
   <Text accessibilityRole="header" style={styles.heading}>Origen y destino</Text>
   <TextInput style={styles.field} value={origin} maxLength={120}
    accessibilityLabel="Origen del viaje MOTO"
    placeholder="¿Dónde te buscamos?"
    onChangeText={value=>edit(setOrigin,value)}/>
   <TextInput style={styles.field} value={destination} maxLength={120}
    accessibilityLabel="Destino del viaje MOTO"
    placeholder="¿A dónde vas?"
    onChangeText={value=>edit(setDestination,value)}/>
   <Text style={styles.small}>Las direcciones permanecen en este formulario y no se transmiten. El GPS y la ruta solo podrán venir de permisos y proveedor verificado.</Text>
  </Panel>
  <Panel>
   <Text accessibilityRole="header" style={styles.heading}>Seguridad del pasajero</Text>
   <Text style={styles.text}>El servicio requiere motociclista autorizado, documentación y seguro válidos, casco homologado y verificación de las condiciones legales de cada zona. No garantizamos cobertura ni disponibilidad.</Text>
   <Action label={safetyAcknowledged?'Requisitos de seguridad: leídos':'Leer y reconocer requisitos de seguridad'}
    selected={safetyAcknowledged} secondary={!safetyAcknowledged}
    onPress={()=>{setSafetyAcknowledged(!safetyAcknowledged);setReviewed(null);}}/>
   <Text style={styles.small}>Reconocer estas condiciones no sustituye la comprobación legal del servidor, KYC, permiso de pasajeros o seguro.</Text>
  </Panel>
  <Panel>
   <Text accessibilityRole="header" style={styles.heading}>Revisá tu ruta MOTO</Text>
   <Action label="Revisar ruta local (sin reservar)" onPress={()=>
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
    <Text style={styles.text}>Tarifa original: {moto.quote.originalFareGs.toLocaleString('es-PY')} Gs.</Text>
    <Text style={styles.text}>Subsidio al cliente (10 %): {moto.quote.customerSubsidyGs.toLocaleString('es-PY')} Gs.</Text>
    <Text style={styles.text}>Total para el cliente: {moto.quote.customerPaysGs.toLocaleString('es-PY')} Gs.</Text>
    <Text style={styles.small}>Comisión nominal 12 %, retención plataforma 2 %. Cifras recibidas y comprobadas contra el servidor en QA, no calculadas como cotización local.</Text>
    {moto.phase==='quoted'&&<Action label="Aceptar esta cotización MOTO" disabled={sending}
     onPress={()=>{
      const result=client.acceptMotoQuote({quoteId:moto.quote!.quoteId,customerPaysGs:moto.quote!.customerPaysGs});
      setFeedback(result.ok?'Cotización aceptada; confirmá expresamente la reserva.':'La cotización cambió o venció.');
     }}/>}
    {moto.phase==='accepted'&&!confirmBook&&<Action label="Revisar reserva MOTO"
     disabled={sending} onPress={()=>setConfirmBook(true)}/>}
    {moto.phase==='accepted'&&confirmBook&&<View>
     <Text style={styles.text}>¿Confirmás pedir MOTO por el total mostrado? Ningún conductor está asignado todavía.</Text>
     <Action label="Confirmar reserva MOTO QA" disabled={sending} busy={sending}
      onPress={()=>{void bookMoto();}}/>
     <Action label="Volver sin reservar" secondary disabled={sending}
      onPress={()=>setConfirmBook(false)}/>
    </View>}
   </View>}
   {moto.phase==='booked'&&<View>
    <Text style={styles.text}>Reserva MOTO registrada en QA. Sin asignación de conductor ni ETA certificada.</Text>
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
   {moto.cancelled&&<Text style={styles.text}>Viaje MOTO cancelado en QA, asiento revertido. No se efectuó reembolso bancario.</Text>}
   {feedback!==''&&<Text accessibilityRole="alert" style={styles.small}>{feedback}</Text>}
   <Text style={styles.small}>MOTO no está disponible comercialmente. G100 solo tiene contratos SQL de laboratorio; sin API HTTPS ni mapas, asignación, ETA, KYC del motorista o pagos reales.</Text>
  </Panel>
 </ScrollView>;
}

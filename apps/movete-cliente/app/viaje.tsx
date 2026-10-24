import React,{useRef,useState} from 'react';
import {ScrollView,Text,TextInput,View} from 'react-native';
import * as Crypto from 'expo-crypto';
import {router} from 'expo-router';
import {Action,Panel,palette,styles} from '../src/ClientUI';
import {BookingRecoveryPanel} from '../src/BookingRecoveryPanel';
import {useClientView} from '../src/ClientRuntime';
import type {ClientExperience,ClientSnapshot} from '../src/domain/client-experience.mjs';
import {validateRideDraft} from '../src/domain/capabilities.mjs';
import {prepareLocalRideRequest} from '../src/domain/client-request-preparation.mjs';
import {projectRideDraftUi} from '../src/domain/ride-draft-ui-policy.mjs';
import {projectAutoPrequoteScreen} from '../src/domain/f1-auto-prequote-screen-policy.mjs';
import {emptyLocalRouteDraft,editLocalRouteDraft,reviewLocalRouteDraft,
 canPrepareCurrentRideContract,MAX_LOCAL_STOPS} from '../src/domain/client-route-editor.mjs';
import type {LocalRouteEdit,LocalRouteDraft} from '../src/domain/client-route-editor.mjs';

type Service='economico'|'confort'|'xl';
const OPTIONS:{code:Service;title:string;description:string}[]=[
 {code:'economico',title:'Económico',description:'Preferencia por costo accesible'},
 {code:'confort',title:'Confort',description:'Preferencia por viaje cómodo'},
 {code:'xl',title:'XL',description:'Preferencia por vehículo de mayor capacidad'}
];

export default function RideRequest(){
 const {client,view}=useClientView();
 // El key fuerza remount antes de pintar un JWT distinto, incluso si subject
 // es idéntico; no hay un render transitorio de rutas de la sesión previa.
 return <PrivateRideForm key={view.privateViewRevision} client={client} view={view}/>;
}
function PrivateRideForm({client,view}:{client:ClientExperience;view:ClientSnapshot}){
 const [route,setRoute]=useState<LocalRouteDraft>(()=>emptyLocalRouteDraft());
 const pickup=route.origin,destination=route.destination;
 const [service,setService]=useState<Service>('economico');
 const [validated,setValidated]=useState(false);
 const [feedback,setFeedback]=useState('');
 const lock=useRef(false);
 const consultationLock=useRef(false);
 const [consulting,setConsulting]=useState(false);
 const [quoteBusy,setQuoteBusy]=useState(false);
 const quoteLock=useRef(false);
 const bookingKey=useRef<string|null>(null);
 const mutation=view.mutation;
 const quoted=projectAutoPrequoteScreen({
  prequote:view.autoPrequote,authenticated:view.authenticated,
  mutationPhase:mutation.phase,now:Date.now()
 });
 const ui=projectRideDraftUi({
  phase:mutation.phase,operation:mutation.operation,
  authenticated:view.authenticated,validated,
  stopsCount:route.stops.length,service
 });
 // Unknown phase, different outstanding operation or a sent request
 // must never leave the vehicle type or route editor unlocked.
 const free=ui.ok&&ui.editable&&quoted.canEditRoute;
 const myDraft=ui.ok&&ui.canDiscard;
 // Las direcciones son datos privados de la pantalla, ajenos al snapshot Auth.
 function changeRoute(change:LocalRouteEdit){
  if(!free||lock.current)return;
  const next=editLocalRouteDraft(route,change);
  if(!next.ok){setFeedback(next.reason);return;}
  setRoute(next.route);setValidated(false);setFeedback('');
 }
 function editPickup(value:string){changeRoute({type:'origin',value});}
 function editDestination(value:string){changeRoute({type:'destination',value});}
 function selectService(next:Service){
  if(!free||lock.current)return;
  setService(next);setValidated(false);setFeedback('');
 }
 function validate(){
  if(!free||lock.current)return;
  const local=reviewLocalRouteDraft(route);
  if(!local.ok){setValidated(false);setFeedback(local.reason);return;}
  const result=validateRideDraft({pickup,destination,vehicleKind:'AUTO'});
  setValidated(result.ok);
  if(!result.ok){setFeedback(result.reason);return;}
  setFeedback(route.stops.length>0
   ?'Ruta con paradas revisada como borrador local. No se puede solicitar ni cotizar hasta que el backend admita paradas.'
   :'Ruta revisada localmente. No hay conductor, zona ni tarifa confirmados.');
 }
 function prepare(){
  if(!ui.ok||!ui.canPrepare||lock.current)return;
  const compatibility=canPrepareCurrentRideContract(route);
  if(!compatibility.ok){
   setValidated(false);setFeedback(compatibility.reason);return;
  }
  lock.current=true;
  try{
   const result=prepareLocalRideRequest({pickup,destination,service},()=>Crypto.randomUUID());
   if(!result.ok){
    setValidated(false);setFeedback(result.reason);return;
   }
   const stored=client.prepareRide(result.body);
   setFeedback(stored.ok?
    'Solicitud guardada temporalmente en esta sesión. NO fue enviada, cotizada ni despachada.':
    'No se pudo preparar el viaje: hay otra solicitud pendiente o faltan permisos.');
  }finally{lock.current=false;}
 }
 async function consultVerifiedRide(){
  if(consultationLock.current||!view.rideContinuation.canVerify)return;
  const before=client.snapshot();
  if(!before.rideContinuation.canVerify||before.rideContinuation.tripId!==view.rideContinuation.tripId
   ||before.privateViewRevision!==view.privateViewRevision)return;
  consultationLock.current=true;setConsulting(true);
  try{
   const result=await client.continueVerifiedRide();
   const latest=client.snapshot();
   if(latest.privateViewRevision!==view.privateViewRevision
    ||latest.rideContinuation.tripId!==before.rideContinuation.tripId)return;
   if(result.ok&&latest.tracking.subscriptionActive
    &&latest.tracking.tripId===result.tripId){
    router.push('/seguimiento');
   }else setFeedback('No se pudo verificar el viaje desde el servidor. No hay seguimiento confirmado.');
  }finally{consultationLock.current=false;setConsulting(false);}
 }
 function acceptVerifiedFare(){
  if(quoteLock.current||!quoted.canAccept||!quoted.quote)return;
  const current=client.snapshot();
  if(current.privateViewRevision!==view.privateViewRevision)return;
  quoteLock.current=true;
  try{
   const fare=quoted.quote;
   const result=client.acceptAutoPrequote({
    quoteId:fare.quoteId,amountGs:fare.amountGs,fareVersion:fare.fareVersion
   });
   setFeedback(result.ok?
    'Tarifa aceptada para esta cotización QA. Todavía no hay conductor, viaje ni cobro.':
    'La cotización ya no puede aceptarse. Consultá nuevamente al servidor.');
  }finally{quoteLock.current=false;}
 }
 async function reserveVerifiedFare(){
  if(quoteLock.current||!quoted.canReserve)return;
  const before=client.snapshot();
  if(before.privateViewRevision!==view.privateViewRevision
   ||before.autoPrequote.phase!=='accepted'||before.mutation.phase!=='idle')return;
  quoteLock.current=true;setQuoteBusy(true);
  // A missing ACK must be recovered with this SAME key, not a second POST.
  const requestKey=bookingKey.current??Crypto.randomUUID();
  bookingKey.current=requestKey;
  try{
   const result=await client.reserveQuotedAuto({requestKey});
   if(client.snapshot().privateViewRevision!==view.privateViewRevision)return;
   setFeedback(result.ok?
    'Reserva registrada solo para QA. Falta verificar estado real con el servidor.':
    result.code==='BOOKING_RECONCILIATION_REQUIRED'?
     'El resultado de la reserva es incierto. No se reenviará: comprobá el estado con el servidor.':
     'No se pudo verificar la reserva. No se inició otro despacho.');
  }finally{quoteLock.current=false;setQuoteBusy(false);}
 }
 async function reconcileQuotedRide(){
  if(quoteLock.current||!quoted.canReconcile)return;
  if(client.snapshot().privateViewRevision!==view.privateViewRevision)return;
  quoteLock.current=true;setQuoteBusy(true);
  try{
   const result=await client.reconcileQuotedAuto();
   if(client.snapshot().privateViewRevision!==view.privateViewRevision)return;
   setFeedback(result.ok?
    'La reserva se encontró por lectura independiente QA. Verificá el viaje antes de seguir.':
    'La reserva sigue sin confirmación. No se hará otra solicitud automáticamente.');
  }finally{quoteLock.current=false;setQuoteBusy(false);}
 }
 function discardVerifiedFare(){
  if(quoteLock.current||!quoted.canDiscard)return;
  if(client.snapshot().privateViewRevision!==view.privateViewRevision)return;
  const result=client.clearAutoPrequote();
  if(result.ok){bookingKey.current=null;
   setValidated(false);setFeedback('Cotización descartada sin solicitar conductor.');
  }else setFeedback('No se puede descartar una reserva pendiente de conciliación.');
 }
 function discard(){
  if(!myDraft||!mutation.requestKey||lock.current)return;
  lock.current=true;
  try{
   const response=client.discardPreparedMutation({
    operation:'rideRequest',requestKey:mutation.requestKey
   });
   if(response.ok){setValidated(false);setFeedback('Borrador descartado antes del envío. Podés modificar la ruta.');}
   else setFeedback('No se puede borrar una solicitud cuyo resultado de servidor sea incierto.');
  }finally{lock.current=false;}
 }
 return <ScrollView style={styles.page} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic"
  keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
  <View style={styles.hero}><Text accessibilityRole="header" style={styles.heroText}>Pedí un automóvil</Text>
   <Text style={styles.heroSub}>Preparación de viaje con revisión de ruta. La cotización y búsqueda requieren autorización del servidor.</Text>
  </View>
  <Panel>
   <Text accessibilityRole="header" style={styles.heading}>Estado del borrador de viaje</Text>
   <Text accessibilityLiveRegion="polite" style={styles.small}>
    {ui.ok?ui.status:'No se puede verificar el estado de este borrador. Edición bloqueada.'}
   </Text>
   <Text style={styles.small}>Tu ruta es privada y temporal. Revisar o preparar no inicia búsqueda de conductor, cotización ni cobro.</Text>
  </Panel>
  <Panel>
   <Text accessibilityRole="header" style={styles.heading}>Paso 1 · Tu ruta</Text>
   <Text style={styles.text}>Origen</Text>
   <TextInput style={styles.field} value={pickup} onChangeText={editPickup}
    editable={free} maxLength={120} placeholder="Ej.: Centro de San Lorenzo"
    accessibilityLabel="Origen del viaje"/>
   <Text style={styles.text}>Destino</Text>
   <TextInput style={styles.field} value={destination} onChangeText={editDestination}
    editable={free} maxLength={120} placeholder="Ej.: Villa Morra, Asunción"
    accessibilityLabel="Destino del viaje"/>
   <Action label="Invertir origen y destino" secondary disabled={!free}
    onPress={()=>changeRoute({type:'swap'})}/>
   <Text accessibilityRole="header" style={styles.heading}>Paradas adicionales · borrador local</Text>
   {route.stops.map((stop,index)=><View key={index}>
    <Text style={styles.text}>Parada {index+1}</Text>
    <TextInput style={styles.field} value={stop} maxLength={120}
     editable={free} accessibilityLabel={'Dirección de parada '+(index+1)}
     placeholder="Dirección o lugar de parada"
     onChangeText={value=>changeRoute({type:'stop',index,value})}/>
    <View style={styles.row}>
     <Action label={'Subir parada '+(index+1)} secondary
      disabled={!free||index===0}
      onPress={()=>changeRoute({type:'move-stop',index,direction:-1})}/>
     <Action label={'Bajar parada '+(index+1)} secondary
      disabled={!free||index===route.stops.length-1}
      onPress={()=>changeRoute({type:'move-stop',index,direction:1})}/>
     <Action label={'Quitar parada '+(index+1)} secondary disabled={!free}
      onPress={()=>changeRoute({type:'remove-stop',index})}/>
    </View>
   </View>)}
   <Action label="Agregar parada al borrador" secondary
    disabled={!free||route.stops.length>=MAX_LOCAL_STOPS}
    onPress={()=>changeRoute({type:'add-stop'})}/>
   <Text style={styles.small}>Las paradas son privadas y temporales. Todavía no se pueden cotizar ni solicitar; no se envían en un viaje simple. No se comprueban en el mapa. La distancia, cobertura y disponibilidad requieren evidencia del backend.</Text>
  </Panel>
  <Panel>
   <Text accessibilityRole="header" style={styles.heading}>Paso 2 · Tipo de automóvil</Text>
   {OPTIONS.map(option=><View key={option.code}>
    <Action label={option.title} secondary={service!==option.code}
     selected={service===option.code}
     disabled={!free} onPress={()=>selectService(option.code)}/>
    <Text style={styles.small}>{option.description}. Disponibilidad y tarifa pendientes del servidor.</Text>
   </View>)}
   <Text style={styles.small}>No hay motos de pasajeros. Motocicletas solo para envíos habilitados.</Text>
  </Panel>
  <Panel>
   <Text accessibilityRole="header" style={styles.heading}>Paso 3 · Revisá antes de continuar</Text>
   <Action label="Revisar ruta y servicio" disabled={!free}
    hint="Revisión del borrador solamente. No solicita automóvil ni cotiza."
    onPress={validate}/>
   {validated&&<View>
    <Text style={styles.text}>Ruta: {[pickup,...route.stops,destination].map(s=>s.trim()).join(' → ')}</Text>
    <Text style={styles.text}>Servicio: {OPTIONS.find(o=>o.code===service)?.title}</Text>
    {route.stops.length>0&&<Text style={styles.small}>
     Esta ruta con paradas no puede convertirse en solicitud hasta la certificación del servidor.
    </Text>}
   </View>}
   {ui.ok&&ui.canPrepare&&
    <Action label="Preparar solicitud segura (sin enviarla)"
     hint="Guarda un borrador en esta sesión; no busca conductor ni envía la solicitud."
     onPress={prepare}/>}
   {!view.authenticated&&<Text style={styles.small}>
    Para guardar una solicitud necesitarás iniciar sesión como pasajero. La revisión local no crea ninguna reserva.
   </Text>}
   {myDraft&&<View>
    <Text style={styles.text}>Borrador preparado de este viaje: no enviado ni confirmado.</Text>
    <Action label="Descartar borrador sin enviar" secondary onPress={discard}/>
   </View>}
   {!free&&!myDraft&&<Text style={styles.small}>
    Hay otra operación preparada, recibida o sin conciliar. No se puede generar otra solicitud sin resolverla de forma segura.
   </Text>}
   {feedback!==''&&<Text accessibilityLiveRegion="polite"
    style={[styles.text,{color:palette.primary}]}>{feedback}</Text>}
  </Panel>
  <BookingRecoveryPanel client={client} view={view} operation="rideRequest"/>
  {view.rideContinuation.canVerify&&<Panel>
   <Text accessibilityRole="header" style={styles.heading}>Viaje registrado en STAGING</Text>
   <Text style={styles.small}>Hay un recibo de solicitud persistida en QA. Consultaremos el estado con el servidor antes de abrir seguimiento; todavía no confirma tarifa, conductor ni operación comercial.</Text>
   <Action label={consulting?'Verificando viaje…':'Verificar viaje y abrir seguimiento'}
    busy={consulting} disabled={consulting}
    hint="GET autoritativo del pasajero, sin nuevo despacho ni cobro."
    onPress={()=>{void consultVerifiedRide();}}/>
  </Panel>}
  <Panel>
   <Text accessibilityRole="header" style={styles.heading}>Paso 4 · Cotización y consentimiento</Text>
   {!view.autoPrequote.quoteAvailable&&<View>
    <Action label="Consultar tarifa oficial — pendiente de backend" disabled
     hint="Requiere resolución de ruta, precotización PYG y contrato certificado de A" onPress={()=>{}}/>
    <Text style={styles.small}>No hay tarifa vigente. El backend debe verificar ruta y cobertura y emitir un precio en Gs antes de solicitar un conductor. La revisión local no es una cotización.</Text>
   </View>}
   {quoted.quote&&<View>
    <Text style={styles.small}>Importe calculado por el servidor (QA, sin cobro)</Text>
    <Text accessibilityLiveRegion="polite" style={styles.heading}>{quoted.amountLabel}</Text>
    <Text style={styles.small}>Cotización vigente hasta {new Date(quoted.quote.expiresAt).toLocaleTimeString('es-PY')}. Aceptar el precio no envía todavía una reserva.</Text>
    {quoted.canAccept&&<Action label="Acepto esta tarifa en guaraníes"
     hint="Aceptación explícita de importe y versión exactos; sin despacho ni cobro"
     onPress={acceptVerifiedFare}/>}
   </View>}
   {quoted.phase==='accepted'&&<Action
    label={quoteBusy?'Registrando reserva QA…':'Confirmar reserva de automóvil — QA'}
    busy={quoteBusy} disabled={!quoted.canReserve}
    hint="Un solo POST de reserva ligado a esta tarifa, sin pago real"
    onPress={()=>{void reserveVerifiedFare();}}/>}
   {quoted.phase==='ambiguous'&&<View>
    <Text accessibilityLiveRegion="polite" style={styles.small}>Resultado de reserva pendiente de conciliación. La app no repetirá el POST ni cambiará la clave de solicitud.</Text>
    <Action label={quoteBusy?'Comprobando…':'Consultar reserva sin volver a solicitar'}
     busy={quoteBusy} disabled={!quoted.canReconcile}
     hint="Solo lectura privada en el servidor con la misma requestKey"
     onPress={()=>{void reconcileQuotedRide();}}/>
   </View>}
   {quoted.phase==='confirmed'&&<Text accessibilityLiveRegion="polite" style={styles.small}>
    Reserva confirmada en QA. Esto no demuestra conductor asignado, ruta GPS, pago ni viaje comercial. El seguimiento requiere otra consulta autenticada al servidor.
   </Text>}
   {quoted.canDiscard&&<Action label="Descartar cotización sin solicitar viaje"
    secondary disabled={quoteBusy} onPress={discardVerifiedFare}/>}
   {quoted.locked&&<Text style={styles.small}>
    Origen, destino y categoría permanecen bloqueados mientras esta cotización o reserva exista. Para cambiar la ruta, descartá la cotización antes de enviar; nunca se descartará un POST ambiguo.
   </Text>}
   <Text style={styles.small}>Sin contratos certificados de A, los controles permanecen deshabilitados. No se estima tarifa, GPS, disponibilidad ni cobro desde el teléfono.</Text>
  </Panel>
 </ScrollView>;
}

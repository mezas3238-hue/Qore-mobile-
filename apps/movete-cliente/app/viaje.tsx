import React,{useRef,useState} from 'react';
import {ScrollView,Text,TextInput,View} from 'react-native';
import * as Crypto from 'expo-crypto';
import {Action,Panel,palette,styles} from '../src/ClientUI';
import {useClientView} from '../src/ClientRuntime';
import type {ClientExperience,ClientSnapshot} from '../src/domain/client-experience.mjs';
import {validateRideDraft} from '../src/domain/capabilities.mjs';
import {prepareLocalRideRequest} from '../src/domain/client-request-preparation.mjs';

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
 const [pickup,setPickup]=useState('');
 const [destination,setDestination]=useState('');
 const [service,setService]=useState<Service>('economico');
 const [validated,setValidated]=useState(false);
 const [feedback,setFeedback]=useState('');
 const lock=useRef(false);
 const mutation=view.mutation;
 const myDraft=mutation.phase==='ready'&&mutation.operation==='rideRequest';
 const free=mutation.phase==='idle';
 // Las direcciones son datos privados de la pantalla, ajenos al snapshot Auth.
 function editPickup(value:string){
  if(myDraft)return;
  setPickup(value);setValidated(false);setFeedback('');
 }
 function editDestination(value:string){
  if(myDraft)return;
  setDestination(value);setValidated(false);setFeedback('');
 }
 function selectService(next:Service){
  if(myDraft)return;
  setService(next);setValidated(false);setFeedback('');
 }
 function validate(){
  if(!free||lock.current)return;
  const result=validateRideDraft({pickup,destination,vehicleKind:'AUTO'});
  setValidated(result.ok);
  setFeedback(result.ok?'Ruta revisada localmente. No hay conductor, zona ni tarifa confirmados.':result.reason);
 }
 function prepare(){
  if(!free||!validated||lock.current||!view.authenticated)return;
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
   <Text accessibilityRole="header" style={styles.heading}>Paso 1 · Tu ruta</Text>
   <Text style={styles.text}>Origen</Text>
   <TextInput style={styles.field} value={pickup} onChangeText={editPickup}
    editable={!myDraft} maxLength={120} placeholder="Ej.: Centro de San Lorenzo"
    accessibilityLabel="Origen del viaje"/>
   <Text style={styles.text}>Destino</Text>
   <TextInput style={styles.field} value={destination} onChangeText={editDestination}
    editable={!myDraft} maxLength={120} placeholder="Ej.: Villa Morra, Asunción"
    accessibilityLabel="Destino del viaje"/>
   <Text style={styles.small}>Estas direcciones aún no se geocodifican ni comprueban en el mapa; distancia, cobertura y disponibilidad requieren evidencia del backend.</Text>
  </Panel>
  <Panel>
   <Text accessibilityRole="header" style={styles.heading}>Paso 2 · Tipo de automóvil</Text>
   {OPTIONS.map(option=><View key={option.code}>
    <Action label={option.title} secondary={service!==option.code}
     selected={service===option.code}
     disabled={myDraft} onPress={()=>selectService(option.code)}/>
    <Text style={styles.small}>{option.description}. Disponibilidad y tarifa pendientes del servidor.</Text>
   </View>)}
   <Text style={styles.small}>No hay motos de pasajeros. Motocicletas solo para envíos habilitados.</Text>
  </Panel>
  <Panel>
   <Text accessibilityRole="header" style={styles.heading}>Paso 3 · Revisá antes de continuar</Text>
   <Action label="Revisar ruta y servicio" disabled={!free} onPress={validate}/>
   {validated&&<View>
    <Text style={styles.text}>Ruta: {pickup.trim()} → {destination.trim()}</Text>
    <Text style={styles.text}>Servicio: {OPTIONS.find(o=>o.code===service)?.title}</Text>
   </View>}
   {view.authenticated&&free&&validated&&
    <Action label="Preparar solicitud segura (sin enviarla)" onPress={prepare}/>}
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
   {feedback!==''&&<Text accessibilityRole="alert" accessibilityLiveRegion="assertive"
    style={[styles.text,{color:palette.primary}]}>{feedback}</Text>}
  </Panel>
  <Panel>
   <Text accessibilityRole="header" style={styles.heading}>Paso 4 · Cotización y conductor</Text>
   <Action label="Aceptar tarifa y buscar conductor — pendiente de backend" disabled
    hint="Se habilitará cuando el servidor certifique cotización y despacho" onPress={()=>{}}/>
   <Text style={styles.small}>No se cobrará ni iniciará búsqueda. Falta el contrato A de precotización sin despacho, Auth Passenger real, verificación de zona y confirmación del importe en Gs.</Text>
  </Panel>
 </ScrollView>;
}

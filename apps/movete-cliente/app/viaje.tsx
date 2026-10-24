import React,{useRef,useState} from 'react';
import {ScrollView,Text,TextInput,View} from 'react-native';
import * as Crypto from 'expo-crypto';
import {Action,Panel,palette,styles} from '../src/ClientUI';
import {useClientView} from '../src/ClientRuntime';
import type {ClientExperience,ClientSnapshot} from '../src/domain/client-experience.mjs';
import {validateRideDraft} from '../src/domain/capabilities.mjs';
import {prepareLocalRideRequest} from '../src/domain/client-request-preparation.mjs';
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
 const mutation=view.mutation;
 const myDraft=mutation.phase==='ready'&&mutation.operation==='rideRequest';
 const free=mutation.phase==='idle';
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
  if(myDraft)return;
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
  if(!free||!validated||lock.current||!view.authenticated)return;
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
     disabled={myDraft} onPress={()=>selectService(option.code)}/>
    <Text style={styles.small}>{option.description}. Disponibilidad y tarifa pendientes del servidor.</Text>
   </View>)}
   <Text style={styles.small}>No hay motos de pasajeros. Motocicletas solo para envíos habilitados.</Text>
  </Panel>
  <Panel>
   <Text accessibilityRole="header" style={styles.heading}>Paso 3 · Revisá antes de continuar</Text>
   <Action label="Revisar ruta y servicio" disabled={!free} onPress={validate}/>
   {validated&&<View>
    <Text style={styles.text}>Ruta: {[pickup,...route.stops,destination].map(s=>s.trim()).join(' → ')}</Text>
    <Text style={styles.text}>Servicio: {OPTIONS.find(o=>o.code===service)?.title}</Text>
    {route.stops.length>0&&<Text style={styles.small}>
     Esta ruta con paradas no puede convertirse en solicitud hasta la certificación del servidor.
    </Text>}
   </View>}
   {view.authenticated&&free&&validated&&route.stops.length===0&&
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

import React,{useCallback,useEffect} from 'react';
import {AppState,ScrollView,Text,View} from 'react-native';
import {router,useFocusEffect,useLocalSearchParams} from 'expo-router';
import {Action,Panel,styles} from '../src/DriverUI';
import {useDriverTrip} from '../src/DriverTripProvider';

const verbs:Record<string,string>={
 accepted:'Oferta aceptada por el backend de pruebas',
 arriving:'Llegada registrada por el servidor',
 in_progress:'Viaje iniciado en el servidor',
 completed:'Viaje terminado en el servidor',
 cancelled:'Viaje cancelado en el servidor'
};
const labels:Record<string,string>={
 arrive:'Registrar llegada al punto de recogida',
 pickup:'Registrar inicio de viaje',
 complete:'Registrar finalización de viaje'
};
/** Driver-only: never trust route tripId for authorization; G65 backend filters
 * by verified Driver ID and the exact persisted assignment before returning.
 */
export default function DriverTripScreen(){
 const args=useLocalSearchParams<{tripId?:string}>();
 const tripId=typeof args.tripId==='string'?args.tripId:null;
 const {state,enabled,open,refresh,poll,advance}=useDriverTrip();
 useEffect(()=>{
  if(enabled&&tripId&&state.phase==='ready'){
   void open(tripId);
  }
 },[enabled,tripId,state.phase,open]);
 // GET-only synchronization for passenger cancellation or other persisted
 // lifecycle updates. The controller fences overlapping reads and unknown
 // COMMITs. No background tracking, geolocation or automatic state mutation.
 useFocusEffect(useCallback(()=>{
  let focused=true;
  const sync=()=>{if(focused&&AppState.currentState==='active')
   void poll();};
  sync();
  const interval=setInterval(sync,5000);
  const sub=AppState.addEventListener('change',s=>{
   if(s==='active')sync();
  });
  return ()=>{focused=false;clearInterval(interval);sub.remove();};
 },[poll]));
 const loaded=state.tripId===tripId;
 const canAct=enabled&&loaded&&state.phase==='active'&&
  state.nextEvent!==null&&!state.uncertain;
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
  <View style={styles.hero}>
   <Text style={styles.heroText}>Mi viaje de prueba</Text>
   <Text style={styles.heroSub}>Solo seguimiento de AUTO asignado a una sesión Driver verificada.</Text>
  </View>
  <Panel>
   <Text style={styles.heading}>Estado confirmado por el servidor</Text>
   <Text style={styles.small}>El estado del viaje se sincroniza con el servidor mientras esta pantalla esté abierta. Si el pasajero cancela, se bloquean las acciones pendientes. No se muestran GPS, tiempos estimados, cobros ni datos del pasajero sin fuentes autorizadas.</Text>
   {!enabled?
    <Text style={styles.text}>No hay backend HTTPS STAGING autorizado. Esta función está bloqueada.</Text>:
    !tripId?
    <Text style={styles.text}>No se recibió un identificador válido de viaje.</Text>:
    state.phase==='ready'||state.phase==='loading'||state.phase==='submitting'?
    <Text style={styles.text}>Consultando la asignación del servidor…</Text>:
    state.phase==='uncertain'?
    <Text style={styles.text}>Resultado incierto: podría haberse registrado un evento. No vamos a repetirlo. Consultá el estado persistido.</Text>:
    loaded&&state.status&&['active','terminal'].includes(state.phase)?
    <>
     <Text style={styles.heading}>{verbs[state.status]??'Estado no identificado'}</Text>
     <Text style={styles.small}>Revisión persistida: {state.revision??'Sin verificar'}</Text>
     {state.phase==='terminal'&&<Text style={styles.text}>Estado final de QA. No representa un viaje comercial ni un pago.</Text>}
    </>:
    <Text style={styles.text}>No se pudo verificar una asignación activa a esta cuenta. Las acciones permanecen bloqueadas.</Text>}
   {canAct&&state.nextEvent&&<Action
    label={labels[state.nextEvent]??'Registrar siguiente evento'}
    onPress={()=>{void advance();}}/>}
   {enabled&&tripId&&<Action
    label={state.uncertain?'Consultar estado sin repetir la acción':'Actualizar estado del viaje'}
    secondary disabled={state.phase==='submitting'||state.phase==='loading'}
    onPress={()=>{void (state.phase==='ready'?open(tripId):refresh());}}/>}
  </Panel>
  <Panel>
   <Text style={styles.heading}>Seguridad del viaje</Text>
   <Text style={styles.text}>La asignación, el orden de llegada, inicio y finalización se validan en PostgreSQL. No se puede saltar una etapa ni dar por confirmado un evento sin consultar el estado persistido.</Text>
   <Text style={styles.small}>No usar el teléfono mientras conducís. En una aplicación operativa estas interacciones necesitarán controles de seguridad vial y pruebas en dispositivos físicos.</Text>
  </Panel>
  <Action label="Volver a ofertas" secondary onPress={()=>router.back()}/>
 </ScrollView>;
}

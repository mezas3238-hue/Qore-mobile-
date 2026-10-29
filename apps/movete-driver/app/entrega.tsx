import React,{useCallback,useEffect} from 'react';
import {AppState,ScrollView,Text,View} from 'react-native';
import {useFocusEffect,useLocalSearchParams,router} from 'expo-router';
import {Action,Panel,styles} from '../src/DriverUI';
import {useDriverCustody} from '../src/DriverCustodyProvider';
const labels:Record<string,string>={
 accepted:'Reparto aceptado por el servidor',
 picked_up:'Paquete recogido según el servidor',
 delivered:'Entrega con prueba verificada',
 disputed:'Entrega en disputa',
 returned:'Paquete devuelto según el servidor',
 cancelled:'Entrega cancelada'
};
const actions:Record<string,string>={
 pickup:'Confirmar recogida del paquete',
 deliver:'Confirmar entrega con prueba registrada',
 return:'Confirmar devolución autorizada'
};
export default function DriverDelivery(){
 const {deliveryId:raw}=useLocalSearchParams<{deliveryId?:string}>();
 const deliveryId=typeof raw==='string'?raw:null;
 const {state,enabled,hasProofSource,open,refresh,poll,advance}=useDriverCustody();
 useEffect(()=>{
  if(enabled&&deliveryId&&state.phase==='ready')void open(deliveryId);
 },[enabled,deliveryId,state.phase,open]);
 // G122C: observe external cancellation/dispute on the same persisted
 // delivery. Never auto-POST; stop polling when unfocused or backgrounded.
 useFocusEffect(useCallback(()=>{
  let focused=true;
  const sync=()=>{if(focused&&AppState.currentState==='active')
   void poll();};
  sync();
  const interval=setInterval(sync,5000);
  const foreground=AppState.addEventListener('change',status=>{
   if(status==='active')sync();
  });
  return ()=>{focused=false;clearInterval(interval);foreground.remove();};
 },[poll]));
 const same=state.deliveryId===deliveryId;
 const active=enabled&&same&&state.phase==='active'&&
  state.nextEvent!==null&&!state.uncertain;
 // G66 default composition does not have a verified proof registry. The
 // controller blocks deliver even if a UI wrongly invokes advance().
 const proofRequired=state.nextEvent==='deliver'&&!hasProofSource;
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
  <View style={styles.hero}>
   <Text style={styles.heroText}>Custodia de mi entrega</Text>
   <Text style={styles.heroSub}>Recogida, entrega y devolución con comprobaciones del backend en STAGING.</Text>
  </View>
  <Panel>
   <Text style={styles.heading}>Estado del envío asignado</Text>
   {!enabled?<Text style={styles.text}>Servidor STAGING no autorizado; la entrega está bloqueada.</Text>:
    !deliveryId?<Text style={styles.text}>No se recibió un identificador de entrega.</Text>:
    ['ready','loading','submitting'].includes(state.phase)?
    <Text style={styles.text}>Verificando estado y asignación…</Text>:
    state.phase==='uncertain'?
    <Text style={styles.text}>El resultado anterior podría haberse guardado. No se repetirá automáticamente. Consultá la custodia persistida.</Text>:
    same&&state.status&&['active','terminal'].includes(state.phase)?<>
     <Text style={styles.heading}>{labels[state.status]??'Estado pendiente'}</Text>
     <Text style={styles.small}>Revisión persistida: {state.revision??'No disponible'}</Text>
     {state.phase==='terminal'&&<Text style={styles.text}>Estado terminal en QA; no confirma pagos ni entregas comerciales.</Text>}
    </>:<Text style={styles.text}>No se pudo comprobar una entrega asignada a tu identidad. Acciones deshabilitadas.</Text>}
   {active&&state.nextEvent&&<Action
    label={actions[state.nextEvent]??'Siguiente evento'}
    disabled={proofRequired}
    onPress={()=>{void advance();}}/>}
   {active&&proofRequired&&<Text style={styles.text}>Antes de marcar entregado hace falta una prueba registrada y verificada por un servicio independiente del backend. No se puede generar un comprobante ficticio desde el teléfono.</Text>}
   {enabled&&same&&state.phase==='terminal'&&state.status==='delivered'&&
     <Action label="Calificar al cliente de esta entrega" secondary
      onPress={()=>router.push({pathname:'/calificar',
       params:{serviceId:deliveryId??'',serviceKind:'DELIVERY_AUTO'}})}/>}
    {enabled&&deliveryId&&<Action
    label={state.uncertain?'Consultar resultado sin reenviar':'Actualizar custodia'}
    secondary disabled={['loading','submitting'].includes(state.phase)}
    onPress={()=>{void (state.phase==='ready'?open(deliveryId):refresh());}}/>}
  </Panel>
  <Panel>
   <Text style={styles.heading}>Seguridad del paquete</Text>
   <Text style={styles.text}>El sistema confirma el repartidor y la asignación desde el servidor. Recogida, entrega y devolución no pueden ejecutarse fuera de orden.</Text>
   <Text style={styles.small}>Ningún comprobante, GPS o mensaje debe interpretarse como verificado solo porque exista una clave UUID. MOTO transporta paquetes admitidos, nunca pasajeros.</Text>
  </Panel>
  <Action label="Volver a ofertas" secondary onPress={()=>router.back()}/>
 </ScrollView>;
}

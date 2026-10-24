import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {AccessibilityInfo,AppState,findNodeHandle,ScrollView,Text,View} from 'react-native';
import * as Crypto from 'expo-crypto';
import {router,useFocusEffect} from 'expo-router';
import {Action,Panel,styles} from '../src/ClientUI';
import {useClientView} from '../src/ClientRuntime';
import {createSecureCancellationKey} from '../src/domain/secure-cancel-key.mjs';
import {guardTrackingCancellationUiAction} from '../src/domain/tracking-cancellation-ui-guard.mjs';
import {createF1FocusedTrackingSync} from '../src/domain/f1-focused-tracking-sync.mjs';

const LABEL:Record<string,string>={
 idle:'Sin viaje activo',searching:'Buscando automóvil',assigned:'Conductor asignado',
 arriving:'Conductor en camino',in_progress:'En viaje',completed:'Finalizado',
 cancelled:'Cancelado',failed:'Servicio no completado'
};
const CANCELLABLE=new Set(['searching','assigned','arriving']);
export default function ClientTracking(){
 const {client,view}=useClientView();
 const state=view.tracking;
 const [confirm,setConfirm]=useState(false);
 const [cancelBusy,setCancelBusy]=useState(false);
 const [message,setMessage]=useState('');
 const locked=useRef(false);
 const confirmHeading=useRef<React.ElementRef<typeof Text>>(null);
 // F1: only the Passenger's verified QA booking may poll while this route is
 // focused. No side effects on other screens or before a certified status GET.
 const foreground=useMemo(()=>createF1FocusedTrackingSync({
  readSnapshot:()=>client.snapshot(),
  syncTracking:()=>client.syncTracking()
 }),[client]);
 useFocusEffect(useCallback(()=>{
  // React Navigation focus may persist when Android/iOS app is backgrounded.
  // Only an ACTIVE app with this route focused may poll the Passenger GET.
  if(AppState.currentState==='active')foreground.start();
  const subscription=AppState.addEventListener('change',state=>{
   if(state==='active')foreground.start();
   else foreground.stop();
  });
  return ()=>{subscription.remove();foreground.stop();};
 },[foreground,view.privateViewRevision,view.tracking.tripId,
  view.tracking.subscriptionActive,view.rideContinuation.tripId]));
 const canSync=view.authenticated&&state.subscriptionActive&&!state.syncing;
 const canCancel=view.authenticated&&state.subscriptionActive&&!state.syncing
  &&CANCELLABLE.has(state.state)&&view.cancellation.contractReady;
 const phase=view.cancellation.phase;
 // JWT rotation, assignment/status revision, or a new trip invalidates an
 // open cancellation confirmation even if the user subject is unchanged.
 useEffect(()=>{setConfirm(false);setMessage('');},
  [view.privateViewRevision,state.tripId,state.state,state.revision,state.syncing]);
 useEffect(()=>{
  if(!confirm)return;
  const timer=setTimeout(()=>{
   const node=findNodeHandle(confirmHeading.current);
   if(node)AccessibilityInfo.setAccessibilityFocus(node);
  },50);
  return ()=>clearTimeout(timer);
 },[confirm]);
 function validateCancelAction(action:'prepare'|'submit'|'retry'){
  const allowed=guardTrackingCancellationUiAction(view,client.snapshot(),{action});
  if(!allowed.ok){
   setConfirm(false);
   setMessage('La sesión o el estado del viaje cambió. Actualizá el seguimiento antes de cancelar.');
   return false;
  }
  return true;
 }
 function prepareCancel(){
  if(!canCancel||!state.tripId||locked.current)return;
  if(!validateCancelAction('prepare'))return;
  if(phase==='ready'){setConfirm(true);return;}
  if(phase!=='idle')return;
  const candidate=createSecureCancellationKey(()=>Crypto.randomUUID());
  if(!candidate.ok||!candidate.requestKey){
   setMessage('No se pudo obtener un identificador seguro del dispositivo. No enviamos ninguna solicitud.');
   return;
  }
  const result=client.prepareCancelRide({tripId:state.tripId,requestKey:candidate.requestKey});
  if(!result.ok){setMessage('La cancelación todavía no está habilitada para este viaje.');return;}
  setMessage('');setConfirm(true);
 }
 async function performCancel(retry:boolean){
  if(locked.current||!canCancel)return;
  if(retry?phase!=='retryable':phase!=='ready')return;
  if(!validateCancelAction(retry?'retry':'submit'))return;
  locked.current=true;setCancelBusy(true);setConfirm(false);setMessage('');
  const old=client.snapshot().cancellation;
  const subject=view.account?.subject;
  const tripId=state.tripId;
  try{
   const result=retry?await client.retryCancelRide():await client.submitCancelRide();
   const latest=client.snapshot();
   if(latest.account?.subject!==subject
    ||latest.privateViewRevision!==view.privateViewRevision
    ||latest.tracking.tripId!==tripId
    ||latest.tracking.revision!==state.revision
    ||latest.tracking.state!==state.state
    ||latest.cancellation.requestKey!==old.requestKey)return;
   if(result.ok){
    setMessage(result.statusRefreshed
     ?'Se registró el evento de cancelación. Consultá el estado del servidor; no se confirma reembolso.'
     :'Solicitud registrada, pero no se pudo verificar el estado del viaje. Volvé a actualizar antes de actuar.');
   }else if(result.code==='CONFLICT_RELOAD_TRIP'){
    setMessage('El viaje cambió mientras intentabas cancelar. Se solicitó una nueva lectura; verificá el estado antes de continuar.');
   }else if(['NETWORK_OR_TIMEOUT','RATE_LIMITED','SERVICE_UNAVAILABLE'].includes(result.code??'')){
    setMessage('La respuesta no llegó de forma verificable. Reintentá con la MISMA solicitud; no generaremos otra.');
   }else{
    setMessage('No fue posible verificar la cancelación. Revisá tu sesión y el estado del viaje.');
   }
  }finally{locked.current=false;setCancelBusy(false);}
 }
 return <ScrollView style={styles.page} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic"
  keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
  <View style={styles.hero}><Text accessibilityRole="header" style={styles.heroText}>Seguimiento</Text>
   <Text style={styles.heroSub}>Solo se muestra la asignación confirmada y autorizada por el servidor.</Text></View>
  {!view.authenticated||!state.subscriptionActive?
   <Panel><Text accessibilityRole="header" style={styles.heading}>Sin servicio activo</Text>
    <Text style={styles.text}>No hay sesión de pasajero ni viaje conectado. Nunca mostramos un automóvil o su ubicación sin datos verificados.</Text>
   </Panel>:
   <Panel>
    <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={styles.heading}>{LABEL[state.state]??'Estado pendiente'}</Text>
    <Text style={styles.text}>Revisión del servidor: {state.revision>=0?String(state.revision):'No disponible'}</Text>
    {state.assignedDriver?<Text style={styles.text}>Conductor: {state.assignedDriver.name} · Patente: {state.assignedDriver.plate}</Text>
     :<Text style={styles.text}>Identidad del conductor oculta hasta aceptación persistida y verificación.</Text>}
    {state.position&&state.etaMinutes!==null?<Text style={styles.text}>Llegada estimada verificada: {state.etaMinutes} min.</Text>
     :<Text style={styles.small}>GPS o tiempo estimado no disponibles, sin consentimiento o desactualizados.</Text>}
    {state.assignedDriver&&state.tripId&&['assigned','arriving','in_progress'].includes(state.state)&&
     <View>
      <Action label="Mensajes con mi conductor" secondary disabled={!view.chat.contractReady}
       hint="Solo se habilita con mensajería de servidor certificada y asignación vigente"
       onPress={()=>router.push({pathname:'/mensajes',params:{serviceId:state.tripId,serviceKind:'RIDE'}})}/>
      {!view.chat.contractReady&&<Text style={styles.small}>
       El chat con tu conductor quedará disponible cuando el backend certifique la conversación privada.
      </Text>}
     </View>}
    {state.lastError&&<Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.small}>Sincronización: {state.lastError}. La ubicación caducada está oculta.</Text>}
    {view.rideContinuation.canVerify&&view.rideContinuation.tripId===state.tripId
     &&!['completed','cancelled','failed'].includes(state.state)&&
     <Text style={styles.small}>El estado del viaje se consulta automáticamente cada 12 segundos mientras esta pantalla está abierta. Las ubicaciones y tiempos solo se muestran con datos vigentes del servidor.</Text>}
    <Action label={state.syncing?'Sincronizando…':'Actualizar desde el servidor'} disabled={!canSync}
     busy={state.syncing}
      onPress={()=>{void client.syncTracking();}}/>
    {!view.cancellation.contractReady&&CANCELLABLE.has(state.state)&&
     <Text style={styles.small}>Cancelar viaje todavía no está disponible: falta certificar Auth, permisos y la API de pruebas.</Text>}
    {canCancel&&phase==='idle'&&
     <Action label="Solicitar cancelación" secondary disabled={cancelBusy} onPress={prepareCancel}/>}
    {canCancel&&phase==='ready'&&!confirm&&
     <Action label="Revisar cancelación" secondary disabled={cancelBusy} onPress={prepareCancel}/>}
    {canCancel&&phase==='ready'&&confirm&&
     <View accessibilityViewIsModal importantForAccessibility="yes">
      <Text ref={confirmHeading} accessible accessibilityRole="header"
       style={styles.heading}>¿Confirmás cancelar este viaje?</Text>
      <Text style={styles.text}>Esto enviará una solicitud al servidor. No podemos asegurar costos, reembolsos ni el estado final hasta consultar el servidor.</Text>
      <Action label="Sí, enviar cancelación" disabled={cancelBusy} busy={cancelBusy}
       hint="Se revalidará la sesión, el viaje y la misma solicitud antes del envío. No garantiza reembolso."
       onPress={()=>{void performCancel(false);}}/>
      <Action label="Volver sin enviar" secondary disabled={cancelBusy} busy={cancelBusy}
       hint="Cierra la confirmación, sin cancelar el viaje."
       onPress={()=>setConfirm(false)}/>
     </View>}
    {canCancel&&phase==='retryable'&&
     <Action label={cancelBusy?'Enviando…':'Reintentar misma cancelación'}
      disabled={cancelBusy} busy={cancelBusy}
      hint="Usa la misma clave de la cancelación pendiente. No crea otra solicitud."
      onPress={()=>{void performCancel(true);}}/>}
    {canCancel&&['failed','acknowledged'].includes(phase)&&
     <Text style={styles.small}>Antes de cualquier nueva operación, consultá el estado actual del servidor. No se envía otra cancelación automáticamente.</Text>}
    {message!==''&&<Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.text}>{message}</Text>}
    <Text style={styles.small}>No se inventan tiempos, mapas ni confirmaciones por notificación push.</Text>
   </Panel>}
 </ScrollView>;
}

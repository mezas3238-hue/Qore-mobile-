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
 const [historyMessage,setHistoryMessage]=useState('');
 const [historyBusy,setHistoryBusy]=useState(false);
 const historyLock=useRef(false);
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
 const g95=view.g95Cancellation;
 const [g95Confirm,setG95Confirm]=useState(false);
 const [g95Message,setG95Message]=useState('');
 const [g95Busy,setG95Busy]=useState(false);
 const g95Lock=useRef(false);
 const [g95VerifyBusy,setG95VerifyBusy]=useState(false);
 const [g95StatusBusy,setG95StatusBusy]=useState(false);
 const g95StatusLock=useRef(false);
 const g95VerifyLock=useRef(false);
 const g95ForTrip=g95.tripId===state.tripId&&state.tripId!==null;
 const canG95=view.authenticated&&g95ForTrip&&g95.contractReady
  &&state.subscriptionActive&&!state.syncing&&CANCELLABLE.has(state.state);
 const canCancel=view.authenticated&&state.subscriptionActive&&!state.syncing
  &&CANCELLABLE.has(state.state)&&view.cancellation.contractReady
  &&!g95ForTrip;
 const phase=view.cancellation.phase;
 // JWT rotation, assignment/status revision, or a new trip invalidates an
 // open cancellation confirmation even if the user subject is unchanged.
 useEffect(()=>{setConfirm(false);setMessage('');setG95Confirm(false);setG95Message('');},
  [view.privateViewRevision,state.tripId,state.state,state.revision,state.syncing]);
 useEffect(()=>{
  if(!confirm)return;
  const timer=setTimeout(()=>{
   const node=findNodeHandle(confirmHeading.current);
   if(node)AccessibilityInfo.setAccessibilityFocus(node);
  },50);
  return ()=>clearTimeout(timer);
 },[confirm]);
 function prepareG95Ui(){
  if(!canG95||g95Lock.current)return;
  const result=client.prepareG95Cancel({requestKey:Crypto.randomUUID()});
  if(result.ok){setG95Message('');setG95Confirm(true);}
  else setG95Message('No se pudo preparar cancelación; actualizá el viaje.');
 }
 async function sendG95Ui(){
  if(g95Lock.current||!g95ForTrip||g95.phase!=='ready')return;
  g95Lock.current=true;setG95Busy(true);setG95Confirm(false);
  try{
   const result=await client.sendG95Cancel(),after=client.snapshot();
   if(after.privateViewRevision!==view.privateViewRevision
    ||after.tracking.tripId!==state.tripId)return;
   setG95Message(result.ok
    ?'Cancelación persistida QA. Verificá estado G4 y contabilidad G94; no es reembolso.'
    :'Respuesta ambigua. No se repetirá el POST: recuperá el recibo por GET.');
  }finally{g95Lock.current=false;setG95Busy(false);}
 }
 async function reconcileG95Ui(){
  if(g95Lock.current||g95.tripId===null||!view.authenticated
   ||!g95.requiresReconciliation)return;
  g95Lock.current=true;setG95Busy(true);
  try{
   const result=await client.reconcileG95Cancel(),after=client.snapshot();
   if(after.privateViewRevision!==view.privateViewRevision
    ||after.tracking.tripId!==state.tripId)return;
   setG95Message(result.ok
    ?'Anulación recuperada por GET privado. Verificá G4/G94, no hay reembolso.'
    :'El servidor no confirmó la anulación; no se enviará un POST nuevo.');
  }finally{g95Lock.current=false;setG95Busy(false);}
 }
 async function verifyRestoredG95Ui(){
  if(g95StatusLock.current||!view.authenticated
   ||!g95.statusReadReady||!g95.tripId)return;
  const privacy=view.privateViewRevision,tripId=g95.tripId;
  g95StatusLock.current=true;setG95StatusBusy(true);
  try{
   const result=await client.verifyRecoveredG95RideStatus();
   const latest=client.snapshot();
   if(latest.privateViewRevision!==privacy
    ||latest.g95Cancellation.tripId!==tripId)return;
   setG95Message(result.ok
    ?'G4 confirmó cancelado el viaje AUTO en QA. G94 sigue sin certificación financiera después del reinicio.'
    :'El servidor G4 todavía no confirma la cancelación. No hay reembolso certificado.');
  }finally{g95StatusLock.current=false;setG95StatusBusy(false);}
 }
 async function verifyG95Ui(){
  if(g95VerifyLock.current||!g95ForTrip||!g95.canVerify)return;
  const before=client.snapshot();
  if(before.privateViewRevision!==view.privateViewRevision
   ||before.g95Cancellation.tripId!==state.tripId)return;
  g95VerifyLock.current=true;setG95VerifyBusy(true);
  try{
   const response=await client.verifyG95Cancellation();
   const after=client.snapshot();
   if(after.privateViewRevision!==view.privateViewRevision
    ||after.tracking.tripId!==state.tripId)return;
   setG95Message(response.ok&&after.g95Cancellation.independentlyVerified
    ?'G4 confirma viaje cancelado y G94 confirma reversión contable en QA. No se efectuó devolución de dinero.'
    :'La cancelación aún no está comprobada por G4 y G94. El recibo G95 se conserva para nueva verificación.');
  }finally{g95VerifyLock.current=false;setG95VerifyBusy(false);}
 }
 async function verifyOwnCompletedHistory(){
  if(historyLock.current||!view.completedRideHistory.readReady
   ||view.completedRideHistory.verified)return;
  const before=client.snapshot();
  if(!before.completedRideHistory.readReady
   ||before.tracking.tripId!==view.tracking.tripId
   ||before.tracking.revision!==view.tracking.revision
   ||before.privateViewRevision!==view.privateViewRevision)return;
  historyLock.current=true;setHistoryBusy(true);setHistoryMessage('');
  try{
   const outcome=await client.verifyCompletedRideHistory();
   const after=client.snapshot();
   if(after.privateViewRevision!==view.privateViewRevision
    ||after.account?.subject!==view.account?.subject
    ||after.tracking.tripId!==before.tracking.tripId)return;
   setHistoryMessage(outcome.ok&&after.completedRideHistory.verified
    ?'El historial privado del servidor confirma la finalización del viaje. Esto no es un comprobante de pago.'
    :'El historial del servidor todavía no confirma esta finalización. No mostramos recibos ni pagos sin verificación.');
  }finally{historyLock.current=false;setHistoryBusy(false);}
 }
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
    <Text style={styles.text}>No hay viaje conectado. Una reserva anterior solo se recupera con una lectura privada del servidor.</Text>
    {view.authenticated&&g95.requiresReconciliation&&<Action
     label={g95Busy?'Recuperando…':'Recuperar cancelación AUTO por GET'}
     disabled={g95Busy} busy={g95Busy}
     hint="El servidor ya revalidó la reserva propia. No se repite el POST."
     onPress={()=>{void reconcileG95Ui();}}/>}
    {view.authenticated&&g95.phase==='confirmed'&&<View>
     <Text style={styles.small}>Recibo G95 recuperado. Faltan verificar G4 y G94; no es un reembolso.</Text>
     {g95.statusReadReady&&<Action
      label={g95StatusBusy?'Comprobando estado…':'Verificar estado cancelado con G4'}
      busy={g95StatusBusy} disabled={g95StatusBusy||g95.busy}
      hint="GET privado del mismo viaje G73, sin repetir cancelación ni declarar pagos."
      onPress={()=>{void verifyRestoredG95Ui();}}/>}
    </View>}
    {g95Message!==''&&<Text accessibilityRole="alert" style={styles.small}>{g95Message}</Text>}
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
    {state.state==='completed'&&<View>
      <Text accessibilityRole="header" style={styles.heading}>Finalización e historial</Text>
      <Text style={styles.small}>El estado finalizado del seguimiento no equivale a una entrada confirmada en el historial ni a un cobro realizado.</Text>
      {view.completedRideHistory.verified
       ?<Text accessibilityLiveRegion="polite" style={styles.text}>Finalización confirmada también por el historial privado del servidor.</Text>
       :view.completedRideHistory.readReady
        ?<Action label={historyBusy?'Verificando historial…':'Verificar finalización en mi historial'}
         busy={historyBusy} disabled={historyBusy||view.completedRideHistory.verifying}
         hint="Lectura independiente de tu historial. No crea otro viaje ni cobra."
         onPress={()=>{void verifyOwnCompletedHistory();}}/>
        :<Text style={styles.small}>La comprobación adicional del historial todavía no está disponible: se requiere una lectura segura y vigente de STAGING.</Text>}
      {historyMessage!==''&&<Text accessibilityRole="alert" style={styles.small}>{historyMessage}</Text>}
      {view.completedRideHistory.verified&&
       <Action label="Abrir mi historial" secondary onPress={()=>router.push('/historial')}/>}
     </View>}
    <Action label={state.syncing?'Sincronizando…':'Actualizar desde el servidor'} disabled={!canSync}
     busy={state.syncing}
      onPress={()=>{void client.syncTracking();}}/>
    {canG95&&<Action label="Solicitar cancelación AUTO G95 — QA" secondary
     hint="Una única solicitud con confirmación humana; sin pago."
     onPress={prepareG95Ui}/>}
    {g95ForTrip&&g95.phase==='ready'&&g95Confirm&&<View
     accessibilityViewIsModal importantForAccessibility="yes">
     <Text accessibilityRole="header" style={styles.heading}>¿Confirmás cancelar el automóvil?</Text>
     <Text style={styles.text}>Solo se enviará una solicitud con clave fija. La anulación QA no equivale a reembolso.</Text>
     <Action label={g95Busy?'Enviando…':'Confirmar cancelación G95'}
      disabled={g95Busy} busy={g95Busy} onPress={()=>{void sendG95Ui();}}/>
     <Action label="Volver sin enviar" secondary disabled={g95Busy}
      onPress={()=>{client.abandonG95PreparedCancel();setG95Confirm(false);}}/>
    </View>}
    {g95ForTrip&&g95.requiresReconciliation&&<Action
     label={g95Busy?'Comprobando…':'Recuperar cancelación sin volver a enviar'}
     disabled={g95Busy} busy={g95Busy}
     hint="GET privado sobre la reserva existente, ningún POST adicional."
     onPress={()=>{void reconcileG95Ui();}}/>}
    {g95ForTrip&&g95.statusIndependentlyVerified&&!g95.independentlyVerified&&
     <Text accessibilityLiveRegion="polite" style={styles.text}>
      Viaje cancelado confirmado por G4. Los importes y la reversión G94 todavía NO están verificados tras el reinicio.
     </Text>}
    {g95ForTrip&&g95.phase==='confirmed'&&<View>
     <Text style={styles.small}>Recibo G95 persistido en QA. Falta comprobar por separado la cancelación G4 y la reversión contable G94. No hay reembolso real.</Text>
     {g95.canVerify&&<Action
      label={g95VerifyBusy?'Verificando G4 y G94…':'Verificar cancelación y contabilidad'}
      busy={g95VerifyBusy} disabled={g95VerifyBusy||g95.busy}
      hint="Dos lecturas independientes autenticadas; ningún POST ni devolución."
      onPress={()=>{void verifyG95Ui();}}/>}
    </View>}
    {g95ForTrip&&g95.independentlyVerified&&<Text accessibilityLiveRegion="polite" style={styles.text}>
      Viaje cancelado confirmado por G4 y reversión de subsidio confirmada por G94 en QA. No es un reembolso bancario.
    </Text>}
    {g95Message!==''&&<Text accessibilityRole="alert" style={styles.small}>{g95Message}</Text>}
    {!view.cancellation.contractReady&&!canG95&&CANCELLABLE.has(state.state)&&
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

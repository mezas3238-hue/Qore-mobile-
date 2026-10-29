import React,{useCallback,useRef,useState} from 'react';
import {AppState,ScrollView,Text,View} from 'react-native';
import {Action,Panel,styles} from '../src/DriverUI';
import {useDriverKycExpiry} from '../src/DriverKycExpiryProvider';
import {useDriverWorkspace} from '../src/DriverWorkspaceProvider';
import {useDriverOfferActions} from '../src/DriverOfferActionsProvider';
import {useDriverCurrentTrip} from '../src/DriverCurrentTripProvider';
import {useDriverCustody} from '../src/DriverCustodyProvider';
import {verifyAcceptedDriverAutoResume,verifyFreshDriverAutoResume} from '../src/domain/driver-accepted-ride-resume.mjs';
import {acceptAndRecoverDriverAuto} from '../src/domain/driver-auto-accept-flow.mjs';
import type {DriverOfferDecisionStatus} from '../src/domain/driver-offer-actions.mjs';
import {router,useFocusEffect} from 'expo-router';

/**
 * Read-only private STAGING inbox; never present a synthetic dispatch as LIVE.
 * Backend G4/G10 still checks identity and KYC transactionally on acceptance.
 * No "accept" control is enabled without an explicitly approved staging auth.
 */
export default function DriverOffers(){
 const {state,refresh,poll}=useDriverWorkspace();
 const kyc=useDriverKycExpiry();
 const {state:actions,enabled,decide,reconcilePending,detail,inspectDelivery}
  =useDriverOfferActions();
 const currentTrip=useDriverCurrentTrip();
 const custody=useDriverCustody();
 const resumeLock=useRef(false);
 const [resuming,setResuming]=useState(false);
 const [resumeMessage,setResumeMessage]=useState('');
 const [clock,setClock]=useState(()=>Date.now());
 // The server suggests 5s polling for short-lived private offers. Refresh
 // only while this screen is focused AND the device is in foreground.
 // No accept/decline POST occurs here; each response is reauthenticated.
 useFocusEffect(useCallback(()=>{
  let focused=true;
  const tick=()=>{if(focused&&AppState.currentState==='active')
   setClock(Date.now());};
  const sync=()=>{if(focused&&AppState.currentState==='active'){
   tick();void poll();
  }};
  sync();
  const clockTimer=setInterval(tick,1000);
  const offerTimer=setInterval(sync,5000);
  const foreground=AppState.addEventListener('change',status=>{
   if(status==='active')sync();
  });
  return ()=>{
   focused=false;clearInterval(clockTimer);clearInterval(offerTimer);
   foreground.remove();
  };
 },[poll]));
 async function acceptVerifiedAutoOffer(offerId:string){
  // Exactly one user-initiated POST. Navigation requires a second private,
  // owner-scoped SQL read matching the accepted offer's serviceId.
  if(resumeLock.current||!enabled||!currentTrip.enabled||
   actions.phase!=='ready'||state.phase!=='connected'||
   !state.currentLicenseApproved||kyc.snapshot?.state!=='READY_QA'||
   kyc.snapshot?.accountBlocked!==false)return;
  resumeLock.current=true;setResuming(true);setResumeMessage('');
  try{
   const result=await acceptAndRecoverDriverAuto({
    offerId,decide,recoverCurrent:currentTrip.refresh
   });
   if(result.ok)router.push({pathname:'/viaje',
    params:{tripId:result.tripId}});
   else if(result.reason==='UNVERIFIED_ASSIGNMENT')
    setResumeMessage('La decisión puede estar confirmada, pero no se verificó la asignación actual en el servidor. Consultá tu viaje antes de continuar; no se repetirá la aceptación.');
   else if(result.reason==='NOT_CONFIRMED')
    setResumeMessage('No se confirmó la aceptación. Consultá el comprobante de la oferta; no se enviará otra aceptación automáticamente.');
  }finally{resumeLock.current=false;setResuming(false);}
 }
 async function continueOwnActiveAuto(){
  // G163: after restart, no stored tripId, old offer, accepted receipt or
  // persisted screen is trusted. G106 rechecks provider session and SQL owner.
  if(resumeLock.current||!currentTrip.enabled||state.phase!=='connected')return;
  resumeLock.current=true;setResuming(true);setResumeMessage('');
  try{
   const verified=await verifyFreshDriverAutoResume({
    recoverCurrent:currentTrip.refresh
   });
   if(verified.ok)router.push({pathname:'/viaje',
    params:{tripId:verified.tripId}});
   else setResumeMessage('No existe un viaje AUTO activo confirmado por el servidor para esta sesión, o no se pudo verificar. No se habilitan controles de viaje.');
  }finally{resumeLock.current=false;setResuming(false);}
 }
 async function resumeAssignedDelivery(){
  // G164: OS keychain stores only an offline hint, NOT authorization. The
  // existing G66 recovery authenticates again, confirms the same Driver in
  // PostgreSQL and rejects terminal/revoked/mismatched delivery ownership.
  if(resumeLock.current||!enabled||!custody.enabled||
   state.phase!=='connected')return;
  resumeLock.current=true;setResuming(true);setResumeMessage('');
  try{
   const restored=await custody.resumeDelivery();
   if(restored.ok&&restored.deliveryId){
    router.push({pathname:'/entrega',
     params:{deliveryId:restored.deliveryId}});
   }else setResumeMessage('No se pudo confirmar una entrega activa con la sesión y la custodia originales. No se repetirá ninguna aceptación o recogida.');
  }catch{setResumeMessage('La recuperación privada de la entrega no está disponible. No se ejecutó ninguna acción de reparto.');}
  finally{resumeLock.current=false;setResuming(false);}
 }
 async function continueAcceptedDelivery(decision:DriverOfferDecisionStatus){
  if(resumeLock.current||!enabled||!custody.enabled||
   decision.kind!=='DELIVERY'||decision.phase!=='confirmed'||
   decision.action!=='accept'||state.phase!=='connected')return;
  resumeLock.current=true;setResuming(true);setResumeMessage('');
  try{
   const verified=await custody.rememberDelivery(decision.serviceId);
   if(verified.ok){
    if(verified.saved===false)setResumeMessage(
     'El servidor verificó la entrega. La recuperación tras reiniciar no quedó guardada en este dispositivo.'
    );
    router.push({pathname:'/entrega',params:{deliveryId:decision.serviceId}});
   }else setResumeMessage('El servidor no confirmó esta entrega asignada a tu sesión Driver. No se realizarán acciones de custodia hasta verificar el mismo envío.');
  }finally{resumeLock.current=false;setResuming(false);}
 }
 async function continueAcceptedAuto(decision:DriverOfferDecisionStatus){
  // G4 receipt alone cannot unlock the trip. G106 independently verifies
  // this exact ID against the currently authenticated Driver in PostgreSQL.
  if(resumeLock.current||!currentTrip.enabled||actions.phase!=='ready'||
   state.phase!=='connected')return;
  resumeLock.current=true;setResuming(true);setResumeMessage('');
  try{
   const result=await verifyAcceptedDriverAutoResume({
    decision,recoverCurrent:currentTrip.refresh
   });
   if(result.ok)router.push({pathname:'/viaje',
    params:{tripId:result.tripId}});
   else setResumeMessage('El servidor no confirmó un viaje AUTO activo asignado a tu cuenta. Consultá nuevamente antes de continuar.');
  }finally{resumeLock.current=false;setResuming(false);}
 }
 const available=state.phase==='connected'?
  state.offers.filter(item=>item.expiresAtMs>clock+3000):[];
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
  <View style={styles.hero}>
   <Text style={styles.heroText}>Mis ofertas privadas</Text>
   <Text style={styles.heroSub}>Viajes AUTO y repartos ofrecidos exclusivamente a esta sesión Driver verificada en STAGING.</Text>
  </View>
  <Panel>
   <Text style={styles.heading}>Bandeja de ofertas — solo QA</Text>
   <Text accessibilityRole="alert" style={styles.text}>{kyc.notice.text}</Text>
   {state.phase==='connected'?<>
    <Text style={styles.small}>El contenido procede del backend de pruebas. Una oferta aquí no confirma push, recepción en el teléfono ni habilitación para prestar servicios reales.</Text>
    {available.length===0?
     <Text style={styles.text}>No hay ofertas vigentes dirigidas a esta identidad de prueba.</Text>:
     available.map(offer=><View key={offer.kind+offer.offerId} style={{gap:5}}>
      <Text style={styles.heading}>{offer.kind==='AUTO_RIDE'?'Viaje en automóvil':'Envío / reparto'}</Text>
      <Text style={styles.text}>Oferta privada de prueba · vence en {Math.max(0,Math.ceil((offer.expiresAtMs-clock)/1000))} s</Text>
      <Text style={styles.small}>La aceptación exige volver a validar documentación, vehículo, ubicación y disponibilidad en el servidor. Ninguna respuesta de prueba habilita viajes comerciales.</Text>
      {(()=>{
       const decision=actions.decisions.find(x=>x.offerId===offer.offerId);
       const preview=offer.kind==='DELIVERY'&&detail.item?.offerId===offer.offerId
        &&detail.item.deliveryId===offer.serviceId
        &&detail.item.expiresAtMs>clock+3000?detail.item:null;
       const allowed=enabled&&actions.phase==='ready'&&
        state.currentLicenseApproved&&kyc.snapshot?.state==='READY_QA'&&
        kyc.snapshot?.accountBlocked===false&&actions.offers.some(x=>x.offerId===offer.offerId)&&
        !decision&&!actions.busy&&!resuming&&
        (offer.kind!=='AUTO_RIDE'||currentTrip.enabled)&&
        (offer.kind!=='DELIVERY'||Boolean(preview))&&
        offer.expiresAtMs>clock+3000;
       return <>
        {decision&&<Text style={styles.text}>
         {decision.phase==='confirmed'?'Decisión confirmada por el servidor de pruebas.':
          decision.phase==='sending'?'Guardando la decisión en el servidor…':
          decision.phase==='uncertain'?'Resultado incierto: el servidor podría haber guardado la decisión. No volvemos a enviarla automáticamente. Actualizá el estado y consultá soporte.':
          'No se pudo verificar una clave segura para esta decisión.'}
        </Text>}
        {decision?.phase==='confirmed'&&decision.action==='accept'&&
         decision.kind==='AUTO_RIDE'&&enabled&&currentTrip.enabled&&
         <Action label={resuming?'Verificando viaje…':'Verificar y continuar mi viaje'}
          secondary disabled={resuming||actions.phase!=='ready'}
          onPress={()=>{void continueAcceptedAuto(decision);}}/>}
        {decision?.phase==='confirmed'&&decision.action==='accept'&&
         decision.kind==='DELIVERY'&&enabled&&custody.enabled&&<Action
          label={resuming?'Verificando entrega…':'Verificar asignación y abrir custodia'}
          secondary disabled={resuming||actions.phase!=='ready'}
          onPress={()=>{void continueAcceptedDelivery(decision);}}/>}
        {decision?.phase==='uncertain'&&enabled&&
         state.phase==='connected'&&<Action
          label="Consultar comprobante del servidor"
          secondary disabled={actions.busy}
          onPress={()=>{void reconcilePending(offer.offerId);}}/>}
        {offer.kind==='DELIVERY'&&<Action
         label={detail.phase==='loading'?'Consultando…':'Ver vehículo y paquete'}
         secondary disabled={!enabled||detail.phase==='loading'
          ||actions.busy||offer.expiresAtMs<=clock+3000}
         onPress={()=>{void inspectDelivery(offer.offerId,offer.serviceId);}}/>}
        {detail.phase==='unavailable'&&offer.kind==='DELIVERY'&&!preview&&
         <Text style={styles.text}>No se pudo verificar el paquete privado.
          Su aceptación permanece bloqueada.</Text>}
        {preview&&<Text style={styles.text}>
         Envío en {preview.vehicleKind} · {preview.category} · {preview.grams} g ·
         {preview.dimensionsCm.length} × {preview.dimensionsCm.width} ×
         {preview.dimensionsCm.height} cm. Solo QA; tarifa no confirmada en esta vista.
        </Text>}
        {allowed&&<>
         <Action label="Aceptar oferta de prueba" onPress={()=>{
          if(offer.kind==='AUTO_RIDE')void acceptVerifiedAutoOffer(offer.offerId);
          else void decide(offer.offerId,'accept');
         }}/>
         <Action label="Rechazar oferta de prueba" secondary onPress={()=>{
          void decide(offer.offerId,'decline');
         }}/>
        </>}
       </>;
      })()}
     </View>)
    }
   </>:<Text style={styles.text}>
    {state.phase==='not-configured'?
     'No hay proveedor de autenticación STAGING conectado. Las ofertas están bloqueadas.':
     state.phase==='loading'?'Verificando sesión y consultando el servidor…':
     state.phase==='offline'?'No se confirmó la conexión: las ofertas anteriores se ocultaron.':
     state.phase==='authorization-required'?'El backend requiere una cuenta Driver exclusiva y autorizada.':
     'Iniciá una sesión Driver autorizada en STAGING para consultar ofertas privadas.'}
   </Text>}
   <Action label="Consultar ofertas en STAGING" secondary
    disabled={state.phase==='not-configured'||state.phase==='loading'}
    onPress={()=>{void refresh();}}/>
  </Panel>
  {state.phase==='connected'&&actions.decisions.some(d=>
   !available.some(o=>o.offerId===d.offerId))&&<Panel>
   <Text style={styles.heading}>Decisiones anteriores de esta sesión</Text>
   <Text style={styles.small}>Aunque una oferta desaparezca del listado o venza, eso no confirma que su aceptación haya sido anulada. La consulta usa exclusivamente la clave original.</Text>
   {actions.decisions.filter(d=>!available.some(o=>o.offerId===d.offerId))
    .map(d=><View key={d.offerId} style={{gap:8}}>
     <Text style={styles.text}>
      {d.kind==='AUTO_RIDE'?'Viaje':'Envío'} ·
      {d.action==='accept'?' aceptación':' rechazo'} ·
      {d.phase==='confirmed'?' confirmado por servidor':
       d.phase==='uncertain'?' resultado aún incierto':
       d.phase==='sending'?' consultando':' bloqueado'}
     </Text>
     {d.phase==='confirmed'&&d.action==='accept'&&
      d.kind==='AUTO_RIDE'&&enabled&&currentTrip.enabled&&<Action
       label={resuming?'Verificando viaje…':'Verificar y continuar mi viaje'}
       secondary disabled={resuming||actions.phase!=='ready'}
       onPress={()=>{void continueAcceptedAuto(d);}}/>}
     {d.phase==='confirmed'&&d.action==='accept'&&
      d.kind==='DELIVERY'&&enabled&&custody.enabled&&<Action
       label={resuming?'Verificando entrega…':'Verificar asignación y abrir custodia'}
       secondary disabled={resuming||actions.phase!=='ready'}
       onPress={()=>{void continueAcceptedDelivery(d);}}/>}
     {d.phase==='uncertain'&&enabled&&<Action
      label="Consultar decisión original" secondary
      disabled={actions.busy}
      onPress={()=>{void reconcilePending(d.offerId);}}/>}
    </View>)}
  </Panel>}
  {resumeMessage!==''&&<Panel>
   <Text accessibilityRole="alert" style={styles.text}>{resumeMessage}</Text>
  </Panel>}

  <Panel>
   <Text style={styles.heading}>Recuperar mi viaje en curso</Text>
   <Text style={styles.small}>Si la app se cerró después de aceptar, consultá directamente al servidor el único viaje AUTO asignado a tu identidad Driver. No necesitamos una oferta antigua ni un identificador guardado en el teléfono.</Text>
   <Action label={resuming?'Verificando mi viaje…':'Verificar y continuar viaje activo'}
    secondary disabled={resuming||!currentTrip.enabled||state.phase!=='connected'}
    onPress={()=>{void continueOwnActiveAuto();}}/>
   <Text style={styles.small}>¿Cerraste la app durante una entrega? La recuperación del paquete verifica nuevamente la custodia original. No vuelve a aceptar una oferta.</Text>
   <Action label={resuming?'Verificando entrega…':'Recuperar entrega activa'}
    secondary disabled={resuming||!enabled||!custody.enabled||
     state.phase!=='connected'}
    onPress={()=>{void resumeAssignedDelivery();}}/>
   {currentTrip.state.phase==='offline'&&
    <Text accessibilityRole="alert" style={styles.small}>No se verificó el servidor; las acciones de viaje están bloqueadas.</Text>}
  </Panel>
  <Panel>
   <Text style={styles.heading}>Seguridad de las asignaciones</Text>
   <Text style={styles.text}>La revisión de licencia G20 se comprueba también al aceptar la oferta; las ofertas vencidas no pueden aceptarse y las motocicletas no están habilitadas para transportar pasajeros.</Text>
   <Text style={styles.small}>Esta aplicación Driver permanece separada de la aplicación Cliente y no contiene pagos ni solicitudes del pasajero.</Text>
  </Panel>
  <Action label="Volver al panel Driver" secondary onPress={()=>router.back()}/>
 </ScrollView>;
}

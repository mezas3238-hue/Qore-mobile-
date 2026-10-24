import React,{useEffect,useState} from 'react';
import {ScrollView,Text,View} from 'react-native';
import {Action,Panel,styles} from '../src/DriverUI';
import {useDriverWorkspace} from '../src/DriverWorkspaceProvider';
import {useDriverOfferActions} from '../src/DriverOfferActionsProvider';
import {router} from 'expo-router';

/**
 * Read-only private STAGING inbox; never present a synthetic dispatch as LIVE.
 * Backend G4/G10 still checks identity and KYC transactionally on acceptance.
 * No "accept" control is enabled without an explicitly approved staging auth.
 */
export default function DriverOffers(){
 const {state,refresh}=useDriverWorkspace();
 const {state:actions,enabled,decide,reconcilePending}=useDriverOfferActions();
 const [clock,setClock]=useState(()=>Date.now());
 useEffect(()=>{
  if(state.phase!=='connected')return;
  const interval=setInterval(()=>setClock(Date.now()),1000);
  return ()=>clearInterval(interval);
 },[state.phase]);
 const available=state.phase==='connected'?
  state.offers.filter(item=>item.expiresAtMs>clock+3000):[];
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
  <View style={styles.hero}>
   <Text style={styles.heroText}>Mis ofertas privadas</Text>
   <Text style={styles.heroSub}>Viajes AUTO y repartos ofrecidos exclusivamente a esta sesión Driver verificada en STAGING.</Text>
  </View>
  <Panel>
   <Text style={styles.heading}>Bandeja de ofertas — solo QA</Text>
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
       const allowed=enabled&&actions.phase==='ready'&&
        state.currentLicenseApproved&&actions.offers.some(x=>x.offerId===offer.offerId)&&
        !decision&&!actions.busy&&offer.expiresAtMs>clock+3000;
       return <>
        {decision&&<Text style={styles.text}>
         {decision.phase==='confirmed'?'Decisión confirmada por el servidor de pruebas.':
          decision.phase==='sending'?'Guardando la decisión en el servidor…':
          decision.phase==='uncertain'?'Resultado incierto: el servidor podría haber guardado la decisión. No volvemos a enviarla automáticamente. Actualizá el estado y consultá soporte.':
          'No se pudo verificar una clave segura para esta decisión.'}
        </Text>}
        {decision?.phase==='uncertain'&&enabled&&
         state.phase==='connected'&&<Action
          label="Consultar comprobante del servidor"
          secondary disabled={actions.busy}
          onPress={()=>{void reconcilePending(offer.offerId);}}/>}
        {allowed&&<>
         <Action label="Aceptar oferta de prueba" onPress={()=>{
          void decide(offer.offerId,'accept');
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
  <Panel>
   <Text style={styles.heading}>Seguridad de las asignaciones</Text>
   <Text style={styles.text}>La revisión de licencia G20 se comprueba también al aceptar la oferta; las ofertas vencidas no pueden aceptarse y las motocicletas no están habilitadas para transportar pasajeros.</Text>
   <Text style={styles.small}>Esta aplicación Driver permanece separada de la aplicación Cliente y no contiene pagos ni solicitudes del pasajero.</Text>
  </Panel>
  <Action label="Volver al panel Driver" secondary onPress={()=>router.back()}/>
 </ScrollView>;
}

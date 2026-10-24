import React,{useRef,useState} from 'react';
import {ScrollView,Text,View} from 'react-native';
import * as Crypto from 'expo-crypto';
import {Action,Panel,styles} from '../src/ClientUI';
import {useClientView} from '../src/ClientRuntime';
import {createSecureCancellationKey} from '../src/domain/secure-cancel-key.mjs';

export default function Fare(){
 const {client,view}=useClientView();
 const quote=view.authenticated?view.quote:null;
 const [message,setMessage]=useState('');
 const locked=useRef(false);
 const fare=view.fareRequest,tracking=view.tracking;
 const eligible=view.authenticated&&fare.contractReady&&tracking.subscriptionActive
  &&tracking.revision>=1&&['searching','assigned','arriving'].includes(tracking.state)
  &&Boolean(tracking.tripId);
 function prepare(){
  if(locked.current||!eligible||!tracking.tripId||fare.phase!=='idle')return;
  const created=createSecureCancellationKey(()=>Crypto.randomUUID());
  if(!created.ok||!created.requestKey){
   setMessage('Sin generador seguro del dispositivo. No se enviará solicitud.');
   return;
  }
  const result=client.prepareServerFare({tripId:tracking.tripId,requestKey:created.requestKey});
  setMessage(result.ok?'Solicitud preparada. No significa reserva, cobro ni conductor asignado.':
   'Se necesita un viaje propio registrado y confirmado por el servidor.');
 }
 async function send(retry:boolean){
  if(locked.current||!eligible)return;
  if(retry?fare.phase!=='retryable':fare.phase!=='ready')return;
  locked.current=true;
  const previousKey=fare.requestKey,previousOwner=view.account?.subject;
  try{
   const result=retry?await client.retryServerFare():await client.submitServerFare();
   const updated=client.snapshot();
   if(updated.account?.subject!==previousOwner||updated.fareRequest.requestKey!==previousKey)return;
   if(result.ok)setMessage('Cotización recibida y validada. No se efectuó ningún pago.');
   else if(['NETWORK_OR_TIMEOUT','SERVICE_UNAVAILABLE','RATE_LIMITED'].includes(result.code??''))
    setMessage('No se confirmó respuesta. Reintentá la MISMA solicitud para evitar duplicados.');
   else setMessage('El servidor no confirmó una tarifa. No se calcula ningún importe local.');
  }finally{locked.current=false;}
 }
 return <ScrollView style={styles.page} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic"
  keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
  <View style={styles.hero}><Text accessibilityRole="header" style={styles.heroText}>Tarifa en guaraníes</Text>
   <Text style={styles.heroSub}>Solo tarifas verificadas por el servidor. Nunca estimaciones inventadas.</Text></View>
  {quote?<Panel>
   <Text accessibilityRole="header" style={styles.heading}>{quote.formattedAmount}</Text>
   <Text style={styles.text}>Modalidad: {quote.fareMode}</Text>
   <Text style={styles.text}>Regla tarifaria: {quote.fareVersion}</Text>
   <Text style={styles.small}>Válida hasta: {new Date(quote.expiresAt).toLocaleString('es-PY')}</Text>
   <Text style={styles.small}>Información sin compromiso comercial, pago ni conductor reservado.</Text>
  </Panel>:<Panel>
   <Text accessibilityRole="header" style={styles.heading}>Todavía no hay tarifa vigente</Text>
   <Text style={styles.text}>La cotización debe pertenecer a esta cuenta y estar respaldada por ruteo y regla vigentes del servidor.</Text>
  </Panel>}
  <Panel>
   <Text accessibilityRole="header" style={styles.heading}>Consultar tarifa del servidor</Text>
   <Text style={styles.small}>Se necesita un viaje identificado previamente por el backend. Esta consulta no despacha conductores ni realiza cobros.</Text>
   {!fare.contractReady&&<Text style={styles.small}>Función desactivada hasta certificar Auth, RLS y servicio STAGING.</Text>}
   {eligible&&fare.phase==='idle'&&<Action label="Preparar consulta segura" onPress={prepare}/>}
   {eligible&&fare.phase==='ready'&&<Action label="Consultar tarifa" onPress={()=>{void send(false);}}/>}
   {eligible&&fare.phase==='retryable'&&<Action label="Reintentar misma consulta" onPress={()=>{void send(true);}}/>}
   {fare.phase==='in_flight'&&<Text accessibilityLiveRegion="polite" style={styles.small}>Consultando tarifa…</Text>}
   {fare.phase==='failed'&&<Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.small}>No se verificó el precio. Primero actualizá el estado del viaje; no hagas una solicitud duplicada.</Text>}
   {message!==''&&<Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.text}>{message}</Text>}
  </Panel>
 </ScrollView>;
}

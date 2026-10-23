import React,{useEffect,useRef,useState} from 'react';
import {ScrollView,Text,TextInput,View} from 'react-native';
import * as Crypto from 'expo-crypto';
import {useLocalSearchParams} from 'expo-router';
import {Action,Panel,styles} from '../src/ClientUI';
import {useClientView} from '../src/ClientRuntime';
import type {ClientExperience,ClientSnapshot} from '../src/domain/client-experience.mjs';
import {passengerChatPrivateViewKey} from '../src/domain/passenger-chat-navigation.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Service='RIDE'|'DELIVERY'|'MERCHANT_ORDER';
function supported(x:unknown):x is Service{
 return x==='RIDE'||x==='DELIVERY'||x==='MERCHANT_ORDER';
}
export default function PassengerChatScreen(){
 const {client,view}=useClientView();
 const params=useLocalSearchParams<{serviceId?:string;
  serviceKind?:string;conversationId?:string}>();
 const serviceId=typeof params.serviceId==='string'&&UUID.test(params.serviceId)
  ?params.serviceId:null;
 const serviceKind=supported(params.serviceKind)?params.serviceKind:null;
 const conversationId=typeof params.conversationId==='string'
  &&UUID.test(params.conversationId)?params.conversationId:null;
 // Si llega una referencia de hilo manipulada, la ruta no puede abrir
 // un hilo no fijado: fallar cerrado en vez de ignorar el parámetro.
 const invalidThread=params.conversationId!==undefined&&conversationId===null;
 return <PrivateChat key={passengerChatPrivateViewKey({
  sessionRevision:view.privateViewRevision,serviceId,serviceKind,
  conversationId:invalidThread?'INVALID_THREAD':conversationId
 })} client={client} view={view} invalidThread={invalidThread}
  serviceId={serviceId} serviceKind={serviceKind}
  conversationId={conversationId}/>;
}
function PrivateChat({client,view,serviceId,serviceKind,
 conversationId,invalidThread}:{
 client:ClientExperience;view:ClientSnapshot;
 serviceId:string|null;serviceKind:Service|null;
 conversationId:string|null;invalidThread:boolean;
}){
 const [draft,setDraft]=useState('');
 const [feedback,setFeedback]=useState('');
 const busy=useRef(false);
 const chat=view.chat;
 const matching=!invalidThread&&chat.serviceId===serviceId
  &&chat.serviceKind===serviceKind
  &&(conversationId===null||chat.conversationId===conversationId);
 const open=async(older=false)=>{
  if(!serviceId||!serviceKind||invalidThread||busy.current
   ||chat.loading||chat.sending)return;
  busy.current=true;setFeedback('');
  try{
   const result=await client.openChat({serviceId,serviceKind,older,
    expectedConversationId:conversationId});
   if(!result.ok)setFeedback(result.code==='INVALID_CHAT_PAGE'
    ?'La conversación cambió o fue reasignada. Volvé a Mis conversaciones y actualizá la bandeja.'
    :'No se pudo verificar la conversación. Es posible que la asignación haya terminado o tu sesión haya cambiado.');
  }finally{busy.current=false;}
 };
 const send=async(retry=false)=>{
  if(busy.current||!serviceId||!matching||!chat.active||chat.loading||chat.sending)return;
  busy.current=true;setFeedback('');
  try{
   let result;
   if(retry)result=await client.retryChat();
   else{
    const body=draft.trim();
    if(!body||body.length>500){setFeedback('Escribí un mensaje entre 1 y 500 caracteres.');return;}
    let requestKey:string;
    try{requestKey=Crypto.randomUUID();}
    catch{
     setFeedback('No se pudo generar una clave segura. No enviamos el mensaje.');
     return;
    }
    result=await client.sendChat({body,requestKey});
   }
   if(result.ok){
    setDraft('');setFeedback('Mensaje almacenado por el servidor. No confirma que el destinatario lo haya leído.');
   }else if(['CHAT_NETWORK_OR_TIMEOUT','RATE_LIMITED','SERVICE_UNAVAILABLE',
      'PENDING_MESSAGE_RECONCILIATION','CHAT_AUTHORIZATION_EXPIRED'].includes(result.code??'')){
    setFeedback('La respuesta es incierta. No se generará otra clave para este mensaje. Reintentá la misma solicitud.');
   }else if(result.code==='INVALID_MESSAGE')
    setFeedback('Mensaje no permitido: evitá números telefónicos, correos, enlaces y caracteres de control.');
   else setFeedback('No se confirmó el mensaje. Verificá la asignación y el estado de tu sesión.');
  }finally{busy.current=false;}
 };
 useEffect(()=>{setDraft('');setFeedback('');},[serviceId,serviceKind]);
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}
  contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
  <View style={styles.hero}>
   <Text accessibilityRole="header" style={styles.heroText}>Mensajes del servicio</Text>
   <Text style={styles.heroSub}>Comunicación privada con el conductor o repartidor asignado.</Text>
  </View>
  <Panel>
   <Text accessibilityRole="header" style={styles.heading}>Chat dentro de Movete Fácil</Text>
   <Text style={styles.small}>No necesitás compartir tu teléfono. Los mensajes pertenecen al viaje, envío o pedido correspondiente y no sustituyen la ayuda de emergencia.</Text>
   {!view.authenticated&&<Text accessibilityRole="alert" style={styles.text}>Iniciá sesión para utilizar mensajes privados.</Text>}
   {invalidThread&&<Text accessibilityRole="alert" style={styles.text}>
    Referencia de conversación inválida. Volvé a Mis conversaciones.
   </Text>}
   {view.authenticated&&(!serviceId||!serviceKind)&&
    <Text style={styles.text}>Abrí esta pantalla desde un viaje, envío o pedido con repartidor efectivamente asignado. No se pueden buscar conductores por nombre o número.</Text>}
   {view.authenticated&&!invalidThread&&serviceId&&serviceKind&&!chat.contractReady&&
    <Text accessibilityRole="alert" style={styles.text}>Chat en preparación. Faltan el servicio de mensajería, la autorización de asignaciones y la recepción en Driver certificados por el backend.</Text>}
   {view.authenticated&&!invalidThread&&serviceId&&serviceKind&&chat.contractReady&&<>
    <Text style={styles.text}>Servicio: {serviceKind==='RIDE'?'Viaje en automóvil':
      serviceKind==='DELIVERY'?'Envío particular':'Entrega de comercio'}</Text>
    <Action label={chat.loading?'Verificando conversación…':matching&&chat.active?'Actualizar mensajes':'Abrir conversación autorizada'}
     disabled={chat.loading||chat.sending||Boolean(chat.pendingSend)}
     busy={chat.loading} onPress={()=>void open()}/>
    {matching&&chat.active&&<>
     <Text accessibilityRole="header" style={styles.heading}>Conversación</Text>
     {chat.messages.length===0?<Text style={styles.small}>No hay mensajes en esta página.</Text>:
      chat.messages.map(item=><View key={item.messageId} style={styles.card}>
       <Text style={styles.small}>{item.senderRole==='passenger'?'Vos':'Conductor / repartidor'}</Text>
       <Text style={styles.text}>{item.body}</Text>
      </View>)}
     <Action secondary label="Cargar mensajes anteriores" disabled={!chat.hasOlder||chat.loading||chat.sending||chat.pendingSend}
      onPress={()=>void open(true)}/>
     <Text style={styles.small}>Mostrando {chat.messages.length} mensajes recientes de la ventana local; se consultaron {chat.window.rowsRead} en esta sesión de visualización. No hay un límite global de mensajes en el servidor.</Text>
     {chat.window.hasEvictedNewer&&<Text style={styles.small}>
      Se liberaron {chat.window.evictedCount} mensajes vistos para cuidar la memoria del dispositivo. Usá «Actualizar mensajes» para volver a los más recientes.
     </Text>}
     <Text style={styles.small}>La lectura del destinatario no se presume.</Text>
     <TextInput multiline style={styles.field} value={draft} maxLength={500}
      onChangeText={setDraft} editable={!chat.sending&&!chat.pendingSend}
      placeholder="Escribí al conductor o repartidor asignado"
      accessibilityLabel="Mensaje de texto para el conductor o repartidor"/>
     <Action label={chat.sending?'Enviando…':'Enviar mensaje'}
      disabled={chat.sending||chat.loading||chat.pendingSend}
      busy={chat.sending} onPress={()=>void send()}/>
     {chat.pendingSend&&<Action secondary label="Reintentar el mismo mensaje"
      busy={chat.sending} disabled={chat.sending||chat.loading}
      onPress={()=>void send(true)}/>}
    </>}
    {matching&&chat.error&&<Text accessibilityRole="alert" style={styles.text}>
     No se pudo validar el estado de la conversación. Ningún mensaje se considera entregado sin confirmación.</Text>}
   </>}
   {feedback!==''&&<Text accessibilityRole="alert" accessibilityLiveRegion="assertive"
    style={styles.text}>{feedback}</Text>}
  </Panel>
 </ScrollView>;
}

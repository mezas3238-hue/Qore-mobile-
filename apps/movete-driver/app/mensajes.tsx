import React,{useEffect,useState} from 'react';
import {ScrollView,Text,TextInput,View} from 'react-native';
import {router} from 'expo-router';
import {Action,Panel,styles,palette} from '../src/DriverUI';
import {useDriverMessages} from '../src/DriverMessagesProvider';

/** G60A — private Driver UI; all actions are disabled without trusted QA adapters.
 * No fake chat, no browser bearer, no automatic read receipts, no autopilot SEND.
 */
const serviceTitle=(kind:string)=>kind==='RIDE'?'Viaje en automóvil':
 kind==='DELIVERY'?'Envío particular':'Entrega de comercio';
const explanation:Record<string,string>={
 'not-configured':'Aún no existe una conexión segura de mensajería para esta aplicación. Nadie puede enviar ni recibir mensajes desde esta pantalla.',
 'signed-out':'Iniciá sesión como Driver autorizado para consultar tus conversaciones.',
 'authorization-required':'Tu cuenta no tiene autorización Driver vigente para consultar mensajes.',
 'ready':'La sesión Driver está lista para verificar la bandeja.',
 'loading':'Comprobando conversaciones y asignaciones en el servidor…',
 'offline':'No se pudo comprobar la conexión o la asignación. Se ocultaron los mensajes privados.',
 'sending':'Validando que el vehículo esté detenido y guardando el mensaje…',
 'uncertain':'El servidor podría haber guardado el mensaje, pero no tenemos confirmación. No lo reenvíes.',
 'connected':'Solo se muestran mensajes de la asignación vigente.'
};
export default function DriverMessages(){
 const {state,configured,refreshInbox,loadMoreInbox,open,loadOlder,
  backToInbox,sendMessage,reconcilePending,confirmVisible,
  refreshConversation}=useDriverMessages();
 const [draft,setDraft]=useState('');
 const [opened,setOpened]=useState<string|null>(null);
 useEffect(()=>{
  if(state.conversation?.conversationId!==opened){
   setOpened(state.conversation?.conversationId??null);setDraft('');
  }
 },[state.conversation?.conversationId,opened]);
 useEffect(()=>{if(state.sendState==='confirmed')setDraft('');},[state.sendState]);
 const room=state.conversation;
 const inRoom=room!==null;
 const canSend=state.phase==='connected'&&state.canCompose&&
   draft.trim()===draft&&draft.length>0&&draft.length<=500;
 const busy=state.phase==='loading'||state.phase==='sending';
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}
  keyboardShouldPersistTaps="handled">
  <View style={styles.hero}>
   <Text style={styles.heroText}>Mensajes privados</Text>
   <Text style={styles.heroSub}>Comunicación exclusiva entre el conductor o repartidor asignado y su cliente, con comprobantes del servidor.</Text>
  </View>
  <Panel>
   <Text style={styles.heading}>Estado de la mensajería</Text>
   <Text style={styles.text}>{state.phase==='inbox'?
    'Conversaciones privadas verificadas para esta sesión Driver':
    explanation[state.phase]??'Sin confirmación de mensajería'}</Text>
   <Text style={styles.small}>La plataforma aún no está habilitada para operación comercial. Una conexión QA no equivale a mensajes en dispositivos reales.</Text>
   {!inRoom&&<Action label="Actualizar mi bandeja" secondary
    disabled={!configured||busy||state.phase==='not-configured'}
    onPress={()=>{void refreshInbox();}}/>}
  </Panel>
  {!inRoom&&state.phase==='inbox'&&<Panel>
   <Text style={styles.heading}>Mis conversaciones</Text>
   {state.conversations.length===0?
    <Text style={styles.text}>No hay conversaciones asignadas a esta identidad.</Text>:
    state.conversations.map(item=><View key={item.conversationId}
     style={{gap:9,borderBottomWidth:1,borderColor:palette.border,paddingBottom:14}}>
     <Text style={styles.heading}>{serviceTitle(item.serviceKind)}</Text>
     <Text style={styles.text}>{item.unreadCount} mensajes pendientes de lectura</Text>
     <Text style={styles.small}>Asignación vigente verificada por el servidor · revisión {item.revision}</Text>
     <Action label="Abrir conversación" secondary
      onPress={()=>{void open(item.conversationId);}}/>
    </View>)}
   {state.hasMore&&<Action label="Cargar más conversaciones" secondary
    onPress={()=>{void loadMoreInbox();}}/>}
  </Panel>}
  {inRoom&&<Panel>
   <Text style={styles.heading}>{serviceTitle(room.serviceKind)}</Text>
   <Text style={styles.small}>Historial privado · revisión de servidor {state.latestRevision||'por verificar'}</Text>
   {state.hasOlder&&state.phase==='connected'&&
    <Action label="Ver mensajes anteriores" secondary
     onPress={()=>{void loadOlder();}}/>}
   {state.messages.length===0?
    <Text style={styles.text}>Los mensajes se mostrarán después de comprobar historial y asignación.</Text>:
    [...state.messages].reverse().map(msg=><View key={msg.messageId}
     style={{borderRadius:12,padding:12,
      backgroundColor:msg.senderRole==='driver'?'#E2F2EF':'#F4F5F8',gap:6}}>
     <Text style={{fontSize:12,fontWeight:'800',color:palette.ink}}>
      {msg.senderRole==='driver'?'Vos':'Cliente'}
     </Text>
     <Text style={styles.text}>{msg.body}</Text>
     <Text style={styles.small}>{new Date(msg.createdAt).toLocaleTimeString('es-PY',{
      hour:'2-digit',minute:'2-digit'})} · confirmado en historial</Text>
     {state.readConfirmedIds.includes(msg.messageId)&&
      <Text style={styles.small}>Lectura confirmada por el servidor</Text>}
     {msg.canConfirmRead&&state.phase==='connected'&&
      <Action label="Confirmar que vi este mensaje" secondary
       onPress={()=>{void confirmVisible(msg.messageId);}}/>}
    </View>)}
   <Action label="Volver a las conversaciones" secondary
    onPress={()=>backToInbox()}/>
  </Panel>}
  {inRoom&&<Panel>
   <Text style={styles.heading}>Escribir al cliente</Text>
   <Text style={styles.small}>Para enviar, el servidor debe confirmar que el vehículo está detenido y que la asignación sigue vigente. No compartas teléfonos, enlaces ni datos personales.</Text>
   <TextInput style={[styles.field,{minHeight:88,textAlignVertical:'top'}]}
    multiline maxLength={500} value={draft} onChangeText={setDraft}
    editable={state.phase==='connected'&&state.canCompose}
    placeholder="Escribí un mensaje breve"
    accessibilityLabel="Mensaje privado al cliente"/>
   <Action label={busy?'Verificando…':'Enviar mensaje'} disabled={!canSend||busy}
    onPress={()=>{void sendMessage(draft);}}/>
   {state.sendState==='confirmed'&&<Text style={styles.text}>
    Mensaje guardado y confirmado por el servidor. Esto no confirma que haya sido leído.
   </Text>}
   {state.sendState==='blocked'&&<Text style={styles.text}>
    Envío bloqueado. No se verificó que sea seguro escribir con el vehículo detenido.
   </Text>}
   {state.phase==='uncertain'&&<>
    <Text style={styles.text}>Resultado incierto. Conservamos la clave original y el texto para buscar el comprobante, sin reenviar automáticamente.</Text>
    <Action label="Consultar resultado del envío" secondary
     onPress={()=>{void reconcilePending();}}/>
   </>}
   {state.phase==='connected'&&<Action label="Actualizar conversación" secondary
    onPress={()=>{void refreshConversation();}}/>}
  </Panel>}
  <Panel>
   <Text style={styles.heading}>Protección durante los viajes</Text>
   <Text style={styles.text}>No escribas ni manipules el teléfono mientras conducís. Una reasignación o cambio de cuenta retira el historial anterior. Los avisos push no deben incluir contenido privado.</Text>
   <Text style={styles.small}>La lectura no se confirma al abrir un chat: solo después de una acción explícita y comprobación en SQL.</Text>
  </Panel>
  <Action label="Volver al panel Driver" secondary onPress={()=>router.back()}/>
 </ScrollView>;
}

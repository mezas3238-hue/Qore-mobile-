import React,{useMemo,useRef,useState} from 'react';
import {ScrollView,Text,TextInput,View} from 'react-native';
import * as Crypto from 'expo-crypto';
import {Action,Panel,styles} from '../src/DriverUI';
import {useNativeDriverAuth} from '../src/DriverApplicationProviders';
import {createG198DriverLostItemsHttp} from '../src/domain/g198-driver-lost-items-http.mjs';
const yes=(x:string|undefined)=>x==='true';
type CaseRow={caseId:string;tripId:string;state:string;expiresAtMs:number};
type Msg={messageId:string;senderRole:'passenger'|'driver';body:string;createdAtMs:number};
export default function DriverLostObjects(){
 const auth=useNativeDriverAuth();
 const [cases,setCases]=useState<CaseRow[]>([]);
 const [current,setCurrent]=useState<string|null>(null);
 const [messages,setMessages]=useState<Msg[]>([]);
 const [canSend,setCanSend]=useState(false);
 const [uncertainSend,setUncertainSend]=useState(false);
 const [body,setBody]=useState('');
 const [feedback,setFeedback]=useState('');
 const [busy,setBusy]=useState(false);
 const lock=useRef(false);
 const api=useMemo(()=>createG198DriverLostItemsHttp({
  enabled:yes(process.env.EXPO_PUBLIC_G198_DRIVER_OWNER_APPROVED),
  ownerApproved:yes(process.env.EXPO_PUBLIC_G198_DRIVER_OWNER_APPROVED),
  postTripCertified:yes(process.env.EXPO_PUBLIC_G198_DRIVER_ORIGINAL_SQL_VERIFIED),
  verifiedStoppedProvider:yes(process.env.EXPO_PUBLIC_G198_DRIVER_MOTION_VERIFIED),
  origin:process.env.EXPO_PUBLIC_QORE_STAGING_API_ORIGIN,
  // A separately reviewed owner pin: using the same dynamic API origin as
  // its own pin would not independently attest the destination host.
  pinnedOrigin:process.env.EXPO_PUBLIC_QORE_STAGING_PINNED_ORIGIN,
  getSession:()=>auth?.getSession()??null
 }),[auth]);
 async function reload(){
  if(lock.current||!api.isConfigured())return;
  lock.current=true;setBusy(true);setFeedback('');
  try{
   const res=await api.inbox();
   if(!res.ok||!res.data?.cases){setCases([]);setCurrent(null);
    setFeedback('No se pudo confirmar tu bandeja privada de objetos olvidados.');return;}
   setCases(res.data.cases);
   if(current&&!res.data.cases.some(c=>c.caseId===current)){
    setCurrent(null);setMessages([]);setCanSend(false);
   }
  }finally{lock.current=false;setBusy(false);}
 }
 async function open(caseId:string){
  if(lock.current||!api.isConfigured()||!cases.some(c=>c.caseId===caseId))return;
  lock.current=true;setBusy(true);setFeedback('');
  try{
   const res=await api.read(caseId);
   if(!res.ok||!res.data?.messages){setFeedback('Caso no autorizado o expirado.');return;}
   setCurrent(caseId);setMessages(res.data.messages);
   setCanSend(res.data.canSend===true);setBody('');
  }finally{lock.current=false;setBusy(false);}
 }
 async function send(){
  if(lock.current||!api.isConfigured()||!current||!canSend||uncertainSend)return;
  const message=body.trim();
  if(message.length<1||message.length>500)return;
  lock.current=true;setBusy(true);
  try{
   const res=await api.send(current,Crypto.randomUUID(),message);
   if(!res.ok){
    setUncertainSend(true);
    setFeedback('Envío no verificado. No reenvíes el mensaje: consultá el historial original y soporte.');
    return;
   }
   setBody('');
   setFeedback('Mensaje de respuesta guardado. Actualizá para comprobarlo.');
  }finally{lock.current=false;setBusy(false);}
 }
 async function closeCase(block:boolean){
  if(lock.current||!api.isConfigured()||!current||!canSend||uncertainSend)return;
  lock.current=true;setBusy(true);setFeedback('');
  try{
   const result=await api.close(current,block);
   if(!result.ok||result.data?.state!==(block?'BLOCKED':'CLOSED')){
    setUncertainSend(true);setCanSend(false);
    setFeedback('Cierre con resultado desconocido. No repetir la solicitud; consultar soporte.');
    return;
   }
   setCases(previous=>previous.filter(x=>x.caseId!==current));
   setCurrent(null);setMessages([]);setBody('');setCanSend(false);
   setFeedback(block?'Contacto bloqueado y confirmado por PostgreSQL.':
    'Expediente cerrado y confirmado por PostgreSQL.');
  }finally{lock.current=false;setBusy(false);}
 }
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}
  keyboardShouldPersistTaps="handled">
  <View style={styles.hero}>
   <Text accessibilityRole="header" style={styles.heroText}>Objetos olvidados</Text>
   <Text style={styles.heroSub}>Respondé a pasajeros de viajes terminados, con conversación interna y sin compartir datos personales.</Text>
  </View>
  <Panel>
   <Text style={styles.heading}>Solicitudes asociadas a tus viajes</Text>
   <Text style={styles.small}>Solo los casos asignados a tu identidad Driver y a un viaje finalizado aparecen aquí. La mensajería se cierra a los siete días o antes si se bloquea.</Text>
   <Action label="Consultar solicitudes" secondary
    disabled={!api.isConfigured()||busy} onPress={()=>{void reload();}}/>
   {!api.isConfigured()&&<Text accessibilityRole="alert" style={styles.small}>
    Se necesita el contrato HTTPS G198, IdP Driver, PostgreSQL y una fuente independiente que certifique que el vehículo está detenido. No se habilitan respuestas de prueba sin esos requisitos.
   </Text>}
   {cases.map(row=><View key={row.caseId} style={{gap:8}}>
    <Text style={styles.text}>Viaje: {row.tripId.slice(0,8)} · {row.state}</Text>
    <Action secondary label="Abrir solicitud de recuperación"
     disabled={busy} onPress={()=>{void open(row.caseId);}}/>
   </View>)}
  </Panel>
  {current&&<Panel>
   <Text style={styles.heading}>Conversación del viaje original</Text>
   {messages.map(m=><View key={m.messageId}>
    <Text style={styles.small}>{m.senderRole==='driver'?'Vos':'Pasajero'}</Text>
    <Text style={styles.text}>{m.body}</Text>
   </View>)}
   <TextInput multiline maxLength={500} value={body}
    onChangeText={setBody} style={[styles.field,{minHeight:80,textAlignVertical:'top'}]}
    editable={canSend&&!busy&&!uncertainSend}
    placeholder="Respondé sobre el objeto, sin teléfonos ni enlaces"
    accessibilityLabel="Respuesta privada al pasajero por objeto olvidado"/>
   <Action label="Responder al pasajero" disabled={!canSend||busy||uncertainSend||!body.trim()}
    onPress={()=>{void send();}}/>
   {canSend&&!uncertainSend&&<Action secondary
    label="Cerrar expediente: pertenencia recuperada"
    disabled={busy} onPress={()=>{void closeCase(false);}}/>}
   {canSend&&!uncertainSend&&<Action secondary
    label="Bloquear contacto de este expediente"
    disabled={busy} onPress={()=>{void closeCase(true);}}/>}
   <Action label="Actualizar este caso" secondary disabled={busy}
    onPress={()=>{void open(current);}}/>
   <Text style={styles.small}>No manipules el teléfono mientras conducís. El servidor debe verificar que estás detenido antes de permitir respuestas.</Text>
  </Panel>}
  {feedback!==''&&<Panel><Text accessibilityLiveRegion="polite" style={styles.text}>{feedback}</Text></Panel>}
 </ScrollView>;
}

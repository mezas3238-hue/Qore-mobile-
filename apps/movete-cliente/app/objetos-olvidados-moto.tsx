import React,{useEffect,useMemo,useRef,useState} from 'react';
import {ScrollView,Text,TextInput,View} from 'react-native';
import {useLocalSearchParams} from 'expo-router';
import * as Crypto from 'expo-crypto';
import {Action,Panel,styles} from '../src/ClientUI';
import {useClientView,useNativePassengerAuth} from '../src/ClientRuntime';
import {createG200PassengerMotoLostItemsHttp} from '../src/domain/g200-moto-lost-items-http.mjs';

const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const yes=(x:string|undefined)=>x==='true';
export default function LostItems(){
 const {client,view}=useClientView();
 return <PrivateLostItems key={view.privateViewRevision} client={client}
  subject={view.account?.subject??null} privacy={view.privateViewRevision}/>;
}
function PrivateLostItems({client,subject,privacy}:{
 client:ReturnType<typeof useClientView>['client'];
 subject:string|null;privacy:number;
}){
 const {tripId:rawId}=useLocalSearchParams<{tripId?:string}>();
 const tripId=typeof rawId==='string'&&UUID.test(rawId)?rawId.toLowerCase():null;
 const auth=useNativePassengerAuth();
 const [caseId,setCaseId]=useState<string|null>(null);
 const [messages,setMessages]=useState<Array<{messageId:string;senderRole:'passenger'|'driver';body:string;createdAtMs:number}>>([]);
 const [canSend,setCanSend]=useState(false);
 const [uncertainSend,setUncertainSend]=useState(false);
 const [draft,setDraft]=useState('');
 const [notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false);
 const lock=useRef(false);
 const attempted=useRef(false);
 const gateway=useMemo(()=>createG200PassengerMotoLostItemsHttp({
  enabled:yes(process.env.EXPO_PUBLIC_G200_MOTO_OWNER_APPROVED),
  ownerApproved:yes(process.env.EXPO_PUBLIC_G200_MOTO_OWNER_APPROVED),
  providerVerified:yes(process.env.EXPO_PUBLIC_G200_MOTO_IDENTITY_VERIFIED),
  g200PostgresVerified:yes(process.env.EXPO_PUBLIC_G200_MOTO_ORIGINAL_SQL_VERIFIED),
  origin:process.env.EXPO_PUBLIC_F1_STAGING_ORIGIN,
  pinnedOrigin:process.env.EXPO_PUBLIC_F1_STAGING_PINNED_ORIGIN,
  getSession:async()=>{
   const s=await auth?.readSession();
   return s?{...s,privateViewRevision:client.snapshot().privateViewRevision}:null;
  }
 }),[auth,client]);
 useEffect(()=>{setCaseId(null);setMessages([]);setNotice('');setDraft('');
  attempted.current=false;setUncertainSend(false);},[tripId]);
 const owned=Boolean(tripId&&subject&&client.snapshot().authenticated
  &&client.snapshot().account?.subject===subject
  &&client.snapshot().privateViewRevision===privacy
  &&client.snapshot().motoPassenger?.tripId===tripId
  &&client.snapshot().motoRideStatus?.readReady===true
  &&client.snapshot().motoRideStatus?.tripId===tripId
  &&client.snapshot().motoRideStatus?.state==='completed');
 const configured=owned&&gateway.isConfigured();
 const scope={tripId:tripId??'',expectedSubject:subject??'',
  expectedPrivateViewRevision:privacy};
 async function open(){
  if(lock.current||!configured||attempted.current)return;
  attempted.current=true;lock.current=true;setBusy(true);setNotice('');
  try{
   const r=await gateway.open(scope);
   if(!r.ok||!r.data?.caseId){
    setNotice('No se confirmó el expediente de objetos olvidados. No se abrirá automáticamente otra solicitud.');
    return;
   }
   if(!owned)return;
   setCaseId(r.data.caseId);
   setNotice('Expediente privado vinculado al viaje original. El motociclista no recibe tu número.');
  }finally{lock.current=false;setBusy(false);}
 }
 async function read(){
  if(lock.current||!configured||!caseId)return;
  lock.current=true;setBusy(true);setNotice('');
  try{
   const r=await gateway.read({...scope,caseId});
   if(!r.ok||!r.data?.messages){
    setNotice('No se pudo verificar la conversación del viaje original.');
    return;
   }
   if(!owned)return;
   setMessages(r.data.messages);
   setCanSend(r.data.canSend===true);
   setNotice('Mensajes originales comprobados en el servidor. No se presume que fueron leídos.');
  }finally{lock.current=false;setBusy(false);}
 }
 async function send(){
  if(lock.current||!configured||!caseId||!canSend||uncertainSend)return;
  const body=draft.trim();
  if(!body||body.length>500)return;
  lock.current=true;setBusy(true);setNotice('');
  try{
   const r=await gateway.send({...scope,caseId,requestKey:Crypto.randomUUID(),body});
   if(!r.ok){
    setUncertainSend(true);
    setNotice('Resultado de mensaje incierto. No se generará automáticamente otra clave ni se repetirá el POST.');
    return;
   }
   if(!owned)return;
   setDraft('');
   setNotice('Mensaje registrado. Actualizá la conversación para ver la respuesta del conductor.');
  }finally{lock.current=false;setBusy(false);}
 }
 async function closeCase(block:boolean){
  if(lock.current||!configured||!caseId||!canSend||uncertainSend)return;
  lock.current=true;setBusy(true);setNotice('');
  try{
   const result=await gateway.close({...scope,caseId,block});
   if(!result.ok||result.data?.state!==(block?'BLOCKED':'CLOSED')){
    setUncertainSend(true);setCanSend(false);
    setNotice('No se pudo confirmar el cierre. No repetiremos la solicitud; contactá a soporte.');
    return;
   }
   if(!owned)return;
   setCanSend(false);setDraft('');setUncertainSend(true);
   setNotice(block?'Contacto bloqueado y registrado en el expediente original.':
    'Expediente cerrado y registrado en el viaje original.');
  }finally{lock.current=false;setBusy(false);}
 }
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}
  contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled"
  keyboardDismissMode="on-drag">
  <View style={styles.hero}>
   <Text accessibilityRole="header" style={styles.heroText}>¿Olvidaste algo en la moto?</Text>
   <Text style={styles.heroSub}>Podés contactar al motociclista asignado a ese viaje sin compartir tu número de teléfono.</Text>
  </View>
  <Panel>
   <Text accessibilityRole="header" style={styles.heading}>Recuperación de pertenencias</Text>
   <Text style={styles.text}>El contacto se habilita solo después de un viaje completado y verificado. El expediente vence a los siete días, se puede bloquear y está limitado para prevenir acoso o fraude.</Text>
   <Text style={styles.small}>No compartas teléfonos, enlaces, códigos ni direcciones particulares. Ante una disputa, utilizá soporte.</Text>
   <Text style={styles.small}>Viaje original: {tripId??'No seleccionado desde tu historial'}</Text>
   {!owned&&<Text accessibilityRole="alert" style={styles.small}>Primero verificá el estado «Viaje finalizado» de tu MOTO en el servidor para solicitar contacto. No se aceptan identificadores ajenos.</Text>}
   {!gateway.isConfigured()&&<Text accessibilityRole="alert" style={styles.small}>El contacto posterior al viaje requiere el servidor HTTPS, la identidad y el contrato PostgreSQL certificados. Esta compilación no habilita mensajes reales.</Text>}
   {!caseId&&<Action label={busy?'Verificando…':'Solicitar contacto con mi conductor'}
    disabled={!configured||busy||attempted.current}
    onPress={()=>{void open();}}/>}
   {caseId&&<Action label={busy?'Consultando…':'Actualizar mensajes del expediente'}
    secondary disabled={!configured||busy}
    onPress={()=>{void read();}}/>}
   {notice!==''&&<Text accessibilityLiveRegion="polite" style={styles.text}>{notice}</Text>}
  </Panel>
  {caseId&&<Panel>
   <Text accessibilityRole="header" style={styles.heading}>Conversación de objetos olvidados</Text>
   {messages.map(m=><View key={m.messageId}>
    <Text style={styles.small}>{m.senderRole==='passenger'?'Vos':'Conductor'}</Text>
    <Text style={styles.text}>{m.body}</Text>
   </View>)}
   <TextInput style={[styles.field,{minHeight:80,textAlignVertical:'top'}]}
    multiline maxLength={500} value={draft} editable={canSend&&!busy&&!uncertainSend}
    onChangeText={setDraft} placeholder="Describí brevemente el objeto olvidado"
    accessibilityLabel="Mensaje privado al motociclista sobre objeto perdido"/>
   <Action label="Enviar mensaje al motociclista" disabled={!canSend||busy||uncertainSend||!draft.trim()}
    onPress={()=>{void send();}}/>
   {canSend&&!uncertainSend&&<Action label="Cerrar expediente: objeto recuperado"
    secondary disabled={busy} onPress={()=>{void closeCase(false);}}/>}
   {canSend&&!uncertainSend&&<Action label="Bloquear contacto de este expediente"
    secondary disabled={busy} onPress={()=>{void closeCase(true);}}/>}
   <Text style={styles.small}>El conductor solo puede responder cuando esté detenido y autenticado. Nunca se comparte información personal de contacto.</Text>
  </Panel>}
 </ScrollView>;
}

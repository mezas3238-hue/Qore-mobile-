import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Alert,ScrollView,Text,TextInput,View} from 'react-native';
import {useLocalSearchParams} from 'expo-router';
import * as Crypto from 'expo-crypto';
import {Action,Panel,styles} from '../src/ClientUI';
import {useClientView,useNativePassengerAuth} from '../src/ClientRuntime';
import {createG198PassengerLostItemsHttp} from '../src/domain/g198-lost-items-http.mjs';

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
 const [caseClosed,setCaseClosed]=useState(false);
 const [closureUncertain,setClosureUncertain]=useState(false);
 const [uncertainSend,setUncertainSend]=useState(false);
 const [draft,setDraft]=useState('');
 const [notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false);
 const lock=useRef(false);
 const attempted=useRef(false);
 const gateway=useMemo(()=>createG198PassengerLostItemsHttp({
  enabled:yes(process.env.EXPO_PUBLIC_G198_OWNER_APPROVED),
  ownerApproved:yes(process.env.EXPO_PUBLIC_G198_OWNER_APPROVED),
  providerVerified:yes(process.env.EXPO_PUBLIC_G198_IDENTITY_VERIFIED),
  g198PostgresVerified:yes(process.env.EXPO_PUBLIC_G198_ORIGINAL_SQL_VERIFIED),
  origin:process.env.EXPO_PUBLIC_F1_STAGING_ORIGIN,
  pinnedOrigin:process.env.EXPO_PUBLIC_F1_STAGING_PINNED_ORIGIN,
  getSession:async()=>{
   const s=await auth?.readSession();
   return s?{...s,privateViewRevision:client.snapshot().privateViewRevision}:null;
  }
 }),[auth,client]);
 useEffect(()=>{setCaseId(null);setMessages([]);setNotice('');setDraft('');
  attempted.current=false;setUncertainSend(false);
  setCaseClosed(false);setClosureUncertain(false);},[tripId]);
 const owned=Boolean(tripId&&subject&&client.snapshot().authenticated
  &&client.snapshot().account?.subject===subject
  &&client.snapshot().privateViewRevision===privacy
  &&client.snapshot().history?.ownerId===subject
  &&client.snapshot().history?.items?.some(x=>x.kind==='RIDE'&&
   x.serviceId===tripId&&x.status==='completed'));
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
   setCaseClosed(r.data.state!=='OPEN');
   setNotice('Expediente privado vinculado al viaje original. El conductor no recibe tu número.');
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
   setCaseClosed(r.data.state!=='OPEN');
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
  if(lock.current||!configured||!caseId||caseClosed||closureUncertain)return;
  lock.current=true;setBusy(true);setNotice('');
  try{
   const r=await gateway.close({...scope,caseId,block});
   if(!r.ok||r.data?.state!==(block?'BLOCKED':'CLOSED')){
    // A POST with uncertain COMMIT must never be repeated automatically.
    setClosureUncertain(true);setCanSend(false);
    setNotice('El cierre puede haberse guardado. No repetiremos la operación; consultá soporte y el estado del expediente.');
    return;
   }
   if(!owned)return;
   setCaseClosed(true);setCanSend(false);setDraft('');
   setNotice(block?'Contacto bloqueado y confirmado por el servidor.':
    'Expediente cerrado y confirmado por el servidor.');
  }finally{lock.current=false;setBusy(false);}
 }
 function confirmCaseClosure(block:boolean){
  if(!caseId||busy||caseClosed||closureUncertain)return;
  Alert.alert(block?'Bloquear contacto':'Cerrar expediente',
   block?'Se deshabilitará el contacto sobre este objeto olvidado.':
    'Al cerrar el expediente dejarás de poder enviar mensajes.',
   [{text:'Cancelar',style:'cancel'},
    {text:block?'Bloquear':'Cerrar',style:block?'destructive':'default',
     onPress:()=>{void closeCase(block);}}]);
 }
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}
  contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled"
  keyboardDismissMode="on-drag">
  <View style={styles.hero}>
   <Text accessibilityRole="header" style={styles.heroText}>¿Olvidaste algo en el vehículo?</Text>
   <Text style={styles.heroSub}>Podés contactar al conductor asignado a ese viaje sin compartir tu número de teléfono.</Text>
  </View>
  <Panel>
   <Text accessibilityRole="header" style={styles.heading}>Recuperación de pertenencias</Text>
   <Text style={styles.text}>El contacto se habilita solo después de un viaje completado y verificado. El expediente vence a los siete días, se puede bloquear y está limitado para prevenir acoso o fraude.</Text>
   <Text style={styles.small}>No compartas teléfonos, enlaces, códigos ni direcciones particulares. Ante una disputa, utilizá soporte.</Text>
   <Text style={styles.small}>Viaje original: {tripId??'No seleccionado desde tu historial'}</Text>
   {!owned&&<Text accessibilityRole="alert" style={styles.small}>Primero verificá este viaje terminado en «Mi historial» para solicitar contacto. No se aceptan identificadores ajenos.</Text>}
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
    accessibilityLabel="Mensaje privado al conductor sobre objeto perdido"/>
   <Action label="Enviar mensaje al conductor" disabled={!canSend||busy||uncertainSend||!draft.trim()}
    onPress={()=>{void send();}}/>
   <Text style={styles.small}>El conductor solo puede responder cuando esté detenido y autenticado. Nunca se comparte información personal de contacto.</Text>
   {!caseClosed&&!closureUncertain&&<>
    <Action label="Cerrar expediente" secondary disabled={busy||!configured}
     onPress={()=>confirmCaseClosure(false)}/>
    <Action label="Bloquear contacto" secondary disabled={busy||!configured}
     onPress={()=>confirmCaseClosure(true)}/>
   </>}
   {caseClosed&&<Text accessibilityRole="alert" style={styles.small}>Expediente cerrado: ya no se pueden enviar mensajes.</Text>}
   {closureUncertain&&<Text accessibilityRole="alert" style={styles.small}>Cierre sin comprobante confirmado. No vuelvas a enviarlo; consultá el expediente o soporte.</Text>}
  </Panel>}
 </ScrollView>;
}

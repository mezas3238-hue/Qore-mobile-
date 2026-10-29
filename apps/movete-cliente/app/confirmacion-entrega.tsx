import React,{useEffect,useMemo,useRef,useState} from 'react';
import {ScrollView,Text,TextInput,View} from 'react-native';
import * as Crypto from 'expo-crypto';
import {Action,Panel,palette,styles} from '../src/ClientUI';
import {useClientView,useNativePassengerAuth} from '../src/ClientRuntime';
import {createG187ClientHttpGateway} from '../src/domain/g187-recipient-http-gateway.mjs';
import {getNativeG192ReceiptJournal} from '../src/NativeG192ReceiptJournal';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const trimUuid=(s:string)=>s.trim().toLowerCase();
const yes=(value:string|undefined)=>value==='true';

export default function ConfirmacionEntrega(){
 const {client,view}=useClientView();
 // Each login/logout/rotation remounts the form: no previous user, delivery,
 // recipient binding or uncertain mutation survives another private identity.
 return <PrivateRecipientConfirmation key={view.privateViewRevision}
  client={client} subject={view.account?.subject??null}
  originalDelivery={view.deliveryRegistration.deliveryId??null}
  privacyRevision={view.privateViewRevision} authenticated={view.authenticated}/>;
}
function PrivateRecipientConfirmation({client,subject,originalDelivery,
 privacyRevision,authenticated}:{
 client:ReturnType<typeof useClientView>['client'];
 subject:string|null;originalDelivery:string|null;
 privacyRevision:number;authenticated:boolean;
}){
 const nativeAuth=useNativePassengerAuth();
 const journal=useMemo(()=>getNativeG192ReceiptJournal(),[]);
 const [journalReady,setJournalReady]=useState(false);
 const [journalError,setJournalError]=useState(false);
 const [verifiedSenderRead,setVerifiedSenderRead]=useState<null|Record<string,unknown>>(null);
 const [verifiedRecipientRead,setVerifiedRecipientRead]=useState<null|Record<string,unknown>>(null);
 const [boundHistoryId,setBoundHistoryId]=useState<string|null>(null);
 const [protectedSenderDeliveryId,setProtectedSenderDeliveryId]=useState<string|null>(null);
 const [confirmedHistoryId,setConfirmedHistoryId]=useState<string|null>(null);
 const [recipientId,setRecipientId]=useState('');
 const [incomingDelivery,setIncomingDelivery]=useState('');
 const [senderMessage,setSenderMessage]=useState('');
 const [recipientMessage,setRecipientMessage]=useState('');
 const [status,setStatus]=useState<null|{state:string;bound:boolean;confirmed:boolean;courierProof:boolean}>(null);
 const [busy,setBusy]=useState(false);
 // These keys are generated once per explicit command and never replaced after
 // an ambiguous HTTP response. Server enforces unique binding/confirmation.
 const senderAttempt=useRef<string|null>(null);
 const receiverAttempt=useRef<string|null>(null);
 const inFlight=useRef(false);
 const gateway=useMemo(()=>createG187ClientHttpGateway({
  enabled:yes(process.env.EXPO_PUBLIC_G187_OWNER_APPROVED),
  ownerApproved:yes(process.env.EXPO_PUBLIC_G187_OWNER_APPROVED),
  contractVerified:yes(process.env.EXPO_PUBLIC_G187_CONTRACT_VERIFIED),
  externalRuntimeVerified:yes(process.env.EXPO_PUBLIC_G187_EXTERNAL_RUNTIME_VERIFIED),
  independentIdpVerified:yes(process.env.EXPO_PUBLIC_G187_IDP_REVOCATION_VERIFIED),
  originalSqlVerified:yes(process.env.EXPO_PUBLIC_G187_ORIGINAL_SQL_VERIFIED),
  origin:process.env.EXPO_PUBLIC_F1_STAGING_ORIGIN,
  pinnedOrigin:process.env.EXPO_PUBLIC_F1_STAGING_PINNED_ORIGIN,
  getSession:async()=>{
   const auth=await nativeAuth?.readSession();
   const active=client.snapshot();
   return auth?{...auth,privateViewRevision:active.privateViewRevision}:null;
  }
 }),[client,nativeAuth]);
 useEffect(()=>()=>gateway.cancelPending(),[gateway]);
 // Read Keystore before enabling ANY new POST. A restart restores the original
 // delivery UUID and persistent request key; it NEVER silently retries.
 useEffect(()=>{
  let active=true;
  if(!authenticated||!subject||!journal){
   setJournalReady(false);return ()=>{active=false;};
  }
  void (async()=>{
   try{
    const [binding,confirmation]=await Promise.all([
     journal.read(subject,'bind'),journal.read(subject,'confirm')]);
    if(!active)return;
    if(binding){
     senderAttempt.current=binding.requestKey;
     setProtectedSenderDeliveryId(binding.deliveryId);
     setRecipientId(binding.recipientId??'');
     setSenderMessage('Vinculación anterior pendiente de comprobación. Usá la consulta privada, no otra solicitud.');
    }
    if(confirmation){
     receiverAttempt.current=confirmation.requestKey;
     setIncomingDelivery(confirmation.deliveryId);
     setRecipientMessage('Se recuperó una recepción pendiente del almacenamiento cifrado. Consultá al servidor; no se enviará otra confirmación.');
    }
    setJournalReady(true);
   }catch{
    if(active){setJournalError(true);setJournalReady(false);}
   }
  })();
  return ()=>{active=false;};
 },[journal,authenticated,subject]);
 const ready=authenticated&&subject!==null&&gateway.isConfigured();
 const mutationReady=ready&&journalReady&&!journalError&&journal!==null;
 const original=protectedSenderDeliveryId??
  (originalDelivery&&UUID.test(originalDelivery)?trimUuid(originalDelivery):null);
 const incoming=trimUuid(incomingDelivery);
 const recipient=trimUuid(recipientId);
 const scope=(deliveryId:string)=>({
  deliveryId,expectedSubject:subject??'',expectedPrivateViewRevision:privacyRevision
 });
 function stillOwns(){
  const latest=client.snapshot();
  return latest.authenticated&&latest.privateViewRevision===privacyRevision
   &&latest.account?.subject===subject;
 }
 async function run(kind:'bind'|'confirm'|'status'|'recover'){
  if(inFlight.current||!ready||!stillOwns())return;
  if(kind==='bind'&&(!mutationReady||!original||!UUID.test(recipient)
   ||recipient===subject||senderAttempt.current!==null||boundHistoryId===original))return;
  if(kind==='confirm'&&(!mutationReady||!UUID.test(incoming)
   ||receiverAttempt.current!==null||confirmedHistoryId===incoming))return;
  if(kind==='status'&&!original)return;
  if(kind==='recover'&&!UUID.test(incoming))return;
  const key=kind==='bind'||kind==='confirm'?Crypto.randomUUID():null;
  inFlight.current=true;setBusy(true);
  if(kind==='status')setSenderMessage('');
  else if(kind==='bind')setSenderMessage('');
  else setRecipientMessage('');
  try{
   if(kind==='bind'||kind==='confirm'){
    // Persist first; any Keychain error halts the POST permanently until
    // secure local reconciliation. The encrypted record survives app death.
    if(!journal||!subject||!key)return;
    let armed;
    try{
     armed=await journal.arm({subject,kind,requestKey:key,
      deliveryId:kind==='bind'?original!:incoming,
      ...(kind==='bind'?{recipientId:recipient}:{})});
    }catch{
     if(stillOwns()){
      setJournalError(true);
      if(kind==='bind')setSenderMessage('No se verificó el guardado seguro de la clave. No se envió ninguna petición.');
      else setRecipientMessage('Almacenamiento cifrado no verificable. No se envió la confirmación.');
     }
     return;
    }
    if(!stillOwns())return;
    if(kind==='bind')senderAttempt.current=armed.requestKey;
    else receiverAttempt.current=armed.requestKey;
   }
   const result=kind==='bind'?
    await gateway.bindRecipient({...scope(original!),recipientId:recipient,
     requestKey:key!}):
    kind==='confirm'?
     await gateway.confirmReceived({...scope(incoming),requestKey:key!}):
     kind==='recover'?
      await gateway.readRecipientConfirmation(scope(incoming)):
      await gateway.readSenderStatus(scope(original!));
   if(!stillOwns())return;
   if(!result.ok){
    const failed=kind==='confirm'?
     'La recepción no quedó confirmada en tu pantalla. No vuelvas a enviarla automáticamente: pedí al remitente que consulte el estado del servidor.':
     kind==='bind'?
      'No pudimos verificar la vinculación. No generaremos otra clave: consultá al soporte antes de volver a intentarlo.':
      'El estado independiente no está disponible o tu sesión no tiene autorización.';
    if(kind==='confirm'||kind==='recover')setRecipientMessage(failed);
    else setSenderMessage(failed);
    return;
   }
   if(kind==='bind'){
    setSenderMessage('Destinatario vinculado en la base original. La clave original queda cifrada hasta consultar y archivar el comprobante.');
   }else if(kind==='confirm'){
    setRecipientMessage('Recepción confirmada por el servidor en QA. La clave cifrada se conserva hasta verificar por GET. No hay cobro.');
   }else if(kind==='recover'){
    const d=result.data;
    setVerifiedRecipientRead(d.recipientConfirmed===true?d:null);
    if(d.recipientConfirmed===true)setConfirmedHistoryId(incoming);
    setRecipientMessage(d.recipientConfirmed
     ?d.eligibleForSettlement?
      'La base confirmó tu recepción original. No se autorizó ningún pago.':
      'Tu recepción original sigue registrada. Existe una incidencia, disputa o devolución: la liquidación continúa bloqueada.':
      'No hay confirmación persistida. Este GET no envió una nueva aceptación; consultá soporte antes de intentar otra operación.');
   }else{
    const d=result.data;
    const exactOriginal=d.recipientBound===true&&senderAttempt.current!==null
     &&d.bindingKey===senderAttempt.current;
    setVerifiedSenderRead(exactOriginal?d:null);
    if(d.recipientBound===true)setBoundHistoryId(original);
    setStatus({state:d.deliveryState,bound:d.recipientBound,
     confirmed:d.recipientConfirmed,courierProof:d.courierProofCommitted});
    setSenderMessage(d.recipientBound===true&&senderAttempt.current!==null
     &&!exactOriginal
      ?'El servidor tiene otra clave de vinculación para este envío. No se puede archivar ni dar por confirmada tu operación; contactá soporte.'
      :'Estado del mismo envío verificado por PostgreSQL. No es un comprobante de pago.');
   }
  }catch{
   if(!stillOwns())return;
   if(kind==='confirm'||kind==='recover')setRecipientMessage(
    'Resultado incierto. No repitas la confirmación: usá la consulta privada o contactá soporte.');
   else setSenderMessage('Servidor no verificado; la operación no puede darse por realizada.');
  }finally{inFlight.current=false;setBusy(false);}
 }
 async function archive(kind:'bind'|'confirm'){
  if(inFlight.current||!journal||!subject||!ready)return;
  const stored=kind==='bind'?senderAttempt.current:receiverAttempt.current;
  const id=kind==='bind'?original:incoming;
  const proof=kind==='bind'?verifiedSenderRead:verifiedRecipientRead;
  if(!stored||!id||!proof||proof.deliveryId!==id||!stillOwns())return;
  inFlight.current=true;setBusy(true);
  try{
   await journal.clearVerified({subject,kind,deliveryId:id,
    requestKey:stored,verifiedServerReceipt:proof});
   if(!stillOwns())return;
   if(kind==='bind'){
    senderAttempt.current=null;setVerifiedSenderRead(null);
    setProtectedSenderDeliveryId(null);
    setSenderMessage('Comprobante original verificado y archivado localmente.');
   }else{
    receiverAttempt.current=null;setVerifiedRecipientRead(null);
    setRecipientMessage('Recepción original verificada y archivada; no se creó otro envío.');
   }
  }catch{
   if(stillOwns())setJournalError(true);
  }finally{inFlight.current=false;setBusy(false);}
 }
 return <ScrollView style={styles.page} contentContainerStyle={styles.content}
  contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled">
  <View style={styles.hero}>
   <Text accessibilityRole="header" style={styles.heroText}>Confirmar una entrega</Text>
   <Text style={styles.heroSub}>El repartidor acredita la entrega; el destinatario confirma la recepción por separado. Ninguna acción de esta pantalla cobra dinero.</Text>
  </View>
  {(journalError||!journalReady)&&authenticated&&<Panel>
   <Text accessibilityRole="alert" style={styles.heading}>Protección de recuperación cifrada</Text>
   <Text style={styles.small}>{journal===null?'La recuperación segura de confirmaciones requiere la aplicación instalada en Android o iOS; no hay almacenamiento persistente seguro para esta operación en la web.':journalError?'No se pudo verificar el almacenamiento cifrado. Se bloquearon nuevos envíos de confirmación para evitar operaciones duplicadas.':'Comprobando claves protegidas de entregas anteriores antes de habilitar nuevas operaciones…'}</Text>
  </Panel>}
  {!ready&&<Panel>
   <Text accessibilityRole="alert" style={styles.heading}>Confirmación independiente aún no habilitada</Text>
   <Text style={styles.small}>Requiere identidad de destinatario, revocación de sesión, endpoint HTTPS y contrato PostgreSQL certificados por el administrador. Las pruebas de GitHub no habilitan entregas comerciales.</Text>
  </Panel>}
  {authenticated&&subject&&<Panel>
   <Text accessibilityRole="header" style={styles.heading}>Tu identidad verificada</Text>
   <Text style={styles.small}>Compartí este identificador únicamente con quien te envía el paquete; no compartas contraseñas ni códigos de acceso. No se obtiene la identidad del teléfono del repartidor.</Text>
   <Text selectable style={styles.text}>{subject}</Text>
  </Panel>}
  <Panel>
   <Text accessibilityRole="header" style={styles.heading}>Soy remitente · vincular destinatario</Text>
   <Text style={styles.small}>Solo podés vincular un destinatario diferente usando el identificador original de un envío registrado en esta sesión.</Text>
   <Text style={styles.text}>Envío propio: {original??'Sin envío original verificado'}</Text>
   {protectedSenderDeliveryId&&protectedSenderDeliveryId!==originalDelivery&&
    <Text style={styles.small}>Se restauró el identificador del envío anterior desde el almacenamiento cifrado. Primero verificá y archivá esa vinculación para volver al envío actual.</Text>}
   <TextInput value={recipientId} onChangeText={setRecipientId}
    editable={ready&&!busy&&senderAttempt.current===null}
    style={styles.field} accessibilityLabel="Identificador del destinatario"
    placeholder="UUID del destinatario" autoCapitalize="none" autoCorrect={false}
    maxLength={36}/>
   <Action label={busy?'Verificando…':'Vincular destinatario'}
    disabled={!mutationReady||!original||!UUID.test(recipient)||recipient===subject||
     busy||senderAttempt.current!==null||boundHistoryId===original}
    hint="Una única vinculación para el deliveryId original, sin pagos."
    onPress={()=>{void run('bind');}}/>
   <Action secondary label="Consultar comprobante independiente"
    disabled={!ready||!original||busy}
    onPress={()=>{void run('status');}}/>
   {verifiedSenderRead&&senderAttempt.current!==null&&
    verifiedSenderRead.deliveryId===original&&<Action secondary
     label="Archivar vinculación comprobada" disabled={busy||journalError}
     hint="Solo libera la clave cifrada después del GET privado verificado por servidor."
     onPress={()=>{void archive('bind');}}/>}
   {status&&<View>
    <Text style={styles.text}>Estado del envío: {status.state}</Text>
    <Text style={styles.text}>Destinatario vinculado: {status.bound?'Sí':'No'}</Text>
    <Text style={styles.text}>Prueba del repartidor: {status.courierProof?'Registrada':'Pendiente'}</Text>
    <Text style={styles.text}>Recepción confirmada: {status.confirmed?'Sí':'No'}</Text>
   </View>}
   {senderMessage!==''&&<Text accessibilityLiveRegion="polite"
    style={[styles.small,{color:palette.primary}]}>{senderMessage}</Text>}
  </Panel>
  <Panel>
   <Text accessibilityRole="header" style={styles.heading}>Soy destinatario · confirmar recepción</Text>
   <Text style={styles.small}>Ingresá el identificador que te compartió el remitente. Verificá el contenido recibido antes de confirmar. El servidor rechazará entregas sin prueba del repartidor o sin vinculación a tu identidad.</Text>
   <TextInput value={incomingDelivery} onChangeText={setIncomingDelivery}
    editable={ready&&!busy&&receiverAttempt.current===null}
    style={styles.field} accessibilityLabel="Identificador de envío recibido"
    placeholder="UUID del envío" autoCapitalize="none" autoCorrect={false}
    maxLength={36}/>
   <Action label={busy?'Comprobando…':'Confirmo que recibí este envío'}
    disabled={!mutationReady||!UUID.test(incoming)||busy||
     receiverAttempt.current!==null||confirmedHistoryId===incoming}
    hint="Acción irreversible: solo si recibiste el paquete. No autoriza cobro."
    onPress={()=>{void run('confirm');}}/>
   <Action secondary label="Consultar mi confirmación original (sin reenviar)"
    disabled={!ready||!UUID.test(incoming)||busy}
    hint="Solo GET privado: permite recuperar una confirmación tras perder la respuesta sin repetir el POST."
    onPress={()=>{void run('recover');}}/>
   {verifiedRecipientRead&&receiverAttempt.current!==null&&
    verifiedRecipientRead.deliveryId===incoming&&<Action secondary
     label="Archivar confirmación comprobada" disabled={busy||journalError}
     hint="Un GET privado demuestra la confirmación original antes de liberar la clave cifrada."
     onPress={()=>{void archive('confirm');}}/>}
   {recipientMessage!==''&&<Text accessibilityLiveRegion="polite"
    style={[styles.small,{color:palette.primary}]}>{recipientMessage}</Text>}
   <Text style={styles.small}>Si hay una incidencia o el paquete no llegó, no confirmes. Contactá al soporte; la plataforma no debe liquidar sin resolución verificada.</Text>
  </Panel>
 </ScrollView>;
}

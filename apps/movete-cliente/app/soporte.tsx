import React,{useEffect,useRef,useState} from 'react';
import * as Crypto from 'expo-crypto';
import {useClientView} from '../src/ClientRuntime';
import {ScrollView,Text,TextInput,View} from 'react-native';
import {Action,Panel,palette,styles} from '../src/ClientUI';
import {SUPPORT_TYPES} from '../src/domain/support-draft.mjs';
import {createSupportDraftSession} from '../src/domain/support-draft-session.mjs';
import {prepareG40IncidentIntent,INCIDENT_SERVICE_OPTIONS,
 INCIDENT_CATEGORY_OPTIONS,INCIDENT_SEVERITY_OPTIONS} from '../src/domain/client-incident-intent.mjs';
import type {ClientExperience,ClientSnapshot} from '../src/domain/client-experience.mjs';
import {MERCHANT_SUPPORT_REASONS,createMerchantSupportGuide}
 from '../src/domain/merchant-support-guide.mjs';
import type {MerchantSupportUpdate,MerchantSupportSeverity}
 from '../src/domain/merchant-support-guide.mjs';

export default function Support(){
 const {client,view}=useClientView();
 // Remontar ante logout, relogin, cambio de cuenta o rotación de JWT.
 return <PrivateSupportDraft key={view.privateViewRevision} client={client} view={view}/>;
}
function PrivateSupportDraft({client,view}:{client:ClientExperience;view:ClientSnapshot}){
 const [session]=useState(()=>createSupportDraftSession());
 const [draft,setDraft]=useState(()=>session.snapshot());
 // El controlador cierra y purga la memoria al desmontarse; jamás persiste contenido.
 useEffect(()=>()=>{session.dispose();},[session]);
 return <ScrollView style={styles.page} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic"
  keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
  <View style={styles.hero}><Text accessibilityRole="header" style={styles.heroText}>Seguridad y soporte</Text>
   <Text style={styles.heroSub}>Borrador privado de ayuda. No sustituye un canal de emergencia.</Text></View>
  <Panel>
   <Text accessibilityRole="header" style={styles.heading}>NO 911 / NO SOS — borrador local NO ENVIADO</Text>
   <Text style={styles.text}>Esta pantalla solo prepara un borrador local: no contacta autoridades, operadores ni conductores. No existe número de caso ni confirmación del servidor.</Text>
   <Text style={styles.small}>Ante peligro inmediato, acudí a los canales oficiales de emergencia de tu zona. No dependas de este formulario para pedir auxilio.</Text>
  </Panel>
  <Panel>
   <Text accessibilityRole="header" style={styles.heading}>Preparar un reporte local</Text>
   <Text style={styles.text}>Tipo de reporte</Text>
   {SUPPORT_TYPES.map(item=><Action key={item.code}
     label={item.label} secondary={draft.category!==item.code} selected={draft.category===item.code}
     onPress={()=>setDraft(session.setCategory(item.code))}/>)}
   <Text style={styles.text}>Identificador del servicio (opcional, formato UUID)</Text>
   <TextInput style={styles.field} value={draft.serviceId} onChangeText={text=>setDraft(session.setServiceId(text))}
    placeholder="Solo si existe un servicio" accessibilityLabel="Identificador del servicio" maxLength={36}/>
   <Text style={styles.text}>Descripción del incidente</Text>
   <TextInput style={[styles.field,{minHeight:100,textAlignVertical:'top'}]}
    value={draft.description} onChangeText={text=>setDraft(session.setDescription(text))} multiline
    placeholder="Sin teléfonos, documentos, enlaces o ubicaciones exactas" accessibilityLabel="Descripción del incidente" maxLength={500}/>
   <Action label="Validar borrador (sin enviar)" onPress={()=>setDraft(session.validate())}/>
   <Action label="Borrar borrador local" secondary onPress={()=>setDraft(session.clear())}/>
   {draft.feedback!==''&&<Text accessibilityRole="alert" accessibilityLiveRegion="assertive"
    style={[styles.text,{color:palette.primary}]}>{draft.feedback}</Text>}
   <Text style={styles.small}>Estado: NO ENVIADO. La validación local no crea, transmite ni confirma ningún incidente.</Text>
  </Panel>
  {view.authenticated&&view.account&&
   <MerchantOrderHelp view={view}/>}
  {view.authenticated&&view.incidentReport.contractReady&&
   <StructuredQaIncident client={client} view={view}/>}
  <Panel><Text accessibilityRole="header" style={styles.heading}>Privacidad del borrador</Text>
   <Text style={styles.text}>Se borra al salir de la sesión o cambiar de cuenta, y puede eliminarse con el botón. La detección local de datos sensibles no es infalible: evitá escribir datos identificatorios.</Text></Panel>
 </ScrollView>;
}

/**
 * Solo visible después de certificación explícita G40 STAGING.
 * Este componente NO es el borrador libre ni un canal de emergencia.
 */
function StructuredQaIncident({client,view}:{client:ClientExperience;view:ClientSnapshot}){
 const [subjectKind,setSubjectKind]=useState<'RIDE'|'DELIVERY'|'MERCHANT_ORDER'>('RIDE');
 const [subjectId,setSubjectId]=useState('');
 const [category,setCategory]=useState<'QUALITY'|'LOSS'|'DISPUTE'|'FRAUD'|'SAFETY'>('QUALITY');
 const [severity,setSeverity]=useState<'LOW'|'MEDIUM'|'HIGH'>('LOW');
 const [feedback,setFeedback]=useState('');
 const lock=useRef(false),alive=useRef(true);
 useEffect(()=>()=>{alive.current=false;},[]);
 const report=view.incidentReport;
 const editable=report.phase==='idle'&&!lock.current;
 const pending=report.phase==='in_flight'||report.phase==='checking';
 function update(action:()=>void){if(!editable)return;action();setFeedback('');}
 function prepare(){
  if(!editable)return;
  lock.current=true;
  try{
   const result=prepareG40IncidentIntent({subjectKind,subjectId,category,severity},
    ()=>Crypto.randomUUID());
   if(!result.ok){setFeedback(result.reason);return;}
   const saved=client.prepareIncidentReport(result.body);
   setFeedback(saved.ok?'Reporte preparado, todavía NO ENVIADO. Revisá antes de confirmar.':
    'No se puede preparar otro reporte mientras hay uno pendiente o sin conciliar.');
  }finally{lock.current=false;}
 }
 async function execute(action:'submit'|'retry'|'refresh'){
  if(lock.current||pending)return;
  lock.current=true;
  try{
   const result=action==='submit'?await client.submitIncidentReport()
    :action==='retry'?await client.retryIncidentReport()
    :await client.refreshIncidentStatus();
   if(!alive.current)return;
   setFeedback(result.ok
    ?'Recibo de base de QA verificado. NO se avisó a operadores ni a emergencias.'
    :result.code==='NETWORK_OR_TIMEOUT'||result.code==='SERVICE_UNAVAILABLE'
     ?'Resultado incierto: conservamos la misma clave. No generes otro reporte.'
    :result.code==='RECONCILE_SAME_REQUEST_KEY'
     ?'Conflicto de idempotencia: requiere conciliación del servidor. No generes otra clave.'
    :'Sin confirmación nueva del servidor. No se afirmó recepción ni atención.');
  }finally{lock.current=false;}
 }
 function discard(){
  if(lock.current||report.phase!=='ready')return;
  const res=client.discardIncidentReport();
  if(res.ok){setSubjectId('');setFeedback('Borrador estructurado descartado antes de enviar.');}
 }
 return <Panel>
  <Text accessibilityRole="header" style={styles.heading}>Reporte estructurado · SOLO QA</Text>
  <Text style={styles.small}>Disponible exclusivamente cuando el servidor G40 de STAGING esté certificado. Este formulario no es SOS y no contacta emergencias.</Text>
  <Text style={styles.text}>Servicio vinculado al caso</Text>
  {INCIDENT_SERVICE_OPTIONS.map(option=><Action key={option.code} label={option.label}
   secondary={subjectKind!==option.code} selected={subjectKind===option.code}
   disabled={!editable} onPress={()=>update(()=>setSubjectKind(option.code as typeof subjectKind))}/>)}
  <Text style={styles.text}>Identificador UUID del servicio propio</Text>
  <TextInput style={styles.field} value={subjectId} editable={editable}
   onChangeText={value=>update(()=>setSubjectId(value))} maxLength={36}
   placeholder="UUID del viaje o envío" accessibilityLabel="ID del servicio vinculado"/>
  <Text style={styles.small}>No ingreses cédula, teléfono, nombres, direcciones ni texto libre. El backend debe verificar que el servicio te pertenece.</Text>
  <Text style={styles.text}>Motivo</Text>
  {INCIDENT_CATEGORY_OPTIONS.map(option=><Action key={option.code} label={option.label}
   secondary={category!==option.code} selected={category===option.code}
   disabled={!editable} onPress={()=>update(()=>setCategory(option.code as typeof category))}/>)}
  <Text style={styles.text}>Gravedad (NO SOS)</Text>
  {INCIDENT_SEVERITY_OPTIONS.map(option=><Action key={option.code} label={option.label}
   secondary={severity!==option.code} selected={severity===option.code}
   disabled={!editable} onPress={()=>update(()=>setSeverity(option.code as typeof severity))}/>)}
  {report.phase==='idle'&&<Action label="Preparar reporte G40 sin enviar"
   onPress={prepare} disabled={!editable}/>}
  {report.phase==='ready'&&<>
   <Text style={styles.text}>Estado: preparado, NO ENVIADO. La clave de reporte queda fijada para evitar duplicados.</Text>
   <Action label="Confirmar registro SOLO en base QA" onPress={()=>void execute('submit')}
    disabled={lock.current}/>
   <Action label="Descartar antes de enviar" secondary onPress={discard}/>
  </>}
  {report.phase==='retryable'&&<>
   <Text style={styles.text}>Resultado del servidor incierto. No abras otro reporte: reintentá con la misma clave.</Text>
   <Action label="Reintentar con la MISMA clave" onPress={()=>void execute('retry')}/>
  </>}
  {pending&&<Text accessibilityRole="alert" style={styles.text}>
   Consulta en curso. Todavía no se puede afirmar recepción.</Text>}
  {report.phase==='failed'&&<Text accessibilityRole="alert" style={styles.text}>
   La respuesta no pudo certificarse. Es necesaria conciliación; no se creará otra clave.</Text>}
  {report.receipt&&<>
   <Text accessibilityRole="header" style={styles.heading}>Recibo de base QA (NO SOS)</Text>
   <Text style={styles.text}>Recibo: {report.receipt.receiptId}</Text>
   <Text style={styles.text}>Estado: {report.receipt.state} · revisión {report.receipt.revision}</Text>
   <Text style={styles.small}>Persistencia en base de pruebas únicamente. No implica atención humana, notificación ni emergencia.</Text>
   {report.phase==='acknowledged'&&<Action label="Consultar estado del recibo QA"
    onPress={()=>void execute('refresh')}/>}
  </>}
  {feedback!==''&&<Text accessibilityRole="alert" accessibilityLiveRegion="assertive"
   style={[styles.text,{color:palette.primary}]}>{feedback}</Text>}
 </Panel>;
}

/**
 * R40: guía privada de clasificación de un problema comercial.
 * Ni el botón Revisar ni el estado UI ejecutan submit o HTTP.
 * G40 mantiene un formulario QA SEPARADO, bajo Auth/contrato propios.
 */
function MerchantOrderHelp({view}:{view:ClientSnapshot}){
 const [guide]=useState(()=>createMerchantSupportGuide());
 const [,setRevision]=useState(0);
 const [feedback,setFeedback]=useState('');
 useEffect(()=>()=>{guide.dispose();},[guide]);
 const actor=view.account&&view.authenticated?{
  role:'passenger' as const,subject:view.account.subject,
  sessionRevision:view.privateViewRevision
 }:null;
 const snapshot=guide.snapshot(actor);
 const edit=(patch:MerchantSupportUpdate)=>{
  const result=guide.update(actor,patch);
  setFeedback(result.ok?'':'Entrada inválida. Comprobá el pedido y el motivo.');
  setRevision(n=>n+1);
 };
 const review=()=>{
  const result=guide.review(actor);
  setFeedback(result.ok
   ?'Guía revisada localmente. NO se envió un caso, un mensaje ni un aviso al comercio. Para atención real se requiere el servicio certificado.'
   :'Faltan el identificador UUID del pedido, el motivo y la gravedad. No se envió ninguna solicitud.');
 };
 const severities:{code:MerchantSupportSeverity;label:string}[]=[
  {code:'LOW',label:'Baja'}, {code:'MEDIUM',label:'Media'},
  {code:'HIGH',label:'Alta (NO SOS)'}
 ];
 return <Panel>
  <Text accessibilityRole="header" style={styles.heading}>
   Ayuda con pedidos de supermercados, farmacias y restaurantes
  </Text>
  <Text style={styles.small}>
   Esta guía es un borrador local y NO contacta comerciantes,
   repartidores, agentes ni emergencias. No sirve para solicitar ayuda urgente.
  </Text>
  <Text style={styles.text}>Identificador del pedido propio (UUID)</Text>
  <TextInput style={styles.field} value={snapshot.orderId}
   editable={snapshot.ok} maxLength={36}
   onChangeText={orderId=>edit({orderId})}
   placeholder="UUID de un pedido existente"
   accessibilityLabel="Identificador UUID del pedido comercial"/>
  <Text style={styles.text}>¿Qué sucedió?</Text>
  {MERCHANT_SUPPORT_REASONS.map(item=><Action key={item.code}
   label={item.label} secondary={snapshot.reason!==item.code}
   selected={snapshot.reason===item.code}
   disabled={!snapshot.ok}
   onPress={()=>edit({reason:item.code})}/>)}
  <Text style={styles.text}>Gravedad del problema (NO SOS)</Text>
  {severities.map(item=><Action key={item.code}
   label={item.label} secondary={snapshot.severity!==item.code}
   selected={snapshot.severity===item.code}
   disabled={!snapshot.ok}
   onPress={()=>edit({severity:item.code})}/>)}
  <Action label="Revisar guía local sin enviar" disabled={!snapshot.canReview}
   onPress={review}/>
  <Action label="Borrar guía local" secondary
   onPress={()=>{guide.clear();setFeedback('Guía local borrada.');
    setRevision(n=>n+1);}}/>
  {feedback!==''&&<Text accessibilityRole="alert" accessibilityLiveRegion="polite"
   style={styles.text}>{feedback}</Text>}
  <Text style={styles.small}>
   Sin comprobación de propiedad del pedido, número de caso ni respuesta del servidor.
   Si hay peligro inmediato, utilizá los canales oficiales de emergencia.
   No ingreses nombres, teléfonos, direcciones, datos de pago ni documentos.
  </Text>
 </Panel>;
}

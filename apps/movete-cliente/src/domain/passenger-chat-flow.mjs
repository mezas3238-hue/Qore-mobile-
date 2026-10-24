/**
 * Mensajería pasajero ↔ conductor/repartidor vinculada a SERVICIO ASIGNADO.
 * Contrato B propuesto a Arquitecto A; sin endpoints ni URLs inventados.
 * El servidor debe autenticar al pasajero, validar asignación actual y
 * guardar mensajes idempotentemente. OFF salvo certificación explícita.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CURSOR=/^[A-Za-z0-9_.-]{44,384}$/;
const TYPES=new Set(['RIDE','DELIVERY','MERCHANT_ORDER']);
const ROLES=new Set(['passenger','driver']);
const LIMIT=100;
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(v,fields)=>isObject(v)&&Object.keys(v).length===fields.length
 &&fields.every(k=>Object.hasOwn(v,k));
const validId=x=>typeof x==='string'&&UUID.test(x);
const validCursor=x=>x===null||(typeof x==='string'&&CURSOR.test(x));
const validInt=x=>Number.isSafeInteger(x)&&x>=0;
const fail=code=>Object.freeze({ok:false,code});
const cleanMessage=s=>typeof s==='string'&&s.length>=1&&s.length<=500
 &&s.trim().length>=1&&s===s.trim()
 &&!/[\u0000-\u001f\u007f<>]/u.test(s)
 &&!/(?:https?:\/\/|www\.)/i.test(s)
 // No compartir teléfonos, correo ni caracteres bidi de suplantación.
 &&!/[\u202a-\u202e\u2066-\u2069\u200e\u200f]/u.test(s)
 &&!/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/u.test(s)
 &&!/(?:\+?\d[\s().-]*){7,}/u.test(s);
const actorOk=a=>isObject(a)&&a.role==='passenger'&&validId(a.subject)
 &&validInt(a.sessionRevision);
const sameActor=(a,b)=>actorOk(b)&&a.subject===b.subject
 &&a.sessionRevision===b.sessionRevision;
const HEADER=['conversationId','serviceId','serviceKind','ownerId',
 'counterpartRole','assignmentVerified','state','revision','generatedAt',
 'expiresAt','messages','nextCursor','canSend','productionEnabled'];
const MESSAGE=['messageId','senderRole','body','createdAt','revision'];
const ACK=['conversationId','serviceId','requestKey','messageId',
 'senderRole','body','createdAt','revision','serverStored'];
const blank=()=>({header:null,sessionRevision:null,messages:[],nextCursor:null,
 seenCursor:new Set(),seenIds:new Set(),pageNumber:0,error:null,pending:null,
 readCount:0,evictedCount:0});
function validateMessage(row,now){
 return exact(row,MESSAGE)&&validId(row.messageId)&&ROLES.has(row.senderRole)
  &&cleanMessage(row.body)&&validInt(row.createdAt)&&row.createdAt<=now
  &&validInt(row.revision);
}
function validPage(dto,{serviceId,serviceKind,ownerId,now,conversationId=null}){
 if(!exact(dto,HEADER)||!validId(dto.conversationId)
  ||(conversationId!==null&&conversationId!==dto.conversationId)
  ||dto.serviceId!==serviceId||dto.serviceKind!==serviceKind
  ||dto.ownerId!==ownerId||dto.counterpartRole!=='driver'
  ||dto.assignmentVerified!==true||dto.state!=='ACTIVE'
  ||!validInt(dto.revision)||!validInt(dto.generatedAt)
  ||!validInt(dto.expiresAt)||dto.generatedAt>now
  ||dto.generatedAt<now-300000||dto.expiresAt<=dto.generatedAt
  ||dto.expiresAt<=now||dto.expiresAt>now+300000
  ||dto.canSend!==true||dto.productionEnabled!==false
  ||!Array.isArray(dto.messages)||dto.messages.length>LIMIT
  ||!validCursor(dto.nextCursor)
  // Una página vacía con continuación puede encadenar cursores sin fin.
  ||(dto.messages.length===0&&dto.nextCursor!==null))return null;
 const ids=new Set(),rows=[];
 for(const row of dto.messages){
  if(!validateMessage(row,now)||row.revision>dto.revision
   ||ids.has(row.messageId)
   // Cada página va newest-first: no aceptar inversión temporal.
   ||rows.length>0&&row.createdAt>rows[rows.length-1].createdAt)return null;
  ids.add(row.messageId);
  rows.push(Object.freeze({...row}));
 }
 return Object.freeze({conversationId:dto.conversationId,serviceId,serviceKind,
  ownerId,expiresAt:dto.expiresAt,revision:dto.revision,
  nextCursor:dto.nextCursor,messages:Object.freeze(rows)});
}
function validAck(row,header,body,key,now){
 return exact(row,ACK)&&row.conversationId===header.conversationId
  &&row.serviceId===header.serviceId&&row.requestKey===key
  &&row.senderRole==='passenger'&&row.body===body
  &&row.serverStored===true&&row.revision>=header.revision
  &&validateMessage({
   messageId:row.messageId,senderRole:row.senderRole,body:row.body,
   createdAt:row.createdAt,revision:row.revision
  },now);
}
// Solo retener datos de autorización. validPage ya proyecta mensajes a
// state.messages; guardarlos también en header dejaría otra referencia viva
// a cuerpos privados después de borrar la ventana en un ACK incierto.
const authorizationHeader=({conversationId,serviceId,serviceKind,ownerId,
 expiresAt,revision})=>Object.freeze({
 conversationId,serviceId,serviceKind,ownerId,expiresAt,revision
});
export function createPassengerChatFlow({gateway=null,getActor=null,
 now=()=>Date.now(),maxCachedMessages=500}={}){
 let generation=0,loading=false,sending=false,state=blank();
 const windowLimit=Number.isSafeInteger(maxCachedMessages)
  &&maxCachedMessages>=100&&maxCachedMessages<=5000?maxCachedMessages:500;
 const ready=()=>{
  try{
   return gateway?.enabled===true&&gateway?.contractCertified===true
    &&gateway?.stagingRuntimeVerified===true&&gateway?.isConfigured?.()===true
    &&typeof gateway.readMessages==='function'
    &&typeof getActor==='function';
  }catch{return false;}
 };
 // La lectura autorizada no habilita POST: solo una operación de escritura
 // real y certificada puede marcar mensajes como entregados.
 const sendReady=()=>ready()&&typeof gateway?.sendMessage==='function';
 const clear=()=>{
  generation++;loading=false;sending=false;state=blank();
  try{gateway?.cancelPending?.();}catch{/* logout local nunca se bloquea */}
 };
 const revoked=()=>{
  if(ready())return false;
  clear();return true;
 };
 function trimWindow(newestFirst){
  const excess=state.messages.length-windowLimit;
  if(excess<=0)return;
  const discarded=newestFirst?state.messages.splice(-excess)
   :state.messages.splice(0,excess);
  for(const item of discarded)state.seenIds.delete(item.messageId);
  state.evictedCount+=discarded.length;
 }
 function snapshot(){
  if(!ready()&&(state.header||state.pending||loading||sending))clear();
  // TTL vencido: no retener físicamente mensajes privados en memoria.
  // Si hay envío incierto, guardar SOLAMENTE la clave/cuerpo pendiente y
  // el identificador del hilo para reconciliarlo con la misma solicitud.
  if(state.header&&state.header.expiresAt<=now()){
   if(!state.pending)clear();
   else{
    state.messages=[];
    state.nextCursor=null;
    state.seenIds.clear();
    state.seenCursor.clear();
    state.pageNumber=0;state.readCount=0;state.evictedCount=0;
   }
  }
  const valid=ready()&&state.header&&state.header.expiresAt>now();
  // Un mensaje incierto conserva contexto para reconciliar la MISMA clave,
  // pero las filas caducadas nunca vuelven a exponerse al dispositivo.
  const pending=Boolean(state.header&&state.pending);
  return Object.freeze({
   contractReady:ready(),sendReady:sendReady(),loading,sending,
   active:Boolean((valid||pending)&&!loading),
   serviceId:valid||pending?state.header.serviceId:null,
   serviceKind:valid||pending?state.header.serviceKind:null,
   conversationId:valid||pending?state.header.conversationId:null,
   pageNumber:valid&&!loading?state.pageNumber:0,
   messages:Object.freeze(valid&&!loading?[...state.messages]:[]),
   hasOlder:Boolean(valid&&!loading&&state.nextCursor),
   pendingSend:pending,
   error:state.error,phoneNumbersRequired:false,
   deliveredWithoutAck:false,attachmentsEnabled:false,
   window:Object.freeze({maxMessages:windowLimit,
    rowsRead:state.readCount,evictedCount:state.evictedCount,
    hasEvictedNewer:state.evictedCount>0})
  });
 }
 async function open({serviceId,serviceKind,older=false,expectedConversationId=null}={}){
  if(revoked())return fail('CHAT_CONTRACT_NOT_CERTIFIED');
  if(loading||sending)return fail('CHAT_BUSY');
  // Un resultado de red ambiguo debe conciliarse con la misma clave antes
  // de permitir abrir otra conversación o generar una solicitud nueva.
  if(state.pending)return fail('PENDING_MESSAGE_RECONCILIATION');
  if(expectedConversationId!==null&&!validId(expectedConversationId))
   return fail('INVALID_CONVERSATION');
  if(older){
   if(!state.header||state.header.serviceId!==serviceId
    ||state.header.serviceKind!==serviceKind
    ||expectedConversationId!==null
     &&state.header.conversationId!==expectedConversationId
    ||!snapshot().hasOlder)
    return fail('NO_OLDER_CHAT_PAGE');
  }else if(!validId(serviceId)||!TYPES.has(serviceKind))
   return fail('INVALID_SERVICE');
  const cursor=older?state.nextCursor:null;
  // El hilo y sus cursores quedan ligados a la revisión de la sesión
  // que autorizó la primera página. Un JWT nuevo exige GET desde cero.
  const previousHeader=older?null:state.header;
  const previousSessionRevision=state.sessionRevision;
  if(older&&state.seenCursor.has(cursor)){clear();return fail('CURSOR_REPEATED');}
  const started=++generation;loading=true;state.error=null;
  try{
   let before;try{before=await getActor();}catch{before=null;}
   if(started!==generation)return fail('STALE_RESPONSE_IGNORED');
   if(revoked())return fail('CHAT_CONTRACT_NOT_CERTIFIED');
   if(!actorOk(before)){clear();return fail('AUTH_REQUIRED');}
   if(older&&(state.header.ownerId!==before.subject
    ||state.sessionRevision!==before.sessionRevision)){
    clear();return fail('STALE_SESSION_RESPONSE');
   }
   if(!older)state=blank();
   let result;
   try{result=await gateway.readMessages({
    serviceId,serviceKind,cursor,subject:before.subject,
    sessionRevision:before.sessionRevision,
    // Fijar hilo autorizado al paginar para que A pueda revocar de inmediato.
    expectedConversationId:older?state.header.conversationId
     :expectedConversationId
   });}catch{result=fail('CHAT_NETWORK_OR_TIMEOUT');}
   if(started!==generation)return fail('STALE_RESPONSE_IGNORED');
   if(revoked())return fail('CHAT_CONTRACT_NOT_CERTIFIED');
   let after;try{after=await getActor();}catch{after=null;}
   if(started!==generation)return fail('STALE_RESPONSE_IGNORED');
   if(revoked())return fail('CHAT_CONTRACT_NOT_CERTIFIED');
   if(!sameActor(before,after)){clear();return fail('STALE_SESSION_RESPONSE');}
   // Un cursor pertenece al TTL de la página que lo emitió.
   if(older&&state.header.expiresAt<=now()){
    clear();return fail('CHAT_AUTHORIZATION_EXPIRED');
   }
   if(result?.ok!==true){
    const code=result?.code||'CHAT_UNAVAILABLE';
    clear();state.error=code;return fail(code);
   }
   const verified=validPage(result.data,{
    serviceId,serviceKind,ownerId:before.subject,now:now(),
    conversationId:older?state.header.conversationId:expectedConversationId
   });
   if(!verified||older&&verified.revision!==state.header.revision
    ||!older&&previousHeader&&previousHeader.ownerId===before.subject
      &&previousSessionRevision===before.sessionRevision
      &&previousHeader.conversationId===verified?.conversationId
      &&verified.revision<previousHeader.revision){
    // Un refresco antiguo no puede reactivar permisos de este mismo hilo.
    clear();state.error='INVALID_CHAT_PAGE';return fail('INVALID_CHAT_PAGE');
   }
   if(older){
    // El cursor "anteriores" no autoriza insertar filas más recientes
    // que la última de la ventana; tiempos iguales siguen permitidos.
    if(verified.messages.length>0&&state.messages.length>0
     &&verified.messages[0].createdAt>
       state.messages[state.messages.length-1].createdAt){
     clear();state.error='CHAT_MESSAGE_ORDER_VIOLATION';
     return fail('CHAT_MESSAGE_ORDER_VIOLATION');
    }
    for(const msg of verified.messages)
     if(state.seenIds.has(msg.messageId)){
      clear();state.error='DUPLICATE_CHAT_MESSAGE';return fail('DUPLICATE_CHAT_MESSAGE');
     }
    state.messages.push(...verified.messages);
    if(cursor)state.seenCursor.add(cursor);
    state.pageNumber++;
   }else{
    state.messages=[...verified.messages];state.pageNumber=1;
    state.readCount=0;state.evictedCount=0;
    state.seenIds=new Set(verified.messages.map(m=>m.messageId));
    state.seenCursor=new Set();
    state.pending=null;
   }
   for(const msg of verified.messages)state.seenIds.add(msg.messageId);
   state.readCount+=verified.messages.length;
   trimWindow(false);
   if(verified.nextCursor!==null&&(verified.nextCursor===cursor
    ||state.seenCursor.has(verified.nextCursor))){
    clear();return fail('CURSOR_REPEATED');
   }
   state.header=authorizationHeader(verified);
    state.sessionRevision=before.sessionRevision;
   state.nextCursor=verified.nextCursor;
   return Object.freeze({ok:true,pageNumber:state.pageNumber,
    hasOlder:state.nextCursor!==null});
  }finally{if(started===generation)loading=false;}
 }
 async function send({body,requestKey,retry=false}={}){
  if(revoked())return fail('CHAT_CONTRACT_NOT_CERTIFIED');
  if(!sendReady())return fail('CHAT_SEND_NOT_CERTIFIED');
  if(loading||sending)return fail('CHAT_BUSY');
  if(!state.header||state.header.expiresAt<=now())return fail('CHAT_NOT_AUTHORIZED');
  if(!cleanMessage(body)||!validId(requestKey))return fail('INVALID_MESSAGE');
  if(retry){
   if(!state.pending||state.pending.body!==body
    ||state.pending.requestKey!==requestKey)return fail('RETRY_KEY_MISMATCH');
  }else if(state.pending)return fail('PENDING_MESSAGE_RECONCILIATION');
  else state.pending=Object.freeze({body,requestKey});
  const started=++generation;sending=true;state.error=null;
  try{
   let before;try{before=await getActor();}catch{before=null;}
   if(started!==generation)return fail('STALE_RESPONSE_IGNORED');
   if(revoked())return fail('CHAT_CONTRACT_NOT_CERTIFIED');
   if(!actorOk(before)||before.subject!==state.header.ownerId){
    clear();return fail('AUTH_REQUIRED');
   }
   if(before.sessionRevision!==state.sessionRevision){
    clear();return fail('STALE_SESSION_RESPONSE');
   }
   const currentHeader=state.header;
   let result;
   try{result=await gateway.sendMessage({
    conversationId:currentHeader.conversationId,
    serviceId:currentHeader.serviceId,serviceKind:currentHeader.serviceKind,
    body,requestKey,subject:before.subject,
    sessionRevision:before.sessionRevision
   });}catch{result=fail('CHAT_NETWORK_OR_TIMEOUT');}
   if(started!==generation)return fail('STALE_RESPONSE_IGNORED');
   if(revoked())return fail('CHAT_CONTRACT_NOT_CERTIFIED');
   let after;try{after=await getActor();}catch{after=null;}
   if(started!==generation)return fail('STALE_RESPONSE_IGNORED');
   if(revoked())return fail('CHAT_CONTRACT_NOT_CERTIFIED');
   if(!sameActor(before,after)){clear();return fail('STALE_SESSION_RESPONSE');}
   if(result?.ok!==true){
    const code=result?.code||'CHAT_UNAVAILABLE';
    if(['CHAT_NETWORK_OR_TIMEOUT','RATE_LIMITED','SERVICE_UNAVAILABLE']
      .includes(code)){state.error=code;return fail(code);}
    clear();state.error=code;return fail(code);
   }
   const ack=result.data;
   if(!validAck(ack,currentHeader,body,requestKey,now())){
    clear();state.error='INVALID_CHAT_ACK';return fail('INVALID_CHAT_ACK');
   }
   if(currentHeader.expiresAt<=now()){
    // ACK tardío: no afirmar entrega con permiso vencido. Preservar
    // body y requestKey para reconciliar con el MISMO servidor/hilo.
    state.error='CHAT_AUTHORIZATION_EXPIRED';
    return fail('CHAT_AUTHORIZATION_EXPIRED');
   }
   const accepted=Object.freeze({messageId:ack.messageId,
    senderRole:ack.senderRole,body:ack.body,createdAt:ack.createdAt,
    revision:ack.revision});
   if(state.seenIds.has(accepted.messageId)){
    // Un replay idempotente es válido solo si reproduce EXACTAMENTE
    // el mensaje persistido. No marcar éxito en una colisión de ID.
    const previous=state.messages.find(row=>row.messageId===accepted.messageId);
    if(!previous||previous.senderRole!==accepted.senderRole
     ||previous.body!==accepted.body||previous.createdAt!==accepted.createdAt
     ||previous.revision!==accepted.revision){
     clear();state.error='CHAT_MESSAGE_ID_COLLISION';
     return fail('CHAT_MESSAGE_ID_COLLISION');
    }
   }else{
    state.messages.unshift(accepted);state.seenIds.add(accepted.messageId);
    state.readCount++;
    trimWindow(true);
   }
   // El ACK durable también avanza el high-water mark del hilo. Una
   // lectura anterior al POST no puede borrar el mensaje confirmado.
   // Un cursor emitido sobre la revisión previa necesita GET fresco.
   state.header=Object.freeze({...currentHeader,revision:ack.revision});
   state.nextCursor=null;state.seenCursor=new Set();
   state.pending=null;state.error=null;
   return Object.freeze({ok:true,serverStored:true});
  }finally{if(started===generation)sending=false;}
 }
 async function retryPending(){
  if(!state.pending||!state.header)return fail('NO_PENDING_MESSAGE');
  if(revoked())return fail('CHAT_CONTRACT_NOT_CERTIFIED');
  if(!sendReady())return fail('CHAT_SEND_NOT_CERTIFIED');
  if(loading||sending)return fail('CHAT_BUSY');
  if(state.header.expiresAt<=now()){
   // Antes de un reintento con token/permiso temporal vencido,
   // releer el hilo desde backend A y revalidar asignación persistida.
   const started=++generation,prior=state.header;
   loading=true;state.error=null;
   try{
    let before;
    try{before=await getActor();}catch{before=null;}
    if(started!==generation)return fail('STALE_RESPONSE_IGNORED');
   if(revoked())return fail('CHAT_CONTRACT_NOT_CERTIFIED');
    if(!actorOk(before)||before.subject!==prior.ownerId){
     clear();return fail('AUTH_REQUIRED');
    }
    if(before.sessionRevision!==state.sessionRevision){
     clear();return fail('STALE_SESSION_RESPONSE');
    }
    let response;
    try{response=await gateway.readMessages({
     serviceId:prior.serviceId,serviceKind:prior.serviceKind,cursor:null,
     subject:before.subject,sessionRevision:before.sessionRevision,
     // Un intento incierto debe revalidar la misma conversación inmutable.
     expectedConversationId:prior.conversationId
    });}catch{response=fail('CHAT_NETWORK_OR_TIMEOUT');}
    if(started!==generation)return fail('STALE_RESPONSE_IGNORED');
   if(revoked())return fail('CHAT_CONTRACT_NOT_CERTIFIED');
    let after;
    try{after=await getActor();}catch{after=null;}
    if(started!==generation)return fail('STALE_RESPONSE_IGNORED');
   if(revoked())return fail('CHAT_CONTRACT_NOT_CERTIFIED');
    if(!sameActor(before,after)){clear();return fail('STALE_SESSION_RESPONSE');}
    if(response?.ok!==true){
     const code=response?.code||'CHAT_UNAVAILABLE';
     if(['CHAT_NETWORK_OR_TIMEOUT','RATE_LIMITED','SERVICE_UNAVAILABLE']
       .includes(code)){state.error=code;return fail(code);}
     clear();state.error=code;return fail(code);
    }
    const verified=validPage(response.data,{
     serviceId:prior.serviceId,serviceKind:prior.serviceKind,
     ownerId:before.subject,conversationId:prior.conversationId,now:now()
    });
    if(!verified||verified.revision<prior.revision){
     // No reautorizar un mensaje ambiguo desde un snapshot regresivo.
     clear();state.error='INVALID_CHAT_PAGE';return fail('INVALID_CHAT_PAGE');
    }
    state.header=authorizationHeader(verified);
     state.messages=[...verified.messages];
    state.nextCursor=verified.nextCursor;state.pageNumber=1;
    state.seenIds=new Set(verified.messages.map(item=>item.messageId));
    state.seenCursor=new Set();state.readCount=verified.messages.length;
    state.evictedCount=0;
   }finally{if(started===generation)loading=false;}
  }
  if(!state.pending)return fail('NO_PENDING_MESSAGE');
  return send({body:state.pending.body,requestKey:state.pending.requestKey,retry:true});
 }
 return Object.freeze({open,send,retryPending,snapshot,clear,isConfigured:ready});
}

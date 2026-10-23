/**
 * Bandeja privada de conversaciones Cliente.
 * No existen endpoints A de chat en G47; no se inventa HTTP ni Driver.
 * Backend debe autenticar cada petición y validar asignación real.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CURSOR=/^[A-Za-z0-9_.-]{44,384}$/;
const KINDS=new Set(['RIDE','DELIVERY','MERCHANT_ORDER']);
const ROW=['conversationId','serviceId','serviceKind','state','assignmentVerified',
 'counterpartRole','revision','unreadCount','updatedAt','canSend'];
const PAGE=['ownerId','generatedAt','expiresAt','revision','items','nextCursor',
 'productionEnabled'];
const validId=x=>typeof x==='string'&&UUID.test(x);
const exact=(x,keys)=>x!==null&&typeof x==='object'&&!Array.isArray(x)
 &&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const natural=n=>Number.isSafeInteger(n)&&n>=1;
const TRANSIENT=new Set(['NETWORK_OR_TIMEOUT','SERVICE_UNAVAILABLE','RATE_LIMITED']);
const actorOk=x=>x!==null&&typeof x==='object'&&x.role==='passenger'
 &&validId(x.subject)&&Number.isSafeInteger(x.sessionRevision)&&x.sessionRevision>=0;
const sameActor=(a,b)=>actorOk(b)&&a.subject===b.subject
 &&a.sessionRevision===b.sessionRevision;
const fail=code=>Object.freeze({ok:false,code});
// Orden inmutable descendente por actividad + UUID como desempate.
// Sin esta cerca, la paginación sobre ventana móvil puede repetir filas
// que ya fueron descartadas de RAM; cursor firmado de A debe respetarlo.
function strictlyOlder(row,previous){
 return row.updatedAt<previous.updatedAt||
  row.updatedAt===previous.updatedAt
   &&row.conversationId<previous.conversationId;
}
const empty=()=>({ownerId:null,sessionRevision:null,expiresAt:0,
 revision:null,nextCursor:null,items:[],seenIds:new Set(),
 seenCursors:new Set(),pagesRead:0,rowsRead:0,evictedCount:0,
 error:null,stale:false,lastSort:null});
function validatePage(dto,{ownerId,now,revision=null}){
 if(!exact(dto,PAGE)||!validId(ownerId)||dto.ownerId!==ownerId
  ||dto.productionEnabled!==false||!natural(dto.revision)
  ||(revision!==null&&dto.revision!==revision)
  ||!Number.isSafeInteger(dto.generatedAt)||dto.generatedAt>now
  ||dto.generatedAt<now-300000||!Number.isSafeInteger(dto.expiresAt)
  ||dto.expiresAt<=now||dto.expiresAt>now+300000
  ||dto.expiresAt<=dto.generatedAt
  ||!Array.isArray(dto.items)||dto.items.length>100
  // Un cursor con página vacía permitiría un bucle interminable.
  ||(dto.items.length===0&&dto.nextCursor!==null)
  ||!(dto.nextCursor===null||(typeof dto.nextCursor==='string'
   &&CURSOR.test(dto.nextCursor))))return null;
 const local=new Set(),services=new Set(),items=[];
 for(const row of dto.items){
  if(!exact(row,ROW)||!validId(row.conversationId)||!validId(row.serviceId)
   ||!KINDS.has(row.serviceKind)||row.state!=='ACTIVE'
   ||row.assignmentVerified!==true||row.counterpartRole!=='driver'
   ||row.canSend!==true||!natural(row.revision)
   ||row.revision>dto.revision
   ||!Number.isSafeInteger(row.unreadCount)||row.unreadCount<0
   ||!Number.isSafeInteger(row.updatedAt)
   ||row.updatedAt<0||row.updatedAt>now
   ||local.has(row.conversationId)
   ||services.has(row.serviceKind+':'+row.serviceId))return null;
  if(items.length>0&&!strictlyOlder(row,items[items.length-1]))return null;
  local.add(row.conversationId);
  services.add(row.serviceKind+':'+row.serviceId);
  items.push(Object.freeze({...row}));
 }
 return Object.freeze({ownerId,revision:dto.revision,
  expiresAt:dto.expiresAt,nextCursor:dto.nextCursor,
  items:Object.freeze(items)});
}
export function createPassengerChatInbox({gateway=null,getActor=null,
 now=()=>Date.now(),maxCachedConversations=300}={}){
 const max=Number.isSafeInteger(maxCachedConversations)
  &&maxCachedConversations>=100&&maxCachedConversations<=5000
  ?maxCachedConversations:300;
 let epoch=0,loading=false,state=empty();
 const ready=()=>{
  try{return gateway?.enabled===true&&gateway?.contractCertified===true
   &&gateway?.stagingRuntimeVerified===true&&gateway?.isConfigured?.()===true
   &&typeof gateway.readInbox==='function'&&typeof getActor==='function';
  }catch{return false;}
 };
 function clear(){
  epoch++;loading=false;state=empty();
  try{gateway?.cancelInbox?.();}catch{/* purga privada es incondicional */}
 }
 function snapshot(){
  if((!ready()||state.ownerId!==null&&state.expiresAt<=now())
    &&(state.ownerId||loading))clear();
  const valid=ready()&&state.ownerId!==null&&state.expiresAt>now();
  return Object.freeze({
   readReady:ready(),loading,stale:Boolean(valid&&state.stale),
   items:Object.freeze(valid&&!loading?[...state.items]:[]),
   pageNumber:valid&&!loading?state.pagesRead:0,
   hasNext:Boolean(valid&&!loading&&!state.stale&&state.nextCursor),
   error:state.error,phoneNumbersExposed:false,messageBodiesExposed:false,
   globalTotalKnown:false,
   window:Object.freeze({maxConversations:max,rowsRead:state.rowsRead,
    evictedCount:state.evictedCount,hasEvictedNewer:state.evictedCount>0})
  });
 }
 async function load({next=false}={}){
  if(!ready()){clear();return fail('CHAT_INBOX_CONTRACT_NOT_CERTIFIED');}
  if(loading)return fail('CHAT_INBOX_READ_IN_FLIGHT');
  const old=state,nowValue=now();
  if(next&&(!old.ownerId||old.expiresAt<=nowValue
   ||old.nextCursor===null||old.stale))return fail('CHAT_INBOX_NEXT_UNAVAILABLE');
  const cursor=next?old.nextCursor:null;
  if(next&&old.seenCursors.has(cursor)){clear();return fail('CURSOR_REPEATED');}
  const started=++epoch;loading=true;state.error=null;
  try{
   let before;
   try{before=await getActor();}catch{before=null;}
   if(started!==epoch)return fail('STALE_SESSION_RESPONSE');
   if(!ready()){clear();return fail('CHAT_INBOX_CONTRACT_NOT_CERTIFIED');}
   if(!actorOk(before)){clear();return fail('AUTH_REQUIRED');}
   if(old.ownerId!==null&&(old.ownerId!==before.subject
    ||old.sessionRevision!==before.sessionRevision)){
    clear();return fail('STALE_SESSION_RESPONSE');
   }
   let answer;
   try{answer=await gateway.readInbox({
    cursor,subject:before.subject,sessionRevision:before.sessionRevision
   });}catch{answer=fail('NETWORK_OR_TIMEOUT');}
   if(started!==epoch)return fail('STALE_SESSION_RESPONSE');
   if(!ready()){clear();return fail('CHAT_INBOX_CONTRACT_NOT_CERTIFIED');}
   let after;
   try{after=await getActor();}catch{after=null;}
   if(started!==epoch)return fail('STALE_SESSION_RESPONSE');
   if(!sameActor(before,after)){clear();return fail('STALE_SESSION_RESPONSE');}
   if(answer?.ok!==true){
    const code=typeof answer?.code==='string'?answer.code:'CHAT_INBOX_UNAVAILABLE';
    // Solo una avería transitoria puede mantener una página existente,
    // y SOLO mientras actor, JWT/gate y TTL sigan siendo válidos.
    if(TRANSIENT.has(code)&&old.ownerId===before.subject
     &&old.sessionRevision===before.sessionRevision
     &&old.expiresAt>now()){
     state.error=code;state.stale=true;return fail(code);
    }
    clear();state.error=code;return fail(code);
   }
   const page=validatePage(answer.data,{ownerId:before.subject,now:now(),
    revision:next?old.revision:null});
   if(!page){clear();state.error='INVALID_CHAT_INBOX_DTO';
    return fail('INVALID_CHAT_INBOX_DTO');}
   // Refresco confirmado: sustituye atómicamente el snapshot anterior.
   if(!next)state=empty();
   if(page.nextCursor!==null&&(page.nextCursor===cursor
    ||state.seenCursors.has(page.nextCursor))){
    clear();state.error='CURSOR_REPEATED';return fail('CURSOR_REPEATED');
   }
   for(const row of page.items){
    if(state.seenIds.has(row.conversationId)){
     clear();state.error='DUPLICATE_CONVERSATION';
     return fail('DUPLICATE_CONVERSATION');
    }
    // Cada servicio activo pertenece a un único hilo en la ventana
    // visible; una reasignación debe invalidar el cursor anterior.
    if(state.items.some(old=>old.serviceKind===row.serviceKind
      &&old.serviceId===row.serviceId)){
     clear();state.error='DUPLICATE_ACTIVE_SERVICE';
     return fail('DUPLICATE_ACTIVE_SERVICE');
    }
   }
   // También impide repetir una conversación descartada de la ventana
   // anterior: la nueva página ha de ser estrictamente más antigua.
   if(next&&old.lastSort&&page.items.length>0
    &&!strictlyOlder(page.items[0],old.lastSort)){
    clear();state.error='CHAT_INBOX_ORDER_VIOLATION';
    return fail('CHAT_INBOX_ORDER_VIOLATION');
   }
   for(const row of page.items){state.items.push(row);state.seenIds.add(row.conversationId);}
   state.rowsRead+=page.items.length;
   if(state.items.length>max){
    const discard=state.items.splice(0,state.items.length-max);
    for(const row of discard)state.seenIds.delete(row.conversationId);
    state.evictedCount+=discard.length;
   }
   if(cursor!==null)state.seenCursors.add(cursor);
   state.ownerId=page.ownerId;state.sessionRevision=before.sessionRevision;
   state.expiresAt=page.expiresAt;
   state.revision=page.revision;state.nextCursor=page.nextCursor;
   state.stale=false;state.error=null;
   if(page.items.length>0)state.lastSort=page.items[page.items.length-1];
   state.pagesRead++;
   return Object.freeze({ok:true,hasNext:page.nextCursor!==null,
    loaded:page.items.length});
  }finally{if(started===epoch)loading=false;}
 }
 return Object.freeze({load,snapshot,clear,isConfigured:ready});
}

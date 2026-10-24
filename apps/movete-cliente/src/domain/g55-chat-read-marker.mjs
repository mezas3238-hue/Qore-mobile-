/**
 * R34 / G55: validación estricta de página privada y marcador de lectura
 * emitido por servidor. SOLO QA, sin HTTP ni POST automáticos.
 * El cliente JAMÁS calcula throughSeq ni deriva watermark de fechas/revision.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CURSOR=/^[A-Za-z0-9_.-]{44,384}$/;
const KINDS=new Set(['RIDE','DELIVERY','MERCHANT_ORDER']);
const PAGE=['conversationId','serviceId','serviceKind','ownerId',
 'counterpartRole','assignmentVerified','state','revision','generatedAt',
 'expiresAt','messages','nextCursor','canSend','productionEnabled'];
const ROW=['messageId','senderRole','body','createdAt','revision'];
const ENVELOPE=['page','readMarker','qaOnly','productionEnabled'];
const MARKER=['marker','messageId','expiresAtMs'];
const RECEIPT=['conversationId','messageId','readConfirmed','qaOnly'];
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>obj(x)&&Object.keys(x).length===keys.length
 &&keys.every(k=>Object.hasOwn(x,k));
const uuid=x=>typeof x==='string'&&UUID.test(x);
const integer=x=>Number.isSafeInteger(x)&&x>=0;
const fail=code=>Object.freeze({ok:false,code});
const safeBody=s=>typeof s==='string'&&s.length>=1&&s.length<=500
 &&s.trim()===s&&s.trim().length>0
 &&!/[\u0000-\u001f\u007f<>]/u.test(s)
 &&!/(?:https?:\/\/|www\.)/i.test(s)
 &&!/[\u202a-\u202e\u2066-\u2069\u200e\u200f]/u.test(s)
 &&!/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/u.test(s)
 &&!/(?:\+?\d[\s().-]*){7,}/u.test(s);

export function validateG55ReadMarkerEnvelope(dto,{
 serviceId,serviceKind,subject,expectedConversationId,now
}={}){
 if(!uuid(serviceId)||!KINDS.has(serviceKind)||!uuid(subject)
  ||!uuid(expectedConversationId)||!integer(now)
  ||!exact(dto,ENVELOPE)||dto.qaOnly!==true
  ||dto.productionEnabled!==false)return fail('INVALID_G55_ENVELOPE');
 const p=dto.page;
 if(!exact(p,PAGE)||p.serviceId!==serviceId
  ||p.serviceKind!==serviceKind||p.ownerId!==subject
  ||p.conversationId!==expectedConversationId||!uuid(p.conversationId)
  ||p.counterpartRole!=='driver'||p.assignmentVerified!==true
  ||p.state!=='ACTIVE'||p.canSend!==true
  ||p.productionEnabled!==false||!integer(p.revision)||p.revision<1
  ||!integer(p.generatedAt)||p.generatedAt>now
  ||p.generatedAt<now-300000
  ||!integer(p.expiresAt)||p.expiresAt<=now
  ||p.expiresAt>now+300000||p.expiresAt<=p.generatedAt
  ||!Array.isArray(p.messages)||p.messages.length>100
  ||!(p.nextCursor===null||(typeof p.nextCursor==='string'
   &&CURSOR.test(p.nextCursor)))
  ||(p.messages.length===0&&p.nextCursor!==null))
  return fail('INVALID_G55_PAGE');
 const rows=[],seen=new Set();
 for(const row of p.messages){
  if(!exact(row,ROW)||!uuid(row.messageId)
   ||!['passenger','driver'].includes(row.senderRole)
   ||!safeBody(row.body)||!integer(row.createdAt)||row.createdAt>now
   ||!integer(row.revision)||row.revision<2||row.revision>p.revision
   ||seen.has(row.messageId)
   ||(rows.length>0&&row.createdAt>rows[rows.length-1].createdAt))
   return fail('INVALID_G55_PAGE');
  seen.add(row.messageId);
  rows.push(Object.freeze({...row}));
 }
 let marker=null;
 if(dto.readMarker!==null){
  const m=dto.readMarker;
  if(!exact(m,MARKER)||!uuid(m.marker)||!uuid(m.messageId)
   ||!integer(m.expiresAtMs)||m.expiresAtMs<=now
   ||m.expiresAtMs>p.expiresAt
   ||!rows.some(r=>r.senderRole==='driver'&&r.messageId===m.messageId))
   return fail('INVALID_G55_MARKER');
  marker=Object.freeze({...m});
 }
 return Object.freeze({ok:true,data:Object.freeze({
  page:Object.freeze({...p,messages:Object.freeze(rows)}),
  readMarker:marker,qaOnly:true,productionEnabled:false
 })});
}

/**
 * No se conecta a la UI hasta certificar evento de visibilidad real.
 * Un GET válido NO provoca POST, ni confirma/unread decrementa nada.
 */
export function createG55ExplicitVisibleReadFlow({transport=null,now=()=>Date.now()}={}){
 let grant=null,generation=0,inFlight=false,confirmed=false;
 const clear=()=>{
  generation++;grant=null;confirmed=false;inFlight=false;
  try{transport?.cancelPending?.();}catch{}
 };
 function acceptPage(envelope,scope){
  clear();
  const checked=validateG55ReadMarkerEnvelope(envelope,{...scope,now:now()});
  if(!checked.ok)return checked;
  if(checked.data.readMarker!==null){
   grant=Object.freeze({
    marker:checked.data.readMarker.marker,
    messageId:checked.data.readMarker.messageId,
    expiresAtMs:checked.data.readMarker.expiresAtMs,
    conversationId:checked.data.page.conversationId,
    serviceId:checked.data.page.serviceId,
    serviceKind:checked.data.page.serviceKind,
    subject:scope.subject,
    sessionRevision:scope.sessionRevision
   });
   if(!integer(scope.sessionRevision)){clear();return fail('INVALID_G55_SCOPE');}
  }
  return Object.freeze({ok:true,hasMarker:grant!==null,
   messageId:grant?.messageId??null});
 }
 async function markVisible({messageId,conversationId,subject,sessionRevision,
  fullyVisible=false,appForeground=false}={}){
  if(!grant)return fail('G55_NO_AUTHORIZED_VISIBLE_MARKER');
  if(confirmed)return fail('G55_ALREADY_CONFIRMED');
  if(inFlight)return fail('G55_MARK_IN_FLIGHT');
  if(messageId!==grant.messageId||conversationId!==grant.conversationId
   ||subject!==grant.subject||sessionRevision!==grant.sessionRevision)
   return fail('G55_STALE_SCOPE');
  if(!fullyVisible||!appForeground)
   return fail('G55_EXPLICIT_VISIBILITY_REQUIRED');
  if(!integer(now())||now()>=grant.expiresAtMs){
   clear();return fail('G55_MARKER_EXPIRED');
  }
  if(!transport||transport.isConfigured?.()!==true
   ||typeof transport.markVisible!=='function')
   return fail('G55_RUNTIME_NOT_CERTIFIED');
  inFlight=true;
  const ticket=grant,started=generation;
  try{
   const r=await transport.markVisible({
    marker:ticket.marker,conversationId:ticket.conversationId,
    messageId:ticket.messageId,subject:ticket.subject,
    sessionRevision:ticket.sessionRevision
   });
   if(started!==generation||grant!==ticket)return fail('G55_STALE_SCOPE');
   if(!integer(now())||now()>=ticket.expiresAtMs)
    return fail('G55_MARKER_EXPIRED');
   const ack=r?.data;
   if(r?.ok!==true||!exact(ack,RECEIPT)
    ||ack.conversationId!==ticket.conversationId
    ||ack.messageId!==ticket.messageId
    ||ack.readConfirmed!==true||ack.qaOnly!==true)
    return fail('G55_READ_UNCONFIRMED');
   confirmed=true;
   return Object.freeze({ok:true,readConfirmed:true,
    conversationId:ticket.conversationId,messageId:ticket.messageId});
  }catch{
   return started!==generation?fail('G55_STALE_SCOPE')
    :fail('G55_READ_UNCONFIRMED');
  }finally{if(started===generation)inFlight=false;}
 }
 return Object.freeze({acceptPage,markVisible,clear,
  snapshot:()=>Object.freeze({hasMarker:grant!==null&&!confirmed
   &&integer(now())&&now()<grant.expiresAtMs,readConfirmed:confirmed})});
}

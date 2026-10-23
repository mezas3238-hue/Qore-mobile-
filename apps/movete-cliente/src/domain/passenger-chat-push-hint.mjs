/**
 * Proyección de pista de notificación de chat. NO implementa push/OS.
 * Texto privado y datos del destinatario nunca deben salir en la alerta.
 * El push NO autoriza abrir el chat; require server-side assignment check.
 */
const SERVICE_ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS=new Set(['RIDE','DELIVERY','MERCHANT_ORDER']);
const REQUIRED=['eventId','ownerId','serviceId','serviceKind',
 'kind','revision','issuedAt','expiresAt','unreadCount','contentIncluded'];
const exact=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)
 &&Object.keys(x).length===REQUIRED.length
 &&REQUIRED.every(k=>Object.hasOwn(x,k));
const validId=x=>typeof x==='string'&&SERVICE_ID.test(x);
const safeCount=n=>Number.isSafeInteger(n)&&n>=1&&n<=99;
const validTime=n=>Number.isSafeInteger(n)&&n>=0;
export function projectPassengerChatPushHint(raw,{subject,now=Date.now()}={}){
 if(!validId(subject)||!exact(raw)||!validId(raw.eventId)
  ||raw.ownerId!==subject||!validId(raw.serviceId)
  ||!KINDS.has(raw.serviceKind)||raw.kind!=='CHAT_ACTIVITY'
  ||!Number.isSafeInteger(raw.revision)||raw.revision<1
  ||!validTime(raw.issuedAt)||!validTime(raw.expiresAt)
  ||raw.issuedAt>now||raw.issuedAt<now-120000
  ||raw.expiresAt<=now||raw.expiresAt>now+300000
  ||raw.expiresAt<=raw.issuedAt
  ||!safeCount(raw.unreadCount)||raw.contentIncluded!==false)
  return null;
 // Esta única representación puede pasarse a un adaptador push SOLO
 // después de aprobar autorizaciones y política de privacidad del SO.
 return Object.freeze({
  eventId:raw.eventId,serviceId:raw.serviceId,
  serviceKind:raw.serviceKind,revision:raw.revision,
  title:'Movete Fácil',
  body:'Tenés mensajes nuevos de tu servicio.',
  badgeText:raw.unreadCount===99?'99+':String(raw.unreadCount),
  expiresAt:raw.expiresAt,requiresServerAuthorization:true,
  containsMessageBody:false,containsSenderIdentity:false
 });
}
export function createPassengerChatPushHintStore({now=()=>Date.now(),
 maxServices=200}={}){
 const limit=Number.isSafeInteger(maxServices)&&maxServices>=10&&maxServices<=1000
  ?maxServices:200;
 let subject=null,latest=new Map();
 function clear(){subject=null;latest.clear();}
 function accept(raw,sessionSubject){
  const item=projectPassengerChatPushHint(raw,{subject:sessionSubject,now:now()});
  if(!item){return {ok:false,code:'INVALID_PUSH_HINT'};}
  if(subject!==null&&subject!==sessionSubject)clear();
  subject=sessionSubject;
  const key=item.serviceKind+':'+item.serviceId;
  const prior=latest.get(key);
  if(prior&&(prior.revision>=item.revision||prior.eventId===item.eventId))
   return {ok:false,code:'PUSH_REPLAY_IGNORED'};
  // No es una cuota de registros de servicios, solo caché local de pistas.
  if(latest.has(key))latest.delete(key);
  latest.set(key,item);
  while(latest.size>limit)latest.delete(latest.keys().next().value);
  return {ok:true,hasChatAuthorization:false};
 }
 function snapshot(sessionSubject){
  if(subject!==sessionSubject||typeof sessionSubject!=='string')return [];
  const visible=[];
  for(const item of latest.values())
   if(item.expiresAt>now())visible.push(item);
  return Object.freeze(visible);
 }
 return Object.freeze({accept,snapshot,clear});
}

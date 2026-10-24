/**
 * El historial verificado puede llevar a mensajes del servicio, pero NO
 * certifica por sí solo una asignación a Driver; el backend la revalida.
 * Sin chat habilitado, ni URL del historial propio: botón oculto.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS=new Set(['RIDE','DELIVERY','MERCHANT_ORDER']);
const ACTIVE=new Set(['assigned','in_progress']);
export function canShowPassengerServiceChat({authenticated=false,
 contractReady=false,accountSubject='',historyOwnerId='',
 serviceId='',kind='',status=''}={}){
 return authenticated===true&&contractReady===true
  &&typeof accountSubject==='string'&&UUID.test(accountSubject)
  &&accountSubject===historyOwnerId&&typeof serviceId==='string'
  &&UUID.test(serviceId)&&KINDS.has(kind)&&ACTIVE.has(status);
}

/**
 * React debe desmontar INMEDIATAMENTE el borrador local al cambiar de
 * servicio (incluso con el mismo pasajero/JWT). No depender de useEffect.
 */
/**
 * La URL de "historial" no tiene conversationId. En ese caso incluir el
 * hilo autorizado por el backend en la clave React, para desmontar el borrador
 * si se reasigna el conductor sin cambiar serviceId ni JWT.
 *
 * No confiar en un hilo de otro servicio, en una sesión no autenticada ni
 * en la vista de una autorización caducada.
 *
 * @param {{sessionRevision?:number,serviceId?:string|null,
 * serviceKind?:string|null,conversationId?:string|null,
 * authorizedConversationId?:string|null,authorizedServiceId?:string|null,
 * authorizedServiceKind?:string|null,authorized?:boolean}} [options]
 */
export function passengerChatPrivateViewKey({sessionRevision,
 serviceId=null,serviceKind=null,conversationId=null,
 authorizedConversationId=null,authorizedServiceId=null,
 authorizedServiceKind=null,authorized=false}={}){
 const rev=Number.isSafeInteger(sessionRevision)&&sessionRevision>=0
  ?sessionRevision:'UNAUTHORIZED';
 const id=typeof serviceId==='string'&&UUID.test(serviceId)?serviceId:'NO_SERVICE';
 const kind=KINDS.has(serviceKind)?serviceKind:'NO_KIND';
 const resolved=conversationId===null&&authorized===true&&rev!=='UNAUTHORIZED'
  &&id!=='NO_SERVICE'&&kind!=='NO_KIND'
  &&authorizedServiceId===serviceId&&authorizedServiceKind===serviceKind
  &&typeof authorizedConversationId==='string'
  &&UUID.test(authorizedConversationId)
  ?authorizedConversationId:null;
 const threadId=conversationId===null?resolved:conversationId;
 const thread=threadId===null?'NO_THREAD'
  :typeof threadId==='string'&&UUID.test(threadId)
   ?threadId:'INVALID_THREAD';
 return `${rev}:${kind}:${id}:${thread}`;
}

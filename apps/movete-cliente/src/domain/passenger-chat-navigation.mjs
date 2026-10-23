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
export function passengerChatPrivateViewKey({sessionRevision,
 serviceId=null,serviceKind=null}={}){
 const rev=Number.isSafeInteger(sessionRevision)&&sessionRevision>=0
  ?sessionRevision:'UNAUTHORIZED';
 const id=typeof serviceId==='string'&&UUID.test(serviceId)?serviceId:'NO_SERVICE';
 const kind=KINDS.has(serviceKind)?serviceKind:'NO_KIND';
 return `${rev}:${kind}:${id}`;
}

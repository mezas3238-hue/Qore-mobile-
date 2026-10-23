/**
 * El historial verificado puede llevar a mensajes del servicio, pero NO
 * certifica por sí solo una asignación a Driver; el backend la revalida.
 * Sin chat habilitado, ni URL del historial propio: botón oculto.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS=new Set(['RIDE','DELIVERY','MERCHANT_ORDER']);
const ACTIVE=new Set(['assigned','in_progress']);
export function canShowPassengerServiceChat({authenticated=false,
 contractReady=false,accountSubject=null,historyOwnerId=null,
 serviceId=null,kind=null,status=null}={}){
 return authenticated===true&&contractReady===true
  &&typeof accountSubject==='string'&&UUID.test(accountSubject)
  &&accountSubject===historyOwnerId&&typeof serviceId==='string'
  &&UUID.test(serviceId)&&KINDS.has(kind)&&ACTIVE.has(status);
}

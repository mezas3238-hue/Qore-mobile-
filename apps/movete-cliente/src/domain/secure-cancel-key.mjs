/**
 * Clave efímera para cancelación: el único origen aceptado debe ser un
 * generador criptográfico provisto por el sistema operativo (expo-crypto).
 * Nunca usar Math.random, Date.now, UUID incremental ni fallback silencioso.
 */
const UUID_V4=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail=code=>Object.freeze({ok:false,code});
export function createSecureCancellationKey(randomUUID){
 if(typeof randomUUID!=='function')return fail('SECURE_RANDOM_UNAVAILABLE');
 try{
  const value=randomUUID();
  if(typeof value!=='string'||!UUID_V4.test(value))
   return fail('SECURE_RANDOM_UNAVAILABLE');
  return Object.freeze({ok:true,requestKey:value});
 }catch{return fail('SECURE_RANDOM_UNAVAILABLE');}
}

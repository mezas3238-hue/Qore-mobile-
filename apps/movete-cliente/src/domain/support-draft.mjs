/** Validación EXCLUSIVAMENTE local. Nunca crea un caso, recibo, aviso o SOS. */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const SUPPORT_TYPES=Object.freeze([
 Object.freeze({code:'SAFETY',label:'Seguridad (no SOS)'}),
 Object.freeze({code:'RIDE',label:'Viaje'}),
 Object.freeze({code:'DELIVERY',label:'Envío'}),
 Object.freeze({code:'PAYMENT',label:'Consulta sobre pago'}),
 Object.freeze({code:'OTHER',label:'Otro'})
]);

/** Barrera orientativa, no detector exhaustivo de PII: no reemplaza protección server-side. */
export function containsSensitiveSupportText(text){
 if(typeof text!=='string')return false;
 const patterns=[
  /\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/i,
  /(?:^|[^\w])(?:\+?595[\s().-]*)?0?9\d{2}[\s().-]*\d{3}[\s().-]*\d{3}(?=$|[^\w])/i,
  /\b(?:https?:\/\/|www\.)\S+/i,
  /\b(?:c[eé]dula|c\.?\s*i\.?|documento|pasaporte)\s*(?:n(?:ro|[úu]mero|[°ºo.])?\s*)?[:#-]?\s*\d[\d .-]{3,20}/i,
  /(?:^|\D)(?:\d[ -]?){13,19}(?=$|\D)/,
  /-?\d{1,2}\.\d{4,}\s*[,;]\s*-?\d{1,3}\.\d{4,}/,
  /\b(?:contrase[nñ]a|password|otp|cvv|pin de acceso|clave de acceso)\s*[:=#-]?\s*\S+/i
 ];
 return patterns.some(pattern=>pattern.test(text));
}

export function validateSupportDraft(value){
 if(!value||typeof value!=='object'||Array.isArray(value))return {ok:false,reason:'Formulario inválido'};
 const {category,serviceId,description}=value;
 if(!SUPPORT_TYPES.some(x=>x.code===category))return {ok:false,reason:'Seleccioná un motivo'};
 if(serviceId!==''&&(typeof serviceId!=='string'||!UUID.test(serviceId)))
  return {ok:false,reason:'Identificador del servicio inválido'};
 if(typeof description!=='string'||description.trim().length<12||description.trim().length>500)
  return {ok:false,reason:'Describí el incidente entre 12 y 500 caracteres'};
 if(containsSensitiveSupportText(description))
  return {ok:false,reason:'Quitá teléfonos, correos, documentos, enlaces, ubicaciones y otros datos sensibles'};
 return {ok:true,localOnly:true,submitted:false,category,
  serviceId,description:description.trim()};
}

/** Validación local de incidentes. No se transmite ni constituye SOS real. */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const SUPPORT_TYPES=Object.freeze([
 Object.freeze({code:'SAFETY',label:'Seguridad'}),
 Object.freeze({code:'RIDE',label:'Viaje'}),
 Object.freeze({code:'DELIVERY',label:'Envío'}),
 Object.freeze({code:'PAYMENT',label:'Pago simulado'}),
 Object.freeze({code:'OTHER',label:'Otro'})
]);
export function validateSupportDraft(value){
 if(!value||typeof value!=='object'||Array.isArray(value))return {ok:false,reason:'Formulario inválido'};
 const {category,serviceId,description}=value;
 if(!SUPPORT_TYPES.some(x=>x.code===category))return {ok:false,reason:'Seleccioná un motivo'};
 if(serviceId!==''&&(typeof serviceId!=='string'||!UUID.test(serviceId)))
  return {ok:false,reason:'Identificador del servicio inválido'};
 if(typeof description!=='string'||description.trim().length<12||description.trim().length>500)
  return {ok:false,reason:'Describí el incidente entre 12 y 500 caracteres'};
 if(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/.test(description)
   ||/\b(?:\+?595[ -]?)?0?9\d{2}[ -]?\d{3}[ -]?\d{3}\b/.test(description))
  return {ok:false,reason:'No ingreses correos, teléfonos ni información sensible'};
 return {ok:true,localOnly:true,submitted:false,category,
  serviceId,description:description.trim()};
}

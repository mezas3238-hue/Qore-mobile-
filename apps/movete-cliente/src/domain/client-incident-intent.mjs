import {validateIncidentG40Request} from './incident-g40-gateway.mjs';
import {createSecureCancellationKey} from './secure-cancel-key.mjs';
/** Solo contrato G40 tipado; no acepta texto/PII o ubicación como payload. */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const INCIDENT_SERVICE_OPTIONS=Object.freeze([
 Object.freeze({code:'RIDE',label:'Viaje en automóvil'}),
 Object.freeze({code:'DELIVERY',label:'Envío particular'}),
 Object.freeze({code:'MERCHANT_ORDER',label:'Pedido comercial'})
]);
export const INCIDENT_CATEGORY_OPTIONS=Object.freeze([
 Object.freeze({code:'QUALITY',label:'Calidad del servicio'}),
 Object.freeze({code:'LOSS',label:'Objeto faltante o perdido'}),
 Object.freeze({code:'DISPUTE',label:'Desacuerdo sobre el servicio'}),
 Object.freeze({code:'FRAUD',label:'Posible fraude'}),
 Object.freeze({code:'SAFETY',label:'Seguridad (NO SOS)'})
]);
export const INCIDENT_SEVERITY_OPTIONS=Object.freeze([
 Object.freeze({code:'LOW',label:'Baja'}),
 Object.freeze({code:'MEDIUM',label:'Media'}),
 Object.freeze({code:'HIGH',label:'Alta (NO emergencia)'})
]);
const fail=reason=>Object.freeze({ok:false,reason});
export function prepareG40IncidentIntent({
 subjectKind,subjectId,category,severity
}={},secureUUID){
 if(!INCIDENT_SERVICE_OPTIONS.some(x=>x.code===subjectKind)||typeof subjectId!=='string'
   ||!UUID.test(subjectId)||!INCIDENT_CATEGORY_OPTIONS.some(x=>x.code===category)
   ||!INCIDENT_SEVERITY_OPTIONS.some(x=>x.code===severity))
  return fail('Elegí servicio, motivo, gravedad y un identificador UUID válido');
 const key=createSecureCancellationKey(secureUUID);
 if(!key.ok)return fail('No está disponible el generador seguro de identificadores');
 const body={requestKey:key.requestKey,subjectKind,subjectId,category,severity};
 if(!validateIncidentG40Request(body))return fail('Solicitud fuera del contrato G40');
 return Object.freeze({ok:true,body:Object.freeze(body),submitted:false,
  qaDatabaseOnly:true,sosDispatched:false,operatorNotified:false});
}

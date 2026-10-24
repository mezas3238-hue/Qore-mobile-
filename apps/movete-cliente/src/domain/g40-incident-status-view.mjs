/**
 * R41: proyección de UN snapshot de estado de incidente, sin fingir
 * un histórico, un agente, una respuesta, un SOS o una atención real.
 * G40 sigue QA-only y x-qore-runtime-wired:false. Sin red ni storage.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEYS=['incidentId','receiptId','state','revision','createdAt','observedAt','receiptStatus'];
const STATE=Object.freeze({
 open:Object.freeze({label:'Registrado en base de pruebas',description:'El registro QA existe; no acredita atención.'}),
 triaged:Object.freeze({label:'Clasificación registrada en QA',description:'Cambio de estado en QA; no demuestra revisión humana.'}),
 investigating:Object.freeze({label:'Estado de análisis en QA',description:'Estado técnico en QA; no demuestra que haya un agente trabajando.'}),
 resolved:Object.freeze({label:'Marcado como resuelto en QA',description:'Marcado técnico en QA; no equivale a solución confirmada con el usuario.'}),
 dismissed:Object.freeze({label:'Marcado como cerrado en QA',description:'Cierre técnico en QA; no prueba notificación al cliente.'})
});
const fail=(code)=>Object.freeze({verified:false,code,label:'Estado no verificado',
 description:'Consultá nuevamente cuando el backend esté certificado.',
 receiptId:null,incidentId:null,revision:null,observedAt:null,
 qaOnly:true,operatorNotified:false,sosDispatched:false,merchantContacted:false,
 humanSupportConfirmed:false});
const exact=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)
 &&Object.keys(x).length===KEYS.length
 &&KEYS.every(k=>Object.hasOwn(x,k));
const instant=s=>{
 if(typeof s!=='string'||!/^20\d\d-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/.test(s))return null;
 const ms=Date.parse(s);
 return Number.isFinite(ms)?ms:null;
};
/**
 * Max 45 s desde observedAt. La expiración se aplica en el render
 * (no debe depender del último efecto/polling). Nunca se interpreta
 * el estado "triaged" como prueba de notificación a soporte.
 */
export function projectQaIncidentStatusView(report,{authenticated=false,now=Date.now()}={}){
 if(authenticated!==true)return fail('AUTH_REQUIRED');
 if(report===null||typeof report!=='object'||Array.isArray(report)
  ||report.contractReady!==true||report.qaDatabaseOnly!==true
  ||report.sosDispatched!==false||report.operatorNotified!==false)
  return fail('INCIDENT_RUNTIME_NOT_CERTIFIED');
 if(report.statusFresh!==true||report.phase!=='acknowledged')
  return fail('INCIDENT_STATUS_NOT_FRESH');
 const receipt=report.receipt;
 if(!exact(receipt)||typeof receipt.incidentId!=='string'||!UUID.test(receipt.incidentId)
  ||typeof receipt.receiptId!=='string'||!UUID.test(receipt.receiptId)
  ||!Object.hasOwn(STATE,receipt.state)||!Number.isSafeInteger(receipt.revision)
  ||receipt.revision<1||receipt.receiptStatus!=='RECEIVED_IN_QA_DATABASE_ONLY')
  return fail('INVALID_INCIDENT_RECEIPT');
 const created=instant(receipt.createdAt),observed=instant(receipt.observedAt);
 if(!Number.isSafeInteger(now)||created===null||observed===null
  ||created>observed||observed>now||created>now||now-observed>=45000)
  return fail('INCIDENT_STATUS_EXPIRED');
 const meta=STATE[receipt.state];
 return Object.freeze({verified:true,code:'QA_DATABASE_SNAPSHOT_ONLY',
  label:meta.label,description:meta.description,
  incidentId:receipt.incidentId,receiptId:receipt.receiptId,
  revision:receipt.revision,observedAt:receipt.observedAt,qaOnly:true,
  operatorNotified:false,sosDispatched:false,merchantContacted:false,
  humanSupportConfirmed:false});
}

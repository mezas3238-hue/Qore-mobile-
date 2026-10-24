import {isValidReview} from './admin-access.mjs';
/** Datos de demostración, sin nombres, documentos ni identificadores reales. */
export const TRAINING_CASES=Object.freeze([
 Object.freeze({id:'123e4567-e89b-42d3-a456-426614174010',label:'Expediente QA-001',vehicleKind:'AUTO',documentLabel:'Seguro pendiente'}),
 Object.freeze({id:'123e4567-e89b-42d3-a456-426614174011',label:'Expediente QA-002',vehicleKind:'MOTO CARGA',documentLabel:'Licencia no validada'}),
 Object.freeze({id:'123e4567-e89b-42d3-a456-426614174012',label:'Expediente QA-003',vehicleKind:'AUTO',documentLabel:'Inspección pendiente'})
]);
export function createReviewDraft(value){
 if(value===null||typeof value!=='object'||Array.isArray(value))return {ok:false,reason:'Datos de revisión inválidos'};
 const input={
  requestKey:value.requestKey,vehicleId:value.vehicleId,
  approve:value.approve,reason:typeof value.reason==='string'?value.reason.trim():value.reason
 };
 if(!TRAINING_CASES.some(row=>row.id===input.vehicleId))
  return {ok:false,reason:'Solo se admite un expediente ficticio conocido en este laboratorio'};
 if(typeof input.reason==='string'&&(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/.test(input.reason)
     ||/\b(?:\+?595[ -]?)?0?9\d{2}[ -]?\d{3}[ -]?\d{3}\b/.test(input.reason)))
  return {ok:false,reason:'No ingreses teléfonos o correos de personas reales'};
 if(!isValidReview(input))return {ok:false,reason:'Escribí un motivo de 12 a 500 caracteres y verificá la revisión'};
 return {ok:true,localOnly:true,submitted:false,summary:{
  caseLabel:TRAINING_CASES.find(row=>row.id===input.vehicleId).label,
  approve:input.approve,reason:input.reason
 }};
}

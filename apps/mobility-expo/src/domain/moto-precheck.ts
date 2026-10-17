/**
 * Motorcycle onboarding information only. Nothing here establishes legal
 * commercial eligibility or writes to a backend. No PII is captured.
 */
export type MotoPrecheckField =
 | 'licenseClassEvidence'
 | 'vehicleRegistrationEvidence'
 | 'paidPassengerInsuranceEvidence'
 | 'municipalCommercialPermitEvidence'
 | 'inspectionEvidence'
 | 'twoCertifiedHelmets'
 | 'twoReflectiveVests'
 | 'routeSafetyInformation';

export type MotoPrecheckAnswers = Record<MotoPrecheckField, boolean>;
export const MOTO_PRECHECK_ITEMS: readonly {key:MotoPrecheckField;label:string;detail:string}[] = [
 {key:'licenseClassEvidence',label:'Licencia habilitante para motocicleta',detail:'Clase vigente, sujeta a comprobación de categoría y municipio'},
 {key:'vehicleRegistrationEvidence',label:'Cédula y habilitación de la motocicleta',detail:'Identificación de vehículo y vigencia documental'},
 {key:'paidPassengerInsuranceEvidence',label:'Póliza que cubra pasajeros remunerados',detail:'Debe constar por escrito y ser verificada por la aseguradora'},
 {key:'municipalCommercialPermitEvidence',label:'Autorización comercial municipal específica',detail:'La circulación particular no equivale a permiso para mototaxi por aplicación'},
 {key:'inspectionEvidence',label:'Inspección técnica del vehículo',detail:'Estado y requisitos de seguridad de circulación'},
 {key:'twoCertifiedHelmets',label:'Dos cascos reglamentarios',detail:'Uno para quien conduce y otro para quien viaja'},
 {key:'twoReflectiveVests',label:'Dos chalecos reflectivos',detail:'Equipamiento para ambos ocupantes'},
 {key:'routeSafetyInformation',label:'Zonas y rutas a verificar',detail:'Restricciones territoriales, vías y horarios aún pendientes de certificar'},
] as const;
export function emptyMotoPrecheck(): MotoPrecheckAnswers {
 return {
  licenseClassEvidence:false,vehicleRegistrationEvidence:false,
  paidPassengerInsuranceEvidence:false,municipalCommercialPermitEvidence:false,
  inspectionEvidence:false,twoCertifiedHelmets:false,twoReflectiveVests:false,
  routeSafetyInformation:false,
 };
}
export interface MotoPrecheckResult {
 readonly missing:readonly string[];
 readonly declaredReadyForReview:boolean;
 readonly commercialTripsAllowed:false;
 readonly decision:'RESEARCH_ONLY';
 readonly notice:string;
}
export function evaluateMotoPrecheck(answers:MotoPrecheckAnswers):MotoPrecheckResult {
 const missing=MOTO_PRECHECK_ITEMS.filter(item=>answers[item.key]!==true).map(item=>item.label);
 return {
  missing,
  declaredReadyForReview:missing.length===0,
  commercialTripsAllowed:false,
  decision:'RESEARCH_ONLY',
  notice:missing.length===0
   ? 'Completaste una autoevaluación informativa. Aún faltan autorización legal, verificaciones oficiales y aprobación en servidor; no podés recibir viajes.'
   : 'Esta lista es informativa; no reemplaza documentos, revisión administrativa ni autorización comercial.',
 };
}

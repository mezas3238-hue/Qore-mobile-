/**
 * G299: safe, non-PII checklist constructed from *read-only authenticated*
 * G17 driver document status response. Does not validate authenticity or
 * grant role, driver eligibility, vehicle approval, or commercial readiness.
 */
export const DOCUMENT_KINDS=Object.freeze([
 'licencia','identidad_frente','identidad_dorso','cedula_verde',
 'habilitacion','seguro','inspeccion','rostro_selfie'
]);
const STATES=new Set(['pending','approved','rejected']);
const VALID=new Set(DOCUMENT_KINDS);
const result=(session,entries)=>Object.freeze({
 session,entries:Object.freeze(entries),
 driverEligible:false,vehicleApproved:false,mayDispatch:false,
 identityVerified:false,readyForCommercialUse:false
});
export function buildPrivateDriverDocumentDossier({connected=false,documents=[]}={}){
 if(connected!==true)
  return result('unverified',DOCUMENT_KINDS.map(kind=>
   Object.freeze({kind,state:'unknown',serverVerified:false})));
 if(!Array.isArray(documents)||documents.length>8)
  return result('invalid',DOCUMENT_KINDS.map(kind=>
   Object.freeze({kind,state:'unknown',serverVerified:false})));
 const statuses=new Map();
 for(const row of documents){
  if(!row||typeof row!=='object'||Array.isArray(row)||
   !VALID.has(row.kind)||!STATES.has(row.status)||statuses.has(row.kind))
   return result('invalid',DOCUMENT_KINDS.map(kind=>
    Object.freeze({kind,state:'unknown',serverVerified:false})));
  statuses.set(row.kind,row.status);
 }
 return result('connected',DOCUMENT_KINDS.map(kind=>
  Object.freeze({kind,state:statuses.get(kind)??'missing',
   serverVerified:statuses.has(kind)})));
}

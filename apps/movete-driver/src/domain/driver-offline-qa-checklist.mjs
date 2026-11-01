/**
 * G301: ephemeral local operator checklist, NO document text, images,
 * identifiers, network transfers, certificates or KYC/vehicle approval.
 */
export const DRIVER_OFFLINE_QA_CHECKS=Object.freeze([
 'permission_prompt','ocr_consistent','ocr_conflict',
 'autocapture_or_manual','background_discards','local_photos_absent'
]);
const kinds=new Set(DRIVER_OFFLINE_QA_CHECKS);
export function buildDriverOfflineQaChecklist(raw={}){
 const blank=()=>Object.freeze(DRIVER_OFFLINE_QA_CHECKS.map(kind=>
  Object.freeze({kind,observed:false})));
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||
  Object.keys(raw).some(k=>!kinds.has(k))||
  Object.values(raw).some(v=>typeof v!=='boolean'))
  return Object.freeze({valid:false,count:0,total:6,entries:blank(),
   certified:false,driverEligible:false,mayDispatch:false});
 const entries=Object.freeze(DRIVER_OFFLINE_QA_CHECKS.map(kind=>
  Object.freeze({kind,observed:raw[kind]===true})));
 return Object.freeze({valid:true,count:entries.filter(x=>x.observed).length,
  total:entries.length,entries,certified:false,
  driverEligible:false,mayDispatch:false});
}

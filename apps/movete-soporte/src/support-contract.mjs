/**
 * G301 support agent: read-only minimum-necessary case DTO.
 * NO identity, telephone, home address, payment, driver KYC, exact GPS,
 * financial data, SOS evidence or full incident records.
 */
export const SUPPORT_CATEGORIES=Object.freeze(['VIAJE_AUTO','VIAJE_MOTO','ENVIO_AUTO','ENVIO_MOTO','COMERCIO','CUENTA','OTRO']);
export const SUPPORT_STATUSES=Object.freeze(['OPEN','IN_PROGRESS','WAITING_CUSTOMER','ESCALATED','RESOLVED']);
export const SUPPORT_PRIORITIES=Object.freeze(['NORMAL','HIGH','CRITICAL']);
export const SUPPORT_PERMISSIONS=Object.freeze({
  viewAssignedCases:true,viewUnassignedQueue:true,writeReply:false,
  assignCase:false,closeCase:false,escalateCase:false,
  approveDriver:false,readDriverKyc:false,readIdentityDocuments:false,
  changeFares:false,changeCommissions:false,moveMoney:false,
  editPayouts:false,manageRoles:false,changeSafetyEvidence:false,
  enableLiveOperations:false,seeRawLocations:false
});
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const CASE_KEYS=['ticket_id','case_code','category','summary','status','priority','assigned_support_id','updated_at'];
const STRING_CODE=/^[A-Z0-9-]{5,32}$/;
const includes=(list,v)=>typeof v==='string'&&list.includes(v);
export function parseSupportCase(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||
  Object.keys(raw).length!==CASE_KEYS.length||
  CASE_KEYS.some(k=>!Object.hasOwn(raw,k)))return null;
 if(typeof raw.ticket_id!=='string'||!UUID.test(raw.ticket_id)||
  typeof raw.case_code!=='string'||!STRING_CODE.test(raw.case_code)||
  !includes(SUPPORT_CATEGORIES,raw.category)||
  !includes(SUPPORT_STATUSES,raw.status)||
  !includes(SUPPORT_PRIORITIES,raw.priority)||
  typeof raw.summary!=='string'||raw.summary.length<5||raw.summary.length>240||
  /[\u0000-\u001f]/.test(raw.summary)||
  (raw.assigned_support_id!==null&&
   (typeof raw.assigned_support_id!=='string'||!UUID.test(raw.assigned_support_id)))||
  typeof raw.updated_at!=='string'||!Number.isFinite(Date.parse(raw.updated_at)))
  return null;
 return Object.freeze(Object.fromEntries(CASE_KEYS.map(k=>[k,raw[k]])));
}
export function parseSupportCasePage(data){
 if(!Array.isArray(data)||data.length>50)return null;
 const items=data.map(parseSupportCase);
 return items.every(Boolean)?Object.freeze(items):null;
}

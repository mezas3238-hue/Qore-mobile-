/**
 * G311 — finite, no-free-text support action requests.
 *
 * A client action is an INTENT, not authority to change ticket state.
 * Dedicated server Edge Function must validate support role, AAL2,
 * current session, assignment, optimistic status, transition and
 * idempotency again in the same transaction before enqueuing.
 *
 * No user ID, PII, GPS, financial amount, arbitrary message or target
 * URL can be supplied by the web UI.
 */
export const SUPPORT_ACTION_KINDS=Object.freeze([
 'ACKNOWLEDGE','REQUEST_INFORMATION','ESCALATE_SAFETY',
 'ESCALATE_FINANCE','RESOLVE_INFORMATIONAL'
]);
export const SUPPORT_ACTION_EXPECTED_STATUSES=Object.freeze([
 'OPEN','IN_PROGRESS','WAITING_CUSTOMER','ESCALATED'
]);
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const INTENT_KEYS=Object.freeze(['ticket_id','expected_status','action','idempotency_key']);
const RECEIPT_KEYS=Object.freeze(['request_id','ticket_id','action','outcome']);
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&
 (Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
const exactKeys=(obj,keys)=>Object.keys(obj).length===keys.length&&
 keys.every(key=>Object.hasOwn(obj,key));
export function parseSupportActionIntent(input){
 if(!plain(input)||!exactKeys(input,INTENT_KEYS))return null;
 if(typeof input.ticket_id!=='string'||!UUID.test(input.ticket_id)||
  typeof input.idempotency_key!=='string'||!UUID.test(input.idempotency_key)||
  !SUPPORT_ACTION_EXPECTED_STATUSES.includes(input.expected_status)||
  !SUPPORT_ACTION_KINDS.includes(input.action))return null;
 return Object.freeze(Object.fromEntries(INTENT_KEYS.map(k=>[k,input[k]])));
}
export function parseSupportActionReceipt(input,intent){
 if(!plain(input)||!intent||!exactKeys(input,RECEIPT_KEYS)||
  typeof input.request_id!=='string'||!UUID.test(input.request_id)||
  input.ticket_id!==intent.ticket_id||input.action!==intent.action||
  input.outcome!=='QUEUED')return null;
 return Object.freeze({
  request_id:input.request_id,
  ticket_id:input.ticket_id,
  action:input.action,
  outcome:'QUEUED'
 });
}

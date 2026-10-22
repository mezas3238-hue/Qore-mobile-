/** QORE STAGING audit contract: no PII, persistence, or production side effects. */
export const AUDIT_LIVE_ENABLED=false;
const events=new Set(['REQUEST_CREATED','OFFER_SENT','OFFER_ACCEPTED','TRIP_CANCELLED','TRIP_COMPLETED','DELIVERY_PICKED_UP','DELIVERY_COMPLETED','ZONE_DENIED','ELIGIBILITY_DENIED']);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail=reason=>({ok:false,reason,liveEnabled:false});
/** Use opaque identifiers; do not include names, addresses, GPS or tokens. */
export function createSyntheticAuditEvent({event,entityId,actorId,occurredAtMs,sequence}={}){
 if(!events.has(event)||typeof entityId!=='string'||!UUID.test(entityId)||typeof actorId!=='string'||!UUID.test(actorId)||!Number.isSafeInteger(occurredAtMs)||occurredAtMs<0||!Number.isSafeInteger(sequence)||sequence<1)return fail('Invalid audit event');
 return {ok:true,liveEnabled:false,record:Object.freeze({event,entityId,actorId,occurredAtMs,sequence,mode:'SYNTHETIC_STAGING'})};
}
export function verifySyntheticAuditSequence(records){
 if(!Array.isArray(records)||records.length===0)return false;
 let last=0;
 for(const record of records){
  if(!record||record.mode!=='SYNTHETIC_STAGING'||!events.has(record.event)||!Number.isSafeInteger(record.sequence)||record.sequence!==last+1||typeof record.entityId!=='string'||!UUID.test(record.entityId)||typeof record.actorId!=='string'||!UUID.test(record.actorId)||!Number.isSafeInteger(record.occurredAtMs)||record.occurredAtMs<0)return false;
  last=record.sequence;
 }
 return true;
}

/**
 * G32.1 — server-side RPC adapter for durable QA signal quarantine only.
 * NO live GPS, no public listener, no SERVICE_ROLE anywhere on a mobile app.
 * A response counts as persisted only when the private SQL returns eventId.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SERVICE=new Set(['AUTO_RIDE','AUTO_DELIVERY','MOTO_DELIVERY']);
export function createQoreG32QuarantineRepository({rpc}){
 if(typeof rpc!=='function')throw Error('Private SQL RPC required for location signal quarantine');
 return async function commitQuarantinedSignal({
  driverId,eventId,sequence,capturedAtMs,zoneId,serviceKind,
  consentRevision,geometryRevision
 }={}){
  if(typeof driverId!=='string'||!UUID.test(driverId)||
   typeof eventId!=='string'||!UUID.test(eventId)||
   typeof zoneId!=='string'||!UUID.test(zoneId)||
   !Number.isSafeInteger(sequence)||sequence<1||
   !Number.isSafeInteger(capturedAtMs)||capturedAtMs<0||
   !Number.isSafeInteger(consentRevision)||consentRevision<1||
   !Number.isSafeInteger(geometryRevision)||geometryRevision<1||
   !SERVICE.has(serviceKind))
   throw Error('Invalid trusted G32 SQL quarantine payload');
  const record=await rpc('mobility_stage_g32_quarantine_signal',{
   _driver:driverId,_event:eventId,_sequence:sequence,
   _captured_ms:capturedAtMs,_zone:zoneId,_service:serviceKind,
   _consent_revision:consentRevision,
   _geometry_revision:geometryRevision
  });
  if(!record||record.error||record.data!==eventId)
   throw Error('G32 private SQL rejected signal or failed to attest stored event');
  return Object.freeze({persisted:true,eventId});
 };
}

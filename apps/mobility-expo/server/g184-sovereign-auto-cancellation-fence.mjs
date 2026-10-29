/**
 * G184 — one cancellation authority for a G73 price-consented AUTO booking.
 *
 * G95 verifies the ORIGINAL Passenger booking key, consent, G3 transition,
 * G94 financial reversal and G96 dispatch closure in the same PostgreSQL
 * transaction. The older G4 endpoint accepted a bare tripId and eventKey,
 * skipping the G95 booking-key contract and reconciliation receipt.
 *
 * The unified A+B+C+D runtime exposes G73/G95, not the legacy cancellation
 * commands. Driver arrive/pickup/complete still flow to the G177 revocable
 * session gate. Nothing here changes SQL/RLS, KYC, G38/G71, or LIVE settings.
 */
const LEGACY_REQUEST='/v1/staging/rider/trips/request';
const LEGACY_RIDER_CANCEL=
 /^\/v1\/staging\/rider\/trips\/[0-9a-f-]{36}\/cancel$/i;
const LEGACY_TRANSITION=
 /^\/v1\/staging\/trips\/[0-9a-f-]{36}\/transition$/i;
const reject=()=>({status:409,body:{
 code:'G184_USE_ORIGINAL_G73_G95_AUTO_BOOKING',
 qaOnly:true,productionEnabled:false,retryLegacyRequest:false,
 financialReconciliationRequired:true
}});
export function createG184SovereignAutoCancellationFence({legacyGateway}={}){
 if(typeof legacyGateway!=='function')
  throw Error('G184 original legacy trip command handler required');
 return async input=>{
  const path=input?.path;
  if(input?.method==='POST'&&typeof path==='string'&&(
   path===LEGACY_REQUEST||
   LEGACY_RIDER_CANCEL.test(path)||
   (LEGACY_TRANSITION.test(path)&&input.body?.event==='cancel')
  ))return reject();
  return legacyGateway(input);
 };
}

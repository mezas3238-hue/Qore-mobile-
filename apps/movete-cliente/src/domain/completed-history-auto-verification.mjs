/**
 * F1/G110: claim one read-only, owner-scoped history confirmation after G4
 * verified the final AUTO state. Never trust a local completion flag alone.
 * A failed/ambiguous GET is NOT replayed automatically; manual retry remains.
 * Claims are scoped to Passenger, JWT privacy epoch, trip and SQL revision.
 */
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const fail=reason=>Object.freeze({ok:false,reason});
export function claimCompletedHistoryAutoVerification(view,lastKey=null){
 if(!view||view.authenticated!==true||
  view.account?.role!=='passenger'||!UUID.test(view.account.subject??'')||
  !Number.isSafeInteger(view.privateViewRevision)||
  view.privateViewRevision<0||
  view.tracking?.state!=='completed'||
  view.tracking.subscriptionActive!==true||
  view.tracking.syncing!==false||
  !UUID.test(view.tracking.tripId??'')||
  !Number.isSafeInteger(view.tracking.revision)||
  view.tracking.revision<2||
  view.rideContinuation?.canVerify!==true||
  view.rideContinuation.tripId!==view.tracking.tripId||
  view.completedRideHistory?.readReady!==true||
  view.completedRideHistory.tripId!==view.tracking.tripId||
  view.completedRideHistory.verifying===true||
  view.completedRideHistory.verified===true)
  return fail('NOT_VERIFIED_COMPLETION');
 const key=[view.account.subject,view.privateViewRevision,
  view.tracking.tripId,view.tracking.revision].join(':');
 if(lastKey===key)return fail('ALREADY_ATTEMPTED');
 return Object.freeze({ok:true,key});
}

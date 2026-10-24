/**
 * F1 Client tracking: foreground-only, bounded polling of the Passenger-owned
 * trip that was linked to a VERIFIED persisted booking receipt.
 *
 * Does not create a trip or authorize Driver/GPS data. Every read goes through
 * ClientExperience.syncTracking() (pinned Passenger HTTPS contract). Never
 * runs without authenticated QA booking/status gates. No background timers.
 */
const TERMINAL=new Set(['completed','cancelled','failed']);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail=code=>Object.freeze({ok:false,code});
function scopeOf(snapshot){
 if(!snapshot||snapshot.authenticated!==true
  ||snapshot.account?.role!=='passenger'
  ||typeof snapshot.account.subject!=='string'
  ||!UUID.test(snapshot.account.subject)
  ||!Number.isSafeInteger(snapshot.privateViewRevision)
  ||snapshot.privateViewRevision<0
  ||snapshot.rideContinuation?.canVerify!==true
  ||snapshot.rideContinuation.qaOnly!==true
  ||snapshot.rideContinuation.productionEnabled!==false
  ||snapshot.tracking?.subscriptionActive!==true
  ||typeof snapshot.tracking.tripId!=='string'
  ||!UUID.test(snapshot.tracking.tripId)
  ||snapshot.tracking.tripId!==snapshot.rideContinuation.tripId
  ||TERMINAL.has(snapshot.tracking.state))
  return null;
 return Object.freeze({subject:snapshot.account.subject,
  privateViewRevision:snapshot.privateViewRevision,
  tripId:snapshot.tracking.tripId});
}
function same(a,b){
 return a!==null&&b!==null&&a.subject===b.subject
  &&a.privateViewRevision===b.privateViewRevision&&a.tripId===b.tripId;
}
export function createF1FocusedTrackingSync({
 readSnapshot,syncTracking,
 schedule=(fn,ms)=>setInterval(fn,ms),
 cancel=timer=>clearInterval(timer),
 intervalMs=12000
}={}){
 if(typeof readSnapshot!=='function'||typeof syncTracking!=='function'
  ||typeof schedule!=='function'||typeof cancel!=='function'
  ||!Number.isSafeInteger(intervalMs)||intervalMs<8000||intervalMs>60000)
  throw Error('F1 foreground tracking configuration invalid');
 let active=false,scope=null,timer=null,busy=false,generation=0;
 function stop(){
  generation++;active=false;scope=null;
  if(timer!==null){try{cancel(timer);}catch{/* fail closed */}timer=null;}
 }
 async function refresh(){
  if(!active)return fail('TRACKING_NOT_FOCUSED');
  if(busy)return fail('TRACKING_READ_IN_FLIGHT');
  let current=null,view=null;
  try{view=readSnapshot();current=scopeOf(view);}
  catch{stop();return fail('TRACKING_SCOPE_UNVERIFIED');}
  if(!same(current,scope)){stop();return fail('TRACKING_SCOPE_CHANGED');}
  if(view.tracking.syncing)return fail('TRACKING_READ_IN_FLIGHT');
  busy=true;
  const captured=++generation;
  let result;
  try{result=await syncTracking();}
  catch{result=fail('TRACKING_READ_UNAVAILABLE');}
  finally{busy=false;}
  if(!active||captured!==generation)return fail('TRACKING_SCOPE_CHANGED');
  try{current=scopeOf(readSnapshot());}catch{stop();return fail('TRACKING_SCOPE_UNVERIFIED');}
  if(!same(current,scope)){stop();return fail('TRACKING_SCOPE_CHANGED');}
  return result?.ok===true?Object.freeze({ok:true})
   :fail('TRACKING_READ_UNAVAILABLE');
 }
 function start(){
  if(active)return fail('TRACKING_ALREADY_FOCUSED');
  let own=null;
  try{own=scopeOf(readSnapshot());}catch{return fail('TRACKING_SCOPE_UNVERIFIED');}
  if(own===null)return fail('TRACKING_NOT_CERTIFIED');
  active=true;scope=own;generation++;
  try{timer=schedule(()=>refresh(),intervalMs);}
  catch{stop();return fail('TRACKING_TIMER_UNAVAILABLE');}
  // First actual GET is still guarded and deduped by ClientExperience.
  void refresh();
  return Object.freeze({ok:true});
 }
 return Object.freeze({start,stop,refresh,isActive:()=>active});
}

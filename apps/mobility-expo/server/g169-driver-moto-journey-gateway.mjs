/**
 * G169: Driver MOTO journey on the ORIGINAL G100/G118 booking, QA-only.
 * G118 has already denied all offers without authentic G71 and independent
 * municipal passenger-MOTO authorization. This gateway cannot mint offers.
 * It receives Driver identity from an independently attested/revocable IdP,
 * then reads the same Driver-owned PostgreSQL booking before every action.
 * G118 transactional state + revision and G169 owner read are authoritative.
 * No passenger PII, GPS, payment, destination or legal approval is exposed.
 */
const ID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const TOKEN=/^Bearer ([A-Za-z0-9._~-]{20,7900})$/;
const CURRENT='/v1/staging/driver/moto/current';
const GET=/^\/v1\/staging\/driver\/moto\/bookings\/([0-9a-f-]{36})\/status$/i;
const POST=/^\/v1\/staging\/driver\/moto\/bookings\/([0-9a-f-]{36})\/advance$/i;
const NEXT=Object.freeze({accepted:'arriving',arriving:'in_progress',
 in_progress:'completed',completed:null});
const REV=Object.freeze({accepted:2,arriving:3,in_progress:4,completed:5});
const exact=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)
 &&Object.getPrototypeOf(v)===Object.prototype
 &&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const fail=(status,code)=>({status,body:{code,qaOnly:true,productionEnabled:false}});
const KEYS=['mode','qaOnly','productionEnabled','serviceKind','driverId',
 'bookingKey','tripId','tripState','tripRevision','serverPersisted'];
function verify(row,driver,booking){
 return exact(row,KEYS)&&row.mode==='STAGING_DEMO_ONLY'
  &&row.qaOnly===true&&row.productionEnabled===false
  &&row.serviceKind==='MOTO_RIDE'&&row.driverId===driver
  &&row.bookingKey===booking&&ID.test(row.tripId??'')
  &&Object.hasOwn(NEXT,row.tripState)
  &&row.tripRevision===REV[row.tripState]
  &&row.serverPersisted===true;
}
const output=row=>({mode:'STAGING_DEMO_ONLY',qaOnly:true,
 productionEnabled:false,serviceKind:'MOTO_RIDE',
 tripId:row.tripId,bookingKey:row.bookingKey,
 tripState:row.tripState,tripRevision:row.tripRevision,
 nextState:NEXT[row.tripState],serverPersisted:true,
 gpsVerified:false,pspCollected:false});
export const G169_MOTO_DRIVER_LIVE_ENABLED=false;
export function createG169DriverMotoJourneyGateway({
 environment,qaOnly,liveEnabled,verifyAccessToken,
 verifySessionNotRevoked,resolveExclusiveRole,allowRequest,
 readMoto,advanceMoto,readCurrentMoto=null,now=Date.now
}={}){
 if(environment!=='isolated_staging'||qaOnly!==true||liveEnabled!==false||
  [verifyAccessToken,verifySessionNotRevoked,resolveExclusiveRole,
   allowRequest,readMoto,advanceMoto,now].some(x=>typeof x!=='function'))
  throw Error('G169 requires original private MOTO SQL and verified Driver');
 if(readCurrentMoto!==null&&typeof readCurrentMoto!=='function')
  throw Error('G189 requires trusted unique active MOTO owner RPC');
 return async({method,path,headers={},body}={})=>{
  const current=method==='GET'&&path===CURRENT;
  const get=method==='GET'&&typeof path==='string'?GET.exec(path):null;
  const post=method==='POST'&&typeof path==='string'?POST.exec(path):null;
  if(!current&&!get&&!post)return fail(404,'G169_ROUTE_DENIED');
  const booking=(get??post)?.[1]??null;
  if((!current&&!ID.test(booking))||headers.cookie!==undefined||
   headers.Authorization!==undefined||typeof headers.authorization!=='string')
   return fail(401,'G169_VERIFIED_BEARER_REQUIRED');
  if(((get||current)&&body!=null)||(post&&(!exact(body,
   ['expectedRevision','nextState','commandKey'])||
   !Number.isSafeInteger(body.expectedRevision)||
   body.expectedRevision<2||body.expectedRevision>4||
   !['arriving','in_progress','completed'].includes(body.nextState)||
   !ID.test(body.commandKey??''))))
   return fail(400,'G169_INVALID_COMMAND');
  const token=TOKEN.exec(headers.authorization)?.[1];
  if(!token)return fail(401,'G169_VERIFIED_BEARER_REQUIRED');
  const at=now();let actor;
  if(!Number.isSafeInteger(at)||at<1)return fail(503,'G169_CLOCK_INVALID');
  try{actor=await verifyAccessToken(token);}catch{return fail(401,'G169_UNVERIFIED_DRIVER');}
  if(!actor||!ID.test(actor.id??'')||!ID.test(actor.sessionId??'')||
   actor.is_anonymous!==false||!Number.isSafeInteger(actor.expiresAtMs)||
   actor.expiresAtMs<=at)return fail(401,'G169_UNVERIFIED_DRIVER');
  try{if(await verifySessionNotRevoked({userId:actor.id,
   sessionId:actor.sessionId,at})!==true)
    return fail(401,'G169_DRIVER_REVOKED');}
  catch{return fail(503,'G169_REVOCATION_UNAVAILABLE');}
  try{if(await resolveExclusiveRole(actor.id)!=='driver')
   return fail(403,'G169_DRIVER_ONLY');}
  catch{return fail(503,'G169_ROLE_UNAVAILABLE');}
  try{if(allowRequest({userId:actor.id,operation:'driver.moto.journey'})!==true)
   return fail(429,'G169_RATE_LIMITED');}
  catch{return fail(503,'G169_RATE_UNAVAILABLE');}
  if(current){
   if(readCurrentMoto===null)return fail(503,'G189_CURRENT_MOTO_DISABLED');
   let active;
   try{active=await readCurrentMoto({driverId:actor.id});}
   catch{return fail(503,'G189_CURRENT_MOTO_UNAVAILABLE');}
   if(active!==null&&(!ID.test(active?.bookingKey??'')||
    !verify(active,actor.id,active.bookingKey)||
    !['accepted','arriving','in_progress'].includes(active.tripState)))
    return fail(503,'G189_UNTRUSTED_ACTIVE_MOTO');
   return {status:200,body:{mode:'STAGING_DEMO_ONLY',
    qaOnly:true,productionEnabled:false,
    activeBooking:active===null?null:output(active)}};
  }
  let before;
  try{before=await readMoto({driverId:actor.id,bookingKey:booking});}
  catch{return fail(503,'G169_ORIGINAL_READ_UNAVAILABLE');}
  if(before===null)return fail(404,'G169_NO_OWN_MOTO_BOOKING');
  if(!verify(before,actor.id,booking))return fail(503,'G169_UNTRUSTED_MOTO_BOOKING');
  if(get)return {status:200,body:output(before)};
  if(before.tripRevision!==body.expectedRevision||
   NEXT[before.tripState]!==body.nextState)
   return fail(409,'G169_STALE_OR_INVALID_MOTO_STEP');
  // A lost POST response is uncertain; only GET may recover. Never create
  // another command or replay a new key automatically.
  try{await advanceMoto({driverId:actor.id,bookingKey:booking,
   expectedRevision:body.expectedRevision,nextState:body.nextState,
   commandKey:body.commandKey});}
  catch{return fail(503,'G169_COMMAND_UNKNOWN_READ_ORIGINAL_STATUS');}
  let after;
  try{after=await readMoto({driverId:actor.id,bookingKey:booking});}
  catch{return fail(503,'G169_COMMITTED_STATUS_UNKNOWN');}
  if(!verify(after,actor.id,booking)||after.tripId!==before.tripId||
   after.tripRevision!==before.tripRevision+1||
   after.tripState!==body.nextState)
   return fail(503,'G169_COMMITTED_STATUS_UNVERIFIED');
  return {status:200,body:output(after)};
 };
}

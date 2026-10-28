/**
 * G138: authoritative service trace for the ORIGINAL G73 AUTO trip.
 * G75's server-verified identity, current Admin role, provider AAL2 and
 * revocation are mandatory; never permit direct read of another service.
 * Browser trace is still OFF until independent external staging attestation.
 */
const ID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const PATH=/^\/v1\/staging\/admin\/services\/AUTO_RIDE\/([0-9a-f-]{36})\/trace$/i;
const deny=(status,code)=>({status,body:{code,qaOnly:true,productionEnabled:false}});
const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
export function createG138AdminAutoTraceGateway({
 adminF1AuditGateway,loadAutoTraceReceipt,now=Date.now
}={}){
 if([adminF1AuditGateway,loadAutoTraceReceipt,now].some(x=>typeof x!=='function'))
  throw Error('G138 requires G75 verified Admin and original SQL trace');
 return async({method,path,headers={},body}={})=>{
  const m=method==='GET'&&typeof path==='string'?PATH.exec(path):null;
  if(!m||!ID.test(m[1])||body!==undefined&&body!==null)
   return deny(404,'G138_TRACE_UNAVAILABLE');
  const tripId=m[1].toLowerCase();
  // G75 authenticates JWT, revocation, exclusive Admin, provider MFA AAL2
  // and a confirmed original G3+G73 booking BEFORE exposing any trace.
  const verified=await adminF1AuditGateway({method:'GET',
   path:'/v1/staging/admin/rides/'+tripId+'/f1-verification',headers});
  if(verified.status!==200)return verified;
  const v=verified.body;
  if(!obj(v)||v.tripId!==tripId||!ID.test(v.viewerId??'')
   ||!ID.test(v.quoteId??'')||!ID.test(v.bookingRequestKey??''))
   return deny(503,'G138_G75_PROVENANCE_INVALID');
  let proof;
  try{proof=await loadAutoTraceReceipt({actorId:v.viewerId,tripId});}
  catch{return deny(503,'G138_SQL_UNAVAILABLE');}
  if(proof===null)return deny(503,'G138_TRACE_NOT_CERTIFIED');
  if(!obj(proof)||proof.serviceId!==tripId||
   proof.serviceKind!=='AUTO_RIDE'||proof.viewerId!==v.viewerId||
   proof.quoteId!==v.quoteId||proof.bookingRequestKey!==v.bookingRequestKey||
   proof.status!==v.status||proof.revision!==v.revision||
   proof.serverPersisted!==true||proof.productionEnabled!==false||
   proof.mode!=='STAGING_DEMO_ONLY'||!Number.isSafeInteger(proof.observedAt)||
   proof.observedAt>now()||now()-proof.observedAt>30000||
   !Array.isArray(proof.events)||proof.events.length<1||
   proof.events.some(e=>e.serviceId!==tripId)||
   proof.ledger!==null&&proof.ledger?.serviceId!==tripId)
   return deny(503,'G138_TRACE_PROVENANCE_MISMATCH');
  return {status:200,body:proof};
 };
}

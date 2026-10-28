/**
 * B25: release a completed QA delivery's *opaque device keys* only after
 * two independent Owner-scoped server reads: G121 terminal delivery status
 * and G68 matching terminal custody with verified delivery/return proof.
 * Local UI flags, expired quotes, cached 404 and mere HTTP 201 never suffice.
 */
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const id=x=>typeof x==='string'&&UUID.test(x);
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const fail=code=>Object.freeze({ok:false,code});
const terminal=new Set(['delivered','returned']);
const validSaved=(r,ownerId,requestKey)=>obj(r)
 &&Object.keys(r).length===4&&r.version===1
 &&r.ownerId===ownerId&&r.requestKey===requestKey
 &&Number.isSafeInteger(r.createdAt)&&r.createdAt>0;
const validQuote=(r,ownerId,deliveryId,requestKey,vehicleKind)=>
 obj(r)&&Object.keys(r).length===8&&r.version===1
 &&r.ownerId===ownerId&&r.deliveryId===deliveryId
 &&r.deliveryRequestKey===requestKey&&id(r.quoteRequestKey)
 &&r.vehicleKind===vehicleKind
 &&['prepared','recovery_attempted','consent_attempted'].includes(r.stage)
 &&Number.isSafeInteger(r.createdAt)&&r.createdAt>0;
export async function releaseTerminalDeliveryKeys({
 ownerId,deliveryId,requestKey,vehicleKind,g121,g68,
 g5Store,g7Store,stillAuthorized=()=>false
}={}){
 if(![ownerId,deliveryId,requestKey].every(id)
  ||!['AUTO','MOTO'].includes(vehicleKind)
  ||!obj(g121)||g121.deliveryId!==deliveryId
  ||g121.requestKey!==requestKey||g121.vehicleKind!==vehicleKind
  ||!terminal.has(g121.status)
  ||!Number.isSafeInteger(g121.revision)||g121.revision<1
  ||!obj(g68)||g68.deliveryId!==deliveryId
  ||g68.vehicleKind!==vehicleKind||g68.state!==g121.status
  ||g68.proofVerified!==true
  ||!Number.isSafeInteger(g68.revision)
  ||g68.revision<g121.revision)
  return fail('TERMINAL_PROOF_REQUIRED');
 if(!g5Store||!g7Store
  ||typeof g5Store.read!=='function'
  ||typeof g5Store.clearMatching!=='function'
  ||typeof g7Store.read!=='function'
  ||typeof g7Store.clearMatching!=='function')
  return fail('TERMINAL_SECURE_STORES_REQUIRED');
 if(!stillAuthorized())return fail('TERMINAL_SESSION_CHANGED');
 let saved,quote;
 try{
  saved=await g5Store.read(ownerId);
  quote=await g7Store.read(ownerId);
 }catch{return fail('TERMINAL_STORAGE_UNAVAILABLE');}
 if(!stillAuthorized())return fail('TERMINAL_SESSION_CHANGED');
 if(!validSaved(saved,ownerId,requestKey)
  ||quote!==null&&!validQuote(quote,ownerId,deliveryId,requestKey,vehicleKind))
  return fail('TERMINAL_SAVED_SCOPE_CONFLICT');
 // Order matters: if G7 deletion succeeds but G5 fails, the G5 key still
 // blocks creating another request. A repeat safe finalization is possible.
 try{
  if(quote!==null){
   if(!stillAuthorized())return fail('TERMINAL_SESSION_CHANGED');
   const erased=await g7Store.clearMatching(ownerId,deliveryId,requestKey);
   if(erased!==true)return fail('TERMINAL_G7_CLEAR_UNVERIFIED');
  }
  if(!stillAuthorized())return fail('TERMINAL_SESSION_CHANGED');
  const erased=await g5Store.clearMatching(ownerId,requestKey);
  if(erased!==true)return fail('TERMINAL_G5_CLEAR_UNVERIFIED');
 }catch{return fail('TERMINAL_STORAGE_UNAVAILABLE');}
 // The caller checks the session again before publishing success; no money,
 // delivery state, settlement or historical evidence are deleted on server.
 return Object.freeze({ok:true,productionEnabled:false,
  qaOnly:true,deliveryId,vehicleKind,localKeysReleased:true});
}

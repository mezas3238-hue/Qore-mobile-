/**
 * G60C — privileged QA-only Driver POST handler bridge.
 * JWT/provider/session/role come from independent trusted server callbacks.
 * An opaque proof is seeded by an owner-only synthetic fixture and exchanged
 * as mobility_g60c_execute_ci. NEVER mount owner seeding into public HTTP.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id=x=>typeof x==='string'&&UUID.test(x);
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const exact=(x,keys)=>plain(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const safe=x=>Number.isSafeInteger(x)&&x>=0;
const ACK=['conversationId','serviceId','requestKey','messageId','senderRole',
 'body','createdAt','revision','serverStored'];
const COMMITTED=['state','serverStored','retrySafe','reconcileAgain',
 'productionEnabled','qaOnly','latestRevision','historyRefreshRequired','ack'];
const UNKNOWN=['state','serverStored','retrySafe','reconcileAgain','productionEnabled','qaOnly'];
const validMessage=x=>typeof x==='string'&&x.length>=1&&x.length<=500&&
 x===x.trim()&&Buffer.byteLength(x,'utf8')<=2000&&
 !/[\u0000-\u001f\u007f<>\u202a-\u202e\u2066-\u2069\u200e\u200f]/u.test(x)&&
 !/(?:https?:\/\/|www\.)/iu.test(x)&&
 !/[\w.+-]+@[\w.-]+\.[a-z]{2,}/iu.test(x)&&
 !/(?:\+?\d[\s().-]*){7,}/u.test(x);
const error=(status,code)=>Object.freeze({status,body:Object.freeze({
 code,qaOnly:true,retrySafe:false
})});
const ackGood=(a,req,at)=>exact(a,ACK)&&
 a.conversationId===req.conversationId&&
 a.serviceId===req.serviceId&&a.requestKey===req.requestKey&&
 a.body===req.body&&a.senderRole==='driver'&&a.serverStored===true&&
 id(a.messageId)&&safe(a.revision)&&a.revision>=2&&
 safe(a.createdAt)&&a.createdAt<=at;
export function createG60CVerifiedDriverWriteQa({
 environment,localQaOnly,liveEnabled,
 verifyAccessToken,verifySessionNotRevoked,resolveExclusiveRole,
 allowRequest,createSyntheticAttestation,exchangeScopedProof,
 now=Date.now
}={}){
 if(environment!=='isolated_staging'||localQaOnly!==true||liveEnabled!==false||
  [verifyAccessToken,verifySessionNotRevoked,resolveExclusiveRole,
   allowRequest,createSyntheticAttestation,exchangeScopedProof,now]
  .some(x=>typeof x!=='function'))
  throw Error('G60C private QA-only verified provider and delegated SQL required');
 async function handle(req,operation){
  if(!exact(req,['bearer','serviceKind','serviceId','conversationId',
   'requestKey','body'])||
   typeof req.bearer!=='string'||req.bearer.length<20||
   req.bearer.length>8192||
   !['RIDE','DELIVERY','MERCHANT_ORDER'].includes(req.serviceKind)||
   !id(req.serviceId)||!id(req.conversationId)||!id(req.requestKey)||
   !validMessage(req.body))
   return error(400,'G60C_INVALID_SCOPE');
  const begun=now();
  if(!safe(begun))return error(503,'G60C_CLOCK_FAILURE');
  let actor;
  try{actor=await verifyAccessToken(req.bearer);}
  catch{return error(401,'G60C_JWT_UNVERIFIED');}
  if(!exact(actor,['id','sessionId','tokenIatMs','expiresAtMs',
    'is_anonymous'])||!id(actor.id)||!id(actor.sessionId)||
   !safe(actor.tokenIatMs)||actor.tokenIatMs>begun||
   !safe(actor.expiresAtMs)||actor.expiresAtMs<=begun||
   actor.is_anonymous!==false)
   return error(401,'G60C_JWT_UNVERIFIED');
  try{
   if(await verifySessionNotRevoked({userId:actor.id,
    sessionId:actor.sessionId,at:begun})!==true)
    return error(401,'G60C_SESSION_REVOKED');
  }catch{return error(503,'G60C_PROVIDER_UNAVAILABLE');}
  let role;
  try{role=await resolveExclusiveRole(actor.id);}
  catch{return error(503,'G60C_ROLE_SOURCE_UNAVAILABLE');}
  if(role!=='driver')return error(403,'G60C_DRIVER_REQUIRED');
  try{
   if(allowRequest({actorId:actor.id,operation})!==true)
    return error(429,'G60C_RATE_DENIED');
  }catch{return error(503,'G60C_RATE_UNAVAILABLE');}
  let proof;
  try{
   proof=await createSyntheticAttestation(Object.freeze({
    operation,driverId:actor.id,sessionId:actor.sessionId,
    tokenIatMs:actor.tokenIatMs,serviceKind:req.serviceKind,
    serviceId:req.serviceId,conversationId:req.conversationId,
    requestKey:req.requestKey,body:req.body
   }));
  }catch{return error(503,'G60C_ATTESTATION_UNAVAILABLE');}
  const seedAt=now();
  if(!safe(seedAt)||seedAt<begun||seedAt>=actor.expiresAtMs||
   !exact(proof,['proof','expiresAtMs','qaOnly','productionEnabled'])||
   !id(proof.proof)||proof.qaOnly!==true||proof.productionEnabled!==false||
   !safe(proof.expiresAtMs)||proof.expiresAtMs<=seedAt||
   proof.expiresAtMs>seedAt+12000)
   return error(503,'G60C_UNTRUSTED_PROOF');
  let dbAnswer;
  try{dbAnswer=await exchangeScopedProof(proof.proof);}
  catch{return error(503,'G60C_SQL_COMMIT_UNKNOWN');}
  const done=now();
  if(!safe(done)||done<seedAt)return error(503,'G60C_CLOCK_FAILURE');
  if(done>=actor.expiresAtMs)return error(401,'G60C_SESSION_EXPIRED');
  if(!plain(dbAnswer))return error(503,'G60C_SQL_COMMIT_UNKNOWN');
  if(dbAnswer.error){
   const code=dbAnswer.error.code;
   return error(['G6013','G5001','G5601'].includes(code)?401:
    ['G5603','G5003','G5913'].includes(code)?403:
    ['G5604','G5914','G5004','G5009','G5919'].includes(code)?409:
    ['G5002','G5602','G5912'].includes(code)?400:503,
    ['G6012','G6014'].includes(code)?
     'G60C_SCOPED_PROOF_DENIED':'G60C_SQL_DENIED');
  }
  const value=dbAnswer.data;
  if(operation==='DRIVER_SEND'){
   if(!ackGood(value,req,done))
    return error(503,'G60C_UNTRUSTED_SQL_ACK');
   return Object.freeze({status:200,body:Object.freeze({...value})});
  }
  if(exact(value,UNKNOWN)&&
    value.state==='NOT_YET_OBSERVED'&&
    value.serverStored===false&&value.retrySafe===false&&
    value.reconcileAgain===true&&value.qaOnly===true&&
    value.productionEnabled===false)
   return error(503,'G60C_OUTCOME_UNKNOWN_RECONCILE_AGAIN');
  if(!exact(value,COMMITTED)||value.state!=='COMMITTED'||
    value.serverStored!==true||value.retrySafe!==false||
    value.reconcileAgain!==false||value.qaOnly!==true||
    value.productionEnabled!==false||
    !ackGood(value.ack,req,done)||
    !safe(value.latestRevision)||
    value.latestRevision<value.ack.revision||
    value.historyRefreshRequired!==(value.latestRevision>value.ack.revision))
   return error(503,'G60C_UNTRUSTED_SQL_RECONCILIATION');
  // G60B wire RECOVERY only includes fields explicitly allowed for clients.
  const publicResult={state:'COMMITTED',ack:Object.freeze({...value.ack}),
   latestRevision:value.latestRevision,
   historyRefreshRequired:value.historyRefreshRequired,
   qaOnly:true,productionEnabled:false,retrySafe:false};
  return Object.freeze({status:200,body:Object.freeze(publicResult)});
 }
 return Object.freeze({
  send:req=>handle(req,'DRIVER_SEND'),
  reconcile:req=>handle(req,'DRIVER_RECONCILE')
 });
}

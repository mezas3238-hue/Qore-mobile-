/**
 * G48 A29: local-only Node boundary for single-use DB-scoped read capabilities.
 * NOT mounted over HTTP. ownerMintTicket is a disposable OWNER-only fixture,
 * NOT a genuine JWT-to-database identity issuer or deployable Auth mechanism.
 * No actorId/role/session proof accepted from the client body.
 */
import {assertStagingRef} from './g2-staging-vehicle-gateway.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const uuid=x=>typeof x==='string'&&UUID.test(x);
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 (Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);
const exact=(x,keys)=>plain(x)&&Object.keys(x).length===keys.length&&
 keys.every(k=>Object.hasOwn(x,k));
const safeInt=x=>Number.isSafeInteger(x)&&x>=0;
const positive=x=>Number.isSafeInteger(x)&&x>0;
const respond=(status,error)=>Object.freeze({status,body:Object.freeze({error})});
const DECL=['ticket','expiresAtMs','purpose','delegationKind','productionEnabled'];
const DOC=['kind','status','submittedAt','reviewedAt'];
const STATUS=['items','source','documentBytesAvailable','signedUrlAvailable','productionEnabled'];
const LEASE=['leaseActive','signedUrlAvailable','documentBytesAvailable','productionEnabled'];
const ITEM=['itemId','itemTag','itemClass','active','unitPricePyg','stockUnits'];
const CATALOG=['branchId','version','expiresAt','hasMore','items','orderEnabled',
 'eligibleByPolicy','source','productionEnabled'];
const docTypes=new Set(['licencia','identidad_frente','identidad_dorso',
 'cedula_verde','seguro','inspeccion','habilitacion']);
const docStatuses=new Set(['pending','approved','rejected']);
const validDoc=x=>exact(x,DOC)&&docTypes.has(x.kind)&&
 docStatuses.has(x.status)&&typeof x.submittedAt==='string'&&
 !Number.isNaN(Date.parse(x.submittedAt))&&
 (x.reviewedAt===null||typeof x.reviewedAt==='string'&&
 !Number.isNaN(Date.parse(x.reviewedAt)));
const validStatus=x=>exact(x,STATUS)&&x.source==='QA_G48_DRIVER_STATUS_ONLY'&&
 x.documentBytesAvailable===false&&x.signedUrlAvailable===false&&
 x.productionEnabled===false&&Array.isArray(x.items)&&x.items.length<=7&&
 x.items.every(validDoc)&&new Set(x.items.map(d=>d.kind)).size===x.items.length;
const validProbe=x=>exact(x,LEASE)&&typeof x.leaseActive==='boolean'&&
 x.signedUrlAvailable===false&&x.documentBytesAvailable===false&&
 x.productionEnabled===false;
const validItem=x=>exact(x,ITEM)&&uuid(x.itemId)&&
 typeof x.itemTag==='string'&&/^[A-Z0-9_]{2,50}$/.test(x.itemTag)&&
 ['GENERAL','PHARMACY_OTC'].includes(x.itemClass)&&x.active===true&&
 Number.isSafeInteger(x.unitPricePyg)&&x.unitPricePyg>=100&&
 x.unitPricePyg<=10000000&&positive(x.stockUnits);
const validCatalog=(x,branch,version)=>exact(x,CATALOG)&&
 x.branchId===branch&&positive(x.version)&&
 (version===null||x.version===version)&&safeInt(x.expiresAt)&&
 typeof x.hasMore==='boolean'&&Array.isArray(x.items)&&x.items.length<=100&&
 x.items.every(validItem)&&new Set(x.items.map(i=>i.itemId)).size===x.items.length&&
 x.source==='QA_G48_SCOPED_CATALOG_ONLY'&&x.orderEnabled===false&&
 x.eligibleByPolicy===false&&x.productionEnabled===false;

export function createG48ScopedDbGatewayQa({
 environment,localQaOnly,liveEnabled,projectRef,
 verifyAccessToken,verifySessionNotRevoked,resolveExclusiveRole,
 ownerMintTicket,rpc,allowRequest,now=Date.now
}={}){
 assertStagingRef(projectRef);
 if(environment!=='isolated_staging'||localQaOnly!==true||
  liveEnabled!==false||[verifyAccessToken,verifySessionNotRevoked,
   resolveExclusiveRole,ownerMintTicket,rpc,allowRequest,now].some(f=>
    typeof f!=='function'))throw Error('G48 local owner-only QA adapter required');
 async function handle({bearer,operation,branchId,leaseId,
  expectedRevision=null,after=null}={}){
  if(!['DRIVER_STATUS','DRIVER_LEASE_PROBE','BUYER_CATALOG_PAGE'].includes(operation))
   return respond(404,'OPERATION_NOT_AVAILABLE');
  if(operation==='BUYER_CATALOG_PAGE'&&
    (!uuid(branchId)||!(expectedRevision===null||positive(expectedRevision))||
     !(after===null||uuid(after))||(after!==null&&expectedRevision===null)))
   return respond(400,'INVALID_CATALOG_PAGE');
  if(operation==='DRIVER_LEASE_PROBE'&&!uuid(leaseId))
   return respond(400,'INVALID_DOCUMENT_LEASE');
  if(operation==='DRIVER_STATUS'&&(branchId!==undefined||leaseId!==undefined||
    after!==null||expectedRevision!==null))
   return respond(400,'INVALID_DOCUMENT_STATUS');
  if(operation!=='BUYER_CATALOG_PAGE'&&(branchId!==undefined||
   expectedRevision!==null||after!==null))
   return respond(400,'UNEXPECTED_QUERY_FIELDS');
  if(operation==='BUYER_CATALOG_PAGE'&&leaseId!==undefined)
   return respond(400,'UNEXPECTED_QUERY_FIELDS');
  if(typeof bearer!=='string'||bearer.length<20||bearer.length>7900||
    !/^[A-Za-z0-9._~-]+$/.test(bearer))
   return respond(401,'PROVIDER_JWT_REQUIRED');
  const at=now();
  if(!safeInt(at)||at>8640000000000000)return respond(503,'CLOCK_UNAVAILABLE');
  let actor;
  try{actor=await verifyAccessToken(bearer);}
  catch{return respond(401,'UNVERIFIED_JWT');}
  if(!plain(actor)||!uuid(actor.id)||!uuid(actor.sessionId)||
   !safeInt(actor.tokenIatMs)||actor.tokenIatMs>at||
   !safeInt(actor.expiresAtMs)||actor.expiresAtMs<=at||
   actor.is_anonymous===true||
   !(typeof actor.email_confirmed_at==='string'||
    typeof actor.phone_confirmed_at==='string'))
   return respond(401,'UNVERIFIED_PROVIDER_SESSION');
  try{
   if(await verifySessionNotRevoked({userId:actor.id,sessionId:actor.sessionId,at})!==true)
    return respond(401,'REVOKED_PROVIDER_SESSION');
  }catch{return respond(503,'PROVIDER_SESSION_UNAVAILABLE');}
  let role;
  try{role=await resolveExclusiveRole(actor.id);}
  catch{return respond(503,'ROLE_AUTHORITY_UNAVAILABLE');}
  if(role!==(operation==='BUYER_CATALOG_PAGE'?'passenger':'driver'))
   return respond(403,'EXCLUSIVE_ROLE_REQUIRED');
  try{
   if(allowRequest({userId:actor.id,operation})!==true)
    return respond(429,'READ_RATE_LIMIT');
  }catch{return respond(503,'LIMITER_UNAVAILABLE');}
  const resourceId=operation==='DRIVER_STATUS'?actor.id:
    operation==='DRIVER_LEASE_PROBE'?leaseId:branchId;
  let minted;
  try{
   minted=await ownerMintTicket({actorId:actor.id,sessionId:actor.sessionId,
    tokenIatMs:actor.tokenIatMs,purpose:operation,resourceId});
  }catch{return respond(503,'TRUSTED_QA_MINT_UNAVAILABLE');}
  if(!exact(minted,DECL)||!uuid(minted.ticket)||
   !safeInt(minted.expiresAtMs)||minted.expiresAtMs<=at||
   minted.expiresAtMs>at+30000||
   minted.purpose!==operation||
   minted.delegationKind!=='QA_OWNER_ONLY_NOT_JWT_BOUND'||
   minted.productionEnabled!==false)
   return respond(503,'UNTRUSTED_QA_DELEGATION');
  const functionName=operation==='DRIVER_STATUS'?
   'mobility_stage_g48_driver_status_qa':
   operation==='DRIVER_LEASE_PROBE'?'mobility_stage_g48_driver_lease_probe_qa':
   'mobility_stage_g48_buyer_catalog_page_qa';
  let source;
  try{
   source=await rpc(functionName,operation==='BUYER_CATALOG_PAGE'?
    {_ticket:minted.ticket,_expected_revision:expectedRevision,_after:after}:
    {_ticket:minted.ticket});
  }catch{return respond(503,'SCOPED_READ_UNAVAILABLE');}
  if(!plain(source))return respond(503,'SCOPED_READ_UNAVAILABLE');
  if(source.error){
   if(source.error.code==='G4804')return respond(410,'PROOF_ALREADY_USED');
   if(['G4801','G4803'].includes(source.error.code))
    return respond(403,'REVOKED_OR_OUT_OF_SCOPE');
   if(source.error.code==='G4409')return respond(409,'CATALOG_REVISION_CHANGED');
   return respond(503,'SCOPED_READ_UNAVAILABLE');
  }
  const valid=operation==='DRIVER_STATUS'?validStatus(source.data):
   operation==='DRIVER_LEASE_PROBE'?validProbe(source.data):
   validCatalog(source.data,branchId,expectedRevision);
  if(!valid)return respond(503,'UNSAFE_PRIVATE_READ_RECEIPT');
  return Object.freeze({status:200,body:Object.freeze({...source.data})});
 }
 return Object.freeze({handle});
}

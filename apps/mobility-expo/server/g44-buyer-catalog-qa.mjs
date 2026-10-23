/**
 * G44 A25 private Buyer discovery/catalog contract — isolated QA only.
 * No HTTPS runtime, no buyer payment, no dispatch/zone eligibility.
 * SQL must lock G42 session in the same transaction as catalog query.
 */
import {createHmac,timingSafeEqual} from 'node:crypto';
import {assertStagingRef} from './g2-staging-vehicle-gateway.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const B64=/^[A-Za-z0-9_-]+$/;
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 (Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);
const exact=(x,keys)=>plain(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const uuid=x=>typeof x==='string'&&UUID.test(x);
const positive=x=>Number.isSafeInteger(x)&&x>0;
const nat=x=>Number.isSafeInteger(x)&&x>=0;
const PAGE=100,TTL=60000;
const error=(status,message)=>Object.freeze({status,body:{error:message}});
const merchantKinds=['SUPERMARKET','PHARMACY','RESTAURANT','RETAIL','OTHER'];
function signer(secrets,projectRef){
 if(!plain(secrets)||Object.keys(secrets).some(k=>!['current','previous'].includes(k))||
  typeof secrets.current!=='string'||Buffer.byteLength(secrets.current)<32||
  (secrets.previous!==undefined&&(typeof secrets.previous!=='string'||
    Buffer.byteLength(secrets.previous)<32||secrets.previous===secrets.current)))
  throw Error('G44 independent cursor secrets required');
 const keys=[secrets.current,...(secrets.previous?[secrets.previous]:[])];
 const mac=(raw,key,ctx)=>createHmac('sha256',key)
  .update('qore-g44-buyer-v1\0').update(projectRef).update('\0')
  .update(ctx.userId).update('\0').update(ctx.sessionId).update('\0')
  .update(ctx.kind).update('\0').update(ctx.scope).update('\0')
  .update(raw).digest();
 return Object.freeze({
  encode(ctx,after,version,at){
   if(!uuid(after)||version!==null&&!positive(version))throw Error('G44 invalid last key');
   const raw=Buffer.from(JSON.stringify([1,at+TTL,after.toLowerCase(),version])).toString('base64url');
   const out=raw+'.'+mac(raw,secrets.current,ctx).toString('base64url');
   if(out.length>384)throw Error('G44 cursor too large');
   return out;
  },
  decode(token,ctx,at){
   if(typeof token!=='string'||token.length>384)return null;
   const p=token.split('.');
   if(p.length!==2||!B64.test(p[0])||!B64.test(p[1])||
    p[1].length!==43)return null;
   const [raw,sig]=p;
   if(Buffer.from(raw,'base64url').toString('base64url')!==raw||
      Buffer.from(sig,'base64url').toString('base64url')!==sig)return null;
   const received=Buffer.from(sig,'base64url');
   if(!keys.some(k=>timingSafeEqual(received,mac(raw,k,ctx))))return null;
   try{
    const str=Buffer.from(raw,'base64url').toString('utf8');
    const d=JSON.parse(str);
    if(JSON.stringify(d)!==str||!Array.isArray(d)||d.length!==4||
     d[0]!==1||!nat(d[1])||d[1]<=at||d[1]>at+TTL||
     !uuid(d[2])||d[2]!==d[2].toLowerCase()||
     !(d[3]===null||positive(d[3])))return null;
    return {after:d[2],version:d[3]};
   }catch{return null;}
  }
 });
}
function validateRows(rows,after,kind,ctx){
 if(!Array.isArray(rows)||rows.length>PAGE)return null;
 if(ctx.hasMore===true&&rows.length!==PAGE)return null;
 const required=kind==='catalog'?
  ['itemId','itemTag','itemClass','active','unitPricePyg','stockUnits']:
  ['branchId','branchTag','merchantKind','municipality','serviceKind','eligibleByPolicy','orderEnabled'];
 let last=after;
 for(const row of rows){
  if(!exact(row,required))return null;
  const id=kind==='catalog'?row.itemId:row.branchId;
  if(!uuid(id)||id!==id.toLowerCase()||last!==null&&id<=last)return null;
  if(kind==='catalog'){
   if(!/^[A-Z0-9_]{2,50}$/.test(row.itemTag)||
    !['GENERAL','PHARMACY_OTC'].includes(row.itemClass)||
    row.active!==true||!positive(row.unitPricePyg)||
    row.unitPricePyg>10000000||!positive(row.stockUnits)||
    row.stockUnits>1000000)return null;
  }else{
   if(!/^[A-Z_]{3,40}$/.test(row.branchTag)||
    !merchantKinds.includes(row.merchantKind)||
    row.municipality!==ctx.municipality||
    row.serviceKind!==ctx.serviceKind||
    row.eligibleByPolicy!==false||row.orderEnabled!==false)return null;
  }
  last=id;
 }
 return last;
}
export function createG44BuyerCatalogQa({
 environment,liveEnabled,localQaOnly,projectRef,cursorSecrets,
 verifyAccessToken,verifySessionNotRevoked,loadExclusiveRole,
 allowRequest,rpc,now=Date.now
}={}){
 if(environment!=='isolated_staging'||liveEnabled!==false||localQaOnly!==true||
  [verifyAccessToken,verifySessionNotRevoked,loadExclusiveRole,allowRequest,rpc,now]
  .some(x=>typeof x!=='function'))throw Error('G44 private isolated QA authorities required');
 assertStagingRef(projectRef);
 const signed=signer(cursorSecrets,projectRef);
 async function authenticate(bearer,operation){
  if(typeof bearer!=='string'||bearer.length<20||bearer.length>7900||
   !/^[A-Za-z0-9._~-]+$/.test(bearer))return {failure:error(401,'JWT_REQUIRED')};
  const at=now();
  if(!nat(at))return {failure:error(503,'CLOCK_UNAVAILABLE')};
  let actor;
  try{actor=await verifyAccessToken(bearer);}
  catch{return {failure:error(401,'SESSION_UNVERIFIED')};}
  if(!plain(actor)||!uuid(actor.id)||!uuid(actor.sessionId)||
   actor.id!==actor.id.toLowerCase()||actor.sessionId!==actor.sessionId.toLowerCase()||
   !nat(actor.tokenIatMs)||actor.tokenIatMs>at||
   !nat(actor.expiresAtMs)||actor.expiresAtMs<=at||
   actor.is_anonymous===true||
   !(typeof actor.email_confirmed_at==='string'||typeof actor.phone_confirmed_at==='string'))
   return {failure:error(401,'SESSION_UNVERIFIED')};
  let current;
  try{current=await verifySessionNotRevoked({
   userId:actor.id,sessionId:actor.sessionId,at
  });}catch{return {failure:error(503,'REVOCATION_UNAVAILABLE')};}
  if(current!==true)return {failure:error(401,'SESSION_REVOKED')};
  let role;
  try{role=await loadExclusiveRole(actor.id);}
  catch{return {failure:error(503,'ROLE_AUTHORITY_UNAVAILABLE')};}
  if(role!=='passenger')return {failure:error(403,'BUYER_ROLE_REQUIRED')};
  try{
   if(allowRequest({userId:actor.id,operation})!==true)
    return {failure:error(429,'BUYER_RATE_LIMIT')};
  }catch{return {failure:error(503,'RATE_LIMIT_UNAVAILABLE')};}
  return {actor,at};
 }
 async function run(kind,{bearer,branchId,municipality,serviceKind,cursor=null}={}){
  if(cursor!==null&&(typeof cursor!=='string'||cursor.length>384)||
   kind==='catalog'&&!uuid(branchId)||
   kind==='branches'&&(
    typeof municipality!=='string'||municipality.length<2||
    municipality.length>80||municipality!==municipality.trim()||
    !['AUTO_DELIVERY','MOTO_DELIVERY'].includes(serviceKind)))
   return error(400,'INVALID_BUYER_FILTER');
  const a=await authenticate(bearer,'buyer.'+kind+'.read');
  if(a.failure)return a.failure;
  const {actor,at}=a;
  const scope=kind==='catalog'?branchId.toLowerCase():
   municipality+'\0'+serviceKind;
  const ctx={userId:actor.id,sessionId:actor.sessionId,kind,scope};
  const page=cursor===null?{after:null,version:null}:signed.decode(cursor,ctx,at);
  if(page===null||kind==='branches'&&page.version!==null||
   kind==='catalog'&&cursor!==null&&page.version===null)
   return error(400,'BUYER_CURSOR_INVALID');
  const name=kind==='catalog'?'mobility_stage_g44_buyer_catalog_page':
   'mobility_stage_g44_buyer_branches_page';
  const args=kind==='catalog'?{
   _buyer:actor.id,_session:actor.sessionId,_iat_ms:actor.tokenIatMs,
   _branch:branchId.toLowerCase(),_expected_revision:page.version,
   _after:page.after,_limit:PAGE
  }:{
   _buyer:actor.id,_session:actor.sessionId,_iat_ms:actor.tokenIatMs,
   _municipality:municipality,_service_kind:serviceKind,
   _after:page.after,_limit:PAGE
  };
  let result;
  try{result=await rpc(name,args);}
  catch{return error(503,'BUYER_CATALOG_SOURCE_UNAVAILABLE')};
  if(!plain(result))return error(503,'BUYER_CATALOG_SOURCE_UNAVAILABLE');
  if(result.error){
   if(result.error.code==='G4409')return error(409,'CATALOG_VERSION_CHANGED_REFRESH');
   if(['G4401','G4403'].includes(result.error.code))
    return error(403,'BUYER_OR_BRANCH_UNAVAILABLE');
   return error(503,'BUYER_CATALOG_SOURCE_UNAVAILABLE');
  }
  const data=result.data;
  const shape=kind==='catalog'?
   ['branchId','version','expiresAt','hasMore','items','orderEnabled','eligibleByPolicy']:
   ['hasMore','items'];
  if(!exact(data,shape)||typeof data.hasMore!=='boolean'||
   !Array.isArray(data.items)||data.items.length>PAGE||
   kind==='catalog'&&(!uuid(data.branchId)||data.branchId!==branchId.toLowerCase()||
    !positive(data.version)||page.version!==null&&data.version!==page.version||
    !nat(data.expiresAt)||data.expiresAt<=at||data.expiresAt>at+TTL||
    data.orderEnabled!==false||data.eligibleByPolicy!==false))
   return error(503,'BUYER_CATALOG_UNSAFE_PAGE');
  const last=validateRows(data.items,page.after,kind,{
   hasMore:data.hasMore,municipality,serviceKind
  });
  if(last===null||data.hasMore&&last===page.after)
   return error(503,'BUYER_CATALOG_UNSAFE_PAGE');
  let nextCursor=null;
  if(data.hasMore){
   try{nextCursor=signed.encode(ctx,last,kind==='catalog'?data.version:null,at);}
   catch{return error(503,'BUYER_CURSOR_SIGNING_UNAVAILABLE');}
  }
  const body=kind==='catalog'?{
   branchId:data.branchId,version:data.version,expiresAt:data.expiresAt,
   items:data.items,nextCursor,orderEnabled:false,eligibleByPolicy:false,
   snapshotConsistent:false,productionEnabled:false
  }:{
   municipality,serviceKind,items:data.items,nextCursor,
   orderEnabled:false,productionEnabled:false
  };
  return Object.freeze({status:200,body:Object.freeze(body)});
 }
 return Object.freeze({
  listBranches:request=>run('branches',request),
  listCatalog:request=>run('catalog',request)
 });
}

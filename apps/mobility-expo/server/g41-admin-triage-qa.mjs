/**
 * G41 / A22 — private, globally filtered priority incident queue in isolated QA.
 * This is a transport-free server boundary, not a deployed HTTP endpoint.
 * Server must supply independently verified JWT, session revocation, role,
 * scoped authorization, provider MFA, limiter and private PostgreSQL RPC.
 */
import {createHmac,timingSafeEqual} from 'node:crypto';
import {assertStagingRef} from './g2-staging-vehicle-gateway.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CURSOR=/^[A-Za-z0-9_-]{44,384}$/;
const KEY=/^[1-4][0-9]{13}[0-9a-f]{32}$/;
const SEVERITIES=['CRITICAL','HIGH','MEDIUM','LOW'];
const STATES=['OPEN','TRIAGED','INVESTIGATING','RESOLVED','CLOSED'];
const KEYS=['incidentId','category','severity','status','createdAt','revision'];
const CATEGORIES=['SAFETY','RIDE','DELIVERY','PAYMENT_SIMULATED','OTHER'];
const PAGE=50,TTL=600000;
const plain=o=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&
 (Object.getPrototypeOf(o)===Object.prototype||Object.getPrototypeOf(o)===null);
const exact=(o,fields)=>plain(o)&&Object.keys(o).length===fields.length&&
 fields.every(f=>Object.hasOwn(o,f));
const uuid=x=>typeof x==='string'&&UUID.test(x);
const num=x=>Number.isSafeInteger(x)&&x>=0;
const key=row=>String(4-SEVERITIES.indexOf(row.severity))+
 String(row.createdAt).padStart(13,'0')+
 row.incidentId.toLowerCase().replaceAll('-','');
const fail=(status,error)=>Object.freeze({
 status,body:Object.freeze({error})
});
function checkRows(source,filter,after,anchor){
 if(!exact(source,['revision','items','hasMore'])||!num(source.revision)||
  !Array.isArray(source.items)||source.items.length>PAGE||
  typeof source.hasMore!=='boolean'||
  source.hasMore&&source.items.length!==PAGE)return null;
 let previous=after;
 const seen=new Set();
 for(const row of source.items){
  if(!exact(row,KEYS)||!uuid(row.incidentId)||
   !CATEGORIES.includes(row.category)||
   !SEVERITIES.includes(row.severity)||!STATES.includes(row.status)||
   !num(row.createdAt)||row.createdAt>anchor||
   !num(row.revision)||row.revision===0||
   (filter.severity!==null&&row.severity!==filter.severity)||
   (filter.status!==null&&row.status!==filter.status))
   return null;
  const position=key(row);
  if(!KEY.test(position)||seen.has(position)||
   previous!==null&&position>=previous)return null;
  seen.add(position);previous=position;
 }
 return previous;
}
function signers(secrets,projectRef){
 if(!plain(secrets)||Object.keys(secrets).some(k=>!['current','previous'].includes(k))||
  typeof secrets.current!=='string'||Buffer.byteLength(secrets.current)<32||
  (secrets.previous!==undefined&&(typeof secrets.previous!=='string'||
   Buffer.byteLength(secrets.previous)<32||secrets.previous===secrets.current)))
  throw Error('G41 private cursor keyring required');
 const keys=[secrets.current,...(secrets.previous?[secrets.previous]:[])];
 const mac=(content,secret,ctx)=>createHmac('sha256',secret)
  .update('qore-g41-admin-triage-v1\0')
  .update(projectRef).update('\0').update(ctx.userId)
  .update('\0').update(ctx.sessionId).update('\0')
  .update(ctx.severity??'*').update('\0').update(ctx.status??'*')
  .update('\0').update(content).digest();
 return Object.freeze({
  encode(position,anchorMs,at,ctx){
   if(!KEY.test(position))throw Error('Cannot sign empty G41 keyset');
   const raw=Buffer.from(JSON.stringify([1,anchorMs,at+TTL,position]))
    .toString('base64url');
   const full=raw+'.'+mac(raw,secrets.current,ctx).toString('base64url');
   if(full.length>384)throw Error('G41 cursor oversized');
   return full;
  },
  decode(token,at,ctx){
   if(typeof token!=='string'||token.length>384)return null;
   const p=token.split('.');
   if(p.length!==2||!CURSOR.test(p[0])||
    !/^[A-Za-z0-9_-]{43}$/.test(p[1]))return null;
   const [value,tag]=p;
   if(Buffer.from(value,'base64url').toString('base64url')!==value||
    Buffer.from(tag,'base64url').toString('base64url')!==tag)return null;
   const received=Buffer.from(tag,'base64url');
   let matched=false;
   for(const secret of keys){
    const expected=mac(value,secret,ctx);
    if(received.length===expected.length&&timingSafeEqual(received,expected))
     matched=true;
   }
   if(!matched)return null;
   try{
    const str=Buffer.from(value,'base64url').toString('utf8');
    const data=JSON.parse(str);
    if(JSON.stringify(data)!==str||!Array.isArray(data)||data.length!==4||
     data[0]!==1||!num(data[1])||data[1]>at||
     !num(data[2])||data[2]<=at||data[2]>at+TTL||
     !KEY.test(data[3]))return null;
    return {anchorMs:data[1],after:data[3]};
   }catch{return null;}
  }
 });
}
export function createG41AdminTriageQa({
 environment,liveEnabled,localQaOnly,projectRef,cursorSecrets,
 verifyAccessToken,verifySessionNotRevoked,loadExclusiveBackofficeRole,
 authorizePermission,verifyBackofficeMfa,allowRequest,rpc,now=Date.now
}={}){
 if(environment!=='isolated_staging'||liveEnabled!==false||
  localQaOnly!==true||[
   verifyAccessToken,verifySessionNotRevoked,loadExclusiveBackofficeRole,
   authorizePermission,verifyBackofficeMfa,allowRequest,rpc,now
  ].some(f=>typeof f!=='function'))
  throw Error('G41 trusted server authorities and local QA only');
 assertStagingRef(projectRef);
 const signed=signers(cursorSecrets,projectRef);
 return async function triage({bearer,severity=null,status=null,cursor=null}={}){
  if(severity!==null&&!SEVERITIES.includes(severity)||
   status!==null&&!STATES.includes(status)||
   cursor!==null&&(typeof cursor!=='string'||cursor.length>384))
   return fail(400,'INVALID_TRIAGE_FILTER_OR_CURSOR');
  if(typeof bearer!=='string'||bearer.length<20||bearer.length>7900||
   !/^[A-Za-z0-9._~-]+$/.test(bearer))
   return fail(401,'JWT_REQUIRED');
  const at=now();
  if(!num(at))return fail(503,'CLOCK_UNAVAILABLE');
  let id;
  try{id=await verifyAccessToken(bearer);}
  catch{return fail(401,'SESSION_UNVERIFIED');}
  if(!plain(id)||!uuid(id.id)||id.is_anonymous===true||
   typeof id.sessionId!=='string'||id.sessionId.length<8||
   id.sessionId.length>128||
   !(typeof id.email_confirmed_at==='string'||
     typeof id.phone_confirmed_at==='string')||
   !num(id.expiresAtMs)||id.expiresAtMs<=at)
   return fail(401,'SESSION_UNVERIFIED');
  let current;
  try{current=await verifySessionNotRevoked({
   userId:id.id,sessionId:id.sessionId,at
  });}catch{return fail(503,'REVOCATION_UNAVAILABLE');}
  if(current!==true)return fail(401,'SESSION_REVOKED');
  let role;
  try{role=await loadExclusiveBackofficeRole(id.id);}
  catch{return fail(503,'ROLE_AUTHORITY_UNAVAILABLE');}
  if(role!=='admin')return fail(403,'EXCLUSIVE_ADMIN_REQUIRED');
  let scope;
  try{scope=await authorizePermission({
   userId:id.id,scope:'admin.incidents.read'
  });}catch{return fail(503,'SCOPE_UNAVAILABLE');}
  if(scope!==true)return fail(403,'TRIAGE_SCOPE_DENIED');
  try{
   if(allowRequest({userId:id.id,operation:'admin.incidents.triage'})!==true)
    return fail(429,'TRIAGE_RATE_LIMIT');
  }catch{return fail(503,'RATE_LIMIT_UNAVAILABLE');}
  let mfa;
  try{mfa=await verifyBackofficeMfa({
   token:bearer,userId:id.id,sessionId:id.sessionId,
   requiredLevel:'aal2',at
  });}catch{return fail(503,'MFA_UNAVAILABLE');}
  if(!plain(mfa)||mfa.verifiedByProvider!==true||
   mfa.userId!==id.id||mfa.sessionId!==id.sessionId||
   mfa.assuranceLevel!=='aal2'||!num(mfa.verifiedAtMs)||
   mfa.verifiedAtMs>at||at-mfa.verifiedAtMs>43200000||
   !num(mfa.expiresAtMs)||mfa.expiresAtMs<=at||
   mfa.expiresAtMs>id.expiresAtMs)
   return fail(403,'PROVIDER_AAL2_REQUIRED');
  const ctx={userId:id.id,sessionId:id.sessionId,severity,status};
  const paging=cursor===null?{anchorMs:at,after:null}:
   signed.decode(cursor,at,ctx);
  if(paging===null)return fail(400,'CURSOR_INVALID_OR_FILTER_CHANGED');
  let source;
  try{source=await rpc('mobility_stage_g41_admin_incident_triage_page',{
   _actor:id.id,_anchor_ms:paging.anchorMs,_after:paging.after,
   _limit:PAGE,_severity:severity,_status:status
  });}catch{return fail(503,'INCIDENT_SOURCE_UNAVAILABLE');}
  if(!plain(source)||source.error)return fail(503,'INCIDENT_SOURCE_UNAVAILABLE');
  const last=checkRows(source.data,{severity,status},paging.after,paging.anchorMs);
  if(last===null||source.data.hasMore&&last===paging.after)
   return fail(503,'UNSAFE_TRIAGE_PAGE');
  let nextCursor=null;
  if(source.data.hasMore){
   try{nextCursor=signed.encode(last,paging.anchorMs,at,ctx);}
   catch{return fail(503,'CURSOR_SIGNING_UNAVAILABLE');}
  }
  return Object.freeze({status:200,body:Object.freeze({
   scope:'admin.incidents.read',priorityOrder:'SEVERITY_THEN_NEWEST',
   severityFilter:severity,statusFilter:status,
   revision:source.data.revision,items:source.data.items,
   nextCursor,generatedAt:at,expiresAt:at+60000,
   snapshotConsistent:false,productionEnabled:false
  })});
 };
}

/**
 * A05.1 — five read-only Admin/Owner contracts, QA-only.
 * No listener, no public service, no SQL client and no LIVE flags.
 * The injected trusted loadPage MUST enforce row policy, server keyset, and
 * authoritative ledgers. This gateway refuses missing/unverified adapters.
 */
import {createHmac,timingSafeEqual} from 'node:crypto';
import {assertStagingRef} from './g2-staging-vehicle-gateway.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CURSOR=/^[A-Za-z0-9_-]{44,256}$/;
const PAGE_SIZE=50;
const TTL=60000;
const CURSOR_TTL=600000;
const ROUTES=Object.freeze({
 '/v1/staging/admin/vehicle-review-queue':{role:'admin',scope:'admin.kyc.read',kind:'kyc'},
 '/v1/staging/admin/zones/overview':{role:'admin',scope:'admin.zones.read',kind:'zones'},
 '/v1/staging/admin/incidents/queue':{role:'admin',scope:'admin.incidents.read',kind:'incidents'},
 '/v1/staging/admin/audit/events':{role:'admin',scope:'admin.audit.read',kind:'audit'},
 '/v1/staging/owner/finance/summary':{role:'owner',scope:'owner.finance.read',kind:'finance'}
});
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 (Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);
const exact=(x,keys)=>plain(x)&&Object.keys(x).length===keys.length&&
 keys.every(k=>Object.hasOwn(x,k));
const uuid=x=>typeof x==='string'&&UUID.test(x);
const num=x=>Number.isSafeInteger(x)&&x>=0;
const one=(x,set)=>set.includes(x);
const enums=Object.freeze({
 vehicleKind:['AUTO','MOTO_DELIVERY'],
 applicationStatus:['pending','under_review','rejected','approved','expired'],
 docStatus:['missing','pending','valid','expired','rejected'],
 serviceKind:['AUTO_RIDE','AUTO_DELIVERY','MOTO_DELIVERY'],
 coverageStatus:['ACTIVE','PLANNED','PAUSED','CLOSED'],
 category:['SAFETY','RIDE','DELIVERY','PAYMENT_SIMULATED','OTHER'],
 severity:['LOW','MEDIUM','HIGH','CRITICAL'],
 incidentStatus:['OPEN','TRIAGED','INVESTIGATING','RESOLVED','CLOSED'],
 actorRole:['admin','owner','security_operator'],
 operation:['KYC_REVIEW','ZONE_POLICY_CHANGE','INCIDENT_TRIAGE',
  'ACCOUNT_SUSPEND','ACCOUNT_RESTORE','TARIFF_PROPOSAL','COMMISSION_PROPOSAL'],
 targetKind:['VEHICLE','ZONE','INCIDENT','ACCOUNT','TARIFF','COMMISSION'],
 outcome:['REQUESTED','DENIED','CONFIRMED','ROLLED_BACK']
});
const keys=Object.freeze({
 kyc:['vehicleId','vehicleKind','applicationStatus','licenseStatus',
  'insuranceStatus','inspectionStatus','reviewRevision'],
 zones:['zoneId','municipality','serviceKind','coverageStatus',
  'eligibleByPolicy','onDutyVehicles','availabilityObservedAt'],
 incidents:['incidentId','category','severity','status','createdAt','revision'],
 audit:['eventId','actorRole','operation','targetKind','outcome','occurredAt','revision']
});
const financeFields=['completedRides','completedDeliveries','completedMerchantOrders',
 'grossCollectedGs','driverPayoutGs','platformCommissionGs','refundsGs',
 'processingFeesGs','netPlatformGs'];
const date=s=>typeof s==='string'&&/^\d{4}-\d\d-\d\d$/.test(s)&&
 !Number.isNaN(Date.parse(s+'T00:00:00Z'))&&
 new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
function good(row,kind,at){
 if(!exact(row,keys[kind]))return false; // whitelist: NEVER pass PII
 switch(kind){
 case 'kyc':return uuid(row.vehicleId)&&
  one(row.vehicleKind,enums.vehicleKind)&&
  one(row.applicationStatus,enums.applicationStatus)&&
  ['licenseStatus','insuranceStatus','inspectionStatus'].every(k=>
   one(row[k],enums.docStatus))&&num(row.reviewRevision);
 case 'zones':return uuid(row.zoneId)&&
  typeof row.municipality==='string'&&row.municipality.trim().length>=2&&
  row.municipality.length<=80&&one(row.serviceKind,enums.serviceKind)&&
  one(row.coverageStatus,enums.coverageStatus)&&
  typeof row.eligibleByPolicy==='boolean'&&
  num(row.onDutyVehicles)&&row.onDutyVehicles<=100000&&
  num(row.availabilityObservedAt)&&row.availabilityObservedAt<=at;
 case 'incidents':return uuid(row.incidentId)&&
  one(row.category,enums.category)&&one(row.severity,enums.severity)&&
  one(row.status,enums.incidentStatus)&&
  num(row.createdAt)&&row.createdAt<=at&&num(row.revision);
 case 'audit':return uuid(row.eventId)&&
  one(row.actorRole,enums.actorRole)&&one(row.operation,enums.operation)&&
  one(row.targetKind,enums.targetKind)&&one(row.outcome,enums.outcome)&&
  num(row.occurredAt)&&row.occurredAt<=at&&num(row.revision);
 default:return false;
 }
}
const compact=id=>id.replaceAll('-','').toLowerCase();
const digits=n=>String(n).padStart(13,'0');
function keyOf(kind,row){
 switch(kind){
 case 'kyc':return compact(row.vehicleId);
 case 'zones':return compact(row.zoneId)+String(enums.serviceKind.indexOf(row.serviceKind));
 case 'incidents':return digits(row.createdAt)+compact(row.incidentId);
 case 'audit':return digits(row.occurredAt)+compact(row.eventId);
 default:throw Error('Unsupported keyset');
 }
}
function validFinance(raw,at){
 if(!exact(raw,['period','currency','revision','ledgerRevision',
  'reconciliationStatus','totals'])||
  raw.currency!=='PYG'||raw.reconciliationStatus!=='RECONCILED'||
  !num(raw.revision)||!num(raw.ledgerRevision)||raw.ledgerRevision===0||
  !exact(raw.period,['from','to','timezone'])||
  raw.period.timezone!=='America/Asuncion'||
  !date(raw.period.from)||!date(raw.period.to)||
  raw.period.from>raw.period.to||
  (Date.parse(raw.period.to+'T00:00:00Z')-
   Date.parse(raw.period.from+'T00:00:00Z'))>92*86400000||
  !exact(raw.totals,financeFields))return false;
 return financeFields.every(f=>Number.isSafeInteger(raw.totals[f])&&
  Math.abs(raw.totals[f])<=1e12&&
  (f==='netPlatformGs'||raw.totals[f]>=0));
}
const response=(status,body)=>({status,body});
const getBearer=headers=>{
 const v=headers?.authorization??headers?.Authorization;
 return typeof v==='string'&&v.length<8000?
  /^Bearer ([A-Za-z0-9._~-]{20,7900})$/.exec(v)?.[1]??null:null;
};
function parsePath(value){
 if(typeof value!=='string'||value.length>600||value.includes('#')||
   value.includes('%25')||value.includes('\\')||value.includes('//'))return null;
 const parts=value.split('?');
 if(parts.length>2||!Object.hasOwn(ROUTES,parts[0]))return null;
 if(parts.length===1)return {route:ROUTES[parts[0]],cursor:null};
 if(ROUTES[parts[0]].kind==='finance'||!/^cursor=[A-Za-z0-9_-]{44,256}$/.test(parts[1]))
  return {error:true};
 return {route:ROUTES[parts[0]],cursor:parts[1].slice(7)};
}
function codec(secrets,projectRef){
 if(!plain(secrets)||!Object.keys(secrets).every(k=>k==='current'||k==='previous')||
   typeof secrets.current!=='string'||Buffer.byteLength(secrets.current)<32||
   (secrets.previous!==undefined&&
    (typeof secrets.previous!=='string'||Buffer.byteLength(secrets.previous)<32||
     secrets.previous===secrets.current)))
  throw Error('Independent server-only backoffice cursor keyring required');
 const current=secrets.current;
 const all=[current,...(secrets.previous?[secrets.previous]:[])];
 const mac=(data,key,ctx)=>createHmac('sha256',key).update('qore-admin-read-v1\0')
  .update(projectRef).update('\0').update(ctx.userId).update('\0')
  .update(ctx.sessionId).update('\0').update(ctx.scope).update('\0')
  .update(data).digest();
 const encode=(position,anchorMs,at,ctx)=>{
  const payload=Buffer.from(JSON.stringify([1,anchorMs,at+CURSOR_TTL,position]))
   .toString('base64url');
  const output=payload+mac(payload,current,ctx).toString('base64url');
  if(output.length>256||!CURSOR.test(output))throw Error('Invalid cursor size');
  return output;
 };
 const decode=(cursor,at,ctx)=>{
  if(!CURSOR.test(cursor))return null;
  const data=cursor.slice(0,-43),sig=Buffer.from(cursor.slice(-43),'base64url');
  if(Buffer.from(data,'base64url').toString('base64url')!==data)return null;
  let match=false;
  for(const secret of all){
   const expected=mac(data,secret,ctx);
   if(sig.length===expected.length&&timingSafeEqual(sig,expected))match=true;
  }
  if(!match)return null;
  try{
   const a=JSON.parse(Buffer.from(data,'base64url').toString('utf8'));
   if(!Array.isArray(a)||a.length!==4||a[0]!==1||
    !num(a[1])||a[1]>at||!num(a[2])||a[2]<=at||
    a[2]>at+CURSOR_TTL||typeof a[3]!=='string'||
    !/^[0-9a-z]{32,45}$/.test(a[3]))return null;
   return {anchorMs:a[1],after:a[3]};
  }catch{return null;}
 };
 return {encode,decode};
}
function confirmed(user,at){
 return plain(user)&&uuid(user.id)&&user.is_anonymous!==true&&
  (typeof user.email_confirmed_at==='string'||
   typeof user.phone_confirmed_at==='string')&&
  typeof user.sessionId==='string'&&user.sessionId.length>=8&&
  user.sessionId.length<=128&&num(user.expiresAtMs)&&user.expiresAtMs>at;
}
function mfaTrusted(m,user,at){
 return plain(m)&&m.verifiedByProvider===true&&m.userId===user.id&&
  m.sessionId===user.sessionId&&m.assuranceLevel==='aal2'&&
  num(m.verifiedAtMs)&&m.verifiedAtMs<=at&&
  at-m.verifiedAtMs<=43200000&&num(m.expiresAtMs)&&
  m.expiresAtMs>at&&m.expiresAtMs<=user.expiresAtMs;
}
/**
 * loadPage({scope,actorId,anchorMs,after,limit}) is NOT a public query:
 * adapter is server-controlled and MUST perform restrictive SQL authorization,
 * deterministic DESC keyset, and real source-of-truth reconciliation.
 */
export function createQoreBackofficeReadGateway({
 projectRef,cursorSecrets,verifyAccessToken,loadExclusiveBackofficeRole,
 verifyBackofficeMfa,authorizePermission,allowRequest,loadPage,now=Date.now
}){
 assertStagingRef(projectRef);
 if(![verifyAccessToken,loadExclusiveBackofficeRole,verifyBackofficeMfa,
  authorizePermission,allowRequest,loadPage,now].every(f=>typeof f==='function'))
  throw Error('Trusted backoffice read adapters required');
 const signing=codec(cursorSecrets,projectRef);
 return async({method,path,headers,body})=>{
  const parsed=parsePath(path);
  if(!parsed)return response(404,{error:'Not found'});
  if(method!=='GET')return response(404,{error:'Not found'});
  if(parsed.error)return response(400,{error:'Invalid cursor query'});
  if(body!==undefined&&body!==null)return response(400,{error:'GET body not supported'});
  const bearer=getBearer(headers);
  if(!bearer)return response(401,{error:'Verified session required'});
  const at=now();
  if(!num(at))return response(503,{error:'Server clock invalid'});
  let user;
  try{user=await verifyAccessToken(bearer);}
  catch{return response(401,{error:'Session invalid'});}
  if(!confirmed(user,at))return response(401,{error:'Active verified session required'});
  const {route,cursor}=parsed;
  let role;
  try{role=await loadExclusiveBackofficeRole(user.id);}
  catch{return response(503,{error:'Role lookup unavailable'});}
  if(role!==route.role)return response(403,{error:'Exclusive role required'});
  let approved;
  try{approved=await authorizePermission({userId:user.id,scope:route.scope});}
  catch{return response(503,{error:'Permission authority unavailable'});}
  if(approved!==true)return response(403,{error:'Permission denied'});
  try{
   if(allowRequest({userId:user.id,operation:route.scope})!==true)
    return response(429,{error:'Backoffice read limited'});
  }catch{return response(503,{error:'Rate limit unavailable'});}
  let mfa;
  try{mfa=await verifyBackofficeMfa({
   token:bearer,userId:user.id,sessionId:user.sessionId,
   requiredLevel:'aal2',at
  });}catch{return response(503,{error:'MFA authority unavailable'});}
  if(!mfaTrusted(mfa,user,at))return response(403,{error:'MFA required'});
  const ctx={userId:user.id,sessionId:user.sessionId,scope:route.scope};
  const state=cursor===null?{anchorMs:at,after:null}:signing.decode(cursor,at,ctx);
  if(state===null)return response(400,{error:'Cursor invalid or expired'});
  let result;
  try{result=await loadPage({
   scope:route.scope,actorId:user.id,anchorMs:state.anchorMs,
   after:state.after,limit:route.kind==='finance'?null:PAGE_SIZE
  });}catch{return response(503,{error:'Source of truth unavailable'});}
  if(route.kind==='finance'){
   if(!validFinance(result,at))
    return response(503,{error:'Finance not reconciled'});
   return response(200,{
    scope:route.scope,ownerId:user.id,...result,
    generatedAt:at,expiresAt:at+TTL
   });
  }
  if(!plain(result)||!exact(result,['revision','items','hasMore'])||
   !num(result.revision)||typeof result.hasMore!=='boolean'||
   !Array.isArray(result.items)||result.items.length>PAGE_SIZE||
   (result.hasMore&&result.items.length!==PAGE_SIZE))
   return response(503,{error:'Invalid page'});
  const seen=new Set();
  let previous=state.after;
  for(const item of result.items){
   if(!good(item,route.kind,at))
    return response(503,{error:'Unsafe record'});
   const key=keyOf(route.kind,item);
   if(seen.has(key)||previous!==null&&key>=previous)
    return response(503,{error:'Unstable keyset'});
   seen.add(key);previous=key;
  }
  let nextCursor=null;
  try{
   if(result.hasMore){
    nextCursor=signing.encode(previous,state.anchorMs,at,ctx);
   }
  }catch{return response(503,{error:'Cannot sign cursor'});}
  return response(200,{
   scope:route.scope,revision:result.revision,generatedAt:at,
   expiresAt:at+TTL,items:result.items,nextCursor
  });
 };
}

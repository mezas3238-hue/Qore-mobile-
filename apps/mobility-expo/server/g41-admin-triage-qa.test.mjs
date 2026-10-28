import test from 'node:test';
import assert from 'node:assert/strict';
import {createG41AdminTriageQa} from './g41-admin-triage-qa.mjs';

const at=Date.parse('2026-10-23T15:00:00Z');
const id='11111111-1111-4111-8111-111111111111';
const token='verifiedFakeBearerForIsolatedQAOnly123456';
const secret='strong-isolated-qa-signing-secret-more-than-32-bytes';
const identity={id,sessionId:'session-verified-001',is_anonymous:false,
 email_confirmed_at:'2026-10-23T08:00:00Z',expiresAtMs:at+1200000};
const mfa={verifiedByProvider:true,userId:id,sessionId:identity.sessionId,
 assuranceLevel:'aal2',verifiedAtMs:at-1000,expiresAtMs:at+900000};
const severity=['CRITICAL','HIGH','MEDIUM','LOW'];
const uuid=n=>n.toString(16).padStart(8,'0')+'-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const rows=Array.from({length:241},(_,i)=>{
 const rank=Math.floor(i/61);
 return {incidentId:uuid(241-i),category:'SAFETY',
  severity:severity[Math.min(rank,3)],
  status:i%3===0?'OPEN':'TRIAGED',
  createdAt:at-100000-(i%9)*1000,
  revision:1};
}).sort((a,b)=>{
 const severityDiff=severity.indexOf(a.severity)-severity.indexOf(b.severity);
 if(severityDiff)return severityDiff;
 return b.createdAt-a.createdAt||
  b.incidentId.localeCompare(a.incidentId);
});
const position=row=>String(4-severity.indexOf(row.severity))+
 String(row.createdAt).padStart(13,'0')+row.incidentId.replaceAll('-','');
function make(overrides={}){
 const calls=[];
 const adapters={
  environment:'isolated_staging',liveEnabled:false,localQaOnly:true,
  projectRef:'staging1234567890abcd',cursorSecrets:{current:secret},now:()=>at,
  verifyAccessToken:async()=>identity,
  verifySessionNotRevoked:async()=>true,
  loadExclusiveBackofficeRole:async()=> 'admin',
  authorizePermission:async()=>true,
  verifyBackofficeMfa:async()=>mfa,
  allowRequest:()=>true,
  rpc:async(name,args)=>{
   calls.push({name,args});
   const list=rows.filter(r=>
    (args._severity===null||r.severity===args._severity)&&
    (args._status===null||r.status===args._status)&&
    r.createdAt<=args._anchor_ms&&
    (args._after===null||position(r)<args._after));
   return {data:{revision:1,items:list.slice(0,50),hasMore:list.length>50}};
  },
  ...overrides
 };
 return {request:createG41AdminTriageQa(adapters),calls};
}
test('G41 globally traverses 241 real-shaped rows, not only first 50',async()=>{
 const {request,calls}=make();let cursor=null,seen=new Set(),pages=0;
 do{
  const v=await request({bearer:token,cursor});
  assert.equal(v.status,200,JSON.stringify(v.body));
  assert.equal(v.body.priorityOrder,'SEVERITY_THEN_NEWEST');
  assert.equal(v.body.snapshotConsistent,false);
  assert.equal(v.body.productionEnabled,false);
  for(const row of v.body.items){
   assert.equal(seen.has(row.incidentId),false);
   seen.add(row.incidentId);
  }
  cursor=v.body.nextCursor;pages++;
 }while(cursor!==null&&pages<10);
 assert.equal(pages,5);
 assert.equal(seen.size,241);
 assert.equal(calls.length,5);
 assert.ok(calls.every(c=>c.name==='mobility_stage_g41_admin_incident_triage_page'&&
  c.args._actor===id&&c.args._limit===50));
});
test('G41 independently applies severity and status filters BEFORE each page',async()=>{
 const {request}=make();let cursor=null,total=0,pages=0;
 do{
  const res=await request({bearer:token,severity:'CRITICAL',status:'OPEN',cursor});
  assert.equal(res.status,200);
  assert.ok(res.body.items.every(x=>x.severity==='CRITICAL'&&x.status==='OPEN'));
  total+=res.body.items.length;
  cursor=res.body.nextCursor;pages++;
 }while(cursor&&pages<10);
 assert.equal(total,rows.filter(r=>r.severity==='CRITICAL'&&r.status==='OPEN').length);
 assert.equal(pages,1);
});
test('G41 HMAC cursors reject filter, identity, session, signature, key and expiry changes',async()=>{
 const first=await make().request({bearer:token,severity:'CRITICAL'});
 assert.equal(first.status,200);
 const cursor=first.body.nextCursor;
 assert.ok(cursor&&cursor.includes('.'));
 assert.equal((await make().request({bearer:token,status:'OPEN',severity:'CRITICAL',cursor})).status,400);
 assert.equal((await make().request({bearer:token,severity:'LOW',cursor})).status,400);
 assert.equal((await make({verifyAccessToken:async()=>({...identity,
  sessionId:'rotated-session-002'}) ,
  verifyBackofficeMfa:async()=>({...mfa,sessionId:'rotated-session-002'})
 }).request({bearer:token,severity:'CRITICAL',cursor})).status,400);
 assert.equal((await make({verifyAccessToken:async()=>({...identity,
  id:'99999999-9999-4999-8999-999999999999'}),
  verifyBackofficeMfa:async()=>({...mfa,
   userId:'99999999-9999-4999-8999-999999999999'})
 }).request({bearer:token,severity:'CRITICAL',cursor})).status,400);
 const altered=cursor.slice(0,-1)+(cursor.endsWith('A')?'B':'A');
 assert.equal((await make().request({bearer:token,severity:'CRITICAL',cursor:altered})).status,400);
 assert.equal((await make({cursorSecrets:{current:secret+'-rotated'}})
  .request({bearer:token,severity:'CRITICAL',cursor})).status,400);
 assert.equal((await make({cursorSecrets:{current:secret+'-rotated',previous:secret}})
  .request({bearer:token,severity:'CRITICAL',cursor})).status,200);
 assert.equal((await make({now:()=>at+600001,
  verifyAccessToken:async()=>({...identity,expiresAtMs:at+900000}),
  verifyBackofficeMfa:async()=>({...mfa,expiresAtMs:at+850000})
 }).request({bearer:token,severity:'CRITICAL',cursor})).status,400);
});
test('G41 independent JWT, revocation, RBAC, MFA and limiter failures never touch SQL',async()=>{
 for(const [overrides,code] of [
  [{verifyAccessToken:async()=>{throw Error('revoked')}},401],
  [{verifySessionNotRevoked:async()=>false},401],
  [{verifySessionNotRevoked:async()=>{throw Error('unavailable')}},503],
  [{loadExclusiveBackofficeRole:async()=> 'owner'},403],
  [{loadExclusiveBackofficeRole:async()=>['admin','owner']},403],
  [{authorizePermission:async()=>false},403],
  [{verifyBackofficeMfa:async()=>({...mfa,verifiedByProvider:false})},403],
  [{verifyBackofficeMfa:async()=>({...mfa,assuranceLevel:'aal1'})},403],
  [{allowRequest:()=>false},429],
  [{allowRequest:()=>{throw Error('unavailable')}},503],
  [{verifyAccessToken:async()=>({...identity,expiresAtMs:at})},401],
 ]){
  const f=make(overrides);
  assert.equal((await f.request({bearer:token})).status,code);
  assert.equal(f.calls.length,0);
 }
});
test('G41 rejects fake filters and poisonous PII/status/ordering from SQL',async()=>{
 const f=make();
 for(const req of [
  {bearer:token,severity:'critical'},{bearer:token,severity:'ALL'},
  {bearer:token,status:'OPEN OR TRUE'},
  {bearer:token,cursor:'bogus'}
 ])assert.equal((await f.request(req)).status,400);
 assert.equal(f.calls.length,0);
 const poisoned=[
  {data:{revision:0,items:[{...rows[0],email:'secret'}],hasMore:false}},
  {data:{revision:0,items:[rows[1],rows[0]],hasMore:false}},
  {data:{revision:0,items:[],hasMore:true}},
  {data:{revision:0,items:[{...rows[0],createdAt:at+1}],hasMore:false}},
  {data:{revision:0,items:[{...rows[0],status:'HACKED'}],hasMore:false}},
  {data:{revision:0,items:Array(51).fill(rows[0]),hasMore:false}}
 ];
 for(const output of poisoned)
  assert.equal((await make({rpc:async()=>output}).request({bearer:token})).status,503);
});
test('G41 constructor refuses production, missing authorities and weak keyring',()=>{
 const d={environment:'isolated_staging',liveEnabled:false,localQaOnly:true,
  projectRef:'staging1234567890abcd',cursorSecrets:{current:secret},
  verifyAccessToken:async()=>{},verifySessionNotRevoked:async()=>{},
  loadExclusiveBackofficeRole:async()=>{},authorizePermission:async()=>{},
  verifyBackofficeMfa:async()=>{},allowRequest:()=>{},rpc:async()=>{}};
 for(const x of [
  {environment:'production'},{liveEnabled:true},{localQaOnly:false},
  {cursorSecrets:{current:'weak'}},{verifyAccessToken:null},
  {rpc:null},{verifySessionNotRevoked:null},{verifyBackofficeMfa:null}
 ])assert.throws(()=>createG41AdminTriageQa({...d,...x}));
});

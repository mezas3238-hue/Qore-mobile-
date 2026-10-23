import test from 'node:test';
import assert from 'node:assert/strict';
import {createQoreBackofficeReadGateway} from './g27-backoffice-read-gateway.mjs';

const at=Date.parse('2026-10-23T12:00:00Z');
const id='11111111-1111-4111-8111-111111111111';
const another='22222222-2222-4222-8222-222222222222';
const token='verifiedSyntheticBearerLongEnough1234567890';
const keyA='A05-testing-dedicated-private-cursor-signing-key-01';
const keyB='A05-testing-dedicated-private-cursor-signing-key-02';
const session={id,sessionId:'session-admin-0001',expiresAtMs:at+1200000,
 is_anonymous:false,email_confirmed_at:'2026-10-22T12:00:00Z'};
const mfa={verifiedByProvider:true,userId:id,sessionId:session.sessionId,
 assuranceLevel:'aal2',verifiedAtMs:at-3000,expiresAtMs:at+900000};
const defs={
 kyc:{path:'/v1/staging/admin/vehicle-review-queue',scope:'admin.kyc.read'},
 zones:{path:'/v1/staging/admin/zones/overview',scope:'admin.zones.read'},
 incidents:{path:'/v1/staging/admin/incidents/queue',scope:'admin.incidents.read'},
 audit:{path:'/v1/staging/admin/audit/events',scope:'admin.audit.read'},
 finance:{path:'/v1/staging/owner/finance/summary',scope:'owner.finance.read'}
};
const uuid=n=>n.toString(16).padStart(8,'0')+'-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
function item(kind,n){
 switch(kind){
 case 'kyc':return {vehicleId:uuid(n),vehicleKind:'AUTO',
  applicationStatus:'pending',licenseStatus:'pending',insuranceStatus:'missing',
  inspectionStatus:'missing',reviewRevision:1};
 case 'zones':return {zoneId:uuid(n),municipality:'Asuncion',serviceKind:'AUTO_RIDE',
  coverageStatus:'PLANNED',eligibleByPolicy:false,onDutyVehicles:0,
  availabilityObservedAt:at-1000};
 case 'incidents':return {incidentId:uuid(n),category:'SAFETY',
  severity:'HIGH',status:'OPEN',createdAt:at-200000+n*10,revision:1};
 case 'audit':return {eventId:uuid(n),actorRole:'admin',operation:'KYC_REVIEW',
  targetKind:'VEHICLE',outcome:'CONFIRMED',occurredAt:at-200000+n*10,revision:1};
 }
}
function key(kind,row){
 const hex=s=>s.replaceAll('-','');
 if(kind==='kyc')return hex(row.vehicleId);
 if(kind==='zones')return hex(row.zoneId)+'0';
 if(kind==='incidents')return String(row.createdAt).padStart(13,'0')+hex(row.incidentId);
 if(kind==='audit')return String(row.occurredAt).padStart(13,'0')+hex(row.eventId);
}
const rows=kind=>Array.from({length:123},(_,i)=>item(kind,123-i));
const finance=()=>({
 period:{from:'2026-10-01',to:'2026-10-22',timezone:'America/Asuncion'},
 currency:'PYG',revision:3,ledgerRevision:12,reconciliationStatus:'RECONCILED',
 totals:{completedRides:4,completedDeliveries:2,completedMerchantOrders:1,
 grossCollectedGs:30000,driverPayoutGs:20000,platformCommissionGs:7000,
 refundsGs:1000,processingFeesGs:500,netPlatformGs:5500}
});
function fixture(options={}){
 const state={auth:0,roles:0,scope:[],mfa:0,reads:[],role:'admin',actor:id};
 const loadPage=async({scope,actorId,anchorMs,after,limit})=>{
  state.reads.push({scope,actorId,anchorMs,after,limit});
  const kind=Object.keys(defs).find(k=>defs[k].scope===scope);
  if(kind==='finance')return finance();
  const list=rows(kind).filter(row=>after===null||key(kind,row)<after)
   .filter(row=>kind!=='incidents'&&kind!=='audit'||row[kind==='incidents'?'createdAt':'occurredAt']<=anchorMs);
  return {revision:1,items:list.slice(0,50),hasMore:list.length>50};
 };
 const gateway=createQoreBackofficeReadGateway({
  projectRef:'staging1234567890abcd',cursorSecrets:{current:keyA},
  now:()=>at,
  verifyAccessToken:async t=>{state.auth++;assert.equal(t,token);
   return {...session,id:state.actor};},
  loadExclusiveBackofficeRole:async()=>{state.roles++;return state.role;},
  authorizePermission:async({userId,scope})=>{state.scope.push({userId,scope});return true;},
  allowRequest:()=>true,
  verifyBackofficeMfa:async()=>{state.mfa++;return {...mfa,userId:state.actor};},
  loadPage,...options
 });
 const req=(kind,cursor)=>gateway({method:'GET',
  path:defs[kind].path+(cursor?'?cursor='+cursor:''),
  headers:{authorization:'Bearer '+token}
 });
 return {state,gateway,req};
}
test('A05 four Admin resources expose unlimited total history in 50-item signed pages',async()=>{
 for(const kind of ['kyc','zones','incidents','audit']){
  const f=fixture();let cursor=null,seen=new Set(),pages=0;
  do {
   const result=await f.req(kind,cursor);
   assert.equal(result.status,200,kind+': '+JSON.stringify(result));
   assert.equal(result.body.scope,defs[kind].scope);
   assert.ok(result.body.items.length<=50);
   for(const row of result.body.items){
    const k=key(kind,row);
    assert.ok(!seen.has(k),kind+': duplicate record');seen.add(k);
   }
   cursor=result.body.nextCursor;
   if(cursor!==null)assert.match(cursor,/^[A-Za-z0-9_-]{44,256}$/);
   pages++;
  }while(cursor!==null&&pages<10);
  assert.equal(seen.size,123,kind+' must never stop at 50');
  assert.equal(pages,3);
  assert.equal(f.state.auth,3);
  assert.equal(f.state.reads.length,3);
  assert.ok(f.state.reads.every(x=>x.actorId===id&&x.limit===50));
 }
});
test('A05 Owner finance is reconciled, synthetic, scoped and never accepts a cursor',async()=>{
 const f=fixture();f.state.role='owner';
 const result=await f.req('finance');
 assert.equal(result.status,200);
 assert.equal(result.body.ownerId,id);
 assert.equal(result.body.scope,'owner.finance.read');
 assert.equal(result.body.totals.netPlatformGs,5500);
 assert.equal(result.body.currency,'PYG');
 assert.equal(result.body.reconciliationStatus,'RECONCILED');
 assert.equal(f.state.reads[0].limit,null);
 assert.equal((await f.req('finance','abcdef'.repeat(10))).status,400);
 f.state.role='admin';
 assert.equal((await f.req('finance')).status,403);
});
test('A05 role and permission boundary denies Admin/Owner cross-access before reading',async()=>{
 const a=fixture();
 assert.equal((await a.req('finance')).status,403);
 assert.equal(a.state.reads.length,0);
 const b=fixture({authorizePermission:async()=>false});
 assert.equal((await b.req('kyc')).status,403);
 assert.equal(b.state.reads.length,0);
 const c=fixture({loadExclusiveBackofficeRole:async()=>['admin','owner']});
 assert.equal((await c.req('kyc')).status,403);
 assert.equal(c.state.reads.length,0);
});
test('A05 bad JWT, missing auth, rotated identity, MFA and rate limit fail closed',async()=>{
 const f=fixture();
 assert.equal((await f.gateway({method:'GET',path:defs.kyc.path,headers:{}})).status,401);
 assert.equal((await f.gateway({method:'POST',path:defs.kyc.path})).status,404);
 assert.equal((await f.gateway({method:'GET',path:defs.kyc.path+'?ownerId='+another})).status,400);
 assert.equal((await f.gateway({method:'GET',path:defs.kyc.path,body:{}})).status,400);
 for(const [options,status] of [
  [{verifyAccessToken:async()=>{throw Error('revoked')}},401],
  [{verifyAccessToken:async()=>({...session,expiresAtMs:at})},401],
  [{verifyAccessToken:async()=>({...session,is_anonymous:true})},401],
  [{verifyBackofficeMfa:async()=>({...mfa,verifiedByProvider:false})},403],
  [{verifyBackofficeMfa:async()=>({...mfa,userId:another})},403],
  [{verifyBackofficeMfa:async()=>({...mfa,assuranceLevel:'aal1'})},403],
  [{verifyBackofficeMfa:async()=>({...mfa,verifiedAtMs:at-50000000})},403],
  [{allowRequest:()=>false},429],
  [{authorizePermission:async()=>{throw Error('denied')}},503],
  [{loadPage:async()=>{throw Error('db down')}},503]
 ]){
  const t=fixture(options);
  assert.equal((await t.req('kyc')).status,status);
  assert.equal(t.state.reads.length,0);
 }
});
test('A05 cursors bind operation, account, session, key and expiry',async()=>{
 const f=fixture();
 const first=await f.req('kyc');
 assert.equal(first.status,200);
 const cursor=first.body.nextCursor;
 assert.ok(cursor);
 assert.equal((await f.req('zones',cursor)).status,400);
 f.state.actor=another;
 assert.equal((await f.req('kyc',cursor)).status,400);
 const nextSession=fixture({verifyAccessToken:async()=>({...session,sessionId:'session-new-0002'})});
 assert.equal((await nextSession.req('kyc',cursor)).status,400);
 const old=fixture({now:()=>at+600001});
 assert.equal((await old.req('kyc',cursor)).status,400);
 const tampered=cursor.slice(0,-1)+(cursor.endsWith('A')?'B':'A');
 assert.equal((await fixture().req('kyc',tampered)).status,400);
 assert.equal((await fixture({cursorSecrets:{current:keyB}}).req('kyc',cursor)).status,400);
 assert.equal((await fixture({cursorSecrets:{current:keyB,previous:keyA}}).req('kyc',cursor)).status,200);
});
test('A05 no PII in queue, bad keys, fake reconciliation or unsorted data',async()=>{
 for(const kind of ['kyc','zones','incidents','audit']){
  const poisoned=item(kind,10);
  poisoned.driverName='SHOULD_NEVER_LEAK';
  const gateway=fixture({loadPage:async()=>({revision:1,items:[poisoned],hasMore:false})});
  assert.equal((await gateway.req(kind)).status,503);
  const wrongOrder=fixture({loadPage:async()=>({
   revision:1,items:[item(kind,1),item(kind,2)],hasMore:false
  })});
  assert.equal((await wrongOrder.req(kind)).status,503);
  const incomplete=fixture({loadPage:async()=>({
   revision:1,items:[item(kind,9)],hasMore:true
  })});
  assert.equal((await incomplete.req(kind)).status,503);
 }
 const f=fixture({loadPage:async()=>({...finance(),reconciliationStatus:'PENDING'})});
 f.state.role='owner';
 assert.equal((await f.req('finance')).status,503);
});
test('A05 fail-closed constructor forbids missing or weak server dependencies',()=>{
 for(const v of [
  {cursorSecrets:{current:'short'}},
  {cursorSecrets:{current:keyA,previous:keyA}},
  {loadPage:null},
  {verifyBackofficeMfa:null}
 ]){
  assert.throws(()=>createQoreBackofficeReadGateway({
   projectRef:'staging1234567890abcd',
   cursorSecrets:{current:keyA},
   verifyAccessToken:async()=>{},
   loadExclusiveBackofficeRole:async()=>{},
   verifyBackofficeMfa:async()=>{},
   authorizePermission:async()=>true,
   allowRequest:()=>true,loadPage:async()=>{},
   ...v
  }));
 }
});

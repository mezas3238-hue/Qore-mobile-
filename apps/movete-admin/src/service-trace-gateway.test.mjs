import test from 'node:test';
import assert from 'node:assert/strict';
import {createServiceTraceGateway,createServiceTraceQaOptions,TRACE_SERVICE_KINDS}
 from './service-trace-gateway.mjs';
const uuid=n=>'d0000000-0000-4000-8000-'+String(n).padStart(12,'0');
const at=Date.parse('2026-10-26T21:00:00Z'),id=uuid(1),admin=uuid(2);
const session={role:'admin',subject:admin,mfaVerified:true,authRevision:4,
 token:'admin-aal2-verified-qa-session-012345',expiresAt:at+300000};
const row=kind=>({
 mode:'STAGING_DEMO_ONLY',viewerId:admin,serviceId:id,
 serviceKind:kind,bookingRequestKey:uuid(3),quoteId:kind==='COMMERCE'?null:uuid(4),
 status:'requested',revision:1,observedAt:at,expiresAt:at+30000,
 serverPersisted:true,productionEnabled:false,
 assignment:{state:'NOT_ASSIGNABLE',legalGate:kind==='COMMERCE'?'G38_BLOCKED':'G71_BLOCKED'},
 events:[{eventId:uuid(5),serviceId:id,sequence:1,status:'requested',at:at-1000}],
 ledger:kind==='COMMERCE'?null:{serviceId:id,currency:'PYG',grossGs:20000,
  platformCommissionGs:3000,customerSubsidyGs:2000,
  driverPayoutGs:17000,reconciliationStatus:'PENDING'}
});
const response=(dto,status=200)=>({
 status,ok:status===200,redirected:false,
 headers:{get:k=>k==='content-type'?'application/json':null},
 text:async()=>JSON.stringify(dto)
});
function configured(fetchImpl,getSession=async()=>session,onSessionInvalid=()=>{}){
 return createServiceTraceGateway({enabled:true,contractCertified:true,
  origin:'https://test.invalid',pinnedOrigin:'https://test.invalid',
  now:()=>at,getSession,fetchImpl,onSessionInvalid});
}
test('D trace stays OFF unless independently certified',async()=>{
 assert.equal((await createServiceTraceGateway().read('AUTO_RIDE',id)).code,'TRACE_CONTRACT_PENDING');
 assert.equal(createServiceTraceQaOptions({origin:'http://localhost'}),null);
});
test('D five flows use precisely one server serviceId across events and ledger',async()=>{
 for(const kind of TRACE_SERVICE_KINDS){
  const api=configured(async(url,options)=>{
   assert(url.endsWith('/'+kind+'/'+id+'/trace'));
   assert.equal(options.method,'GET');
   assert.match(options.headers.Authorization,/^Bearer /);
   return response(row(kind));
  });
  const out=await api.read(kind,id);
  assert.equal(out.ok,true,kind);
  assert.equal(out.data.serviceId,id);
  assert.equal(out.data.events[0].serviceId,id);
  assert.equal(out.data.ledger?.serviceId??null,kind==='COMMERCE'?null:id);
  assert.equal(out.data.assignment.state,'NOT_ASSIGNABLE');
  assert.equal(out.data.viewerId,undefined);
  assert.equal(out.data.productionEnabled,false);
 }
});
test('D mismatched reservation/history/ledger/viewer never displays as E2E',async()=>{
 for(const tweak of [
  d=>d.events[0].serviceId=uuid(98),
  d=>d.ledger.serviceId=uuid(98),
  d=>d.viewerId=uuid(98),
  d=>d.events[0].status='delivered'
 ]){
  const d=row('DELIVERY_AUTO');tweak(d);
  const got=await configured(async()=>response(d)).read('DELIVERY_AUTO',id);
  assert.equal(got.code,'INVALID_TRACE_RECEIPT');
 }
});
test('D G38/G71 blocks any assigned driver and rejects fraudulent paid ledger',async()=>{
 const d=row('MOTO_RIDE');d.assignment.state='ASSIGNED';
 assert.equal((await configured(async()=>response(d)).read('MOTO_RIDE',id)).ok,false);
 const e=row('COMMERCE');e.ledger={serviceId:id,currency:'PYG',
  grossGs:20000,platformCommissionGs:3000,customerSubsidyGs:0,
  driverPayoutGs:17000,reconciliationStatus:'RECONCILED'};
 assert.equal((await configured(async()=>response(e)).read('COMMERCE',id)).ok,false);
});
test('D rejects role downgrade during HTTP, does not leak private session',async()=>{
 let who=session;
 const got=await configured(async()=>{who={...session,role:'owner'};
  return response(row('AUTO_RIDE'));},async()=>who).read('AUTO_RIDE',id);
 assert.equal(got.code,'STALE_SESSION_RESPONSE');
 assert(!JSON.stringify(got).includes(session.token));
});
test('D 401 revokes matching session; HTTP absent, oversize or missing stay blocked',async()=>{
 let revokes=0;
 assert.equal((await configured(async()=>response({},401),async()=>session,
  ()=>revokes++).read('AUTO_RIDE',id)).code,'ADMIN_AUTH_REQUIRED');
 assert.equal(revokes,1);
 assert.equal((await configured(async()=>response({},404)).read('AUTO_RIDE',id)).code,'SERVICE_NOT_FOUND');
 const large=configured(async()=>({...response(row('AUTO_RIDE')),
  headers:{get:k=>k==='content-type'?'application/json':'1000000'}}));
 assert.equal((await large.read('AUTO_RIDE',id)).code,'RESPONSE_TOO_LARGE');
});
test('D duplicates in flight are rejected, cancellation discards late response',async()=>{
 let resolve;let requests=0;
 const gateway=configured(async()=>{requests++;return await new Promise(r=>resolve=r);});
 const pending=gateway.read('AUTO_RIDE',id);
 await new Promise(r=>setImmediate(r));
 assert.equal((await gateway.read('AUTO_RIDE',id)).code,'TRACE_IN_FLIGHT');
 gateway.cancelPending();
 resolve(response(row('AUTO_RIDE')));
 assert.equal((await pending).code,'STALE_SESSION_RESPONSE');
 assert.equal(requests,1);
});

test('D rejects legacy delivery service aliases at the HTTP contract boundary',async()=>{
 for(const legacy of ['AUTO_DELIVERY','MOTO_DELIVERY']){
  const responseForLegacy=await configured(async()=>{throw Error('Legacy kind must not reach transport');}).read(legacy,id);
  assert.equal(responseForLegacy.code,'INVALID_SERVICE_KIND');
 }
 assert.deepEqual(TRACE_SERVICE_KINDS,[
  'AUTO_RIDE','MOTO_RIDE','DELIVERY_MOTO','DELIVERY_AUTO','COMMERCE'
 ]);
});

test('G146 Commerce requires explicit missing G7 quote and never renders a fabricated paid ledger',async()=>{
 const good=row('COMMERCE');
 assert.equal((await configured(async()=>response(good)).read('COMMERCE',id)).ok,true);
 for(const change of [
  x=>x.quoteId=uuid(66),
  x=>x.status='delivered',
  x=>x.revision=2,
  x=>x.ledger={serviceId:id,currency:'PYG',grossGs:25000,
   platformCommissionGs:1000,customerSubsidyGs:0,driverPayoutGs:24000,
   reconciliationStatus:'PENDING'}
 ]){
  const dto=row('COMMERCE');change(dto);
  const got=await configured(async()=>response(dto)).read('COMMERCE',id);
  assert.equal(got.code,'INVALID_TRACE_RECEIPT');
 }
});

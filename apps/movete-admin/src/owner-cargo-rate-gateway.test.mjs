import test from 'node:test';
import assert from 'node:assert/strict';
import {createOwnerCargoRateGateway} from './owner-cargo-rate-gateway.mjs';
const uuid=n=>'12400000-0000-4124-8124-'+String(n).padStart(12,'0');
const at=Date.parse('2026-10-26T12:00:00Z');
const token='owner-g124-verified-token-abcdefgh';
const owner={subject:uuid(1),role:'owner',mfaVerified:true,
 token,expiresAt:at+300000};
const payload={requestKey:uuid(3),basePyg:3200,perKmPyg:1200,
 perMinutePyg:100,minimumPyg:5500,commissionBps:950,durationDays:30};
const receipt=(kind='AUTO')=>({
 vehicleKind:kind,cargoZone:'ASUNCION',ruleId:uuid(4),
 ruleVersion:'cargo_auto_asuncion_v2',version:2,basePyg:3200,
 perKmPyg:1200,perMinutePyg:100,minimumPyg:5500,commissionBps:950,
 active:true,validUntil:'2026-12-01T15:00:00Z',mode:'STAGING_DEMO_ONLY',
 liveEnabled:false,passengerSubsidyPolicyApplicable:false
});
const ok=(data,status=200)=>({ok:status===200,status,redirected:false,
 headers:{get:k=>k==='content-type'?'application/json':null},
 text:async()=>JSON.stringify(data)});
function fixture(fetchImpl,readSession=async()=>owner){
 return createOwnerCargoRateGateway({enabled:true,contractCertified:true,
  origin:'https://owner-qa.invalid',pinnedOrigin:'https://owner-qa.invalid',
  now:()=>at,getSession:readSession,fetchImpl});
}
test('G124 UI client OFF by default and never accepts malformed cargo target',async()=>{
 assert.equal((await createOwnerCargoRateGateway().read('AUTO','ASUNCION')).ok,false);
 const g=fixture(async()=>ok(receipt()));
 assert.equal((await g.read('AUTO_RIDE','ASUNCION')).code,'INVALID_CARGO_TARGET');
 assert.equal((await g.read('AUTO','bad')).code,'INVALID_CARGO_TARGET');
});
test('G124 reads exact authorized AUTO/MOTO tariffs, without passenger subsidy',async()=>{
 for(const vehicleKind of ['AUTO','MOTO']){
  let calls=0;
  const g=fixture(async(url,options)=>{
   calls++;assert(url.endsWith('/'+vehicleKind+'/ASUNCION'));
   assert.equal(options.method,'GET');
   return ok(receipt(vehicleKind));
  });
  const got=await g.read(vehicleKind,'ASUNCION');
  assert.equal(got.ok,true);assert.equal(got.data.commissionBps,950);
  assert.equal(got.data.passengerSubsidyPolicyApplicable,false);
  assert.equal(calls,1);
 }
});
test('G124 sends exact Owner tariff write with immutable requestKey and no subsidy',async()=>{
 let seen;
 const g=fixture(async(_url,options)=>{seen=options;
  return ok(receipt('MOTO'));});
 const got=await g.change('MOTO','ASUNCION',payload);
 assert.equal(got.ok,true);assert.equal(seen.method,'POST');
 assert.deepEqual(Object.keys(JSON.parse(seen.body)),Object.keys(payload));
 assert.equal(JSON.parse(seen.body).subsidyBps,undefined);
 assert.equal(JSON.parse(seen.body).requestKey,payload.requestKey);
});
test('G124 rejects role downgrade during a pending HTTP response',async()=>{
 let actor=owner;
 const g=fixture(async()=>{actor={...owner,role:'admin'};
  return ok(receipt());},async()=>actor);
 assert.equal((await g.read('AUTO','ASUNCION')).code,'STALE_OWNER_SESSION');
});
test('G124 blocks forged extra fields, invalid percentages, mismatched receipt',async()=>{
 const g=fixture(async()=>ok(receipt()));
 assert.equal((await g.change('AUTO','ASUNCION',{...payload,subsidyBps:0})).code,
  'INVALID_CARGO_DRAFT');
 assert.equal((await g.change('AUTO','ASUNCION',{...payload,commissionBps:4000})).code,
  'INVALID_CARGO_DRAFT');
 const m=fixture(async()=>ok({...receipt(),cargoZone:'CIUDAD'}));
 assert.equal((await m.read('AUTO','ASUNCION')).code,'INVALID_CARGO_RECEIPT');
 const n=fixture(async()=>ok({...receipt(),basePyg:999}));
 assert.equal((await n.change('AUTO','ASUNCION',payload)).code,'CARGO_WRITE_MISMATCH');
});
test('G124 hides Owner rate when server lacks an approved policy',async()=>{
 const g=fixture(async()=>ok({},404));
 assert.equal((await g.read('AUTO','ASUNCION')).code,'CARGO_RATE_NOT_CONFIGURED');
});
test('G124 never allows simultaneous modifications',async()=>{
 let release;
 const g=fixture(async()=>new Promise(r=>{release=r}));
 const p=g.change('AUTO','ASUNCION',payload);
 assert.equal((await g.change('AUTO','ASUNCION',payload)).code,
  'CARGO_REQUEST_IN_FLIGHT');
 await Promise.resolve();release(ok(receipt()));
 assert.equal((await p).ok,true);
});

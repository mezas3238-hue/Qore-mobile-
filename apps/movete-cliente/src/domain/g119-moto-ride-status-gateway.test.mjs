import test from 'node:test';
import assert from 'node:assert/strict';
import {createG119MotoStatusGateway} from './g119-moto-ride-status-gateway.mjs';
const owner='11900000-0000-4119-8119-000000000001';
const booking='11900000-0000-4119-8119-000000000020';
const trip='11900000-0000-4119-8119-000000000025';
const clock=1900000000000,token='g119-passenger-moto-jwt-0123456789';
const value=(state='searching',revision=1)=>({
 mode:'STAGING_DEMO_ONLY',commercialEnabled:false,ownerId:owner,bookingKey:booking,
 tripId:trip,serviceKind:'MOTO_RIDE',tripState:state,tripRevision:revision,
 driverAssigned:!['searching','cancelled'].includes(state),
 driverIdentityExposed:false,gpsVerified:false,etaAvailable:false,
 commissionBps:1800,subsidyBps:1000,amountGs:11000,
 customerPaysGs:9900,customerSubsidyGs:1100,
 financialState:state==='completed'?'COMPLETED_UNSETTLED_QA':
 state==='cancelled'?'VOIDED_QA':'RESERVED_QA',
 pspCollected:false,serverPersisted:true
});
const mk=(server,role='passenger',enabled=true)=>{
 let calls=0;
 const gateway=createG119MotoStatusGateway({
  enabled,contractCertified:true,stagingRuntimeVerified:true,
  origin:'https://g119-ci.invalid',pinnedOrigin:'https://g119-ci.invalid',
  getSession:async()=>({role,subject:owner,token,expiresAt:clock+600000}),
  now:()=>clock,
  fetchImpl:async(url,opts)=>{
   calls++;assert(url.endsWith('/bookings/'+booking+'/status'));
   assert.equal(opts.method,'GET');assert.equal(opts.credentials,'omit');
   return {status:200,ok:true,redirected:false,
    headers:{get:()=> 'application/json'},text:async()=>JSON.stringify(server)};
  }
 });
 return {gateway,calls:()=>calls};
};
test('G119 four persisted MOTO Driver stages and immutable 10 percent subsidy',async()=>{
 for(const [s,n] of [['searching',1],['accepted',2],['arriving',3],
  ['in_progress',4],['completed',5]]){
  const f=mk(value(s,n)),out=await f.gateway.read({
   bookingKey:booking,expectedTripId:trip,minimumRevision:n});
  assert.equal(out.ok,true,JSON.stringify(out));
  assert.equal(out.data.commissionBps,1800);
  assert.equal(out.data.subsidyBps,1000);
  assert.equal(out.data.etaAvailable,false);
 }
});
test('G119 refuses forged identity, ETA, GPS and rollback',async()=>{
 for(const invalid of [
  {...value(),ownerId:trip},{...value(),tripId:owner},
  {...value(),gpsVerified:true},{...value(),etaAvailable:true},
  {...value(),subsidyBps:900},{...value(),commissionBps:900},
  {...value(),driverId:trip}
 ]){
  const f=mk(invalid);
  assert.equal((await f.gateway.read({bookingKey:booking,expectedTripId:trip})).ok,false);
 }
 const f=mk(value());
 assert.equal((await f.gateway.read({bookingKey:booking,
  expectedTripId:trip,minimumRevision:2})).ok,false);
});
test('G119 defaults off and fails closed for nonpassenger',async()=>{
 for(const f of [mk(value(),'passenger',false),mk(value(),'admin',true)]){
  assert.equal((await f.gateway.read({bookingKey:booking,expectedTripId:trip})).ok,false);
  assert.equal(f.calls(),0);
 }
});

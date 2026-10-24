import test from 'node:test';
import assert from 'node:assert/strict';
import {decidePrivateDriverOffer,reconcilePrivateDriverOffer,
 DRIVER_OFFER_DECISIONS_LIVE_ENABLED}
 from './driver-offer-decision.mjs';
const token='a'.repeat(60),origin='http://127.0.0.1:4141';
const offer='11111111-1111-4111-8111-111111111111';
const key='22222222-2222-4222-8222-222222222222';
const event='33333333-3333-4333-8333-333333333333';
const receipt=(kind,action)=>({mode:'STAGING_DEMO_ONLY',
 ...(kind==='AUTO_RIDE'?{commercialRidesEnabled:false}:
 {liveDeliveriesEnabled:false,serverPersisted:true}),
 outcome:action==='accept'?'accepted':'declined',
 ...(action==='accept'?{eventId:event}:{offerId:offer}),
 pushDelivered:false});
function fake(data,status=200){
 const seen={};
 const request=async(url,init)=>{seen.url=url;seen.init=init;
  return {status,json:async()=>data};};
 return {seen,request};
}
test('Driver accepts only auto private offer using server-verified bearer',async()=>{
 assert.equal(DRIVER_OFFER_DECISIONS_LIVE_ENABLED,false);
 const m=fake(receipt('AUTO_RIDE','accept'));
 const result=await decidePrivateDriverOffer({apiOrigin:origin,accessToken:token,
  kind:'AUTO_RIDE',offerId:offer,requestKey:key,action:'accept',request:m.request});
 assert.deepEqual(result,{kind:'AUTO_RIDE',action:'accept',outcome:'accepted',
  receiptId:event,liveEnabled:false,pushDelivered:false});
 assert.equal(m.seen.url,origin+'/v1/staging/driver/offers/accept');
 assert.equal(m.seen.init.method,'POST');
 assert.equal(m.seen.init.cache,'no-store');
 assert.equal(m.seen.init.credentials,'omit');
 assert.equal(m.seen.init.headers.authorization,'Bearer '+token);
 assert.deepEqual(JSON.parse(m.seen.init.body),{offerId:offer,requestKey:key});
 assert.doesNotMatch(m.seen.init.body,/driverId|passengerId|courierId|amount|lat|lng/i);
});
test('Driver courier decline uses separate endpoint and requires server receipt',async()=>{
 const m=fake(receipt('DELIVERY','decline'));
 const result=await decidePrivateDriverOffer({apiOrigin:origin,accessToken:token,
  kind:'DELIVERY',offerId:offer,requestKey:key,action:'decline',request:m.request});
 assert.equal(result.receiptId,offer);
 assert.equal(m.seen.url,origin+'/v1/staging/courier/delivery-offers/decline');
});
test('Driver decisions refuse forbidden categories, keys, tokens and remote origins before network',async()=>{
 let calls=0;const request=async()=>{calls++;throw Error('Never call')};
 const base={apiOrigin:origin,accessToken:token,kind:'AUTO_RIDE',
  offerId:offer,requestKey:key,action:'accept',request};
 for(const mod of [{apiOrigin:'https://api.example.com'},
  {apiOrigin:'http://localhost:4141'},
  {apiOrigin:'http://127.0.0.1:4141/path'},
  {apiOrigin:'http://127.0.0.1:4141/?role=admin'},
  {kind:'ADMIN'},{kind:'MOTO_PASSENGER'},{offerId:'bad'},
  {requestKey:'bad'},{accessToken:'secret'},{action:'capture'}]){
  await assert.rejects(()=>decidePrivateDriverOffer({...base,...mod}));
 }
 assert.equal(calls,0);
});
test('Driver decisions fail closed on expired Auth, duplicate, ambiguous network and forged receipts',async()=>{
 const base={apiOrigin:origin,accessToken:token,kind:'DELIVERY',
  offerId:offer,requestKey:key,action:'accept'};
 await assert.rejects(()=>decidePrivateDriverOffer({...base,request:fake(null,401).request}),/session expired/);
 await assert.rejects(()=>decidePrivateDriverOffer({...base,request:fake(null,403).request}),/role not authorized/);
 await assert.rejects(()=>decidePrivateDriverOffer({...base,request:fake(null,409).request}),/resync required/);
 await assert.rejects(()=>decidePrivateDriverOffer({...base,request:async()=>{throw Error('private')}}),/uncertain/);
 for(const bad of [
  {...receipt('DELIVERY','accept'),serverPersisted:false},
  {...receipt('DELIVERY','accept'),pushDelivered:true},
  {...receipt('DELIVERY','accept'),eventId:'fake'},
  {...receipt('DELIVERY','accept'),outcome:'declined'},
  {...receipt('DELIVERY','accept'),mode:'LIVE'}
 ]){
  await assert.rejects(()=>decidePrivateDriverOffer({...base,request:fake(bad).request}));
 }
});
test('Driver retry retains the SAME caller-generated decision key',async()=>{
 const bodies=[],request=async(url,init)=>{
  bodies.push(JSON.parse(init.body));
  if(bodies.length===1)throw Error('network cut after server save');
  return {status:200,json:async()=>receipt('AUTO_RIDE','accept')};
 };
 const params={apiOrigin:origin,accessToken:token,kind:'AUTO_RIDE',
  offerId:offer,requestKey:key,action:'accept',request};
 await assert.rejects(()=>decidePrivateDriverOffer(params),/uncertain/);
 const out=await decidePrivateDriverOffer(params);
 assert.equal(out.receiptId,event);
 assert.deepEqual(bodies,[{offerId:offer,requestKey:key},{offerId:offer,requestKey:key}]);
});

test('G64 Driver recovery uses separate read-only action with exact original ID and key',async()=>{
 const good={mode:'STAGING_DEMO_ONLY',state:'COMMITTED',
  kind:'AUTO_RIDE',action:'accept',offerId:offer,requestKey:key,
  outcome:'accepted',receiptId:event,serverPersisted:true,
  liveEnabled:false,pushDelivered:false,qaOnly:true,
  productionEnabled:false,retrySafe:false};
 const m=fake(good);
 const result=await reconcilePrivateDriverOffer({
  apiOrigin:origin,accessToken:token,kind:'AUTO_RIDE',
  offerId:offer,requestKey:key,action:'accept',request:m.request
 });
 assert.equal(m.seen.url,origin+'/v1/staging/driver/offers/reconcile');
 assert.equal(m.seen.init.method,'POST');
 assert.deepEqual(JSON.parse(m.seen.init.body),{
  offerId:offer,requestKey:key,action:'accept'});
 assert.deepEqual(result,{kind:'AUTO_RIDE',action:'accept',
  outcome:'accepted',receiptId:event,serverPersisted:true,
  liveEnabled:false,pushDelivered:false});
});
test('G64 unobserved or malformed recovery cannot fabricate a Driver accepted receipt',async()=>{
 const base={apiOrigin:origin,accessToken:token,
  kind:'AUTO_RIDE',offerId:offer,requestKey:key,action:'accept'};
 const good={mode:'STAGING_DEMO_ONLY',state:'COMMITTED',
  kind:'AUTO_RIDE',action:'accept',offerId:offer,requestKey:key,
  outcome:'accepted',receiptId:event,serverPersisted:true,
  liveEnabled:false,pushDelivered:false,qaOnly:true,
  productionEnabled:false,retrySafe:false};
 for(const data of [
  {...good,state:'NOT_YET_OBSERVED'},
  {...good,requestKey:'22222222-2222-4222-8222-222222222223'},
  {...good,kind:'DELIVERY'},
  {...good,action:'decline'},
  {...good,receiptId:'bad'},
  {...good,serverPersisted:false},
  {...good,retrySafe:true},
  {...good,qaOnly:false},
  {...good,passengerPhone:'secret'}
 ]){
  await assert.rejects(()=>reconcilePrivateDriverOffer({
   ...base,request:fake(data).request
  }));
 }
 for(const status of [401,403,409,429,503]){
  await assert.rejects(()=>reconcilePrivateDriverOffer({
   ...base,request:fake({state:'NOT_YET_OBSERVED',retrySafe:false},status).request
  }));
 }
});

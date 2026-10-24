import test from 'node:test';
import assert from 'node:assert/strict';
import {readDriverPrivateInbox,DRIVER_INBOX_LIVE_ENABLED} from './driver-inbox.mjs';
const token='a'.repeat(60),at=Date.parse('2026-10-22T12:00:00Z');
const offer='11111111-1111-4111-8111-111111111111';
const trip='22222222-2222-4222-8222-222222222222';
const deliveryOffer='33333333-3333-4333-8333-333333333333';
const delivery='44444444-4444-4444-8444-444444444444';
const apiOrigin='http://127.0.0.1:4141';
const snapshot={mode:'STAGING_DEMO_ONLY',liveTripsEnabled:false,liveDeliveriesEnabled:false,
 pushDelivered:false,deviceReceived:false,suggestedPollIntervalMs:5000,
 offers:[
  {kind:'AUTO_RIDE',offerId:offer,serviceId:trip,expiresAtMs:at+25000},
  {kind:'DELIVERY',offerId:deliveryOffer,serviceId:delivery,expiresAtMs:at+30000}
 ]};
function mock(data=snapshot,status=200){
 const seen={};
 return {seen,request:async(url,init)=>{seen.url=url;seen.init=init;
  return {status,json:async()=>data};}};
}
const run=(input={})=>readDriverPrivateInbox({
 apiOrigin,accessToken:token,now:()=>at,...input
});
test('Driver private inbox keeps LIVE off and reads ONLY local QA with bearer',async()=>{
 assert.equal(DRIVER_INBOX_LIVE_ENABLED,false);
 const m=mock();
 const out=await run({request:m.request});
 assert.deepEqual(out,snapshot.offers);
 assert.equal(Object.isFrozen(out),true);
 assert.equal(Object.isFrozen(out[0]),true);
 assert.equal(m.seen.url,apiOrigin+'/v1/staging/driver/inbox');
 assert.equal(m.seen.init.method,'GET');
 assert.equal(m.seen.init.cache,'no-store');
 assert.equal(m.seen.init.credentials,'omit');
 assert.equal(m.seen.init.headers.authorization,'Bearer '+token);
});
test('Driver never contacts remote API or sends when configuration/credentials invalid',async()=>{
 let calls=0;
 const request=async()=>{calls++;throw Error('Must never fetch')};
 for(const origin of ['https://real.api.example','http://localhost:4141',
  'http://0.0.0.0:4141','http://127.0.0.1:4141/api',
  'http://127.0.0.1:4141/?driverId=123',
  'http://a:b@127.0.0.1:4141','http://127.0.0.1']){
  await assert.rejects(()=>run({apiOrigin:origin,request}));
 }
 await assert.rejects(()=>run({accessToken:'',request}));
 await assert.rejects(()=>run({accessToken:'wrong',request}));
 assert.equal(calls,0);
});
test('Driver refuses unknown, expired, duplicate, live and PII-bearing offers',async()=>{
 for(const data of [
  {...snapshot,liveTripsEnabled:true},
  {...snapshot,pushDelivered:true},
  {...snapshot,deviceReceived:true},
  {...snapshot,offers:[snapshot.offers[0],snapshot.offers[0]]},
  {...snapshot,offers:[{...snapshot.offers[0],expiresAtMs:at+3000}]},
  {...snapshot,offers:[{...snapshot.offers[0],expiresAtMs:at+50000}]},
  {...snapshot,offers:[{...snapshot.offers[0],passengerName:'private'}]},
  {...snapshot,offers:[{...snapshot.offers[0],kind:'ADMIN'}]},
  {...snapshot,offers:[{...snapshot.offers[0],offerId:'forged'}]},
  {...snapshot,offers:Array(11).fill(snapshot.offers[0])}
 ]){
  await assert.rejects(()=>run({request:mock(data).request}));
 }
});
test('Driver reports unauthorized, offline and malformed responses without retaining stale offers',async()=>{
 await assert.rejects(()=>run({request:mock(snapshot,401).request}),/session expired/);
 await assert.rejects(()=>run({request:mock(snapshot,403).request}),/role not authorized/);
 await assert.rejects(()=>run({request:mock(snapshot,503).request}),/unavailable/);
 await assert.rejects(()=>run({request:async()=>{throw Error('token-leaking private error')}}),/unavailable/);
 await assert.rejects(()=>run({request:mock({}).request}),/invalid response/);
 assert.deepEqual(await run({request:mock({...snapshot,offers:[]}).request}),[]);
});

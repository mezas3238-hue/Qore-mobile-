import test from 'node:test';
import assert from 'node:assert/strict';
import {createDriverPrivateInboxRepository,G16_DRIVER_INBOX_LIVE_ENABLED as DB_LIVE}
 from './g16-driver-private-inbox-repository.mjs';
import {createDriverPrivateInboxGateway,G16_DRIVER_INBOX_LIVE_ENABLED as API_LIVE}
 from './g16-driver-private-inbox-gateway.mjs';
const driver='11111111-1111-4111-8111-111111111111';
const outsider='22222222-2222-4222-8222-222222222222';
const autoOffer='33333333-3333-4333-8333-333333333333';
const trip='44444444-4444-4444-8444-444444444444';
const deliveryOffer='55555555-5555-4555-8555-555555555555';
const delivery='66666666-6666-4666-8666-666666666666';
const now=Date.parse('2026-10-22T12:00:00Z');
const token='a'.repeat(60);
const auth={id:driver,is_anonymous:false,email_confirmed_at:'2026-10-21T12:00:00Z'};
const a={offer_id:autoOffer,trip_id:trip,expires_at:'2026-10-22T12:00:25Z'};
const d={offer_id:deliveryOffer,delivery_id:delivery,expires_at:'2026-10-22T12:00:35Z'};
const path='/v1/staging/driver/inbox';
const request={method:'GET',path,headers:{authorization:'Bearer '+token}};
function repository({auto=[a],deliveries=[d]}={}){
 const calls=[];
 const repo=createDriverPrivateInboxRepository({rpc:async(name,args)=>{
  calls.push({name,args});
  return {data:name==='mobility_stage_poll_driver_auto_offers'?auto:deliveries,error:null};
 }});
 return {repo,calls};
}
function gateway(overrides={}){
 const calls=[];
 const handler=createDriverPrivateInboxGateway({
  projectRef:'staging1234567890abcd',
  now:()=>now,verifyAccessToken:async incoming=>{
   calls.push(['auth',incoming]);return auth;
  },
  authorizeDriver:async id=>{calls.push(['role',id]);return true;},
  allowRequest:input=>{calls.push(['rate',input]);return true;},
  listForDriver:async input=>{
   calls.push(['inbox',input]);
   return {ok:true,liveEnabled:false,offers:[
    {kind:'AUTO_RIDE',offerId:autoOffer,serviceId:trip,expiresAtMs:now+25000},
    {kind:'DELIVERY',offerId:deliveryOffer,serviceId:delivery,expiresAtMs:now+35000}
   ]};
  },...overrides
 });
 return {handler,calls};
}
test('G16 private repo separates AUTO and DELIVERY and never runs LIVE',async()=>{
 assert.equal(DB_LIVE,false);assert.equal(API_LIVE,false);
 const {repo,calls}=repository();
 const out=await repo.listForDriver({driverId:driver});
 assert.equal(out.liveEnabled,false);
 assert.deepEqual(out.offers,[
  {kind:'AUTO_RIDE',offerId:autoOffer,serviceId:trip,expiresAtMs:now+25000},
  {kind:'DELIVERY',offerId:deliveryOffer,serviceId:delivery,expiresAtMs:now+35000}
 ]);
 assert.deepEqual(calls,[
  {name:'mobility_stage_poll_driver_auto_offers',args:{_driver_id:driver}},
  {name:'mobility_stage_poll_courier_delivery_offers',args:{_courier_id:driver}}
 ]);
 assert.equal(Object.isFrozen(out.offers),true);
});
test('G16 rejects malformed SQL results and unexpected private data',async()=>{
 for(const bad of [[a,a],[{...a,trip_id:'invalid'}],
  [{...a,expires_at:'not-an-iso'}],Array(6).fill(a),null]){
  const {repo}=repository({auto:bad});
  await assert.rejects(()=>repo.listForDriver({driverId:driver}));
 }
 const {repo}=repository();
 await assert.rejects(()=>repo.listForDriver({driverId:'invalid'}));
 const broken=createDriverPrivateInboxRepository({rpc:async()=>({error:{message:'private'},data:[]})});
 await assert.rejects(()=>broken.listForDriver({driverId:driver}));
});
test('G16 gateway authenticates first and never accepts caller-provided driver ID',async()=>{
 const {handler,calls}=gateway();
 const out=await handler(request);
 assert.equal(out.status,200);
 assert.equal(out.body.offers.length,2);
 assert.equal(out.body.deviceReceived,false);
 assert.equal(out.body.pushDelivered,false);
 assert.equal(out.body.liveTripsEnabled,false);
 assert.equal(out.body.liveDeliveriesEnabled,false);
 assert.deepEqual(calls.at(-1),['inbox',{driverId:driver}]);
 assert.doesNotMatch(JSON.stringify(out),/passengerId|driverId|senderId|gps|lat|lng|providerTicket/i);
 assert.equal((await handler({...request,body:{driverId:outsider}})).status,400);
 assert.equal((await handler({...request,path:path+'?driverId='+outsider})).status,404);
 assert.equal(calls.filter(x=>x[0]==='inbox').length,1);
});
test('G16 invalid token, anonymous, missing role and rate limit fail closed',async()=>{
 assert.equal((await gateway({verifyAccessToken:async()=>{throw Error('secret')}}).handler(request)).status,401);
 assert.equal((await gateway({verifyAccessToken:async()=>({...auth,is_anonymous:true})}).handler(request)).status,401);
 assert.equal((await gateway({authorizeDriver:async()=>false}).handler(request)).status,403);
 assert.equal((await gateway({authorizeDriver:async()=>{throw Error('db')}}).handler(request)).status,503);
 assert.equal((await gateway({allowRequest:()=>false}).handler(request)).status,429);
 assert.equal((await gateway().handler({...request,headers:{}})).status,401);
 assert.equal((await gateway().handler({...request,method:'POST'})).status,404);
});
test('G16 expiry, duplicate, forged LIVE, and RPC outage return no driver data',async()=>{
 const baseline={kind:'AUTO_RIDE',offerId:autoOffer,serviceId:trip,expiresAtMs:now+25000};
 for(const value of [
  {ok:true,liveEnabled:true,offers:[baseline]},
  {ok:true,liveEnabled:false,offers:[baseline,baseline]},
  {ok:true,liveEnabled:false,offers:[{...baseline,expiresAtMs:now+3000}]},
  {ok:true,liveEnabled:false,offers:[{...baseline,expiresAtMs:now+50000}]},
  {ok:true,liveEnabled:false,offers:[{...baseline,kind:'ADMIN'}]},
  {ok:true,liveEnabled:false,offers:[{...baseline,offerId:'fake'}]},
  {ok:true,liveEnabled:false,offers:Array(11).fill(baseline)}
 ]){
  assert.equal((await gateway({listForDriver:async()=>value}).handler(request)).status,503);
 }
 assert.equal((await gateway({listForDriver:async()=>{throw Error('private')}}).handler(request)).status,503);
});
test('G16 zero private offers is not an invented acceptance',async()=>{
 const result=await gateway({listForDriver:async()=>({ok:true,liveEnabled:false,offers:[]})}).handler(request);
 assert.equal(result.status,200);
 assert.deepEqual(result.body.offers,[]);
 assert.equal(result.body.deviceReceived,false);
});

test('G134 guarded G16 inbox denies revoked or expired Driver sessions before private SQL',async()=>{
 let reads=0;
 let revoked=false;
 const authWithSession={...auth,sessionId:'77777777-7777-4777-8777-777777777777',expiresAtMs:now+60000};
 const guarded=gateway({
  requireFreshSession:true,
  verifyAccessToken:async()=>authWithSession,
  verifySessionNotRevoked:async({userId,sessionId,at})=>{
   assert.equal(userId,driver);
   assert.equal(sessionId,authWithSession.sessionId);
   assert.equal(at,now);
   return !revoked;
  },
  listForDriver:async()=>{reads++;return {ok:true,liveEnabled:false,offers:[]};}
 }).handler;
 assert.equal((await guarded(request)).status,200);
 assert.equal(reads,1);
 revoked=true;
 assert.equal((await guarded(request)).status,401);
 assert.equal(reads,1,'revocation cannot leak private offers');
 assert.equal((await gateway({
  requireFreshSession:true,
  verifyAccessToken:async()=>({...authWithSession,expiresAtMs:now}),
  verifySessionNotRevoked:async()=>true
 }).handler(request)).status,401);
 assert.equal((await gateway({
  requireFreshSession:true,
  verifyAccessToken:async()=>authWithSession,
  verifySessionNotRevoked:async()=>{throw Error('provider outage')}
 }).handler(request)).status,503);
 assert.throws(()=>gateway({
  requireFreshSession:true,verifySessionNotRevoked:null
 }));
});

test('G181 revocation, expiry and provider outage DURING original SQL inbox hide all offer IDs',async()=>{
 const sessionId='77777777-7777-4777-8777-777777777777';
 const actor={...auth,sessionId,expiresAtMs:now+60000};
 let checks=0,reads=0;
 const revoked=gateway({
  requireFreshSession:true,
  verifyAccessToken:async()=>actor,
  verifySessionNotRevoked:async()=>++checks===1,
  listForDriver:async()=>{reads++;return {ok:true,liveEnabled:false,offers:[
   {kind:'AUTO_RIDE',offerId:autoOffer,serviceId:trip,expiresAtMs:now+25000}
  ]};}
 });
 const denied=await revoked.handler(request);
 assert.equal(denied.status,401);
 assert.equal(reads,1);assert.equal(checks,2);
 assert.doesNotMatch(JSON.stringify(denied),new RegExp(autoOffer+'|'+trip));

 checks=0;
 const offline=gateway({
  requireFreshSession:true,
  verifyAccessToken:async()=>actor,
  verifySessionNotRevoked:async()=>{if(++checks===2)throw Error('secret provider');return true;}
 });
 const unavailable=await offline.handler(request);
 assert.equal(unavailable.status,503);
 assert.doesNotMatch(JSON.stringify(unavailable),/secret provider|offerId|tripId/);
 assert.equal(checks,2);

 let ticks=0;
 const expired=gateway({
  requireFreshSession:true,
  verifyAccessToken:async()=>({...actor,expiresAtMs:now+1}),
  verifySessionNotRevoked:async()=>true,
  now:()=>now+ticks++*2
 });
 const result=await expired.handler(request);
 assert.equal(result.status,401);
 assert.doesNotMatch(JSON.stringify(result),new RegExp(autoOffer));
});

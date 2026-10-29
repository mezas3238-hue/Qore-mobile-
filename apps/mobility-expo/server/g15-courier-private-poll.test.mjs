import test from 'node:test';
import assert from 'node:assert/strict';
import {createCourierPrivatePollRepository,G15_COURIER_POLL_LIVE_ENABLED as DB_LIVE}
 from './g15-courier-private-poll-repository.mjs';
import {createCourierPrivatePollGateway,G15_COURIER_POLL_LIVE_ENABLED as API_LIVE}
 from './g15-courier-private-poll-gateway.mjs';

const courier='11111111-1111-4111-8111-111111111111';
const delivery='22222222-2222-4222-8222-222222222222';
const offer='33333333-3333-4333-8333-333333333333';
const token='a'.repeat(60);
const now=Date.parse('2026-10-22T12:00:00Z');
const expiry='2026-10-22T12:00:30Z';
const user={id:courier,is_anonymous:false,email_confirmed_at:'2026-10-20T00:00:00Z'};
const endpoint='/v1/staging/courier/delivery-offers';
const request={method:'GET',path:endpoint,headers:{authorization:'Bearer '+token}};
const rows=[{offer_id:offer,delivery_id:delivery,expires_at:expiry}];
test('G15 poll adapter normalizes private data and never enables live',async()=>{
 assert.equal(DB_LIVE,false);assert.equal(API_LIVE,false);
 let call;
 const repo=createCourierPrivatePollRepository({rpc:async(name,args)=>{
  call={name,args};return {data:rows,error:null};
 }});
 const result=await repo.listForCourier({courierId:courier});
 assert.deepEqual(call,{name:'mobility_stage_poll_courier_delivery_offers',
  args:{_courier_id:courier}});
 assert.deepEqual(result,{ok:true,liveEnabled:false,
  offers:[{offerId:offer,deliveryId:delivery,expiresAtMs:now+30000}]});
});
test('G15 rejects malformed, duplicate and excessive RPC snapshots',async()=>{
 for(const data of [[rows[0],rows[0]],[{...rows[0],offer_id:'wrong'}],
  [{...rows[0],expires_at:'bad'}],Array(6).fill(rows[0]),null]){
  const repo=createCourierPrivatePollRepository({rpc:async()=>({data,error:null})});
  await assert.rejects(()=>repo.listForCourier({courierId:courier}));
 }
 const repo=createCourierPrivatePollRepository({rpc:async()=>({data:[],error:null})});
 await assert.rejects(()=>repo.listForCourier({courierId:'spoof'}));
 assert.throws(()=>createCourierPrivatePollRepository({}),/Trusted G15/);
});
function gateway(overrides={}){
 const calls=[];
 const fn=createCourierPrivatePollGateway({
  projectRef:'staging1234567890abcd',now:()=>now,
  verifyAccessToken:async value=>{calls.push(['auth',value]);return user;},
  authorizeCourier:async id=>{calls.push(['role',id]);return true;},
  allowRequest:details=>{calls.push(['rate',details]);return true;},
  listForCourier:async query=>{calls.push(['list',query]);return {
   ok:true,liveEnabled:false,offers:[{offerId:offer,deliveryId:delivery,expiresAtMs:now+30000}]
  };},
  ...overrides
 });
 return {fn,calls};
}
test('G15 authenticated courier can discover offers even if push never arrived',async()=>{
 const {fn,calls}=gateway();
 const response=await fn(request);
 assert.equal(response.status,200);
 assert.equal(response.body.offers[0].offerId,offer);
 assert.equal(response.body.deviceReceived,false);
 assert.equal(response.body.pushDelivered,false);
 assert.equal(response.body.suggestedPollIntervalMs,5000);
 assert.deepEqual(calls.at(-1),['list',{courierId:courier}]);
 assert.doesNotMatch(JSON.stringify(response.body),/sender|phone|lat|lng|claimNonce|providerTicket/i);
});
test('G15 cannot select another courier or pass actor in request body',async()=>{
 const {fn,calls}=gateway();
 assert.equal((await fn({...request,body:{courierId:delivery}})).status,400);
 assert.equal((await fn({...request,path:endpoint+'?courierId='+delivery})).status,404);
 assert.equal((await fn({...request,method:'POST'})).status,404);
 assert.equal((await fn({...request,headers:{}})).status,401);
 assert.equal(calls.filter(x=>x[0]==='list').length,0);
});
test('G15 invalid authentication, roles, limits, expiry or private RPC fail closed',async()=>{
 assert.equal((await gateway({verifyAccessToken:async()=>{throw Error('secret');}})
  .fn(request)).status,401);
 assert.equal((await gateway({verifyAccessToken:async()=>({...user,is_anonymous:true})})
  .fn(request)).status,401);
 assert.equal((await gateway({authorizeCourier:async()=>false})
  .fn(request)).status,403);
 assert.equal((await gateway({allowRequest:()=>false}).fn(request)).status,429);
 assert.equal((await gateway({listForCourier:async()=>{throw Error('secret')}})
  .fn(request)).status,503);
 for(const result of [
  {ok:true,liveEnabled:true,offers:[]},
  {ok:true,liveEnabled:false,offers:[{offerId:offer,deliveryId:delivery,expiresAtMs:now-1}]},
  {ok:true,liveEnabled:false,offers:[{offerId:offer,deliveryId:delivery,expiresAtMs:now+60000}]},
  {ok:true,liveEnabled:false,offers:Array(6).fill({offerId:offer,deliveryId:delivery,expiresAtMs:now+30000})},
  {ok:true,liveEnabled:false,offers:[{offerId:'spoof',deliveryId:delivery,expiresAtMs:now+30000}]}
 ]){
  assert.equal((await gateway({listForCourier:async()=>result}).fn(request)).status,503);
 }
});
test('G15 empty queue is valid and never invents a push receipt',async()=>{
 const {fn}=gateway({listForCourier:async()=>({ok:true,liveEnabled:false,offers:[]})});
 const result=await fn(request);
 assert.equal(result.status,200);assert.deepEqual(result.body.offers,[]);
 assert.equal(result.body.deviceReceived,false);
});


test('G183 revocation during original courier SQL poll never exposes private offer identifiers',async()=>{
 const actor={...user,sessionId:'77777777-7777-4777-8777-777777777777',
  expiresAtMs:now+60000};
 let checks=0,reads=0;
 const {fn}=gateway({
  requireFreshSession:true,verifyAccessToken:async()=>actor,
  verifySessionNotRevoked:async()=>++checks===1,
  listForCourier:async()=>{reads++;return {ok:true,liveEnabled:false,
   offers:[{offerId:offer,deliveryId:delivery,expiresAtMs:now+30000}]}}
 });
 const denied=await fn(request);
 assert.equal(denied.status,401);assert.equal(checks,2);assert.equal(reads,1);
 assert.doesNotMatch(JSON.stringify(denied),new RegExp(offer+'|'+delivery));
});

test('G183 revoked, expired and unavailable courier authority fail before private polling',async()=>{
 const actor={...user,sessionId:'77777777-7777-4777-8777-777777777777',
  expiresAtMs:now+60000};
 let reads=0;
 const init={requireFreshSession:true,verifyAccessToken:async()=>actor,
  listForCourier:async()=>{reads++;return {ok:true,liveEnabled:false,offers:[]}}};
 assert.equal((await gateway({...init,verifySessionNotRevoked:async()=>false}).fn(request)).status,401);
 assert.equal((await gateway({...init,verifySessionNotRevoked:async()=>{throw Error('IdP offline')}}).fn(request)).status,503);
 assert.equal((await gateway({...init,verifyAccessToken:async()=>({...actor,expiresAtMs:now}),
  verifySessionNotRevoked:async()=>true}).fn(request)).status,401);
 assert.equal(reads,0);
 assert.throws(()=>gateway({...init,verifySessionNotRevoked:undefined}));
});

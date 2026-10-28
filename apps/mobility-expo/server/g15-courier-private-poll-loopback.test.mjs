import test from 'node:test';
import assert from 'node:assert/strict';
import {createQoreRadarLoopbackTransport,listenQoreRadarLoopback}
 from './g4-loopback-http-transport.mjs';
import {createCourierPrivatePollGateway}
 from './g15-courier-private-poll-gateway.mjs';
const courier='11111111-1111-4111-8111-111111111111';
const outsider='22222222-2222-4222-8222-222222222222';
const delivery='33333333-3333-4333-8333-333333333333';
const offer='44444444-4444-4444-8444-444444444444';
const token='a'.repeat(60),other='b'.repeat(60);
const now=Date.parse('2026-10-22T12:00:00Z');
const path='/v1/staging/courier/delivery-offers';
const inactive=async()=>({status:404,body:{error:'Not found'}});
function fixture(){
 const calls=[];
 const courierPoll=createCourierPrivatePollGateway({
  projectRef:'staging1234567890abcd',now:()=>now,
  verifyAccessToken:async value=>{
   if(value!==token)throw Error('Invalid session');
   return {id:courier,is_anonymous:false,email_confirmed_at:'2026-10-22T00:00:00Z'};
  },
  authorizeCourier:async id=>id===courier,
  allowRequest:()=>true,
  listForCourier:async x=>{
   calls.push(x);return {ok:true,liveEnabled:false,
    offers:[{offerId:offer,deliveryId:delivery,expiresAtMs:now+25000}]};
  }
 });
 const opts={riderHandler:inactive,offerHandler:inactive,tripCommandHandler:inactive,
  deliveryHandler:inactive,merchantHandler:inactive,financeHandler:inactive,
  safetyHandler:inactive,merchantManagementHandler:inactive,deliveryOfferHandler:inactive,
  courierPollHandler:courierPoll};
 return {server:createQoreRadarLoopbackTransport(opts),calls,opts};
}
const close=server=>new Promise((resolve,reject)=>
 server.close(err=>err?reject(err):resolve()));
test('G15 real localhost HTTP exposes only JWT-scoped active courier offers',async t=>{
 const {server,calls}=fixture(),base=await listenQoreRadarLoopback(server);
 t.after(()=>close(server));
 assert.equal(server.address().address,'127.0.0.1');
 const response=await fetch(base+path,{headers:{authorization:'Bearer '+token}});
 assert.equal(response.status,200);
 const body=await response.json();
 assert.deepEqual(body.offers,[{offerId:offer,deliveryId:delivery,expiresAtMs:now+25000}]);
 assert.equal(body.pushDelivered,false);assert.equal(body.deviceReceived,false);
 assert.deepEqual(calls,[{courierId:courier}]);
 assert.equal(response.headers.get('cache-control'),'private, no-store, max-age=0');
 assert.equal(response.headers.get('access-control-allow-origin'),null);
 assert.doesNotMatch(JSON.stringify(body),/phone|name|senderId|claimNonce/i);
 for(const unauthorized of [
  {authorization:'Bearer '+other},
  {authorization:'Bearer '+token,origin:'https://evil.example'},
  {authorization:'Bearer '+token,cookie:'token=spoof'}]){
  const blocked=await fetch(base+path,{headers:unauthorized});
  assert.ok([401,403].includes(blocked.status),blocked.status);
 }
 assert.equal((await fetch(base+path+'?courierId='+outsider,{
  headers:{authorization:'Bearer '+token}})).status,404);
});
test('G15 HTTP refuses access when polling adapter is not configured',async t=>{
 const {opts}=fixture();
 const {courierPollHandler:unused,...legacy}=opts;
 const server=createQoreRadarLoopbackTransport(legacy);
 const base=await listenQoreRadarLoopback(server);t.after(()=>close(server));
 const response=await fetch(base+path,{headers:{authorization:'Bearer '+token}});
 assert.equal(response.status,503);
 assert.equal((await response.json()).error,'Private courier polling not configured');
});

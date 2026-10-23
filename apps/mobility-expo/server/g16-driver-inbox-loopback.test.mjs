import test from 'node:test';
import assert from 'node:assert/strict';
import {createQoreRadarLoopbackTransport,listenQoreRadarLoopback}
 from './g4-loopback-http-transport.mjs';
import {createDriverPrivateInboxGateway} from './g16-driver-private-inbox-gateway.mjs';
const driver='11111111-1111-4111-8111-111111111111';
const trip='22222222-2222-4222-8222-222222222222';
const offer='33333333-3333-4333-8333-333333333333';
const token='a'.repeat(60);
const now=Date.parse('2026-10-22T12:00:00Z');
const inactive=async()=>({status:404,body:{error:'Not found'}});
const path='/v1/staging/driver/inbox';
const close=server=>new Promise((resolve,reject)=>
 server.close(err=>err?reject(err):resolve()));
function fixture(){
 const calls=[];
 const driverInboxHandler=createDriverPrivateInboxGateway({
  projectRef:'staging1234567890abcd',now:()=>now,
  verifyAccessToken:async t=>{
   if(t!==token)throw Error('Invalid JWT');
   return {id:driver,is_anonymous:false,email_confirmed_at:'2026-10-20T00:00:00Z'};
  },
  authorizeDriver:async id=>id===driver,allowRequest:()=>true,
  listForDriver:async query=>{calls.push(query);return {ok:true,liveEnabled:false,offers:[
   {kind:'AUTO_RIDE',offerId:offer,serviceId:trip,expiresAtMs:now+25000}
  ]};}
 });
 const opts={riderHandler:inactive,offerHandler:inactive,tripCommandHandler:inactive,
  deliveryHandler:inactive,merchantHandler:inactive,financeHandler:inactive,
  safetyHandler:inactive,merchantManagementHandler:inactive,deliveryOfferHandler:inactive,
  courierPollHandler:inactive,driverInboxHandler};
 return {opts,calls};
}
test('G16 HTTP real localhost: only confirmed Driver can discover own AUTO offers',async t=>{
 const {opts,calls}=fixture();
 const server=createQoreRadarLoopbackTransport(opts);
 const base=await listenQoreRadarLoopback(server);t.after(()=>close(server));
 assert.equal(server.address().address,'127.0.0.1');
 const response=await fetch(base+path,{headers:{authorization:'Bearer '+token}});
 assert.equal(response.status,200);
 const body=await response.json();
 assert.deepEqual(body.offers,[{kind:'AUTO_RIDE',offerId:offer,serviceId:trip,expiresAtMs:now+25000}]);
 assert.equal(body.deviceReceived,false);assert.equal(body.pushDelivered,false);
 assert.equal(body.liveTripsEnabled,false);assert.equal(body.liveDeliveriesEnabled,false);
 assert.deepEqual(calls,[{driverId:driver}]);
 assert.equal(response.headers.get('cache-control'),'private, no-store, max-age=0');
 assert.equal(response.headers.get('access-control-allow-origin'),null);
 assert.doesNotMatch(JSON.stringify(body),/passengerId|senderPhone|driverId|token|gps|latitude/i);
 for(const [headers,expected] of [
  [{authorization:'Bearer '+('b'.repeat(60))},401],
  [{authorization:'Bearer '+token,origin:'https://evil.example'},403],
  [{authorization:'Bearer '+token,cookie:'session=evil'},403]
 ]){
  const out=await fetch(base+path,{headers});assert.equal(out.status,expected);
 }
 assert.equal((await fetch(base+path+'?driverId=33333333-3333-4333-8333-333333333333',{
  headers:{authorization:'Bearer '+token}})).status,404);
 const post=await fetch(base+path,{method:'POST',headers:{authorization:'Bearer '+token,
  'content-type':'application/json'},body:JSON.stringify({driverId:driver})});
 assert.equal(post.status,404);
});
test('G16 HTTP fails closed when gateway is not wired',async t=>{
 const {opts}=fixture();
 const {driverInboxHandler:ignored,...rest}=opts;
 const server=createQoreRadarLoopbackTransport(rest);
 const base=await listenQoreRadarLoopback(server);t.after(()=>close(server));
 const response=await fetch(base+path,{headers:{authorization:'Bearer '+token}});
 assert.equal(response.status,503);
 assert.deepEqual(await response.json(),{error:'Driver inbox not configured'});
});

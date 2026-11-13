/** G336: do not resurrect legacy direct courier assignment while G10 exists.
 * QA-only loopback with injected Auth/DB adapters; no real PSP or Driver.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createQoreRadarLoopbackTransport,listenQoreRadarLoopback}
 from './g4-loopback-http-transport.mjs';
import {createQoreDeliveryOfferGateway} from './g10-delivery-offer-gateway.mjs';

const courier='11111111-1111-4111-8111-111111111111';
const delivery='22222222-2222-4222-8222-222222222222';
const offer='33333333-3333-4333-8333-333333333333';
const key='44444444-4444-4444-8444-444444444444';
const event='55555555-5555-4555-8555-555555555555';
const session='66666666-6666-4666-8666-666666666666';
const token='c'.repeat(60);
const now=Date.parse('2026-11-13T12:00:00Z');
const noRoute=async()=>({status:404,body:{error:'Not found'}});
const legacy='/v1/staging/courier/deliveries/'+delivery+'/accept';
const privateOffer='/v1/staging/courier/delivery-offers/accept';
const close=s=>new Promise((resolve,reject)=>s.close(e=>e?reject(e):resolve()));
const post=async(base,path,body,withToken=true)=>{
 const r=await fetch(base+path,{method:'POST',headers:{
  'content-type':'application/json',...(withToken?{authorization:'Bearer '+token}:{})
 },body:JSON.stringify(body)});
 return {status:r.status,body:await r.json()};
};
test('G336 active runtime adapter refuses retired direct delivery accept',()=>{
 const text=readFileSync(new URL('./g4-staging-runtime.mjs',import.meta.url),'utf8');
 assert.match(text,/acceptDelivery:async\(\)=>\{/);
 assert.doesNotMatch(text,/acceptDelivery:params=>deliveryPersistence\.accept/);
 assert.match(text,/G336 direct delivery assignment prohibited/);
});
test('G336 genuine HTTP has no legacy direct G5 accept; only G10 authenticated offer',async t=>{
 let writes=0,legacyCalls=0,revoked=false;
 const offerGateway=createQoreDeliveryOfferGateway({
  projectRef:'staging1234567890abcd',now:()=>now,
  verifyAccessToken:async input=>{
   if(input!==token)throw Error('invalid');
   return {id:courier,sessionId:session,expiresAtMs:now+60000,
    is_anonymous:false,email_confirmed_at:'2026-11-13T00:00:00Z'};
  },
  verifySessionNotRevoked:async()=>!revoked,requireFreshSession:true,
  authorizeCourier:async id=>id===courier,allowRequest:()=>true,
  loadOffer:async()=>null,
  acceptOffer:async ({actorId,offerId,decisionKey})=>{
   assert.deepEqual({actorId,offerId,decisionKey},
    {actorId:courier,offerId:offer,decisionKey:key});
   writes++;
   return {ok:true,liveEnabled:false,eventId:event};
  },
  declineOffer:async()=>{throw Error('not needed')}
 });
 const server=createQoreRadarLoopbackTransport({
  riderHandler:noRoute,offerHandler:noRoute,tripCommandHandler:noRoute,
  deliveryHandler:async()=>{legacyCalls++;return {status:200,body:{bad:true}}},
  merchantHandler:noRoute,financeHandler:noRoute,safetyHandler:noRoute,
  merchantManagementHandler:noRoute,deliveryOfferHandler:offerGateway,
 });
 const base=await listenQoreRadarLoopback(server);
 t.after(()=>close(server));
 const decision={offerId:offer,requestKey:key};
 assert.equal((await post(base,legacy,{vehicleId:offer,requestKey:key})).status,404);
 assert.equal(writes,0);
 assert.equal(legacyCalls,0);
 assert.equal((await post(base,privateOffer,decision,false)).status,401);
 assert.equal(writes,0);
 revoked=true;
 assert.equal((await post(base,privateOffer,decision)).status,401);
 assert.equal(writes,0);
 revoked=false;
 const accepted=await post(base,privateOffer,decision);
 assert.equal(accepted.status,200);
 assert.equal(accepted.body.eventId,event);
 assert.equal(accepted.body.outcome,'accepted');
 assert.equal(writes,1);
 assert.equal(legacyCalls,0);
});

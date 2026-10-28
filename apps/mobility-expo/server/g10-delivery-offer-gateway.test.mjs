import test from 'node:test';
import assert from 'node:assert/strict';
import {createQoreDeliveryOfferGateway} from './g10-delivery-offer-gateway.mjs';
const ref='staging1234567890abcd';
const courier='11111111-1111-4111-8111-111111111111';
const offer='22222222-2222-4222-8222-222222222222';
const delivery='33333333-3333-4333-8333-333333333333';
const vehicle='44444444-4444-4444-8444-444444444444';
const key='55555555-5555-4555-8555-555555555555';
const event='66666666-6666-4666-8666-666666666666';
const token='a'.repeat(60),now=Date.parse('2026-10-22T12:00:00Z');
const confirmed={id:courier,is_anonymous:false,email_confirmed_at:'2026-10-22T00:00:00Z'};
const record={offerId:offer,deliveryId:delivery,courierId:courier,vehicleId:vehicle,
 status:'offered',expiresAt:'2026-10-22T12:00:30Z',vehicleKind:'MOTO',category:'PARCEL',
 grams:1000,lengthCm:20,widthCm:15,heightCm:10,pickupTag:'SHOP_A',deliveryTag:'CLIENT_A'};
function fixture(overrides={}){
 const seen={};
 const gateway=createQoreDeliveryOfferGateway({projectRef:ref,now:()=>now,
  verifyAccessToken:async value=>{seen.token=value;return confirmed},
  authorizeCourier:async id=>{seen.actor=id;return true},allowRequest:()=>true,
  loadOffer:async input=>{seen.load=input;return {ok:true,liveEnabled:false,offer:record}},
  acceptOffer:async input=>{seen.accept=input;return {ok:true,liveEnabled:false,eventId:event}},
  declineOffer:async input=>{seen.decline=input;return {ok:true,liveEnabled:false,offerId:offer}},
  ...overrides});
 return {gateway,seen};
}
const req=(method,path,body)=>({method,path,headers:{authorization:'Bearer '+token},
 ...(body===undefined?{}:{body})});
const read='/v1/staging/courier/delivery-offers/'+offer;
const accept='/v1/staging/courier/delivery-offers/accept';
const decline='/v1/staging/courier/delivery-offers/decline';
test('private preview exposes package facts only to verified recipient',async()=>{
 const {gateway,seen}=fixture();const result=await gateway(req('GET',read));
 assert.equal(result.status,200);assert.equal(result.body.offerId,offer);
 assert.equal(result.body.expiresAtMs,now+30_000);
 assert.equal(result.body.confirmedAcceptance,false);
 assert.deepEqual(seen.load,{actorId:courier,offerId:offer});
 assert.doesNotMatch(JSON.stringify(result),/sender|lat|lng|phone/i);
});
test('accept and decline derive courier from verified Auth',async()=>{
 const {gateway,seen}=fixture();
 const accepted=await gateway(req('POST',accept,{offerId:offer,requestKey:key}));
 assert.equal(accepted.status,200);assert.equal(accepted.body.eventId,event);
 assert.deepEqual(seen.accept,{actorId:courier,offerId:offer,decisionKey:key});
 const declined=await gateway(req('POST',decline,{offerId:offer,requestKey:key}));
 assert.equal(declined.status,200);assert.equal(declined.body.offerId,offer);
 assert.deepEqual(seen.decline,{actorId:courier,offerId:offer,decisionKey:key});
});
test('forged courier fields and malformed decisions never reach persistence',async()=>{
 let calls=0;const {gateway}=fixture({acceptOffer:async()=>{calls++;return {}}});
 for(const body of [{offerId:offer,requestKey:key,courierId:courier},
  {offerId:offer,requestKey:'bad'},{offerId:'bad',requestKey:key},{}])
  assert.equal((await gateway(req('POST',accept,body))).status,400);
 assert.equal(calls,0);
});
test('expired/foreign snapshots and auth, role, limiter or DB failures fail closed',async()=>{
 assert.equal((await fixture({loadOffer:async()=>({ok:true,liveEnabled:false,
  offer:{...record,courierId:key}})}).gateway(req('GET',read))).status,404);
 assert.equal((await fixture({now:()=>now+31_000}).gateway(req('GET',read))).status,404);
 assert.equal((await fixture({verifyAccessToken:async()=>{throw Error('secret')}})
  .gateway(req('GET',read))).status,401);
 assert.equal((await fixture({authorizeCourier:async()=>false})
  .gateway(req('GET',read))).status,403);
 assert.equal((await fixture({allowRequest:()=>false})
  .gateway(req('GET',read))).status,429);
 assert.equal((await fixture({acceptOffer:async()=>{throw Error('private')}})
  .gateway(req('POST',accept,{offerId:offer,requestKey:key}))).status,409);
});

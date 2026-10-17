import test from 'node:test';
import assert from 'node:assert/strict';
import {createQoreOfferGateway} from './g4-offer-gateway.mjs';
const ref='staging1234567890abcd';
const driver='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const offer='33333333-3333-4333-8333-333333333333';
const ride='44444444-4444-4444-8444-444444444444';
const requestKey='55555555-5555-4555-8555-555555555555';
const event='66666666-6666-4666-8666-666666666666';
const access='a'.repeat(60);
const confirmed={id:driver,email_confirmed_at:'2026-10-17T00:00:00Z',is_anonymous:false};
const data={offerId:offer,tripId:ride,driverId:driver,status:'offered',
 expiresAtMs:100_015,service:'economico',originTag:'PANTEON',destinationTag:'SHOPPING'};
function fixture(overrides={}){
 const observed={};
 const gateway=createQoreOfferGateway({
  projectRef:ref,
  verifyAccessToken:async t=>{observed.token=t;return confirmed},
  authorizeDriver:async id=>{observed.actor=id;return true},
  allowRequest:()=>true,now:()=>100_000,
  loadOfferForDriver:async params=>{observed.lookedUp=params;return data},
  acceptOffer:async params=>{observed.accept=params;return event},
  declineOffer:async params=>{observed.decline=params;return offer},
  ...overrides
 });
 return {gateway,observed};
}
const req=(method,path,body)=>({method,path,
 headers:{authorization:'Bearer '+access},
 ...(body===undefined?{}:{body})});
const readPath='/v1/staging/driver/offers/'+offer;
const acceptPath='/v1/staging/driver/offers/accept';
const declinePath='/v1/staging/driver/offers/decline';
test('private GET preview verifies JWT+driver role then filters BOTH offer and verified recipient',async()=>{
 const {gateway,observed}=fixture();
 const res=await gateway(req('GET',readPath));
 assert.equal(res.status,200);
 assert.deepEqual(observed.lookedUp,{offerId:offer,driverId:driver});
 assert.equal(observed.token,access);
 assert.equal(observed.actor,driver);
 assert.equal(res.body.originTag,'PANTEON');
 assert.equal(res.body.confirmedAcceptance,false);
 assert.equal(res.body.commercialRidesEnabled,false);
 assert.equal(res.body.mode,'STAGING_DEMO_ONLY');
 assert.doesNotMatch(JSON.stringify(res),/lat|lng|phone|plate/i);
});
test('POST accepts only offerId/requestKey; actor taken from server Auth, not request',async()=>{
 const {gateway,observed}=fixture();
 const res=await gateway(req('POST',acceptPath,{offerId:offer,requestKey}));
 assert.equal(res.status,200);
 assert.equal(res.body.outcome,'accepted');
 assert.equal(res.body.eventId,event);
 assert.equal(res.body.passengerEventDelivered,false);
 assert.equal(res.body.pushDelivered,false);
 assert.deepEqual(observed.accept,{
  _offer_id:offer,_driver_id:driver,_decision_key:requestKey
 });
 const declined=await gateway(req('POST',declinePath,{offerId:offer,requestKey}));
 assert.equal(declined.status,200);
 assert.equal(declined.body.outcome,'declined');
 assert.deepEqual(observed.decline,{
  _offer_id:offer,_driver_id:driver,_decision_key:requestKey
 });
});
test('rejects all attempts to forge conductor and acceptance status, without touching adapters',async()=>{
 let calls=0;
 const {gateway}=fixture({
  acceptOffer:async()=>{calls++;return event},
  declineOffer:async()=>{calls++;return offer}
 });
 for(const body of [
  {offerId:offer,requestKey,driverId:other},
  {offerId:offer,requestKey,_driver_id:other},
  {offerId:offer,requestKey,role:'admin'},
  {offerId:offer,requestKey,commercialRidesEnabled:true},
  {offerId:offer,requestKey,accepted:true},
  {offerId:'not-a-uuid',requestKey},
  {offerId:offer,requestKey:'not-a-uuid'},
  {},
 ]){
  assert.equal((await gateway(req('POST',acceptPath,body))).status,400);
 }
 assert.equal(calls,0);
});
test('invalid or unconfirmed JWT fails closed before role lookup or offers',async()=>{
 let calls=0;
 const {gateway}=fixture({
  verifyAccessToken:async()=>{throw Error('secret Auth detail')},
  authorizeDriver:async()=>{calls++;return true}
 });
 const res=await gateway(req('GET',readPath));
 assert.equal(res.status,401);
 assert.doesNotMatch(JSON.stringify(res),/secret/);
 assert.equal(calls,0);
 for(const invalid of [{id:driver},{id:driver,is_anonymous:true,email_confirmed_at:'yes'}]){
  const h=fixture({verifyAccessToken:async()=>invalid});
  assert.equal((await h.gateway(req('GET',readPath))).status,401);
 }
 assert.equal((await gateway({method:'GET',path:readPath,headers:{}})).status,401);
});
test('unauthorized passenger or role API failure always denies offers and decisions',async()=>{
 let accepted=0;
 const deny=fixture({authorizeDriver:async()=>false,
  acceptOffer:async()=>{accepted++;return event}});
 assert.equal((await deny.gateway(req('POST',acceptPath,{offerId:offer,requestKey}))).status,403);
 assert.equal(accepted,0);
 const fails=fixture({authorizeDriver:async()=>{throw Error('secret DB')}})
 assert.equal((await fails.gateway(req('GET',readPath))).status,503);
});
test('private offer expired, foreign, malformed or revoked is always NOT disclosed',async()=>{
 for(const invalid of [
  {...data,driverId:other},
  {...data,expiresAtMs:100_000},
  {...data,expiresAtMs:140_000},
  {...data,status:'withdrawn'},
  {...data,service:'moto_pasajero'},
  {...data,originTag:'PRIVATE ADDRESS'},
  {...data,tripId:other,offerId:other}
 ]){
  const {gateway}=fixture({loadOfferForDriver:async()=>invalid});
  assert.equal((await gateway(req('GET',readPath))).status,404);
 }
});
test('limiter refuses non-true, throws, and does not run DB decision',async()=>{
 let called=0;
 for(const decision of [false,null,'yes',Promise.resolve(true)]){
  const {gateway}=fixture({allowRequest:()=>decision,acceptOffer:async()=>{called++;return event}});
  assert.equal((await gateway(req('POST',acceptPath,{offerId:offer,requestKey}))).status,429);
 }
 const h=fixture({allowRequest:()=>{throw Error('limiter private')}});
 assert.equal((await h.gateway(req('GET',readPath))).status,503);
 assert.equal(called,0);
});
test('database conflicts and missing receipt never cause fake acceptance success',async()=>{
 const conflict=fixture({acceptOffer:async()=>{throw Error('private deadlock')}})
 const a=await conflict.gateway(req('POST',acceptPath,{offerId:offer,requestKey}));
 assert.equal(a.status,409);
 assert.doesNotMatch(JSON.stringify(a),/deadlock/);
 const bad=fixture({acceptOffer:async()=>true});
 const b=await bad.gateway(req('POST',acceptPath,{offerId:offer,requestKey}));
 assert.equal(b.status,503);
});
test('old backend and missing required role/SQL/limiter adapters rejected at startup',()=>{
 const args={
  projectRef:ref,verifyAccessToken:async()=>confirmed,
  authorizeDriver:async()=>true,loadOfferForDriver:async()=>data,
  acceptOffer:async()=>event,declineOffer:async()=>offer,allowRequest:()=>true
 };
 assert.throws(()=>createQoreOfferGateway({...args,projectRef:'qdqrlgzlotnfdxzpacxs'}));
 for(const key of ['verifyAccessToken','authorizeDriver','loadOfferForDriver',
  'acceptOffer','declineOffer','allowRequest']){
  assert.throws(()=>createQoreOfferGateway({...args,[key]:null}));
 }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createQoreG4PrivatePushWorker} from './g4-private-push-outbox-worker.mjs';
import {createExpoPrivateOfferSender} from './g4-expo-push-offers.mjs';

const workerId='11111111-1111-4111-8111-111111111111';
const offerId='22222222-2222-4222-8222-222222222222';
const driverId='33333333-3333-4333-8333-333333333333';
const tripId='44444444-4444-4444-8444-444444444444';
const nowMs=2_000_000;
const token='ExponentPushToken[abcdefghijklmnop12345678]';
const queued={offerId,driverId,tripId,expiresAtMs:nowMs+20_000};
const live={...queued,status:'offered',tripStatus:'searching'};
function harness(overrides={}){
 const actions={claimed:0,rechecked:0,tokenLookups:0,send:0,ack:0,body:null};
 let first=true;
 const sender=createExpoPrivateOfferSender({
  now:()=>nowMs,
  request:async(url,opts)=>{
   actions.send++;
   actions.body=JSON.parse(opts.body);
   return {ok:true,json:async()=>({data:{status:'ok',id:'ticket-0001234'}})};
  }
 });
 const fn=createQoreG4PrivatePushWorker({
  workerId,environment:'staging',liveTripsEnabled:false,now:()=>nowMs,
  claim:async()=>{actions.claimed++;if(first){first=false;return {...queued};}return null;},
  readCurrentOffer:async()=>{actions.rechecked++;return {...live};},
  findVerifiedDevice:async()=>{actions.tokenLookups++;return{
   driverId,active:true,pushOptIn:true,token
  };},
  sendVerifiedOffer:sender,
  ackTicket:async()=>{actions.ack++;return true;},
  ...overrides
 });
 return {fn,actions};
}
test('one claim → one consenting driver token → Expo ticket → owner ACK; never reports delivery',async()=>{
 const params=[];
 const h=harness({ackTicket:async args=>{params.push(args);return true;}});
 const r=await h.fn();
 assert.deepEqual(r,{status:'accepted_for_processing_not_delivered',
  commercialRidesEnabled:false,delivered:false,rideAccepted:false});
 assert.equal(h.actions.send,1);
 assert.equal(h.actions.tokenLookups,1);
 assert.deepEqual(params,[{workerId,offerId,ticketId:'ticket-0001234'}]);
 assert.equal(h.actions.body.to,token);
 assert.equal(h.actions.body.ttl,20);
 assert.deepEqual(Object.keys(h.actions.body.data).sort(),['kind','offerId','rideId']);
 assert.doesNotMatch(JSON.stringify(h.actions.body),/lat|lng|passenger|plate|pickup/i);
 const again=await h.fn();
 assert.equal(again.status,'idle');
 assert.equal(h.actions.send,1,'claimed offer never resent');
});
test('recheck rejects expired, withdrawn, accepted, reassigned or different driver before token lookup',async()=>{
 for(const fake of [
  {...live,status:'withdrawn'}, {...live,status:'declined'},
  {...live,status:'accepted'}, {...live,tripStatus:'accepted'},
  {...live,driverId:workerId}, {...live,tripId:workerId},
  {...live,expiresAtMs:nowMs+10_000}
 ]){
  const h=harness({readCurrentOffer:async()=>fake});
  assert.equal((await h.fn()).status,'no_longer_eligible');
  assert.equal(h.actions.tokenLookups,0);
  assert.equal(h.actions.send,0);
 }
});
test('no push consent or cross-driver token cannot notify anyone',async()=>{
 for(const d of [
  null,{driverId,active:false,pushOptIn:true,token},
  {driverId,active:true,pushOptIn:false,token},
  {driverId:workerId,active:true,pushOptIn:true,token},
  {driverId,active:true,pushOptIn:true,token:null}
 ]){
  const h=harness({findVerifiedDevice:async()=>d});
  assert.equal((await h.fn()).status,'no_consenting_device');
  assert.equal(h.actions.send,0);
 }
});
test('late, stale or malformed claims never query device, send or ack',async()=>{
 for(const wrong of [
  {...queued,expiresAtMs:nowMs+2_000},
  {...queued,expiresAtMs:nowMs-1},
  {...queued,expiresAtMs:nowMs+31_000},
  {...queued,driverId:'a stranger'},
  {...queued,tripId:'bad trip'},
  {...queued,offerId:'not an offer'},
  null
 ]){
  if(wrong===null)continue;
  const h=harness({claim:async()=>wrong});
  assert.equal((await h.fn()).status,'invalid_claim');
  assert.equal(h.actions.send,0);
  assert.equal(h.actions.ack,0);
 }
});
test('time advancing after preflight cancels request instead of sending expired private push',async()=>{
 let calls=0;
 const h=harness({now:()=>{calls++;return calls===1?nowMs:nowMs+18_000;}});
 assert.equal((await h.fn()).status,'expired_before_delivery');
 assert.equal(h.actions.send,0);
});
test('provider failures, invalid ticket and ACK errors fail closed without fabricated delivery',async()=>{
 const fail=harness({sendVerifiedOffer:async()=>{throw Error('EXPO secrets...')}});
 assert.equal((await fail.fn()).status,'provider_unavailable_no_retry');
 const fake=harness({sendVerifiedOffer:async()=>({
  acceptedForProcessing:true,delivered:true,rideAccepted:true,offerId,
  providerTicketId:'ticket-0001234',commercialRidesEnabled:false
 })});
 assert.equal((await fake.fn()).status,'provider_receipt_untrusted');
 const ackFalse=harness({ackTicket:async()=>false});
 assert.equal((await ackFalse.fn()).status,'ack_unconfirmed_no_retry');
 const ackError=harness({ackTicket:async()=>{throw Error('DB private...')}});
 assert.equal((await ackError.fn()).status,'ack_unavailable_no_retry');
 assert.doesNotMatch(JSON.stringify(await ackError.fn()),/DB private/);
});
test('worker startup requires server-only interfaces and forbids any LIVE environment',()=>{
 const required={workerId,environment:'staging',liveTripsEnabled:false,
  claim:async()=>null,readCurrentOffer:async()=>live,
  findVerifiedDevice:async()=>({}),sendVerifiedOffer:async()=>({}),
  ackTicket:async()=>true};
 for(const x of [
  {environment:'production'}, {liveTripsEnabled:true},
  {workerId:'not-a-uuid'}, {claim:null}, {ackTicket:null}
 ]){
  assert.throws(()=>createQoreG4PrivatePushWorker({...required,...x}));
 }
});

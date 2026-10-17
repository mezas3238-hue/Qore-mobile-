import test from 'node:test';
import assert from 'node:assert/strict';
import {createExpoPrivateOfferSender} from './g4-expo-push-offers.mjs';
import {makePrivateDriverPush} from './g4-qore-radar-core.mjs';
const driver='11111111-1111-4111-8111-111111111111';
const offerId='22222222-2222-4222-8222-222222222222';
const ride='33333333-3333-4333-8333-333333333333';
const token='ExponentPushToken[abcdefghijklmnop12345678]';
const now=2_000_000;
const offer=makePrivateDriverPush({rideId:ride,offerId,driverId:driver,
 expiresAtMs:now+15_000,nowMs:now});
test('Expo driver push carries only opaque ride and offer IDs, short TTL and no passenger PII',async()=>{
 let params;
 const send=createExpoPrivateOfferSender({now:()=>now,request:async(url,init)=>{
  params={url,init};
  return {ok:true,json:async()=>({data:{status:'ok',id:'ticket-1234567'}})};
 }});
 const result=await send({token,verifiedDriverId:driver,offer});
 assert.deepEqual(result,{acceptedForProcessing:true,delivered:false,
  rideAccepted:false,offerId,commercialRidesEnabled:false});
 const p=JSON.parse(params.init.body);
 assert.equal(params.url,'https://exp.host/--/api/v2/push/send');
 assert.equal(p.to,token);
 assert.equal(p.ttl,15);
 assert.deepEqual(Object.keys(p.data).sort(),['kind','offerId','rideId']);
 assert.doesNotMatch(params.init.body,/lat|lng|pickup|passengerPhone|plate/i);
 assert.equal(params.init.redirect,'error');
});
test('recipient mismatch, fake tokens, disabled offer and expiration stop before network',async()=>{
 let called=0;
 const send=createExpoPrivateOfferSender({now:()=>now,request:async()=>{called++;throw Error('network')}});
 for(const args of [
  {token:'invalid',verifiedDriverId:driver,offer},
  {token,verifiedDriverId:'44444444-4444-4444-8444-444444444444',offer},
  {token,verifiedDriverId:driver,offer:{...offer,ok:false}},
  {token,verifiedDriverId:driver,offer:{...offer,expiresAtMs:now-1}},
  {token,verifiedDriverId:driver,offer:{...offer,expiresAtMs:now+31_000}}
 ]){
  await assert.rejects(send(args));
 }
 assert.equal(called,0);
});
test('Expo push HTTP failure or ticket error is not represented as delivery or acceptance',async()=>{
 const fail=createExpoPrivateOfferSender({now:()=>now,
  request:async()=>({ok:false,status:429})});
 await assert.rejects(fail({token,verifiedDriverId:driver,offer}));
 const errorTicket=createExpoPrivateOfferSender({now:()=>now,
  request:async()=>({ok:true,json:async()=>({data:{status:'error',message:'DeviceNotRegistered'}})})});
 await assert.rejects(errorTicket({token,verifiedDriverId:driver,offer}));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createG82PrivateAutoCandidateDispatch} from './g82-f1-auto-candidate-dispatch.mjs';
const passengerId='81810000-0000-4818-8818-000000000001';
const bookingKey='81810000-0000-4818-8818-000000000012';
const offerKey='82820000-0000-4828-8828-000000000013';
const args={passengerId,bookingKey,offerKey,ttlSeconds:15};
test('G82 private SQL selects candidate without receiving client driver/vehicle ID',async()=>{
 const calls=[];
 const dispatch=createG82PrivateAutoCandidateDispatch({rpc:async(n,p)=>{
  calls.push([n,p]);return {data:offerKey,error:null};
 }});
 assert.deepEqual(await dispatch.offerFirstEligible(args),{
  offerId:offerKey,candidateAvailable:true,pushDelivered:false,
  commercialRidesEnabled:false,liveEnabled:false
 });
 assert.deepEqual(calls,[['mobility_stage_g82_offer_first_eligible_auto_qa',{
  _passenger_id:passengerId,_booking_key:bookingKey,
  _offer_key:offerKey,_ttl_seconds:15
 }]]);
});
test('G82 no eligible candidate means no offer and never an assignment',async()=>{
 const dispatch=createG82PrivateAutoCandidateDispatch({rpc:async()=>({
  data:null,error:null
 })});
 assert.deepEqual(await dispatch.offerFirstEligible(args),{
  offerId:null,candidateAvailable:false,pushDelivered:false,
  commercialRidesEnabled:false,liveEnabled:false
 });
});
test('G82 rejects driver ID injection, malformed inputs and SQL uncertainty',async()=>{
 let called=0;
 const dispatch=createG82PrivateAutoCandidateDispatch({rpc:async()=>{
  called++;return {data:offerKey,error:null};
 }});
 for(const bad of [
  {...args,driverId:passengerId},
  {...args,vehicleId:bookingKey},
  {...args,tripId:bookingKey},
  {...args,ttlSeconds:31},
  {...args,ttlSeconds:4},
  {...args,passengerId:'not-a-uuid'},
  {},
  null
 ])await assert.rejects(dispatch.offerFirstEligible(bad));
 assert.equal(called,0,'Untrusted payload must never reach SQL');
 for(const result of [{data:12,error:null},{data:undefined,error:null},
  {data:null,error:{message:'denied'}},null]){
  const broken=createG82PrivateAutoCandidateDispatch({rpc:async()=>result});
  await assert.rejects(broken.offerFirstEligible(args),/SQL/);
 }
 const throws=createG82PrivateAutoCandidateDispatch({rpc:async()=>{throw Error('secret');}});
 await assert.rejects(throws.offerFirstEligible(args),/SQL unavailable/);
});

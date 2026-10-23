import test from 'node:test';
import assert from 'node:assert/strict';
import {createQoreTripCommandGateway} from './g4-trip-command-gateway.mjs';

const ref='staging1234567890abcd';
const passenger='11111111-1111-4111-8111-111111111111';
const driver='22222222-2222-4222-8222-222222222222';
const outsider='33333333-3333-4333-8333-333333333333';
const trip='44444444-4444-4444-8444-444444444444';
const key='55555555-5555-4555-8555-555555555555';
const bearer=id=>'synthetic_bearer_'+id.replaceAll('-','')+'_token';
const headers=id=>({authorization:'Bearer '+bearer(id)});
const requestBody={requestKey:key,originTag:'PANTEON',
 destinationTag:'AEROPUERTO',service:'economico'};
const transitionPath='/v1/staging/trips/'+trip+'/transition';

function fixture(){
 const calls=[];
 const gateway=createQoreTripCommandGateway({
  projectRef:ref,
  verifyAccessToken:async token=>{
   const id=[passenger,driver,outsider].find(value=>bearer(value)===token);
   if(!id)throw Error('unauthorized');
   return {id,is_anonymous:false,email_confirmed_at:'2026-10-22T12:00:00Z'};
  },
  resolveRole:async id=>id===passenger?'passenger':id===driver?'driver':null,
  allowRequest:()=>true,
  requestTrip:async input=>{
   calls.push({operation:'request',input});
   return {ok:true,liveEnabled:false,tripId:trip};
  },
  transitionTrip:async input=>{
   calls.push({operation:'transition',input});
   return {ok:true,liveEnabled:false,eventId:key};
  },
 });
 return {gateway,calls};
}

test('passenger request persists without accepting identity fields from payload',async()=>{
 const {gateway,calls}=fixture();
 const result=await gateway({method:'POST',path:'/v1/staging/rider/trips/request',
  headers:headers(passenger),body:requestBody});
 assert.equal(result.status,201);
 assert.equal(result.body.tripId,trip);
 assert.equal(result.body.status,'searching');
 assert.equal(result.body.commercialRidesEnabled,false);
 assert.deepEqual(calls,[{operation:'request',input:{
  actorId:passenger,requestKey:key,originTag:'PANTEON',
  destinationTag:'AEROPUERTO',service:'economico',
 }}]);
 for(const forged of [
  {...requestBody,passengerId:passenger},
  {...requestBody,driverId:driver},
  {...requestBody,liveEnabled:true},
 ])assert.equal((await gateway({method:'POST',
  path:'/v1/staging/rider/trips/request',headers:headers(passenger),body:forged})).status,400);
 assert.equal(calls.length,1);
});

test('driver can advance only driver events and passenger can only cancel',async()=>{
 const {gateway,calls}=fixture();
 for(const event of ['arrive','pickup','complete']){
  const result=await gateway({method:'POST',path:transitionPath,
   headers:headers(driver),body:{event,eventKey:key}});
  assert.equal(result.status,200);
  assert.equal(result.body.event,event);
 }
 assert.equal((await gateway({method:'POST',path:transitionPath,
  headers:headers(passenger),body:{event:'cancel',eventKey:key}})).status,200);
 assert.equal((await gateway({method:'POST',path:transitionPath,
  headers:headers(passenger),body:{event:'pickup',eventKey:key}})).status,403);
 assert.equal((await gateway({method:'POST',path:transitionPath,
  headers:headers(driver),body:{event:'cancel',eventKey:key}})).status,403);
 assert.equal(calls.length,4);
 assert.deepEqual(calls[0].input,{actorId:driver,tripId:trip,event:'arrive',eventKey:key});
});

test('invalid Auth, roles, bodies, paths, limits and persistence fail closed',async()=>{
 const f=fixture();
 assert.equal((await f.gateway({method:'GET',path:transitionPath,
  headers:headers(driver)})).status,404);
 assert.equal((await f.gateway({method:'POST',path:transitionPath,
  headers:{},body:{event:'arrive',eventKey:key}})).status,401);
 assert.equal((await f.gateway({method:'POST',path:transitionPath,
  headers:headers(outsider),body:{event:'arrive',eventKey:key}})).status,403);
 assert.equal((await f.gateway({method:'POST',path:transitionPath,
  headers:headers(driver),body:{event:'dispute',eventKey:key}})).status,400);
 assert.equal((await f.gateway({method:'POST',path:transitionPath,
  headers:headers(driver),body:{event:'arrive',eventKey:key,actorId:driver}})).status,400);
 const limited=createQoreTripCommandGateway({
  projectRef:ref,verifyAccessToken:async()=>({id:passenger,is_anonymous:false,
   email_confirmed_at:'2026-10-22T12:00:00Z'}),
  resolveRole:async()=> 'passenger',allowRequest:()=>false,
  requestTrip:async()=>{throw Error('must not run');},transitionTrip:async()=>{},
 });
 assert.equal((await limited({method:'POST',path:'/v1/staging/rider/trips/request',
  headers:headers(passenger),body:requestBody})).status,429);
 const broken=createQoreTripCommandGateway({
  projectRef:ref,verifyAccessToken:async()=>({id:passenger,is_anonymous:false,
   email_confirmed_at:'2026-10-22T12:00:00Z'}),
  resolveRole:async()=> 'passenger',allowRequest:()=>true,
  requestTrip:async()=>({ok:true,liveEnabled:true,tripId:trip}),
  transitionTrip:async()=>{},
 });
 assert.equal((await broken({method:'POST',path:'/v1/staging/rider/trips/request',
  headers:headers(passenger),body:requestBody})).status,409);
});

test('G25 Client cancel alias: only confirmed Passenger, sealed requestKey, existing atomic transition',async()=>{
 const {gateway,calls}=fixture();
 const path='/v1/staging/rider/trips/'+trip+'/cancel';
 const canceled=await gateway({method:'POST',path,headers:headers(passenger),
  body:{requestKey:key}});
 assert.equal(canceled.status,200);
 assert.equal(canceled.body.event,'cancel');
 assert.equal(canceled.body.tripId,trip);
 assert.equal(canceled.body.eventId,key);
 assert.equal(canceled.body.serverPersisted,true);
 assert.equal(canceled.body.commercialRidesEnabled,false);
 assert.deepEqual(calls,[{operation:'transition',input:{
  actorId:passenger,tripId:trip,event:'cancel',eventKey:key
 }}]);
 for(const body of [
  {requestKey:key,actorId:passenger},{requestKey:key,amountGs:1},
  {requestKey:key,feeGs:1000},{requestKey:key,refund:true},
  {requestKey:'not-uuid'},{}
 ]){
  assert.equal((await gateway({method:'POST',path,headers:headers(passenger),body})).status,400);
 }
 assert.equal((await gateway({method:'POST',path,headers:headers(driver),
  body:{requestKey:key}})).status,403);
 assert.equal((await gateway({method:'POST',path,headers:{},
  body:{requestKey:key}})).status,401);
 assert.equal((await gateway({method:'GET',path,headers:headers(passenger)})).status,404);
 assert.equal(calls.length,1);
});

test('G25 stale/foreign cancellation returns no event or private trip info',async()=>{
 const gateway=createQoreTripCommandGateway({
  projectRef:ref,verifyAccessToken:async()=>({id:passenger,is_anonymous:false,
   email_confirmed_at:'2026-10-22T12:00:00Z'}),
  resolveRole:async()=> 'passenger',allowRequest:()=>true,
  requestTrip:async()=>{throw Error('unused')},
  transitionTrip:async()=>{throw Error('No own mutable trip')}
 });
 const out=await gateway({method:'POST',path:'/v1/staging/rider/trips/'+trip+'/cancel',
  headers:headers(passenger),body:{requestKey:key}});
 assert.equal(out.status,409);
 assert.doesNotMatch(JSON.stringify(out),/driver|passenger_id|feeGs|No own mutable trip/i);
});

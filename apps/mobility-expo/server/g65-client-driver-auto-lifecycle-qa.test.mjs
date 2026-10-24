/**
 * G65 integration across distinct authenticated Client/Driver API surfaces.
 * Synthetic state ONLY: does not claim a database, phones, IdP or LIVE.
 * PostgreSQL one-winner and G38 no-live gates are certified separately.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createQoreTripCommandGateway} from './g4-trip-command-gateway.mjs';
import {createQoreOfferGateway} from './g4-offer-gateway.mjs';
import {createG65PrivateDriverTripStatusQa} from './g65-driver-trip-status-qa.mjs';
const id=n=>'65652000-0000-4656-8656-'+String(n).padStart(12,'0');
const passenger=id(1),driver=id(2),other=id(3),vehicle=id(4),
 trip=id(5),offer=id(6),reqKey=id(7),acceptKey=id(8);
const session=id(9),otherSession=id(10);
const at=Date.parse('2026-10-24T17:00:00Z');
const ref='staging1234567890abcd';
const token=x=>'token_'+x.replaceAll('-','')+'_signedqa';
const headers=x=>({authorization:'Bearer '+token(x)});
function fixture(){
 const state={trip:null,offer:null,events:new Map(),commits:0,
  role:new Map([[passenger,'passenger'],[driver,'driver'],[other,'passenger']]),
  sessionValid:true};
 const user=t=>{
  const actor=[passenger,driver,other].find(x=>token(x)===t);
  if(!actor)throw Error('invalid token');
  return {id:actor,email_confirmed_at:'2026-10-23T10:00:00Z',is_anonymous:false};
 };
 const command=createQoreTripCommandGateway({
  projectRef:ref,verifyAccessToken:async t=>user(t),
  resolveRole:async id=>state.role.get(id)??null,
  allowRequest:()=>true,
  requestTrip:async({actorId,requestKey,originTag,destinationTag,service})=>{
   if(actorId!==passenger||requestKey!==reqKey||state.trip)
    throw Error('Invalid synthetic booking');
   state.trip={id:trip,passengerId:actorId,driverId:null,vehicleId:null,
    status:'searching',revision:1,service,originTag,destinationTag};
   return {ok:true,liveEnabled:false,tripId:trip};
  },
  transitionTrip:async({actorId,tripId,event,eventKey})=>{
   const row=state.trip;
   if(!row||tripId!==row.id)throw Error('Missing trip');
   if(state.events.has(eventKey)){
    const old=state.events.get(eventKey);
    if(old.event!==event||old.actorId!==actorId)
     throw Error('Idempotency misuse');
    return {ok:true,liveEnabled:false,eventId:old.eventId};
   }
   const step={accepted:'arrive',arriving:'pickup',in_progress:'complete'};
   if(actorId!==driver||event!==step[row.status])
    throw Error('Unassigned driver or skipped state');
   row.status={arrive:'arriving',pickup:'in_progress',complete:'completed'}[event];
   row.revision++;state.commits++;
   const eventId=id(20+state.commits);
   state.events.set(eventKey,{actorId,event,eventId});
   return {ok:true,liveEnabled:false,eventId};
  }
 });
 const offerGateway=createQoreOfferGateway({
  projectRef:ref,verifyAccessToken:async t=>user(t),
  authorizeDriver:async id=>state.role.get(id)==='driver',
  allowRequest:()=>true,now:()=>at,
  loadOfferForDriver:async({offerId,driverId})=>{
   if(state.offer?.id!==offerId||state.offer.driverId!==driverId)return null;
   return {offerId,driverId,tripId:trip,status:state.offer.status,
    expiresAtMs:at+15000,service:'economico',
    originTag:'CENTRO',destinationTag:'AEROPUERTO'};
  },
  acceptOffer:async({_offer_id,_driver_id,_decision_key})=>{
   if(!state.trip||state.offer?.id!==_offer_id||
    state.offer.driverId!==_driver_id||
    state.offer.status!=='offered'||state.trip.status!=='searching')
    throw Error('Not eligible');
   state.trip.status='accepted';state.trip.revision=2;
   state.trip.driverId=_driver_id;state.trip.vehicleId=vehicle;
   state.offer.status='accepted';state.commits++;
   return _decision_key;
  },
  declineOffer:async()=>{throw Error('Not used')}
 });
 const status=createG65PrivateDriverTripStatusQa({
  environment:'isolated_staging',localQaOnly:true,liveEnabled:false,
  now:()=>at,
  verifyAccessToken:async t=>{
   const who=user(t);
   return {id:who.id,sessionId:who.id===driver?session:otherSession,
    tokenIatMs:at-5000,expiresAtMs:at+60000,is_anonymous:false};
  },
  verifySessionNotRevoked:async()=>state.sessionValid,
  resolveExclusiveRole:async id=>state.role.get(id),
  allowRequest:()=>true,
  loadAssignedTrip:async({actorId,tripId})=>{
   const row=state.trip;
   if(!row||row.id!==tripId||row.driverId!==actorId)return null;
   return {tripId:row.id,driverId:row.driverId,vehicleId:row.vehicleId,
    passengerId:row.passengerId,status:row.status,revision:row.revision,
    service:row.service};
  }
 });
 return {state,command,offerGateway,status};
}
const request=()=>({method:'POST',path:'/v1/staging/rider/trips/request',
 headers:headers(passenger),
 body:{requestKey:reqKey,originTag:'CENTRO',
  destinationTag:'AEROPUERTO',service:'economico'}});
const read=(who=driver)=>({method:'GET',
 path:'/v1/staging/driver/trips/'+trip+'/status',headers:headers(who)});
const advance=(event,eventKey,who=driver)=>({method:'POST',
 path:'/v1/staging/trips/'+trip+'/transition',headers:headers(who),
 body:{event,eventKey}});
test('G65 Client booking -> private Driver offer -> Driver arrives/pickup/completes in order',async()=>{
 const f=fixture();
 const booked=await f.command(request());
 assert.equal(booked.status,201);
 assert.equal(booked.body.status,'searching');
 assert.equal((await f.status(read())).status,404);
 f.state.offer={id:offer,driverId:driver,status:'offered'};
 const wrong=await f.offerGateway({method:'POST',
  path:'/v1/staging/driver/offers/accept',headers:headers(other),
  body:{offerId:offer,requestKey:acceptKey}});
 assert.notEqual(wrong.status,200);
 const accepted=await f.offerGateway({method:'POST',
  path:'/v1/staging/driver/offers/accept',headers:headers(driver),
  body:{offerId:offer,requestKey:acceptKey}});
 assert.equal(accepted.status,200);
 assert.equal(accepted.body.commercialRidesEnabled,false);
 assert.equal((await f.status(read())).body.nextEvent,'arrive');
 const forbidden=await f.command(advance('complete',id(21)));
 assert.equal(forbidden.status,409);
 assert.equal(f.state.trip.revision,2);
 for(const [event,expected,revision,key] of [
  ['arrive','arriving',3,id(31)],
  ['pickup','in_progress',4,id(32)],
  ['complete','completed',5,id(33)]
 ]){
  const result=await f.command(advance(event,key));
  assert.equal(result.status,200,event);
  const snapshot=await f.status(read());
  assert.equal(snapshot.status,200);
  assert.equal(snapshot.body.state,expected);
  assert.equal(snapshot.body.revision,revision);
  assert.equal(snapshot.body.productionEnabled,false);
  assert.equal(snapshot.body.gpsVerified,false);
 }
 assert.equal((await f.status(read())).body.nextEvent,null);
 assert.equal((await f.command(advance('complete',id(34)))).status,409);
 assert.equal(f.state.commits,4);
});
test('G65 outsider and revoked session never reveal assigned Driver trip',async()=>{
 const f=fixture();
 await f.command(request());
 f.state.offer={id:offer,driverId:driver,status:'offered'};
 await f.offerGateway({method:'POST',path:'/v1/staging/driver/offers/accept',
  headers:headers(driver),body:{offerId:offer,requestKey:acceptKey}});
 const foreign=await f.status(read(other));
 assert.notEqual(foreign.status,200);
 assert(!JSON.stringify(foreign).includes(passenger));
 f.state.sessionValid=false;
 const revoked=await f.status(read(driver));
 assert.equal(revoked.status,401);
 assert(!JSON.stringify(revoked).includes(trip));
 assert.equal((await f.command(advance('pickup',id(40),other))).status,403);
});

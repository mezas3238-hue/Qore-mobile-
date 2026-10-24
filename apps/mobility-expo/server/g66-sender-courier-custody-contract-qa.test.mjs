/**
 * G66 contract integration: sender request -> private courier accept ->
 * pickup -> verified proof -> deliver -> participant status.
 * Uses synthetic persistence only. No phones, GPS, cloud DB or production.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createQoreDeliveryCommandGateway} from './g5-delivery-command-gateway.mjs';
import {createG66CourierCustodyStatusQa} from './g66-courier-custody-status-qa.mjs';
import {createG66CourierCustodyTransitionQa} from './g66-courier-custody-transition-qa.mjs';
const id=n=>'66662000-0000-4666-8666-'+String(n).padStart(12,'0');
const sender=id(1),driver=id(2),outsider=id(3),session=id(4),
 delivery=id(5),vehicle=id(6),proof=id(7),offerEvent=id(8);
const clock=Date.parse('2026-10-24T18:00:00Z');
const token=who=>'signed-qa-user-'+who.replaceAll('-','')+'-token';
const head=who=>({authorization:'Bearer '+token(who)});
const now=()=>clock;
function fixture(){
 const state={row:null,revision:0,events:new Map(),proofs:new Set(),
  writes:0,mutations:[]};
 const resolve=x=>{
  const actor=[sender,driver,outsider].find(who=>token(who)===x);
  if(!actor)throw Error('not authenticated');
  return actor;
 };
 const verifyAccessToken=async bearer=>{
  const actor=resolve(bearer);
  return {id:actor,is_anonymous:false,email_confirmed_at:'2026-10-23T00:00:00Z'};
 };
 const serverAuth=async bearer=>{
  const actor=resolve(bearer);
  return {id:actor,sessionId:session,tokenIatMs:clock-1000,
   expiresAtMs:clock+60000,is_anonymous:false};
 };
 const role=actor=>actor===sender?'passenger':actor===driver?'driver':null;
 const requestDelivery=async({actorId,requestKey,vehicleKind,category,
  grams,lengthCm,widthCm,heightCm,pickupTag,deliveryTag,
  restrictedItemDeclared})=>{
  if(actorId!==sender||state.row)throw Error('unverified request');
  state.row={deliveryId:delivery,courierId:null,vehicleId:null,
   senderId:actorId,status:'requested',revision:1,
   vehicleKind,category,proofRef:null};
  state.revision=1;
  return {ok:true,liveEnabled:false,deliveryId:delivery};
 };
 const acceptDelivery=async({actorId,deliveryId,vehicleId,requestKey})=>{
  if(actorId!==driver||deliveryId!==delivery||vehicleId!==vehicle||
   state.row?.status!=='requested')throw Error('invalid courier acceptance');
  state.row={...state.row,courierId:actorId,vehicleId,status:'accepted',revision:2};
  state.writes++;
  return {ok:true,liveEnabled:false,eventId:offerEvent};
 };
 const transitionDelivery=async({actorId,deliveryId,event,eventKey,proofRef})=>{
  if(actorId!==driver||deliveryId!==delivery||
   !state.row||state.row.courierId!==actorId)
   throw Error('Unauthorized mutation');
  if(state.events.has(eventKey)){
   const r=state.events.get(eventKey);
   if(r.event!==event)throw Error('wrong key replay');
   return {ok:true,liveEnabled:false,eventId:r.id};
  }
  const expected={accepted:'pickup',picked_up:'deliver',disputed:'return'};
  if(expected[state.row.status]!==event)
   throw Error('out-of-order custody');
  if(event==='deliver'&&(!state.proofs.has(proofRef)||
   typeof proofRef!=='string'))throw Error('unregistered proof');
  const status={pickup:'picked_up',deliver:'delivered',return:'returned'}[event];
  state.row={...state.row,status,revision:state.row.revision+1,
   proofRef:event==='deliver'?proofRef:state.row.proofRef};
  state.writes++;
  const idEvent=id(30+state.writes);
  state.events.set(eventKey,{event,id:idEvent});
  state.mutations.push(event);
  return {ok:true,liveEnabled:false,eventId:idEvent};
 };
 const core=createQoreDeliveryCommandGateway({
  projectRef:'staging1234567890abcd',verifyAccessToken,
  resolveRole:async id=>role(id),allowRequest:()=>true,
  requestDelivery,acceptDelivery,transitionDelivery,
  loadDelivery:async({actorId,deliveryId})=>{
   if(!state.row||state.row.deliveryId!==deliveryId||
    ![sender,driver].includes(actorId))throw Error('not participant');
   return {ok:true,liveEnabled:false,delivery:{id:deliveryId,status:state.row.status}};
  }
 });
 const shared={environment:'isolated_staging',localQaOnly:true,liveEnabled:false,
  now,verifyAccessToken:serverAuth,
  verifySessionNotRevoked:async()=>true,
  resolveExclusiveRole:async id=>role(id),allowRequest:()=>true};
 const status=createG66CourierCustodyStatusQa({...shared,
  loadAssignedDelivery:async({actorId,deliveryId})=>{
   if(state.row?.courierId!==actorId||state.row.deliveryId!==deliveryId)
    return null;
   return {...state.row};
  },
  verifyStoredProof:async({proofRef})=>state.proofs.has(proofRef)
 });
 const mutate=createG66CourierCustodyTransitionQa({...shared,
  verifyIndependentProof:async({actorId,deliveryId,proofRef})=>
   actorId===driver&&deliveryId===delivery&&state.proofs.has(proofRef),
  transitionDelivery
 });
 return {state,core,status,mutate};
}
const newDelivery=()=>({method:'POST',
 path:'/v1/staging/sender/deliveries/request',headers:head(sender),
 body:{requestKey:id(10),vehicleKind:'MOTO',category:'PHARMACY_OTC',
  grams:500,lengthCm:15,widthCm:10,heightCm:10,
  pickupTag:'FARMACIA_A',deliveryTag:'CASA_B',restrictedItemDeclared:false}});
const assigned=(who=driver)=>({method:'GET',
 path:'/v1/staging/courier/deliveries/'+delivery+'/custody',headers:head(who)});
const step=(event,eventKey,actor=driver,proofRef=null)=>({method:'POST',
 path:'/v1/staging/courier/deliveries/'+delivery+'/custody-transition',
 headers:head(actor),body:{event,eventKey,...(proofRef?{proofRef}:{})}});
test('G66 two-role staged flow: sender → courier → pickup → independent proof → delivered',async()=>{
 const f=fixture();
 const requested=await f.core(newDelivery());
 assert.equal(requested.status,201);
 assert.equal(requested.body.liveDeliveriesEnabled,false);
 assert.equal((await f.status(assigned())).status,404);
 const accepted=await f.core({method:'POST',
  path:'/v1/staging/courier/deliveries/'+delivery+'/accept',
  headers:head(driver),body:{vehicleId:vehicle,requestKey:id(11)}});
 assert.equal(accepted.status,200);
 const initial=await f.status(assigned());
 assert.equal(initial.status,200);
 assert.equal(initial.body.nextEvent,'pickup');
 assert.equal((await f.mutate(step('deliver',id(12),driver,proof))).status,403);
 assert.equal((await f.mutate(step('pickup',id(13),outsider))).status,403);
 assert.equal((await f.mutate(step('pickup',id(14)))).status,200);
 const picked=await f.status(assigned());
 assert.equal(picked.body.state,'picked_up');
 assert.equal(picked.body.nextEvent,'deliver');
 assert.equal(picked.body.proofVerified,false);
 // An independent server registry verifies the proof; never an app claim.
 f.state.proofs.add(proof);
 const delivered=await f.mutate(step('deliver',id(15),driver,proof));
 assert.equal(delivered.status,200);
 const finished=await f.status(assigned());
 assert.equal(finished.body.state,'delivered');
 assert.equal(finished.body.proofVerified,true);
 assert.equal(finished.body.nextEvent,null);
 assert.equal(f.state.writes,3); // accept + pickup + deliver
 assert.deepEqual(f.state.mutations,['pickup','deliver']);
 assert(!JSON.stringify(finished).includes(sender));
 assert(!JSON.stringify(finished).includes(proof));
 assert.equal((await f.mutate(step('deliver',id(16),driver,proof))).status,503);
});
test('G66 revoke and missing custody assignment deny unrelated Driver actor',async()=>{
 const f=fixture();
 await f.core(newDelivery());
 const bad=await f.status(assigned(outsider));
 assert.notEqual(bad.status,200);
 assert(!JSON.stringify(bad).includes(delivery));
});

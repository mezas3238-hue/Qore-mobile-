import test from 'node:test';
import assert from 'node:assert/strict';
import {createG68SenderCustodyStatusQa} from './g68-sender-custody-status-qa.mjs';
import {createG68SenderCustodyRepository} from './g68-sender-custody-repository.mjs';
const id=n=>'68000000-0000-4680-8680-'+String(n).padStart(12,'0');
const sender=id(1),session=id(2),delivery=id(3),courier=id(4),
 vehicle=id(5),proof=id(6),other=id(7);
const time=Date.parse('2026-10-24T18:00:00Z');
const bearer='synthetic-g42-passenger-bearer-verified-000000';
const route='/v1/staging/sender/deliveries/'+delivery+'/custody';
const auth={id:sender,sessionId:session,tokenIatMs:time-5000,
 expiresAtMs:time+60000,is_anonymous:false};
const row={deliveryId:delivery,senderId:sender,courierId:null,vehicleId:null,
 status:'requested',revision:1,vehicleKind:'MOTO',proofRef:null};
const get=()=>({method:'GET',path:route,headers:{authorization:'Bearer '+bearer}});
function fixture(extras={}){
 const calls={lookup:[],proof:[]};
 const opts={environment:'isolated_staging',localQaOnly:true,liveEnabled:false,
  now:()=>time,verifyAccessToken:async()=>auth,
  verifySessionNotRevoked:async()=>true,
  resolveExclusiveRole:async()=> 'passenger',allowRequest:()=>true,
  loadOwnDelivery:async args=>{calls.lookup.push(args);return row;},
  verifyStoredProof:async args=>{calls.proof.push(args);return true;},
  ...extras};
 return {read:createG68SenderCustodyStatusQa(opts),calls};
}
test('G68 exact sender-only requested DTO matches B R62 without courier/proof/media',async()=>{
 const x=fixture(),r=await x.read(get());
 assert.equal(r.status,200,JSON.stringify(r));
 assert.deepEqual(r.body,{mode:'STAGING_DEMO_ONLY',deliveryId:delivery,
  ownerId:sender,state:'requested',revision:1,vehicleKind:'MOTO',
  assignmentPersisted:false,proofVerified:false,
  qaOnly:true,productionEnabled:false,liveDeliveriesEnabled:false});
 assert.deepEqual(x.calls.lookup,[{actorId:sender,deliveryId:delivery}]);
 assert.equal(x.calls.proof.length,0);
 assert(!JSON.stringify(r).includes(bearer));
});
test('G68 server-only verified proof required for delivered, disputed and returned',async()=>{
 for(const state of ['delivered','disputed','returned']){
  const x=fixture({loadOwnDelivery:async()=>({...row,courierId:courier,
   vehicleId:vehicle,proofRef:proof,status:state,revision:7})});
  const r=await x.read(get());
  assert.equal(r.status,200,JSON.stringify({state,response:r}));
  assert.equal(r.body.proofVerified,true);
  assert.deepEqual(x.calls.proof,[{actorId:sender,courierId:courier,
   deliveryId:delivery,proofRef:proof}]);
  for(const k of ['courierId','proofRef','vehicleId','phone','gps','sha256']){
   assert(!Object.hasOwn(r.body,k),k);
  }
 }
 const unverified=fixture({loadOwnDelivery:async()=>({...row,courierId:courier,
  vehicleId:vehicle,proofRef:proof,status:'delivered',revision:4}),
  verifyStoredProof:async()=>false});
 assert.equal((await unverified.read(get())).status,503);
});
test('G68 role, JWT, revocation, query scope, malformed response and rate fail closed',async()=>{
 for(const extra of [
  {resolveExclusiveRole:async()=> 'driver'},
  {resolveExclusiveRole:async()=> ['passenger','driver']},
  {verifySessionNotRevoked:async()=>false},
  {verifyAccessToken:async()=>({...auth,id:other})},
  {verifyAccessToken:async()=>({...auth,expiresAtMs:time-1})},
  {verifyAccessToken:async()=>{throw Error('bad signature');}},
  {allowRequest:()=>false},
  {loadOwnDelivery:async()=>null},
  {loadOwnDelivery:async()=>({...row,senderId:other})},
  {loadOwnDelivery:async()=>({...row,phone:'fake'})},
  {loadOwnDelivery:async()=>({...row,status:'delivered',proofRef:proof})},
  {loadOwnDelivery:async()=>({...row,status:'picked_up',courierId:courier,
    vehicleId:vehicle,proofRef:proof})}
 ]){
  const x=fixture(extra);
  const r=await x.read(get());
  assert.notEqual(r.status,200,JSON.stringify(extra));
 }
 const x=fixture();
 for(const bad of [
  {...get(),method:'POST'},
  {...get(),body:{senderId:sender}},
  {...get(),headers:{authorization:'Bearer '+bearer,cookie:'a'}},
  {...get(),headers:{authorization:'Bearer forged'}},
  {...get(),path:'/v1/staging/courier/deliveries/'+delivery+'/custody'}
 ])assert.notEqual((await x.read(bad)).status,200);
 assert.equal(x.calls.lookup.length,0);
});
test('G68 repository applies BOTH id and sender_id SQL predicates before reading',async()=>{
 const query=[],columns=[];
 const mock={from(t){
  assert.equal(t,'mobility_stage_deliveries');
  const q={select(s){columns.push(s);return q;},
   eq(k,v){query.push([k,v]);return q;},
   async maybeSingle(){return {data:{id:delivery,sender_id:sender,
    courier_id:null,vehicle_id:null,status:'requested',revision:1,
    requested_vehicle_kind:'MOTO',proof_ref:null},error:null};}};
  return q;
 }};
 const repo=createG68SenderCustodyRepository(mock);
 assert.deepEqual(await repo.loadOwnDelivery({actorId:sender,deliveryId:delivery}),row);
 assert.deepEqual(query,[['id',delivery],['sender_id',sender]]);
 assert(!columns.join('').includes('phone'));
 assert(!columns.join('').includes('pickup_tag'));
 assert(!columns.join('').includes('delivery_tag'));
 await assert.rejects(()=>repo.loadOwnDelivery({actorId:other,deliveryId:'not-uuid'}));
});
test('G68 live, missing verified session / authority / DB never start',()=>{
 const common={environment:'isolated_staging',localQaOnly:true,liveEnabled:false,
  verifyAccessToken:async()=>auth,verifySessionNotRevoked:async()=>true,
  resolveExclusiveRole:async()=> 'passenger',allowRequest:()=>true,
  loadOwnDelivery:async()=>row,verifyStoredProof:async()=>true};
 for(const bad of [
  {environment:'production'},{localQaOnly:false},{liveEnabled:true},
  {verifyAccessToken:null},{verifySessionNotRevoked:null},
  {resolveExclusiveRole:null},{allowRequest:null},
  {loadOwnDelivery:null},{verifyStoredProof:null}
 ])assert.throws(()=>createG68SenderCustodyStatusQa({...common,...bad}));
});

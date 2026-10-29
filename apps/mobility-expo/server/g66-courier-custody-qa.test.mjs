import test from 'node:test';
import assert from 'node:assert/strict';
import {createG66CourierCustodyStatusQa} from './g66-courier-custody-status-qa.mjs';
import {createG66CourierCustodyTransitionQa} from './g66-courier-custody-transition-qa.mjs';
import {createG66CourierCustodyRepository} from './g66-courier-custody-repository.mjs';
const id=n=>'66660000-0000-4666-8666-'+String(n).padStart(12,'0');
const driver=id(1),session=id(2),delivery=id(3),vehicle=id(4),sender=id(5),
 proof=id(6),eventKey=id(7),receipt=id(8);
const at=Date.parse('2026-10-24T18:00:00Z');
const bearer='verified-qa-courier-bearer-token-000000000';
const route='/v1/staging/courier/deliveries/'+delivery;
const source={deliveryId:delivery,courierId:driver,vehicleId:vehicle,
 senderId:sender,status:'accepted',revision:2,vehicleKind:'MOTO',
 category:'PHARMACY_OTC',proofRef:null};
const auth={id:driver,sessionId:session,tokenIatMs:at-5000,
 expiresAtMs:at+60000,is_anonymous:false};
const get=()=>({method:'GET',path:route+'/custody',
 headers:{authorization:'Bearer '+bearer}});
const post=(event='pickup',body={event,eventKey})=>({
 method:'POST',path:route+'/custody-transition',
 headers:{authorization:'Bearer '+bearer},body
});
function fixture(extra={}){
 const calls={stored:[],verified:[],transition:[]};
 const common={environment:'isolated_staging',localQaOnly:true,liveEnabled:false,
  now:()=>at,verifyAccessToken:async()=>auth,
  verifySessionNotRevoked:async()=>true,
  resolveExclusiveRole:async()=> 'driver',
  allowRequest:()=>true,
  ...extra};
 const status=createG66CourierCustodyStatusQa({...common,
  loadAssignedDelivery:async p=>{calls.stored.push(p);return source;},
  verifyStoredProof:async p=>{calls.verified.push(p);return true;}
 });
 const transition=createG66CourierCustodyTransitionQa({...common,
  verifyIndependentProof:async p=>{calls.verified.push(p);return true;},
  transitionDelivery:async p=>{calls.transition.push(p);
   return {ok:true,liveEnabled:false,eventId:receipt};}
 });
 return {status,transition,calls};
}
test('G66 G42 Driver-scoped custody status contains no sender or GPS',async()=>{
 const f=fixture(),r=await f.status(get());
 assert.equal(r.status,200);
 assert.deepEqual(r.body,{mode:'STAGING_DEMO_ONLY',deliveryId:delivery,
  state:'accepted',revision:2,nextEvent:'pickup',
  assignmentPersisted:true,proofVerified:false,
  qaOnly:true,productionEnabled:false,liveDeliveriesEnabled:false,
  senderContactVisible:false,gpsVerified:false});
 assert.deepEqual(f.calls.stored,[{actorId:driver,deliveryId:delivery}]);
 assert(!JSON.stringify(r).includes(sender));
 assert(!JSON.stringify(r).includes(bearer));
});
test('G66 custody phases are precise and terminal proof must be independently verified',async()=>{
 for(const [status,next,pf] of [
  ['accepted','pickup',null],['picked_up','deliver',null],
  ['delivered',null,proof],['disputed','return',proof],
  ['returned',null,proof],['cancelled',null,null]
 ]){
  const f=fixture({loadAssignedDelivery:undefined});
  const gateway=createG66CourierCustodyStatusQa({
   environment:'isolated_staging',localQaOnly:true,liveEnabled:false,
   now:()=>at,verifyAccessToken:async()=>auth,
   verifySessionNotRevoked:async()=>true,resolveExclusiveRole:async()=> 'driver',
   allowRequest:()=>true,verifyStoredProof:async()=>true,
   loadAssignedDelivery:async()=>({...source,status,revision:5,proofRef:pf})
  });
  const r=await gateway(get());
  assert.equal(r.status,200,status);
  assert.equal(r.body.nextEvent,next);
  assert.equal(r.body.proofVerified,pf!==null);
 }
 const denied=createG66CourierCustodyStatusQa({
  environment:'isolated_staging',localQaOnly:true,liveEnabled:false,
  now:()=>at,verifyAccessToken:async()=>auth,
  verifySessionNotRevoked:async()=>true,resolveExclusiveRole:async()=> 'driver',
  allowRequest:()=>true,
  verifyStoredProof:async()=>false,
  loadAssignedDelivery:async()=>({...source,status:'delivered',revision:4,proofRef:proof})
 });
 assert.equal((await denied(get())).status,503);
});
test('G66 proof gate allows pickup without proof, deliver only with registry verification',async()=>{
 const x=fixture();
 assert.equal((await x.transition(post())).status,200);
 assert.equal(x.calls.verified.length,0);
 assert.deepEqual(x.calls.transition,[{actorId:driver,
  deliveryId:delivery,event:'pickup',eventKey}]);
 const delivered=await x.transition(post('deliver',{
  event:'deliver',eventKey,proofRef:proof
 }));
 assert.equal(delivered.status,200);
 assert.equal(delivered.body.serverPersisted,true);
 assert.equal(delivered.body.retrySafe,false);
 assert.deepEqual(x.calls.verified,[{actorId:driver,
  deliveryId:delivery,proofRef:proof,action:'deliver'}]);
 assert.deepEqual(x.calls.transition[1],{actorId:driver,
  deliveryId:delivery,event:'deliver',eventKey,proofRef:proof});
 const rejected=createG66CourierCustodyTransitionQa({
  environment:'isolated_staging',localQaOnly:true,liveEnabled:false,
  now:()=>at,verifyAccessToken:async()=>auth,
  verifySessionNotRevoked:async()=>true,resolveExclusiveRole:async()=> 'driver',
  allowRequest:()=>true,verifyIndependentProof:async()=>false,
  transitionDelivery:async()=>{throw Error('must not mutate');}
 });
 const r=await rejected(post('deliver',{event:'deliver',eventKey,proofRef:proof}));
 assert.equal(r.status,403);
 assert.equal(r.body.retrySafe,false);
});
test('G66 forged actor, missing proof, unauthorized role or stale JWT never reaches SQL',async()=>{
 const x=fixture();
 for(const request of [
  post('deliver',{event:'deliver',eventKey}),
  post('deliver',{event:'deliver',eventKey,proofRef:'bad'}),
  post('pickup',{event:'pickup',eventKey,actorId:driver}),
  post('pickup',{event:'pickup',eventKey,proofRef:proof}),
  post('complete',{event:'complete',eventKey}),
  {...post(),method:'GET'},
  {...post(),headers:{authorization:'Bearer bad'}},
  {...post(),headers:{authorization:'Bearer '+bearer,cookie:'some'}}
 ]){
  assert.notEqual((await x.transition(request)).status,200);
 }
 assert.equal(x.calls.transition.length,0);
 for(const extra of [
  {verifySessionNotRevoked:async()=>false},
  {resolveExclusiveRole:async()=> 'passenger'},
  {resolveExclusiveRole:async()=> ['driver','passenger']},
  {verifyAccessToken:async()=>{throw Error('JWT invalid')}},
  {allowRequest:()=>false}
 ]){
  const f=fixture(extra);
  assert.notEqual((await f.status(get())).status,200);
  assert.notEqual((await f.transition(post())).status,200);
  assert.equal(f.calls.transition.length,0);
 }
});
test('G66 SQL query uses exact assigned delivery AND courier, with minimal projection',async()=>{
 const preds=[],columns=[];
 const client={from(t){
  assert.equal(t,'mobility_stage_deliveries');
  const q={
   select(v){columns.push(v);return q;},
   eq(k,v){preds.push([k,v]);return q;},
   async maybeSingle(){return {error:null,data:{
    id:delivery,courier_id:driver,vehicle_id:vehicle,sender_id:sender,
    status:'accepted',revision:2,requested_vehicle_kind:'MOTO',
    category:'DOCUMENTS',proof_ref:null
   }};}
  };return q;
 }};
 const repo=createG66CourierCustodyRepository(client);
 assert.deepEqual(await repo.loadAssignedDelivery({
  actorId:driver,deliveryId:delivery}),{
   ...source,category:'DOCUMENTS'
  });
 assert.deepEqual(preds,[['id',delivery],['courier_id',driver]]);
 assert(!columns.join(' ').includes('pickup_tag'));
 assert(!columns.join(' ').includes('delivery_tag'));
 await assert.rejects(()=>repo.loadAssignedDelivery({actorId:sender,deliveryId:'bad'}));
});
test('G66 default live or without proof verifier and session authority refuses startup',()=>{
 for(const bad of [
  {environment:'production'},{liveEnabled:true},{localQaOnly:false},
  {verifyAccessToken:null},{verifySessionNotRevoked:null},
  {resolveExclusiveRole:null},{loadAssignedDelivery:null},
  {verifyIndependentProof:null},{verifyStoredProof:null}
 ]){
  if(bad.verifyIndependentProof===null){
   assert.throws(()=>createG66CourierCustodyTransitionQa({
    environment:'isolated_staging',localQaOnly:true,liveEnabled:false,
    now:()=>at,verifyAccessToken:async()=>auth,
    verifySessionNotRevoked:async()=>true,
    resolveExclusiveRole:async()=> 'driver',allowRequest:()=>true,
    transitionDelivery:async()=>{},...bad
   }));continue;
  }
  if(bad.verifyStoredProof===null){
   assert.throws(()=>createG66CourierCustodyStatusQa({
    environment:'isolated_staging',localQaOnly:true,liveEnabled:false,
    now:()=>at,verifyAccessToken:async()=>auth,
    verifySessionNotRevoked:async()=>true,
    resolveExclusiveRole:async()=> 'driver',allowRequest:()=>true,
    loadAssignedDelivery:async()=>{},...bad
   }));continue;
  }
  assert.throws(()=>createG66CourierCustodyStatusQa({
   environment:'isolated_staging',localQaOnly:true,liveEnabled:false,
   now:()=>at,verifyAccessToken:async()=>auth,
   verifySessionNotRevoked:async()=>true,
   resolveExclusiveRole:async()=> 'driver',allowRequest:()=>true,
   loadAssignedDelivery:async()=>{},verifyStoredProof:async()=>true,...bad
  }));
 }
});

test('G185 courier custody SQL read never discloses state after session revocation or expiry',async()=>{
 for(const mode of ['revoked','expired','outage']){
  let checks=0,reads=0,clock=at;
  const instance=createG66CourierCustodyStatusQa({
   environment:'isolated_staging',localQaOnly:true,liveEnabled:false,
   now:()=>clock,
   verifyAccessToken:async()=>({...auth,expiresAtMs:at+2000}),
   verifySessionNotRevoked:async()=>{
    checks++;
    if(checks===2&&mode==='revoked')return false;
    if(checks===2&&mode==='outage')throw Error('IdP unavailable');
    return true;
   },resolveExclusiveRole:async()=> 'driver',allowRequest:()=>true,
   loadAssignedDelivery:async()=>{reads++;if(mode==='expired')clock=at+3000;
    return source;},verifyStoredProof:async()=>true
  });
  const result=await instance(get());
  assert.equal(result.status,mode==='outage'?503:401);
  assert.equal(result.body.code,mode==='revoked'? 'G185_COURIER_SESSION_REVOKED':
   mode==='expired'?'G185_COURIER_SESSION_EXPIRED':
   'G185_COURIER_REVOCATION_UNAVAILABLE');
  assert.equal(reads,1,'original assigned SQL row has been read');
  assert.equal(checks,mode==='expired'?1:2);
  assert(!JSON.stringify(result).includes(delivery));
  assert(!JSON.stringify(result).includes(sender));
 }
});
test('G185 after committed custody event, revoked/expired/outage never acknowledges success or retries',async()=>{
 for(const mode of ['revoked','expired','outage','success']){
  let checks=0,commits=0,clock=at;
  const instance=createG66CourierCustodyTransitionQa({
   environment:'isolated_staging',localQaOnly:true,liveEnabled:false,
   now:()=>clock,
   verifyAccessToken:async()=>({...auth,expiresAtMs:at+2000}),
   verifySessionNotRevoked:async()=>{
    checks++;
    if(checks===2&&mode==='revoked')return false;
    if(checks===2&&mode==='outage')throw Error('IdP disconnected');
    return true;
   },resolveExclusiveRole:async()=> 'driver',allowRequest:()=>true,
   verifyIndependentProof:async()=>true,
   transitionDelivery:async ({deliveryId,event,eventKey:ek})=>{
    commits++;
    assert.equal(deliveryId,delivery);
    assert.equal(event,'deliver');
    assert.equal(ek,eventKey);
    if(mode==='expired')clock=at+3000;
    return {ok:true,liveEnabled:false,eventId:receipt};
   }
  });
  const result=await instance(post('deliver',{event:'deliver',eventKey,proofRef:proof}));
  assert.equal(commits,1,'G5 SQL authority executes at most once per request');
  if(mode==='success'){
   assert.equal(result.status,200);
   assert.equal(result.body.eventId,receipt);
   assert.equal(checks,2);
  }else{
   assert.equal(result.status,503,'post-SQL uncertainty is not a definitive rejection');
   assert.equal(result.body.code,'G185_CUSTODY_OUTCOME_UNKNOWN');
   assert.equal(result.body.retrySafe,false);
   assert.equal(checks,mode==='expired'?1:2);
   assert(!JSON.stringify(result).includes(receipt));
  }
 }
});

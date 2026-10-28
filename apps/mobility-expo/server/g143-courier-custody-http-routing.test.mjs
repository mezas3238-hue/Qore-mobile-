/** G143: real G66 server controllers reachable from the Driver's exact
 * HTTP paths; independent session, role, persistence and proof are mandatory.
 * The synthetic fixture NEVER certifies legal delivery or production.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
 createQoreRadarLoopbackTransport,listenQoreRadarLoopback
} from './g4-loopback-http-transport.mjs';
import {createG66CourierCustodyStatusQa} from './g66-courier-custody-status-qa.mjs';
import {createG66CourierCustodyTransitionQa} from './g66-courier-custody-transition-qa.mjs';
const actor='11111111-1111-4111-8111-111111111111';
const stranger='22222222-2222-4222-8222-222222222222';
const sender='33333333-3333-4333-8333-333333333333';
const delivery='44444444-4444-4444-8444-444444444444';
const vehicle='55555555-5555-4555-8555-555555555555';
const session='66666666-6666-4666-8666-666666666666';
const eventKey='77777777-7777-4777-8777-777777777777';
const proof='88888888-8888-4888-8888-888888888888';
const at=1800000000000;
const bearer='a'.repeat(40);
const noop=async()=>({status:404,body:{error:'Not found'}});
function makeServer(custody){
 return createQoreRadarLoopbackTransport({
  riderHandler:noop,offerHandler:noop,tripCommandHandler:noop,
  deliveryHandler:noop,merchantHandler:noop,financeHandler:noop,
  safetyHandler:noop,merchantManagementHandler:noop,deliveryOfferHandler:noop,
  ...(custody?{courierCustodyHandler:custody}:{})
 });
}
const close=server=>new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
async function http(base,path,{method='GET',token=bearer,body}={}){
 const res=await fetch(base+path,{method,headers:{
  ...(token?{authorization:'Bearer '+token}:{}),
  ...(body?{'content-type':'application/json'}:{})
 },...(body?{body:JSON.stringify(body)}:{})});
 return {status:res.status,body:await res.json()};
}
test('G143 Driver G66 paths fail closed without configured authorities',async t=>{
 const server=makeServer(),origin=await listenQoreRadarLoopback(server);
 t.after(()=>close(server));
 const path='/v1/staging/courier/deliveries/'+delivery;
 assert.equal((await http(origin,path+'/custody')).status,503);
 assert.equal((await http(origin,path+'/custody-transition',{
  method:'POST',body:{event:'pickup',eventKey}
 })).status,503);
 assert.equal((await http(origin,path+'/accept',{
  method:'POST',body:{vehicleId:vehicle,requestKey:eventKey}
 })).status,404,'direct G5 acceptance must never bypass private G10 offer');
 assert.equal((await http(origin,path+'/custody',{
  method:'POST',body:{event:'pickup',eventKey}
 })).status,404);
});
test('G143 G66 HTTP routes enforce identity, single Driver role and immutable assignment',async t=>{
 let owner=actor,revoked=false,allowedRole='driver',verifiedProof=false;
 const claims=()=>({id:owner,sessionId:session,tokenIatMs:at-1000,
  expiresAtMs:at+10000,is_anonymous:false});
 const shared={environment:'isolated_staging',localQaOnly:true,
  liveEnabled:false,now:()=>at,verifyAccessToken:async token=>{
   if(token!==bearer)throw Error('Invalid provider');
   return claims();
  },verifySessionNotRevoked:async()=>!revoked,
  resolveExclusiveRole:async()=>allowedRole,allowRequest:()=>true};
 const read=createG66CourierCustodyStatusQa({...shared,
  loadAssignedDelivery:async()=>({deliveryId:delivery,courierId:actor,
   senderId:sender,vehicleId:vehicle,status:'accepted',revision:2,
   vehicleKind:'MOTO',category:'PARCEL',proofRef:null}),
  verifyStoredProof:async()=>verifiedProof
 });
 const write=createG66CourierCustodyTransitionQa({...shared,
  verifyIndependentProof:async()=>verifiedProof,
  transitionDelivery:async()=>({ok:true,liveEnabled:false,eventId:eventKey})
 });
 const server=makeServer(input=>input.method==='GET'?read(input):write(input));
 const origin=await listenQoreRadarLoopback(server);
 t.after(()=>close(server));
 const path='/v1/staging/courier/deliveries/'+delivery;
 assert.equal((await http(origin,path+'/custody',{token:null})).status,401);
 assert.equal((await http(origin,path+'/custody',{token:'b'.repeat(40)})).status,401);
 owner=stranger;
 assert.equal((await http(origin,path+'/custody')).status,404,
  'foreign Driver cannot read another courier assignment');
 owner=actor;allowedRole='passenger';
 assert.equal((await http(origin,path+'/custody')).status,403);
 allowedRole='driver';revoked=true;
 assert.equal((await http(origin,path+'/custody')).status,401);
 revoked=false;
 const current=await http(origin,path+'/custody');
 assert.equal(current.status,200);
 assert.equal(current.body.assignmentPersisted,true);
 assert.equal(current.body.state,'accepted');
 assert.equal(current.body.senderContactVisible,false);
 assert.equal((await http(origin,path+'/custody-transition',{
  method:'POST',body:{event:'deliver',eventKey,proofRef:proof}
 })).status,403,'unverified delivery proof never completes custody');
 const picked=await http(origin,path+'/custody-transition',{
  method:'POST',body:{event:'pickup',eventKey}});
 assert.equal(picked.status,200);
 assert.equal(picked.body.event,'pickup');
 assert.equal(picked.body.liveDeliveriesEnabled,false);
});

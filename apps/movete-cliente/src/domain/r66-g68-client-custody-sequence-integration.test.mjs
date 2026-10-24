import test from 'node:test';
import assert from 'node:assert/strict';
import {createClientExperience} from './client-experience.mjs';

const T=1800000000000;
const id=n=>'66110000-0000-4661-8661-'+String(n).padStart(12,'0');
const owner=id(1),delivery=id(2),foreign=id(3);
const token='synthetic-passenger-g68-token-abcdefghijk';
const history=()=>({ownerId:owner,generatedAt:T-1000,expiresAt:T+15000,
 nextCursor:null,items:[{serviceId:delivery,kind:'DELIVERY',
  status:'in_progress',createdAt:T-3000,revision:2}]});
const dto=(state,revision)=>({
 mode:'STAGING_DEMO_ONLY',deliveryId:delivery,ownerId:owner,
 state,revision,vehicleKind:'AUTO',
 assignmentPersisted:state!=='requested',
 proofVerified:['delivered','disputed','returned'].includes(state),
 qaOnly:true,productionEnabled:false,liveDeliveriesEnabled:false
});
const reply=payload=>({ok:true,status:200,redirected:false,
 headers:{get:k=>k==='content-type'?'application/json':null},
 text:async()=>JSON.stringify(payload)});
function fixture(){
 let user=owner,answer=dto('requested',1),code=null,hits=0;
 const app=createClientExperience({
  now:()=>T,
  authProvider:{readSession:async()=>({subject:user,role:'passenger',
   token,expiresAt:T+90000}),signOut:async()=>{}},
  senderCustodyHttpOptions:{enabled:true,contractCertified:true,
   stagingRuntimeVerified:true,g68SenderContractCertified:true,
   origin:'https://staging.example.invalid',pinnedOrigin:'https://staging.example.invalid',
   fetchImpl:async(u,req)=>{
    hits++;
    if(code)return {ok:false,status:code,redirected:false};
    assert.equal(req.method,'GET');
    assert(u.endsWith('/sender/deliveries/'+delivery+'/custody'));
    return reply(answer);
   }}
 });
 return {app,put:(s,rev)=>answer=dto(s,rev),fail:status=>code=status,
  ok:()=>code=null,user:x=>user=x,hits:()=>hits};
}
test('R66 Passenger can follow full G5 server custody sequence with one account and one delivery',async()=>{
 const f=fixture();await f.app.refreshSession();
 assert.equal(f.app.acceptHistory(history()),true);
 const steps=['requested','accepted','picked_up','delivered','disputed','returned'];
 for(let i=0;i<steps.length;i++){
  f.put(steps[i],i+1);
  assert.equal((await f.app.readOwnDeliveryCustody(delivery)).ok,true);
  const actual=f.app.snapshot().senderCustody;
  assert.equal(actual.deliveryId,delivery);
  assert.equal(actual.state,steps[i]);
  assert.equal(actual.revision,i+1);
  assert.equal(actual.proofVerified,i>=3);
 }
 assert.equal(f.hits(),6);
});
test('R66 QA HTTP 503 clears visible delivered but cannot reset monotonic floor',async()=>{
 const f=fixture();await f.app.refreshSession();f.app.acceptHistory(history());
 f.put('delivered',10);
 assert.equal((await f.app.readOwnDeliveryCustody(delivery)).ok,true);
 f.fail(503);
 assert.equal((await f.app.readOwnDeliveryCustody(delivery)).code,'SENDER_CUSTODY_UNVERIFIED');
 assert.equal(f.app.snapshot().senderCustody.state,null);
 f.ok();f.put('picked_up',8);
 assert.equal((await f.app.readOwnDeliveryCustody(delivery)).code,'SENDER_CUSTODY_STATE_CONFLICT');
 assert.equal(f.app.snapshot().senderCustody.proofVerified,false);
});
test('R66 impossible same-revision status change cannot be displayed',async()=>{
 const f=fixture();await f.app.refreshSession();f.app.acceptHistory(history());
 f.put('accepted',6);await f.app.readOwnDeliveryCustody(delivery);
 f.put('picked_up',6);
 assert.equal((await f.app.readOwnDeliveryCustody(delivery)).code,'SENDER_CUSTODY_STATE_CONFLICT');
 assert.equal(f.app.snapshot().senderCustody.state,null);
});
test('R66 switching account revokes old proof before any foreign GET',async()=>{
 const f=fixture();await f.app.refreshSession();f.app.acceptHistory(history());
 f.put('delivered',6);await f.app.readOwnDeliveryCustody(delivery);
 const previous=f.hits();
 f.user(foreign);await f.app.refreshSession();
 assert.equal(f.app.snapshot().senderCustody.state,null);
 assert.equal((await f.app.readOwnDeliveryCustody(delivery)).code,
  'SENDER_DELIVERY_NOT_IN_OWN_HISTORY');
 assert.equal(f.hits(),previous);
});
test('R66 cancelled cannot turn into delivered even at a larger server revision',async()=>{
 const f=fixture();await f.app.refreshSession();f.app.acceptHistory(history());
 f.put('accepted',3);await f.app.readOwnDeliveryCustody(delivery);
 f.put('cancelled',4);assert.equal((await f.app.readOwnDeliveryCustody(delivery)).ok,true);
 f.put('delivered',10);
 assert.equal((await f.app.readOwnDeliveryCustody(delivery)).code,'SENDER_CUSTODY_STATE_CONFLICT');
 assert.equal(f.app.snapshot().senderCustody.proofVerified,false);
});

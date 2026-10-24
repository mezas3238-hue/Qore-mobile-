import test from 'node:test';
import assert from 'node:assert/strict';
import {createSenderCustodyFlow} from './sender-custody-flow.mjs';
const now=1800000000000;
const id=n=>'66662000-0000-4666-8666-'+String(n).padStart(12,'0');
const owner=id(1),delivery=id(5);
let actor=()=>({role:'passenger',subject:owner,sessionRevision:7,
 token:'synthetic-passenger-jwt-1234567890',expiresAt:now+60000});
const record=(state='accepted',revision=2,rest={})=>({
 mode:'STAGING_DEMO_ONLY',deliveryId:delivery,ownerId:owner,
 state,revision,vehicleKind:'MOTO',assignmentPersisted:state!=='requested',
 proofVerified:['delivered','returned'].includes(state),
 qaOnly:true,productionEnabled:false,liveDeliveriesEnabled:false,...rest
});
const response=data=>({ok:true,status:200,data});
const options=()=>({enabled:true,contractCertified:true,stagingRuntimeVerified:true,
 getSession:async()=>actor(),readOwnDelivery:async()=>response(record()),
 now:()=>now});
const fetch=(flow,who=owner,key=delivery,revision=7)=>flow.refresh(key,who,revision);
test('R62 default OFF never opens Driver-only courier endpoint',async()=>{
 let reads=0;
 const x=createSenderCustodyFlow({readOwnDelivery:async()=>{reads++;}});
 assert.equal(x.isConfigured(),false);
 assert.equal((await fetch(x)).code,'SENDER_CUSTODY_NOT_CERTIFIED');
 assert.equal(x.snapshot().readReady,false);
 assert.equal(reads,0);
});
test('R62 all three gates and callback independently required',async()=>{
 let reads=0;
 for(const field of ['enabled','contractCertified','stagingRuntimeVerified']){
  const x=createSenderCustodyFlow({...options(),[field]:false,
   readOwnDelivery:async()=>{reads++;}});
  assert.equal(x.isConfigured(),false);
  assert.equal((await fetch(x)).ok,false);
 }
 const x=createSenderCustodyFlow({...options(),readOwnDelivery:null});
 assert.equal(x.isConfigured(),false);assert.equal(reads,0);
});
test('R62 sender read returns redacted QA custody after independent authorization',async()=>{
 let scope;
 const x=createSenderCustodyFlow({...options(),
  readOwnDelivery:async s=>{scope=s;return response(record());}});
 assert.equal((await fetch(x)).ok,true);
 assert.deepEqual(Object.keys(scope).sort(),
  ['deliveryId','ownerId','sessionRevision','bearer'].sort());
 assert.equal(scope.bearer,actor().token);assert.equal(scope.ownerId,owner);
 const value=x.snapshot();
 assert.equal(value.deliveryId,delivery);
 assert.equal(value.state,'accepted');
 assert.equal(value.proofVerified,false);
 assert.equal(value.productionEnabled,false);
 assert.equal(value.qaOnly,true);
 assert.equal(JSON.stringify(value).includes(scope.bearer),false);
});
test('R62 G66 requested accepted pickup delivered require proof progression',async()=>{
 let state='requested',revision=1;
 const x=createSenderCustodyFlow({...options(),
  readOwnDelivery:async()=>response(record(state,revision))});
 for(const next of ['requested','accepted','picked_up','delivered']){
  state=next;revision++;
  assert.equal((await fetch(x)).ok,true,next);
  assert.equal(x.snapshot().state,next);
  assert.equal(x.snapshot().proofVerified,next==='delivered');
 }
 assert.equal(x.snapshot().revision,revision);
});
test('R62 delivered without independent verified proof is NEVER confirmed',async()=>{
 const x=createSenderCustodyFlow({...options(),
  readOwnDelivery:async()=>response(record('delivered',5,{proofVerified:false}))});
 assert.equal((await fetch(x)).code,'SENDER_CUSTODY_UNVERIFIED');
 assert.equal(x.snapshot().state,null);
 assert.equal(x.snapshot().proofVerified,false);
});
test('R62 terminal returned requires independent proof and cancellation hides proof',async()=>{
 const good=createSenderCustodyFlow({...options(),
  readOwnDelivery:async()=>response(record('returned',8))});
 assert.equal((await fetch(good)).ok,true);
 assert.equal(good.snapshot().proofVerified,true);
 const bad=createSenderCustodyFlow({...options(),
  readOwnDelivery:async()=>response(record('returned',8,{proofVerified:false}))});
 assert.equal((await fetch(bad)).ok,false);
 const cancelled=createSenderCustodyFlow({...options(),
  readOwnDelivery:async()=>response(record('cancelled',3,{proofVerified:false}))});
 assert.equal((await fetch(cancelled)).ok,true);
 assert.equal(cancelled.snapshot().proofVerified,false);
});
test('R62 cross-user, different delivery, extra PII, false LIVE are rejected',async()=>{
 for(const patch of [
  {ownerId:id(9)},{deliveryId:id(9)},{senderPhone:'0981123456'},
  {senderAddress:'PRIVATE_ZONE'}, {proofRef:id(33)},
  {mode:'PRODUCTION'}, {productionEnabled:true},
  {liveDeliveriesEnabled:true},{qaOnly:false},{vehicleKind:'MOTO_PASSENGER'},
  {revision:0},{state:'unsupported'}, {assignmentPersisted:false},
  {proofVerified:true}
 ]){
  const x=createSenderCustodyFlow({...options(),
   readOwnDelivery:async()=>response(record('accepted',2,patch))});
  assert.equal((await fetch(x)).code,'SENDER_CUSTODY_UNVERIFIED',
   JSON.stringify(patch));
  assert.equal(x.snapshot().state,null);
 }
});
test('R62 no cross-tenant session reaches the sender read callback',async()=>{
 let calls=0;
 const x=createSenderCustodyFlow({...options(),getSession:async()=>({
  ...actor(),role:'driver'}),readOwnDelivery:async()=>{calls++;}});
 assert.equal((await fetch(x)).code,'SENDER_CUSTODY_SESSION_CHANGED');
 assert.equal(calls,0);
 const other=createSenderCustodyFlow({...options(),getSession:async()=>({
  ...actor(),subject:id(9)}),readOwnDelivery:async()=>{calls++;}});
 assert.equal((await fetch(other)).ok,false);
 assert.equal(calls,0);
});
test('R62 logout or token rotation during read cannot resurrect custody',async()=>{
 let release;const pending=new Promise(resolve=>release=resolve);
 let identity=actor();
 const x=createSenderCustodyFlow({...options(),
  getSession:async()=>identity,readOwnDelivery:async()=>pending});
 const read=fetch(x);await Promise.resolve();await Promise.resolve();
 identity={...identity,token:'synthetic-jwt-rotated-token-abcdefghi'};
 release(response(record('delivered',7)));
 assert.equal((await read).code,'SENDER_CUSTODY_SESSION_CHANGED');
 assert.equal(x.snapshot().state,null);
});
test('R62 clear during an outstanding read discards late server proof',async()=>{
 let release;const pending=new Promise(resolve=>release=resolve);
 const x=createSenderCustodyFlow({...options(),readOwnDelivery:async()=>pending});
 const read=fetch(x);await Promise.resolve();await Promise.resolve();
 x.clear();release(response(record('delivered',7)));
 assert.equal((await read).code,'STALE_CUSTODY_RESPONSE');
 assert.equal(x.snapshot().deliveryId,null);
});
test('R62 concurrent GET never emits duplicate reads',async()=>{
 let calls=0,release;const pending=new Promise(resolve=>release=resolve);
 const x=createSenderCustodyFlow({...options(),
  readOwnDelivery:async()=>{calls++;return pending;}});
 const first=fetch(x);
 assert.equal((await fetch(x)).code,'SENDER_CUSTODY_READ_IN_FLIGHT');
 await Promise.resolve();await Promise.resolve();
 release(response(record()));
 assert.equal((await first).ok,true);assert.equal(calls,1);
});
test('R62 older server revision revokes prior status instead of claiming fresh delivered',async()=>{
 let count=0;
 const x=createSenderCustodyFlow({...options(),
  readOwnDelivery:async()=>response(count++===0
   ?record('delivered',9):record('picked_up',8))});
 assert.equal((await fetch(x)).ok,true);
 assert.equal(x.snapshot().state,'delivered');
 assert.equal((await fetch(x)).code,'SENDER_CUSTODY_STALE_REVISION');
 assert.equal(x.snapshot().state,null);
 assert.equal(x.snapshot().proofVerified,false);
});
test('R62 server uncertainty clears previous proof and never prints raw error',async()=>{
 let count=0;
 const x=createSenderCustodyFlow({...options(),
  readOwnDelivery:async()=>count++===0?response(record('delivered',9))
   :{ok:false,code:'PRIVATE_PHONE_0981234567',status:503}});
 assert.equal((await fetch(x)).ok,true);
 assert.equal((await fetch(x)).code,'SENDER_CUSTODY_UNVERIFIED');
 assert.equal(x.snapshot().state,null);
 assert.equal(JSON.stringify(x.snapshot()).includes('PRIVATE_PHONE'),false);
});

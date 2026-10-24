import test from 'node:test';
import assert from 'node:assert/strict';
import {createSenderCustodyFlow} from './sender-custody-flow.mjs';

const T=1800000000000;
const id=n=>'66000000-0000-4660-8660-'+String(n).padStart(12,'0');
const subject=id(1),delivery=id(2),otherDelivery=id(3);
const actor=()=>({subject,role:'passenger',
 token:'synthetic-passenger-jwt-12345678901234',
 sessionRevision:5,expiresAt:T+90000});
const status=(state,revision=1,patch={})=>({
 mode:'STAGING_DEMO_ONLY',deliveryId:delivery,ownerId:subject,
 state,revision,vehicleKind:'AUTO',
 assignmentPersisted:state!=='requested',
 proofVerified:['delivered','disputed','returned'].includes(state),
 qaOnly:true,productionEnabled:false,liveDeliveriesEnabled:false,...patch
});
const response=data=>({ok:true,status:200,data});
function setup(readOwnDelivery){
 const flow=createSenderCustodyFlow({enabled:true,contractCertified:true,
  stagingRuntimeVerified:true,readOwnDelivery,
  getSession:async()=>actor(),now:()=>T});
 return {flow,read:()=>flow.refresh(delivery,subject,5)};
}
test('R66 G5 exact requested→accepted→picked_up→delivered→disputed→returned accepted',async()=>{
 const seq=['requested','accepted','picked_up','delivered','disputed','returned'];
 let step=0;
 const f=setup(async()=>response(status(seq[step],step+1)));
 for(let i=0;i<seq.length;i++){
  step=i;assert.equal((await f.read()).ok,true,seq[i]);
  assert.equal(f.flow.snapshot().state,seq[i]);
  assert.equal(f.flow.snapshot().revision,i+1);
  assert.equal(f.flow.snapshot().proofVerified,i>=3);
 }
});
test('R66 offline skipped transitions accepted only with sufficient server revision delta',async()=>{
 let current=status('requested',1);
 const f=setup(async()=>response(current));
 assert.equal((await f.read()).ok,true);
 current=status('delivered',4);
 assert.equal((await f.read()).ok,true);
 current=status('returned',6);
 assert.equal((await f.read()).ok,true);
});
test('R66 impossible skipped transitions with too-small revision are rejected',async()=>{
 let current=status('requested',1);
 const f=setup(async()=>response(current));
 await f.read();
 current=status('delivered',2);
 assert.equal((await f.read()).code,'SENDER_CUSTODY_STATE_CONFLICT');
 assert.equal(f.flow.snapshot().state,null);
 assert.equal(f.flow.snapshot().proofVerified,false);
});
test('R66 same revision cannot report two different states',async()=>{
 let current=status('accepted',7);
 const f=setup(async()=>response(current));
 await f.read();
 current=status('picked_up',7);
 assert.equal((await f.read()).code,'SENDER_CUSTODY_STATE_CONFLICT');
 assert.equal(f.flow.snapshot().state,null);
});
test('R66 accepted state at equal revision is safe to re-read',async()=>{
 let reads=0;
 const f=setup(async()=>{reads++;return response(status('accepted',7));});
 assert.equal((await f.read()).ok,true);
 assert.equal((await f.read()).ok,true);
 assert.equal(reads,2);
 assert.equal(f.flow.snapshot().state,'accepted');
});
test('R66 transient HTTP failure erases evidence but retains server monotonic floor',async()=>{
 let index=0;
 const f=setup(async()=>{
  index++;
  if(index===1)return response(status('delivered',8));
  if(index===2)return {ok:false,status:503,code:'INTERNAL_PII_098111111'};
  return response(status('picked_up',7));
 });
 assert.equal((await f.read()).ok,true);
 assert.equal((await f.read()).code,'SENDER_CUSTODY_UNVERIFIED');
 assert.equal(f.flow.snapshot().state,null);
 assert.equal((await f.read()).code,'SENDER_CUSTODY_STATE_CONFLICT');
 assert.equal(f.flow.snapshot().proofVerified,false);
 assert.equal(JSON.stringify(f.flow.snapshot()).includes('098111111'),false);
});
test('R66 terminal delivered cannot resurrect an accepted or requested status',async()=>{
 for(const rollback of ['requested','accepted','picked_up']){
  let payload=status('delivered',8);
  const f=setup(async()=>response(payload));
  await f.read();
  payload=status(rollback,13);
  assert.equal((await f.read()).code,'SENDER_CUSTODY_STATE_CONFLICT',rollback);
  assert.equal(f.flow.snapshot().state,null);
 }
});
test('R66 disputed cannot return to delivered even with a higher revision',async()=>{
 let payload=status('disputed',7);
 const f=setup(async()=>response(payload));
 await f.read();
 payload=status('delivered',12);
 assert.equal((await f.read()).code,'SENDER_CUSTODY_STATE_CONFLICT');
});
test('R66 cancelled delivery cannot reopen or claim proof verified',async()=>{
 let payload=status('cancelled',6);
 const f=setup(async()=>response(payload));
 assert.equal((await f.read()).ok,true);
 payload=status('delivered',9);
 assert.equal((await f.read()).code,'SENDER_CUSTODY_STATE_CONFLICT');
});
test('R66 G5 cancellation from requested and accepted is accepted only once',async()=>{
 for(const before of ['requested','accepted']){
  let state=status(before,1);
  const f=setup(async()=>response(state));
  assert.equal((await f.read()).ok,true);
  state=status('cancelled',2,{assignmentPersisted:before==='accepted'});
  assert.equal((await f.read()).ok,true);
  assert.equal(f.flow.snapshot().state,'cancelled');
 }
});
test('R66 different vehicle kind with same delivery is a rejected server conflict',async()=>{
 let payload=status('accepted',3);
 const f=setup(async()=>response(payload));
 await f.read();
 payload=status('picked_up',4,{vehicleKind:'MOTO'});
 assert.equal((await f.read()).code,'SENDER_CUSTODY_STATE_CONFLICT');
});
test('R66 clear on logout resets prior delivery floor and rejects stale old GET',async()=>{
 let release;
 const waiting=new Promise(resolve=>release=resolve);
 let calls=0;
 const f=setup(async()=>{
  calls++;
  return calls===1?response(status('returned',10)):waiting;
 });
 assert.equal((await f.read()).ok,true);
 const pending=f.read();
 await Promise.resolve();await Promise.resolve();
 f.flow.clear();
 release(response(status('accepted',2)));
 assert.equal((await pending).code,'STALE_CUSTODY_RESPONSE');
 assert.equal(f.flow.snapshot().deliveryId,null);
 assert.equal(f.flow.snapshot().proofVerified,false);
});
test('R66 different delivery after session-authorized read never displays previous proof',async()=>{
 let current=status('delivered',5);
 const f=setup(async()=>response(current));
 assert.equal((await f.read()).ok,true);
 current=status('requested',1,{deliveryId:otherDelivery});
 assert.equal((await f.flow.refresh(otherDelivery,subject,5)).ok,true);
 assert.equal(f.flow.snapshot().deliveryId,otherDelivery);
 assert.equal(f.flow.snapshot().proofVerified,false);
});
test('R66 G68 disputed without database-verified proof is forbidden',async()=>{
 const f=setup(async()=>response(status('disputed',5,{proofVerified:false})));
 assert.equal((await f.read()).code,'SENDER_CUSTODY_UNVERIFIED');
 assert.equal(f.flow.snapshot().state,null);
});

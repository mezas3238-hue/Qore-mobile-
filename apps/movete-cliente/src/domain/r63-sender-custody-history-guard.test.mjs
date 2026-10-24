import test from 'node:test';
import assert from 'node:assert/strict';
import {createClientExperience} from './client-experience.mjs';

const id=n=>'76662000-0000-4666-8666-'+String(n).padStart(12,'0');
const owner=id(1),other=id(2),delivery=id(3),second=id(4);
const start=1800000000000;
const dto=(serviceId=delivery,revision=7)=>({
 mode:'STAGING_DEMO_ONLY',deliveryId:serviceId,ownerId:owner,
 state:'delivered',revision,vehicleKind:'MOTO',assignmentPersisted:true,
 proofVerified:true,qaOnly:true,productionEnabled:false,liveDeliveriesEnabled:false
});
const reply=(serviceId=delivery)=>({ok:true,status:200,data:dto(serviceId)});
const page=(clock,entries=[delivery],revisions={})=>({
 ownerId:owner,generatedAt:clock-100,expiresAt:clock+5000,nextCursor:null,
 items:entries.map(serviceId=>({serviceId,kind:'DELIVERY',
  status:'in_progress',createdAt:clock-1000,revision:revisions[serviceId]??2}))
});
function fixture({readOwnDelivery=async()=>reply()}={}){
 let clock=start,subject=owner,token='synthetic-passenger-jwt-1234567890';
 const api=createClientExperience({
  now:()=>clock,
  authProvider:{readSession:async()=>({role:'passenger',subject,token,expiresAt:start+120000}),
   signOut:async()=>{}},
  senderCustodyOptions:{enabled:true,contractCertified:true,
   stagingRuntimeVerified:true,readOwnDelivery}
 });
 return {api,now:()=>clock,advance:ms=>clock+=ms,
  setSubject:s=>subject=s,setToken:t=>token=t};
}
async function authenticated(f,entries=[delivery]){
 assert.equal((await f.api.refreshSession()).ok,true);
 assert.equal(f.api.acceptHistory(page(f.now(),entries)),true);
}
test('R63 delivery proof is suppressed once the history TTL expires',async()=>{
 const f=fixture();await authenticated(f);
 assert.equal((await f.api.readOwnDeliveryCustody(delivery)).ok,true);
 assert.equal(f.api.snapshot().senderCustody.proofVerified,true);
 f.advance(5001);
 const snap=f.api.snapshot();
 assert.equal(snap.history,null);
 assert.equal(snap.senderCustody.deliveryId,null);
 assert.equal(snap.senderCustody.state,null);
 assert.equal(snap.senderCustody.proofVerified,false);
 assert.equal((await f.api.readOwnDeliveryCustody(delivery)).code,
  'SENDER_DELIVERY_NOT_IN_OWN_HISTORY');
});
test('R63 refreshed history replacing the delivery revokes previous proof',async()=>{
 const f=fixture();await authenticated(f);
 await f.api.readOwnDeliveryCustody(delivery);
 assert.equal(f.api.snapshot().senderCustody.state,'delivered');
 assert.equal(f.api.acceptHistory(page(f.now(),[second])),true);
 assert.equal(f.api.snapshot().senderCustody.state,null);
 assert.equal((await f.api.readOwnDeliveryCustody(delivery)).code,
  'SENDER_DELIVERY_NOT_IN_OWN_HISTORY');
});
test('R63 refreshed history at newer service revision cannot reuse old proof',async()=>{
 const f=fixture();await authenticated(f);
 await f.api.readOwnDeliveryCustody(delivery);
 assert.equal(f.api.acceptHistory(page(f.now(),[delivery],{[delivery]:3})),true);
 assert.equal(f.api.snapshot().senderCustody.proofVerified,false);
});
test('R63 new custody read hides previous proof before network result',async()=>{
 let release,started;
 const waiting=new Promise(resolve=>release=resolve);
 const arrived=new Promise(resolve=>started=resolve);
 const f=fixture({readOwnDelivery:async scope=>{
  if(scope.deliveryId===delivery)return reply();
  started();return waiting;
 }});
 await authenticated(f,[delivery,second]);
 assert.equal((await f.api.readOwnDeliveryCustody(delivery)).ok,true);
 const pending=f.api.readOwnDeliveryCustody(second);await arrived;
 const snap=f.api.snapshot().senderCustody;
 assert.equal(snap.loading,true);
 assert.equal(snap.deliveryId,null);
 assert.equal(snap.proofVerified,false);
 release(reply(second));
 assert.equal((await pending).ok,true);
 assert.equal(f.api.snapshot().senderCustody.deliveryId,second);
});
test('R63 history reset during in-flight GET invalidates late delivery proof',async()=>{
 let release,started;
 const waiting=new Promise(resolve=>release=resolve);
 const arrived=new Promise(resolve=>started=resolve);
 const f=fixture({readOwnDelivery:async()=>{started();return waiting;}});
 await authenticated(f);
 const pending=f.api.readOwnDeliveryCustody(delivery);await arrived;
 assert.equal(f.api.acceptHistory(page(f.now(),[second])),true);
 release(reply());
 assert.equal((await pending).code,'STALE_CUSTODY_RESPONSE');
 assert.equal(f.api.snapshot().senderCustody.state,null);
});
test('R63 TTL expiration DURING an authorized read rejects late response',async()=>{
 let release,started;
 const waiting=new Promise(resolve=>release=resolve);
 const arrived=new Promise(resolve=>started=resolve);
 const f=fixture({readOwnDelivery:async()=>{started();return waiting;}});
 await authenticated(f);
 const pending=f.api.readOwnDeliveryCustody(delivery);await arrived;
 f.advance(5001);
 release(reply());
 assert.equal((await pending).code,'SENDER_CUSTODY_HISTORY_REVOKED');
 assert.equal(f.api.snapshot().senderCustody.proofVerified,false);
});
test('R63 JWT rotation for same Passenger invalidates proof and history',async()=>{
 const f=fixture();await authenticated(f);
 await f.api.readOwnDeliveryCustody(delivery);
 f.setToken('synthetic-rotated-passenger-jwt-00000');
 assert.equal((await f.api.refreshSession()).ok,true);
 assert.equal(f.api.snapshot().senderCustody.state,null);
 assert.equal(f.api.snapshot().history,null);
});
test('R63 Passenger switch denies cross-account cached sender evidence',async()=>{
 const f=fixture();await authenticated(f);
 await f.api.readOwnDeliveryCustody(delivery);
 f.setSubject(other);
 assert.equal((await f.api.refreshSession()).ok,true);
 assert.equal(f.api.snapshot().account.subject,other);
 assert.equal(f.api.snapshot().senderCustody.proofVerified,false);
 assert.equal((await f.api.readOwnDeliveryCustody(delivery)).code,
  'SENDER_DELIVERY_NOT_IN_OWN_HISTORY');
});
test('R63 an unauthorised delivery read cannot preserve a prior success',async()=>{
 const f=fixture();await authenticated(f);
 await f.api.readOwnDeliveryCustody(delivery);
 const outcome=await f.api.readOwnDeliveryCustody(second);
 assert.equal(outcome.code,'SENDER_DELIVERY_NOT_IN_OWN_HISTORY');
 assert.equal(f.api.snapshot().senderCustody.state,null);
});

test('R63 concurrent request for other delivery cannot re-anchor an earlier in-flight GET',async()=>{
 let release,started;
 const waiting=new Promise(resolve=>release=resolve);
 const arrived=new Promise(resolve=>started=resolve);
 const f=fixture({readOwnDelivery:async scope=>{
  if(scope.deliveryId===delivery){started();return waiting;}
  throw Error('unexpected second transport');
 }});
 await authenticated(f,[delivery,second]);
 const initial=f.api.readOwnDeliveryCustody(delivery);await arrived;
 const blocked=await f.api.readOwnDeliveryCustody(second);
 assert.equal(blocked.code,'SENDER_CUSTODY_READ_IN_FLIGHT');
 release(reply(delivery));
 assert.equal((await initial).ok,true);
 assert.equal(f.api.snapshot().senderCustody.deliveryId,delivery);
 assert.equal(f.api.snapshot().senderCustody.proofVerified,true);
});

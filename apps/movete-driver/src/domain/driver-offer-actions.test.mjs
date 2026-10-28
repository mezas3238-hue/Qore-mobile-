import test from 'node:test';
import assert from 'node:assert/strict';
import {createDriverOfferActionsController,DRIVER_OFFER_ACTIONS_LIVE_ENABLED}
 from './driver-offer-actions.mjs';
const id=n=>'63630000-0000-4636-8636-'+String(n).padStart(12,'0');
const actor=id(1),offer=id(2),service=id(3),key=id(4),event=id(5);
const now=Date.parse('2026-10-24T16:00:00Z');
const bearer='verified-staging-driver-access-token-00000';
const session={role:'driver',userId:actor,accessToken:bearer};
const oneOffer={kind:'AUTO_RIDE',offerId:offer,serviceId:service,expiresAtMs:now+30000};
const receipt=(action='accept')=>({kind:'AUTO_RIDE',action,
 outcome:action==='accept'?'accepted':'declined',receiptId:action==='accept'?event:offer,
 liveEnabled:false,pushDelivered:false});
function fixture(overrides={}){
 const calls={decisions:[],keys:0};
 const opts={now:()=>now,
 makeRequestKey:async()=>{calls.keys++;return key;},
 decide:async args=>{calls.decisions.push(args);return receipt(args.action);},
 liveEnabled:false,...overrides};
 return {c:createDriverOfferActionsController(opts),calls};
}
function ready(c){
 c.setSession(session);
 c.setOffers([oneOffer],{currentLicenseApproved:true});
 return c;
}
test('G63B one user action yields exactly one server-authoritative accept',async()=>{
 assert.equal(DRIVER_OFFER_ACTIONS_LIVE_ENABLED,false);
 const x=fixture();ready(x.c);
 assert.equal(x.c.current().offers.length,1);
 assert.equal(x.c.current().productionEnabled,false);
 assert.equal(x.c.current().qaOnly,true);
 const result=await x.c.decide({offerId:offer,action:'accept'});
 assert.equal(result.decisions[0].phase,'confirmed');
 assert.equal(result.busy,false);
 assert.equal(result.offers.length,0);
 assert.equal(x.calls.decisions.length,1);
 assert.deepEqual(x.calls.decisions[0],{
  accessToken:bearer,kind:'AUTO_RIDE',offerId:offer,requestKey:key,action:'accept'});
 assert(!JSON.stringify(result).includes(bearer));
 assert(!JSON.stringify(result).includes(actor));
 assert(!JSON.stringify(result).includes(key));
 assert(!JSON.stringify(result).includes(event));
 await x.c.decide({offerId:offer,action:'accept'});
 assert.equal(x.calls.decisions.length,1);
});
test('G63B explicit decline succeeds only with matching server receipt',async()=>{
 const x=fixture();
 ready(x.c);
 const result=await x.c.decide({offerId:offer,action:'decline'});
 assert.equal(result.decisions[0].phase,'confirmed');
 assert.equal(result.decisions[0].action,'decline');
 assert.equal(x.calls.decisions.length,1);
});
test('G63B lost HTTP response after database COMMIT stays uncertain, never resends',async()=>{
 const x=fixture({decide:async args=>{
  x.calls.decisions.push(args);
  throw Error('lost after commit');
 }});
 ready(x.c);
 const first=await x.c.decide({offerId:offer,action:'accept'});
 assert.equal(first.decisions[0].phase,'uncertain');
 assert.equal(first.offers.length,1);
 await x.c.decide({offerId:offer,action:'accept'});
 await x.c.decide({offerId:offer,action:'decline'});
 assert.equal(x.calls.keys,1);
 assert.equal(x.calls.decisions.length,1);
 // A fresh inbox lacking this item is NOT evidence of rolled-back acceptance.
 x.c.setOffers([],{currentLicenseApproved:true});
 assert.equal(x.c.current().decisions[0].phase,'uncertain');
});
test('G63B bad receipt never generates a synthetic confirmed acceptance',async()=>{
 for(const bad of [
  {...receipt(),kind:'DELIVERY'},
  {...receipt(),action:'decline'},
  {...receipt(),outcome:'declined'},
  {...receipt(),receiptId:'not-uuid'},
  {...receipt(),liveEnabled:true},
  {...receipt(),pushDelivered:true},
  null
 ]){
  const x=fixture({decide:async()=>bad});
  ready(x.c);
  const result=await x.c.decide({offerId:offer,action:'accept'});
  assert.equal(result.decisions[0].phase,'uncertain');
  assert.equal(result.busy,false);
 }
});
test('G63B invalid CSPRNG key or expired/foreign offer never submits POST',async()=>{
 for(const k of ['bad',id(99)]){
  const x=fixture({makeRequestKey:async()=>k});
  ready(x.c);
  if(k==='bad'){
   assert.equal((await x.c.decide({offerId:offer,action:'accept'}))
    .decisions[0].phase,'blocked');
   assert.equal(x.calls.decisions.length,0);
  }else{
   assert.equal((await x.c.decide({offerId:id(22),action:'accept'}))
    .decisions.length,0);
   assert.equal(x.calls.decisions.length,0);
  }
 }
 const f=fixture();
 f.c.setSession(session);
 f.c.setOffers([{...oneOffer,expiresAtMs:now+1000}],{
  currentLicenseApproved:true});
 assert.equal(f.c.current().phase,'signed-out');
 assert.equal(f.calls.decisions.length,0);
});
test('G63B no license approval, wrong role, mixed offers or no session blocks action',async()=>{
 const a=fixture();
 a.c.setSession(session);
 a.c.setOffers([oneOffer],{currentLicenseApproved:false});
 assert.equal(a.c.current().offers.length,0);
 await a.c.decide({offerId:offer,action:'accept'});
 assert.equal(a.calls.decisions.length,0);
 for(const wrong of [
  {...session,role:'passenger'},
  {...session,userId:'invalid'},
  {...session,accessToken:'bad'},
  {...session,role:['driver','passenger']}
 ]){
  const f=fixture();
  f.c.setSession(wrong);
  assert.equal(f.c.current().phase,'authorization-required');
 }
 const dup=fixture();
 dup.c.setSession(session);
 dup.c.setOffers([oneOffer,oneOffer],{currentLicenseApproved:true});
 assert.equal(dup.c.current().phase,'signed-out');
});
test('G63B logout during slow key creation cannot submit acceptance for previous user',async()=>{
 let release;
 const pendingKey=new Promise(r=>{release=r;});
 const x=fixture({makeRequestKey:async()=>pendingKey});
 ready(x.c);
 const flight=x.c.decide({offerId:offer,action:'accept'});
 x.c.clear();
 release(key);
 await flight;
 assert.equal(x.calls.decisions.length,0);
 assert.equal(x.c.current().phase,'signed-out');
 assert.deepEqual(x.c.current().decisions,[]);
});
test('G63B logout during slow transport cannot resurrect accepted status',async()=>{
 let release;
 const pending=new Promise(r=>{release=r;});
 const x=fixture({decide:async params=>{
  x.calls.decisions.push(params);return pending;
 }});
 ready(x.c);
 const flight=x.c.decide({offerId:offer,action:'accept'});
 await Promise.resolve();await Promise.resolve();await Promise.resolve();
 x.c.clear();
 release(receipt());
 await flight;
 assert.equal(x.c.current().phase,'signed-out');
 assert.equal(x.c.current().decisions.length,0);
});
test('G63B cannot be constructed without trusted callback or with LIVE',()=>{
 for(const wrong of [
  {liveEnabled:true},{decide:null},{makeRequestKey:null},{now:null}
 ])assert.throws(()=>fixture(wrong));
});

test('G64 outcome lookup recovers original acceptance after lost ACK; never resends',async()=>{
 const calls={send:[],reconcile:[]};
 const x=fixture({
  decide:async args=>{calls.send.push(args);throw Error('HTTP lost after COMMIT');},
  reconcile:async args=>{calls.reconcile.push(args);
   return {...receipt(),serverPersisted:true};}
 });
 ready(x.c);
 assert.equal((await x.c.decide({offerId:offer,action:'accept'}))
  .decisions[0].phase,'uncertain');
 x.c.setOffers([],{currentLicenseApproved:true});
 const result=await x.c.reconcilePending(offer);
 assert.equal(result.decisions[0].phase,'confirmed');
 assert.deepEqual(result.offers,[]);
 assert.equal(calls.send.length,1);
 assert.equal(calls.reconcile.length,1);
 assert.deepEqual(calls.reconcile[0],{
  accessToken:bearer,offerId:offer,kind:'AUTO_RIDE',
  requestKey:key,action:'accept'
 });
 assert(!JSON.stringify(result).includes(bearer));
 assert(!JSON.stringify(result).includes(key));
 await x.c.reconcilePending(offer);
 assert.equal(calls.reconcile.length,1);
});
test('G64 unknown/untrusted reconciliation leaves decision uncertain and key intact',async()=>{
 for(const answer of [
  async()=>{throw Error('NOT_YET_OBSERVED')},
  async()=>({...receipt(),serverPersisted:false}),
  async()=>({...receipt(),serverPersisted:true,kind:'DELIVERY'}),
  async()=>({...receipt(),serverPersisted:true,action:'decline'}),
  async()=>({...receipt(),serverPersisted:true,receiptId:'invalid'}),
  async()=>({...receipt(),serverPersisted:true,pushDelivered:true})
 ]){
  const calls=[];
  const x=fixture({
   decide:async()=>{throw Error('lost')},
   reconcile:async args=>{calls.push(args);return answer();}
  });
  ready(x.c);
  await x.c.decide({offerId:offer,action:'accept'});
  assert.equal((await x.c.reconcilePending(offer)).decisions[0].phase,'uncertain');
  assert.equal((await x.c.reconcilePending(offer)).decisions[0].phase,'uncertain');
  assert.equal(calls.length,2);
  assert.equal(calls[0].requestKey,key);
  assert.equal(calls[1].requestKey,key);
 }
});
test('G64 logout while reconciliation pending cannot restore old Driver decision',async()=>{
 let resolve;
 const wait=new Promise(done=>{resolve=done});
 const x=fixture({
  decide:async()=>{throw Error('lost')},
  reconcile:async()=>wait
 });
 ready(x.c);
 await x.c.decide({offerId:offer,action:'accept'});
 const flight=x.c.reconcilePending(offer);
 x.c.clear();
 resolve({...receipt(),serverPersisted:true});
 await flight;
 assert.equal(x.c.current().phase,'signed-out');
 assert.deepEqual(x.c.current().decisions,[]);
});

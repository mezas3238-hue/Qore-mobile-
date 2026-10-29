import test from 'node:test';
import assert from 'node:assert/strict';
import {createG187RecipientConfirmationGateway}
 from './g187-recipient-confirmation-gateway.mjs';
import {createQoreRadarLoopbackTransport,listenQoreRadarLoopback}
 from './g4-loopback-http-transport.mjs';
const sender='18700000-0000-4187-8187-000000000001';
const recipient='18700000-0000-4187-8187-000000000002';
const courier='18700000-0000-4187-8187-000000000003';
const session='18700000-0000-4187-8187-000000000011';
const delivery='18700000-0000-4187-8187-000000000021';
const key='18700000-0000-4187-8187-000000000031';
const at=1793300000000,token='g187-an-authenticated-provider-token-00000000001';
const noop=async()=>({status:404,body:{error:'Not found'}});
const path=who=>'/v1/staging/'+who+'/deliveries/'+delivery;
const req=(method,p,body=null)=>({method,path:p,
 headers:{authorization:'Bearer '+token},...(body===null?{}:{body})});
const receipt=(actor)=>({mode:'STAGING_DEMO_ONLY',deliveryId:delivery,
 ownerId:actor,deliveryState:'delivered',revision:4,
 courierProofCommitted:true,recipientBound:true,recipientConfirmed:true,
 eligibleForSettlement:true,paymentAuthorized:false,qaOnly:true,productionEnabled:false});
function fixture(overrides={}){
 let actor=sender,revoked=false,commitCount=0,afterCommit=false;
 const calls=[];
 const gateway=createG187RecipientConfirmationGateway({
  environment:'isolated_staging',qaOnly:true,liveEnabled:false,now:()=>at,
  verifyAccessToken:async()=>({id:actor,sessionId:session,tokenIatMs:at-1000,
   expiresAtMs:at+10000,is_anonymous:false}),
  verifySessionNotRevoked:async()=>{
   if(afterCommit)return false;
   return !revoked;
  },
  resolveExclusiveRole:async()=>actor===courier?'driver':'passenger',
  allowRequest:()=>true,
  bindRecipient:async x=>{calls.push(['bind',x]);return {
   mode:'STAGING_DEMO_ONLY',deliveryId:delivery,bindingPersisted:true,
   recipientConfirmed:false,qaOnly:true,productionEnabled:false}},
  confirmReceived:async x=>{calls.push(['confirm',x]);commitCount++;
   return {mode:'STAGING_DEMO_ONLY',deliveryId:delivery,
    confirmationId:key,recipientConfirmed:true,serverPersisted:true,
    qaOnly:true,productionEnabled:false,paymentAuthorized:false}},
  readSenderStatus:async x=>{calls.push(['read',x]);return receipt(actor)},
  ...overrides
 });
 return {gateway,calls,actor:x=>{actor=x},revoked:x=>{revoked=x},
  afterCommit:x=>{afterCommit=x},commits:()=>commitCount};
}
test('G187 HTTP contract binds and reads original sender G5 delivery without private recipient data',async()=>{
 const f=fixture();
 const bound=await f.gateway(req('POST',path('sender')+'/recipient-bind',
  {recipientId:recipient,requestKey:key}));
 assert.equal(bound.status,200);
 assert.equal(bound.body.bindingPersisted,true);
 assert.deepEqual(f.calls[0][1],{actorId:sender,sessionId:session,
  tokenIatMs:at-1000,deliveryId:delivery,recipientId:recipient,requestKey:key});
 const own=await f.gateway(req('GET',path('sender')+'/recipient-confirmation'));
 assert.equal(own.status,200);
 assert.equal(own.body.recipientConfirmed,true);
 assert.equal(own.body.paymentAuthorized,false);
 assert.equal(own.body.eligibleForSettlement,true);
 assert(!JSON.stringify(own).includes(recipient));
 assert(!JSON.stringify(own).includes(token));
 assert(!JSON.stringify(own).includes(session));
});
test('G187 recipient confirms the SAME server delivery; expired, revoked and foreign actors never mutate',async()=>{
 const f=fixture();
 f.actor(recipient);
 const ok=await f.gateway(req('POST',path('recipient')+'/confirm',{requestKey:key}));
 assert.equal(ok.status,200);
 assert.equal(ok.body.confirmationId,key);
 assert.equal(ok.body.paymentAuthorized,false);
 assert.equal(f.commits(),1);
 assert.equal(f.calls[0][1].actorId,recipient);
 f.afterCommit(true);
 const uncertain=await f.gateway(req('POST',path('recipient')+'/confirm',{requestKey:key}));
 assert.equal(uncertain.status,503);
 assert.equal(uncertain.body.retrySafe,false);
 // Revocation on second check AFTER the SQL callback cannot report 200.
 assert.equal(f.commits(),2);
 f.afterCommit(false);f.revoked(true);
 assert.equal((await f.gateway(req('POST',path('recipient')+'/confirm',
  {requestKey:key}))).status,401);
 assert.equal(f.commits(),2);
 f.revoked(false);f.actor(courier);
 assert.equal((await f.gateway(req('POST',path('recipient')+'/confirm',
  {requestKey:key}))).status,403);
 assert.equal(f.commits(),2);
});
test('G187 strips untrusted/extra fields and denies malformed identities and mixed routes',async()=>{
 const f=fixture({
  readSenderStatus:async()=>({...receipt(sender),recipientPhone:'hidden'})
 });
 assert.equal((await f.gateway(req('GET',path('sender')+'/recipient-confirmation')).status,503);
 for(const bad of [
  req('POST',path('recipient')+'/confirm',{requestKey:'bad'}),
  req('POST',path('sender')+'/recipient-bind',{recipientId:sender,requestKey:key,extra:1}),
  req('GET',path('sender')+'/recipient-confirmation',{requestKey:key}),
  req('POST',path('sender')+'/confirm',{requestKey:key}),
  req('POST',path('recipient')+'/recipient-bind',{recipientId:recipient,requestKey:key}),
 ])assert.notEqual((await f.gateway(bad)).status,200);
 const missing=fixture({verifyAccessToken:async()=>{throw Error('IdP disconnected')}});
 assert.equal((await missing.gateway(req('POST',path('sender')+'/recipient-bind',
  {recipientId:recipient,requestKey:key}))).status,401);
 const down=fixture({confirmReceived:async()=>{throw Error('Unknown SQL commit')}});
 down.actor(recipient);
 const failed=await down.gateway(req('POST',path('recipient')+'/confirm',{requestKey:key}));
 assert.equal(failed.status,503);assert.equal(failed.body.retrySafe,false);
});
test('G187 original G4 loopback routes all recipient events; unconfigured authority remains closed',async t=>{
 const f=fixture();
 const mk=recipientHandler=>createQoreRadarLoopbackTransport({
  riderHandler:noop,offerHandler:noop,tripCommandHandler:noop,
  deliveryHandler:noop,merchantHandler:noop,financeHandler:noop,
  safetyHandler:noop,merchantManagementHandler:noop,deliveryOfferHandler:noop,
  ...(recipientHandler?{recipientConfirmationHandler:recipientHandler}:{})
 });
 const server=mk(f.gateway),origin=await listenQoreRadarLoopback(server);
 t.after(()=>new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve())));
 const send=async(method,p,body,who)=>{
  f.actor(who);
  const res=await fetch(origin+p,{method,headers:{
   authorization:'Bearer '+token,
   ...(body?{'content-type':'application/json'}:{})
  },...(body?{body:JSON.stringify(body)}:{})});
  return {status:res.status,body:await res.json()};
 };
 const binding=await send('POST',path('sender')+'/recipient-bind',
  {recipientId:recipient,requestKey:key},sender);
 assert.equal(binding.status,200);
 const confirmation=await send('POST',path('recipient')+'/confirm',{requestKey:key},recipient);
 assert.equal(confirmation.status,200);
 assert.equal(confirmation.body.confirmationId,key);
 const own=await send('GET',path('sender')+'/recipient-confirmation',null,sender);
 assert.equal(own.status,200);
 assert.equal(own.body.recipientConfirmed,true);
 const forbidden=await send('POST',path('recipient')+'/confirm',
  {requestKey:key,actorId:recipient},recipient);
 assert.equal(forbidden.status,400);
 assert.equal(f.commits(),1);
 const noProvider=mk(),second=await listenQoreRadarLoopback(noProvider);
 t.after(()=>new Promise((resolve,reject)=>noProvider.close(e=>e?reject(e):resolve())));
 const res=await fetch(second+path('sender')+'/recipient-confirmation',{
  headers:{authorization:'Bearer '+token}});
 assert.equal(res.status,503);
});

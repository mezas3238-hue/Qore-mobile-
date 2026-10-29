import test from 'node:test';
import assert from 'node:assert/strict';
import {createG187ClientHttpGateway} from './g187-recipient-http-gateway.mjs';
const sender='18700000-0000-4187-8187-000000000001';
const recipient='18700000-0000-4187-8187-000000000002';
const delivery='18700000-0000-4187-8187-000000000021';
const key='18700000-0000-4187-8187-000000000031';
const now=1800000000000;
const session=x=>({role:'passenger',subject:x,token:'provider-idp-session-token-123456789012345678',
 expiresAt:now+60000,privateViewRevision:4});
const host='https://qore-signature-qa.onrender.com';
const reply=(operation,who=sender)=>operation==='bind'?{
 mode:'STAGING_DEMO_ONLY',deliveryId:delivery,bindingPersisted:true,
 recipientConfirmed:false,qaOnly:true,productionEnabled:false
}:operation==='confirm'?{
 mode:'STAGING_DEMO_ONLY',deliveryId:delivery,confirmationId:key,
 recipientConfirmed:true,serverPersisted:true,
 qaOnly:true,productionEnabled:false,paymentAuthorized:false
}:{
 mode:'STAGING_DEMO_ONLY',deliveryId:delivery,ownerId:who,deliveryState:'delivered',
 revision:4,courierProofCommitted:true,recipientBound:true,bindingKey:key,recipientConfirmed:true,
 eligibleForSettlement:true,paymentAuthorized:false,qaOnly:true,productionEnabled:false
};
const response=d=>new Response(JSON.stringify(d),{
 status:200,headers:{'content-type':'application/json'}});
const scope=(who=sender)=>({deliveryId:delivery,expectedSubject:who,
 expectedPrivateViewRevision:4,requestKey:key,recipientId:recipient});
const options=extra=>({
 enabled:true,ownerApproved:true,contractVerified:true,externalRuntimeVerified:true,
 independentIdpVerified:true,originalSqlVerified:true,
 origin:host,pinnedOrigin:host,now:()=>now,
 ...extra
});
test('G188 gateway off until all six sovereign gates and pinned HTTPS host',async()=>{
 let hits=0;
 const fetchImpl=async()=>{hits++;return response(reply('read'));};
 for(const config of [
  {},{enabled:false},{independentIdpVerified:false},
  {originalSqlVerified:false},{externalRuntimeVerified:false},
  {origin:'http://qore-signature-qa.onrender.com'},
  {pinnedOrigin:'https://another-host.onrender.com'},
  {origin:'https://qore-signature-qa.onrender.com/wrong'},
  {origin:'https://qore-signature-qa.onrender.com:443'},
 ]){
  const gateway=createG187ClientHttpGateway(options({...config,
   getSession:async()=>session(sender),fetchImpl}));
  if(Object.keys(config).length===0)assert.equal(gateway.isConfigured(),true);
  else{
   assert.equal(gateway.isConfigured(),false);
   assert.equal((await gateway.readSenderStatus(scope())).ok,false);
  }
 }
 assert.equal(hits,0);
});
test('G188 sender binds original G5 ID and reads private independently verified receipt',async()=>{
 const calls=[];
 const gateway=createG187ClientHttpGateway(options({
  getSession:async()=>session(sender),
  fetchImpl:async(url,opts)=>{calls.push({url,opts});
   return response(reply(calls.length===1?'bind':'read'));
  }
 }));
 const bound=await gateway.bindRecipient(scope());
 assert.equal(bound.ok,true);
 assert.equal(bound.data.bindingPersisted,true);
 assert.equal(calls[0].url,host+'/v1/staging/sender/deliveries/'+delivery+'/recipient-bind');
 assert.equal(calls[0].opts.method,'POST');
 assert.equal(calls[0].opts.redirect,'error');
 assert.equal(calls[0].opts.credentials,'omit');
 assert.deepEqual(JSON.parse(calls[0].opts.body),{recipientId:recipient,requestKey:key});
 assert(!calls[0].url.includes(recipient));
 assert(!calls[0].url.includes('token-'));
 const own=await gateway.readSenderStatus(scope());
 assert.equal(own.ok,true);
 assert.equal(own.data.eligibleForSettlement,true);
 assert.equal(own.data.paymentAuthorized,false);
 assert.equal(calls[1].opts.method,'GET');
 assert.equal(calls[1].opts.body,undefined);
});
test('G188 independent recipient confirms original delivery once, never authorizes money',async()=>{
 let calls=0;
 const gateway=createG187ClientHttpGateway(options({
  getSession:async()=>session(recipient),
  fetchImpl:async(url,opts)=>{
   calls++;
   assert.equal(url,host+'/v1/staging/recipient/deliveries/'+delivery+'/confirm');
   assert.deepEqual(JSON.parse(opts.body),{requestKey:key});
   return response(reply('confirm'));
  }
 }));
 const r=await gateway.confirmReceived(scope(recipient));
 assert.equal(r.ok,true);assert.equal(r.data.confirmationId,key);
 assert.equal(r.data.paymentAuthorized,false);assert.equal(calls,1);
});
test('G188 rejects changing JWT/identity after network without exposing stale ACK',async()=>{
 let passes=0;
 const gateway=createG187ClientHttpGateway(options({
  getSession:async()=>{passes++;return session(passes<2?recipient:sender);},
  fetchImpl:async()=>response(reply('confirm'))
 }));
 const answer=await gateway.confirmReceived(scope(recipient));
 assert.equal(answer.ok,false);
 assert.equal(answer.code,'G187_SESSION_CHANGED');
 assert.equal(answer.retrySafe,false);
});
test('G188 denies self recipient, forged SQL receipt, extra PII, foreign owner and unknown result',async()=>{
 let sends=0;
 const gateway=createG187ClientHttpGateway(options({
  getSession:async()=>session(sender),
  fetchImpl:async()=>{sends++;return response({...reply('read'),recipientPhone:'+595000000'})}
 }));
 assert.equal((await gateway.bindRecipient({...scope(),recipientId:sender})).code,'G187_INVALID_SCOPE');
 assert.equal(sends,0);
 assert.equal((await gateway.readSenderStatus(scope())).code,'G187_UNTRUSTED_RECEIPT');
 const wrong=createG187ClientHttpGateway(options({
  getSession:async()=>session(sender),
  fetchImpl:async()=>response(reply('read',recipient))
 }));
 assert.equal((await wrong.readSenderStatus(scope())).ok,false);
 const offline=createG187ClientHttpGateway(options({
  getSession:async()=>session(recipient),
  fetchImpl:async()=>{throw Error('Network error after possible COMMIT')}
 }));
 const uncertain=await offline.confirmReceived(scope(recipient));
 assert.equal(uncertain.ok,false);assert.equal(uncertain.retrySafe,false);
 assert.equal(uncertain.code,'G187_UNKNOWN_OUTCOME');
});
test('G188 refuses huge response, redirect, expired session and invalid recipient request key',async()=>{
 const good=()=>session(recipient);
 const large=createG187ClientHttpGateway(options({
  getSession:async()=>good(),
  fetchImpl:async()=>new Response(JSON.stringify({...reply('confirm'),extra:'x'.repeat(5000)}),
   {status:200,headers:{'content-type':'application/json'}})
 }));
 assert.equal((await large.confirmReceived(scope(recipient))).ok,false);
 const redirect=createG187ClientHttpGateway(options({
  getSession:async()=>good(),
  fetchImpl:async()=>({redirected:true,status:200})
 }));
 assert.equal((await redirect.confirmReceived(scope(recipient))).code,'G187_UNTRUSTED_REDIRECT');
 const expired=createG187ClientHttpGateway(options({
  getSession:async()=>({...good(),expiresAt:now+100}),
  fetchImpl:async()=>{throw Error('must never call')}
 }));
 assert.equal((await expired.confirmReceived(scope(recipient))).code,'G187_SESSION_CHANGED');
 assert.equal((await large.confirmReceived({...scope(recipient),requestKey:'bad'})).code,'G187_INVALID_SCOPE');
});

test('G190 recipient can reconcile lost ACK by bounded GET without second POST; dispute never settles',async()=>{
 const calls=[];
 const gateway=createG187ClientHttpGateway(options({
  getSession:async()=>session(recipient),
  fetchImpl:async(url,opts)=>{
   calls.push({url,opts});
   return response({mode:'STAGING_DEMO_ONLY',deliveryId:delivery,
    recipientConfirmed:true,confirmationId:key,deliveryState:'disputed',
    revision:5,eligibleForSettlement:false,paymentAuthorized:false,
    qaOnly:true,productionEnabled:false});
  }
 }));
 const recovered=await gateway.readRecipientConfirmation(scope(recipient));
 assert.equal(recovered.ok,true);
 assert.equal(recovered.data.confirmationId,key);
 assert.equal(recovered.data.recipientConfirmed,true);
 assert.equal(recovered.data.eligibleForSettlement,false);
 assert.equal(calls.length,1);
 assert.equal(calls[0].opts.method,'GET');
 assert.equal(calls[0].opts.body,undefined);
 assert.equal(calls[0].url,host+'/v1/staging/recipient/deliveries/'+delivery+'/confirmation');
 const missing=createG187ClientHttpGateway(options({
  getSession:async()=>session(recipient),
  fetchImpl:async()=>response({mode:'STAGING_DEMO_ONLY',deliveryId:delivery,
   recipientConfirmed:false,confirmationId:null,deliveryState:'picked_up',
   revision:3,eligibleForSettlement:false,paymentAuthorized:false,
   qaOnly:true,productionEnabled:false})
 }));
 const pending=await missing.readRecipientConfirmation(scope(recipient));
 assert.equal(pending.ok,true);assert.equal(pending.data.confirmationId,null);
 const forged=createG187ClientHttpGateway(options({
  getSession:async()=>session(recipient),
  fetchImpl:async()=>response({mode:'STAGING_DEMO_ONLY',deliveryId:delivery,
   recipientConfirmed:true,confirmationId:key,deliveryState:'disputed',
   revision:5,eligibleForSettlement:true,paymentAuthorized:false,
   qaOnly:true,productionEnabled:false})
 }));
 assert.equal((await forged.readRecipientConfirmation(scope(recipient))).ok,false);
});

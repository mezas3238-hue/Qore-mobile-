import test from 'node:test';
import assert from 'node:assert/strict';
import {createDriverChatHttpsStagingAdapters,
 DRIVER_CHAT_HTTPS_LIVE_ENABLED} from './driver-chat-https-staging.mjs';
const id=n=>'61610000-0000-4161-8161-'+String(n).padStart(12,'0');
const service=id(10),conversation=id(20),message=id(30),marker=id(40),key=id(50);
const token='trusted-staging-driver-session-bearer-000000000';
const at=Date.parse('2026-10-24T12:00:00Z');
const host='api-staging.movetefacil.example';
const origin='https://'+host;
const response=(status,body,headers={
 'content-type':'application/json; charset=utf-8',
 'cache-control':'private, no-store'
})=>({status,headers:{get:k=>headers[k]??null},
 text:async()=>JSON.stringify(body)});
function setup(override={}){
 const calls=[];
 const opts={apiOrigin:origin,approvedStagingHost:host,
  request:async(url,options)=>{calls.push({url,options});
   return response(200,{qaOnly:true,productionEnabled:false});},
  makeRequestKey:()=>key,
  verifyStopped:()=>({vehicleStopped:true,source:'trusted_navigation',
    observedAtMs:at-100}),now:()=>at,
  allowedByOwner:true,liveEnabled:false,timeoutMs:4500,
  ...override};
 return {client:createDriverChatHttpsStagingAdapters(opts),calls};
}
test('G61A release remains OFF by default, only explicit approved HTTPS staging origin',()=>{
 assert.equal(DRIVER_CHAT_HTTPS_LIVE_ENABLED,false);
 assert.throws(()=>createDriverChatHttpsStagingAdapters());
 for(const invalid of [
  {allowedByOwner:false},{liveEnabled:true},
  {apiOrigin:'http://'+host},{apiOrigin:'https://'+host+'/x'},
  {apiOrigin:'https://'+host+'?secret=x'},
  {apiOrigin:'https://attacker.example'},{apiOrigin:'https://'+host+':8443'},
  {apiOrigin:'https://user:pass@'+host},
  {apiOrigin:'https://127.0.0.1'},
  {approvedStagingHost:'127.0.0.1'},
  {approvedStagingHost:'localhost'},
  {approvedStagingHost:'api.production.example'},
  {approvedStagingHost:'qa..staging.example'},
  {approvedStagingHost:'api-staging.exaMple'},
  {request:null},{makeRequestKey:null},{verifyStopped:null},
  {timeoutMs:500},{timeoutMs:12000}
 ])assert.throws(()=>setup(invalid));
});
test('G61A all five real mobile request contracts are same approved HTTPS host and private',async()=>{
 const f=setup();
 const ref={bearer:token,serviceKind:'RIDE',serviceId:service,
  conversationId:conversation,requestKey:key,body:'Estoy llegando'};
 assert.equal((await f.client.readInbox({bearer:token,limit:50})).status,200);
 assert.equal((await f.client.readHistory({...ref,limit:50})).status,200);
 assert.equal((await f.client.send(ref)).status,200);
 assert.equal((await f.client.reconcile(ref)).status,200);
 assert.equal((await f.client.markVisible({bearer:token,conversationId:conversation,
  messageId:message,marker})).status,200);
 assert.equal(f.calls.length,5);
 const want=[
  '/v1/staging/driver/chat/conversations?limit=50',
  '/v1/staging/driver/chat/services/RIDE/'+service+
   '/conversations/'+conversation+'/history-with-ordered-markers?limit=50',
  '/v1/staging/driver/chat/services/RIDE/'+service+
   '/conversations/'+conversation+'/send',
  '/v1/staging/driver/chat/services/RIDE/'+service+
   '/conversations/'+conversation+'/reconcile',
  '/v1/staging/driver/chat/conversations/'+conversation+'/mark-visible-ordered'
 ];
 assert.deepEqual(f.calls.map(c=>c.url),want.map(p=>origin+p));
 for(let i=0;i<f.calls.length;i++){
  const {options}=f.calls[i];
  assert.equal(options.redirect,'error');
  assert.equal(options.cache,'no-store');
  assert.equal(options.credentials,'omit');
  assert.equal(options.headers.authorization,'Bearer '+token);
  assert.equal(options.headers.accept,'application/json');
  assert.equal(options.method,i<2?'GET':'POST');
  assert.equal(options.signal instanceof AbortSignal,true);
 }
 assert.deepEqual(JSON.parse(f.calls[2].options.body),{requestKey:key,body:'Estoy llegando'});
 assert.deepEqual(JSON.parse(f.calls[3].options.body),{requestKey:key,body:'Estoy llegando'});
 assert.deepEqual(JSON.parse(f.calls[4].options.body),{messageId:message,marker});
 assert.equal(f.calls.some(({url})=>url.includes(token)),false);
});
test('G61A signed opaque cursor is URL encoded, no global conversation limit',async()=>{
 const f=setup();
 const cursor='opaque.staging_cursor.'+'b'.repeat(46);
 await f.client.readInbox({bearer:token,limit:100,cursor});
 assert.equal(f.calls[0].url,origin+'/v1/staging/driver/chat/conversations?limit=100&cursor='+cursor);
 await f.client.readHistory({bearer:token,serviceKind:'DELIVERY',serviceId:service,
  conversationId:conversation,limit:100,cursor});
 assert(f.calls[1].url.includes('/DELIVERY/'+service+'/'));
 assert(f.calls[1].url.includes('&cursor='+cursor));
});
test('G61A forbids caller-supplied identity and malicious data without touching network',async()=>{
 const f=setup();
 for(const bad of [
  {requestKey:key,body:'Hola',actorId:id(9)},
  {requestKey:key,body:'Hola',sessionId:id(9)},
  {requestKey:key,body:'Hola',role:'driver'}
 ]){
  // Extra attributes do not get serialized into fixed allowlisted request body.
  await f.client.send({bearer:token,serviceKind:'RIDE',serviceId:service,
   conversationId:conversation,...bad});
 }
 assert.equal(f.calls.length,3);
 for(const call of f.calls)assert.deepEqual(
  JSON.parse(call.options.body),{requestKey:key,body:'Hola'});
 f.calls.length=0;
 for(const bad of [
  {requestKey:'not-uuid',body:'Hola'},
  {requestKey:key,body:'https://evil.example'},
  {requestKey:key,body:'contact me: test@example.org'},
  {requestKey:key,body:'0981 123 456'},
  {requestKey:key,body:'<script>oops</script>'},
  {requestKey:key,body:'\u202ec'},
  {requestKey:key,body:'Hola\nmalicioso'},
  {requestKey:key,body:'x'.repeat(501)}
 ]){
  const r=await f.client.send({bearer:token,serviceKind:'RIDE',serviceId:service,
   conversationId:conversation,...bad});
  assert.equal(r.status,400,JSON.stringify(bad));
 }
 assert.equal((await f.client.readInbox({bearer:'bad'})).status,400);
 assert.equal((await f.client.readInbox({bearer:token,limit:101})).status,400);
 assert.equal((await f.client.readInbox({bearer:token,cursor:'not-opaque'})).status,400);
 assert.equal((await f.client.readHistory({bearer:token,serviceKind:'WRONG',
  serviceId:service,conversationId:conversation})).status,400);
 assert.equal((await f.client.markVisible({bearer:token,conversationId:conversation,
  messageId:message,marker:'not-uuid'})).status,400);
 assert.equal(f.calls.length,0);
});
test('G61A timeouts, redirects, 5xx, HTML, excessive response and JSON errors fail closed',async()=>{
 for(const fn of [
  async()=>{throw Error('network after db COMMIT')},
  async()=>response(302,{url:'https://evil.test'}),
  async()=>response(500,{code:'UNAVAILABLE'}),
  async()=>response(200,{ack:true},{'content-type':'text/html','cache-control':'no-store'}),
  async()=>response(200,{ack:true},{'content-type':'application/json'}),
  async()=>({status:200,headers:{get:k=>k==='content-type'?
   'application/json':'private, no-store'},text:async()=>'{bad'}),
  async()=>({status:200,headers:{get:k=>k==='content-type'?
   'application/json':'private, no-store'},text:async()=>JSON.stringify('invalid')}),
  async()=>({status:200,headers:{get:k=>k==='content-type'?
   'application/json':'private, no-store'},text:async()=>JSON.stringify({body:'x'.repeat(200001)})})
 ]){
  const f=setup({request:fn});
  const r=await f.client.send({bearer:token,serviceKind:'RIDE',
   serviceId:service,conversationId:conversation,
   requestKey:key,body:'Estoy llegando'});
  assert.equal(r.status,503);
  assert.equal(r.body.retrySafe,false);
  assert.equal(r.body.serverStored,undefined);
 }
});
test('G61A server 401/403/409/429/503 cannot order mobile to retry SEND',async()=>{
 for(const status of [401,403,409,429,503]){
  const f=setup({request:async()=>response(status,
   {secret:'backend trace',retrySafe:true,serverStored:true})});
  const r=await f.client.reconcile({bearer:token,serviceKind:'RIDE',
   serviceId:service,conversationId:conversation,requestKey:key,body:'Hola'});
  assert.equal(r.status,status);
  assert.equal(r.body.retrySafe,false);
  assert.equal(r.body.serverStored,undefined);
  assert(!JSON.stringify(r).includes('secret'));
 }
});
test('G61A external CSPRNG UUID and externally attested stopped state are mandatory',async()=>{
 const f=setup();
 assert.equal(await f.client.makeRequestKey(),key);
 assert.deepEqual(await f.client.verifyStopped(),
  {vehicleStopped:true,source:'trusted_navigation',observedAtMs:at-100});
 for(const state of [
  {vehicleStopped:true,source:'user_toggle',observedAtMs:at-100},
  {vehicleStopped:true,source:'trusted_navigation',observedAtMs:at-20000},
  {vehicleStopped:false,source:'trusted_navigation',observedAtMs:at},
  {vehicleStopped:true,source:'trusted_navigation',observedAtMs:at+100}
 ]){
  const a=setup({verifyStopped:()=>state}).client;
  assert.equal((await a.verifyStopped()).vehicleStopped,false);
 }
 await assert.rejects(()=>setup({makeRequestKey:()=> 'Math.random()'}).client.makeRequestKey());
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {request} from 'node:http';
import {createG60BDriverWriteLoopbackQa} from './g60b-driver-write-loopback-qa.mjs';
const id=n=>'60606000-0000-4060-8060-'+String(n).padStart(12,'0');
const service=id(2),conversation=id(3),key=id(4),message=id(5);
const token='driver-jwt-verified-by-server-qa-only-000000';
const msg='Estoy a una cuadra';
const now=Date.now();
const ack={conversationId:conversation,serviceId:service,requestKey:key,
 messageId:message,senderRole:'driver',body:msg,createdAt:now-1000,
 revision:4,serverStored:true};
const recovered={state:'COMMITTED',ack,latestRevision:7,
 historyRefreshRequired:true,qaOnly:true,productionEnabled:false,retrySafe:false};
const QA={environment:'isolated_staging',localQaOnly:true,liveEnabled:false};
const route=operation=>'/v1/staging/driver/chat/services/RIDE/'+service+
 '/conversations/'+conversation+'/'+operation;
function fixture(changes={}){
 const calls={send:[],recover:[],stopped:[]};
 const app=createG60BDriverWriteLoopbackQa({...QA,now:()=>now,
  verifyStopped:async input=>{calls.stopped.push(input);
   return {vehicleStopped:true,source:'trusted_navigation',observedAtMs:now-100};},
  driverSendHandler:async x=>{calls.send.push(x);return {status:200,body:ack};},
  driverReconcileHandler:async x=>{calls.recover.push(x);return {status:200,body:recovered};},
  ...changes});
 return {app,calls};
}
async function http(port,endpoint,{method='POST',body={requestKey:key,body:msg},
 auth=true,headers={},host='127.0.0.1'}={}){
 return await new Promise((resolve,reject)=>{
  const bytes=body===null?null:Buffer.from(JSON.stringify(body));
  const h={host:host+':'+port,
   ...(auth?{authorization:'Bearer '+token}:{}),
   ...(bytes?{'content-type':'application/json','content-length':String(bytes.length)}:{}),
   ...headers};
  const req=request({hostname:'127.0.0.1',port,path:endpoint,method,headers:h},
   res=>{
    const chunks=[];
    res.on('data',x=>chunks.push(x));
    res.on('end',()=>{
     const text=Buffer.concat(chunks).toString('utf8');
     resolve({status:res.statusCode,headers:res.headers,
      body:text?JSON.parse(text):null});
    });
   });
  req.on('error',reject);req.end(bytes??undefined);
 });
}
test('G60B Driver local SEND and RECONCILE validate and preserve original G59B ACK',async()=>{
 const f=fixture();
 const {address,port}=await f.app.listen();
 try{
  assert.equal(address,'127.0.0.1');
  const send=await http(port,route('send'));
  assert.equal(send.status,200);
  assert.deepEqual(send.body,ack);
  assert.equal(f.calls.send.length,1);
  assert.equal(f.calls.stopped.length,1);
  assert.deepEqual(f.calls.send[0],{bearer:token,serviceKind:'RIDE',
   serviceId:service,conversationId:conversation,requestKey:key,body:msg});
  assert.equal(send.headers['access-control-allow-origin'],undefined);
  assert.equal(send.headers['cache-control'],'private, no-store, max-age=0');
  const recover=await http(port,route('reconcile'));
  assert.equal(recover.status,200);
  assert.deepEqual(recover.body,recovered);
  assert.equal(recover.body.ack.revision,4);
  assert.equal(recover.body.latestRevision,7);
  assert.equal(f.calls.recover.length,1);
  assert.equal(f.calls.stopped.length,1); // no vehicle-motion gate on read
  assert.equal(JSON.stringify(recover).includes(token),false);
 }finally{await f.app.close();}
});
test('G60B never trusts client actor, role, iat, SQL, content links or browser requests',async()=>{
 const f=fixture();
 const {port}=await f.app.listen();
 try{
  for(const bad of [
   {requestKey:key,body:msg,actorId:id(12)},
   {requestKey:key,body:msg,role:'driver'},
   {requestKey:key,body:msg,sessionId:id(12)},
   {requestKey:key,body:msg,tokenIatMs:now-1000},
   {requestKey:key,body:msg,retrySafe:true},
   {requestKey:key,body:' tel 0981 123 456'},
   {requestKey:key,body:'https://site.test'},
   {requestKey:key,body:'x@y.org'},
   {requestKey:key,body:'<script>bad</script>'},
   {requestKey:'invalid',body:msg},
   {requestKey:key,body:msg+'\nHola'},
   {requestKey:key,body:'x'.repeat(501)}
  ]){
   const x=await http(port,route('send'),{body:bad});
   assert.equal(x.status,400,JSON.stringify(bad).slice(0,120));
  }
  for(const headers of [
   {origin:'https://evil.example'},{cookie:'session=any'},
   {referer:'https://evil.example'},{authorization:'Bearer fake'}
  ]){
   const x=await http(port,route('send'),{headers});
   assert.notEqual(x.status,200);
  }
  assert.equal((await http(port,route('send'),{auth:false})).status,401);
  assert.equal((await http(port,route('send'),{host:'remote.example'})).status,403);
  for(const url of [
   route('send')+'?actorId='+id(20),
   '/v1/staging/driver/chat/conversations',
   route('send')+'%20',
   route('send')+'//',
   route('receive')
  ])assert.notEqual((await http(port,url)).status,200);
  assert.equal((await http(port,route('send'),{method:'GET'})).status,404);
  assert.equal(f.calls.send.length,0);
  assert.equal(f.calls.recover.length,0);
 }finally{await f.app.close();}
});
test('G60B server-side stopped-vehicle attestation is mandatory for SEND',async()=>{
 for(const state of [
  {vehicleStopped:false,source:'trusted_navigation',observedAtMs:now},
  {vehicleStopped:true,source:'user_checkbox',observedAtMs:now},
  {vehicleStopped:true,source:'trusted_navigation',observedAtMs:now-10000},
  {vehicleStopped:true,source:'trusted_navigation',observedAtMs:now+100},
  {vehicleStopped:true,source:'trusted_navigation',observedAtMs:now,extra:'forged'}
 ]){
  const f=fixture({verifyStopped:async()=>state});
  const {port}=await f.app.listen();
  try{
   const output=await http(port,route('send'));
   assert.equal(output.status,409);
   assert.equal(output.body.code,'G60B_VEHICLE_NOT_STOPPED');
   assert.equal(f.calls.send.length,0);
   assert.equal((await http(port,route('reconcile'))).status,200);
  }finally{await f.app.close();}
 }
});
test('G60B rejects forged ACK, wrong original request, fake revised receipt and unknown response',async()=>{
 for(const response of [
  {status:200,body:{...ack,senderRole:'passenger'}},
  {status:200,body:{...ack,requestKey:id(13)}},
  {status:200,body:{...ack,serverStored:false}},
  {status:200,body:{...ack,revision:1}},
  {status:200,body:{...ack,body:'different'}},
  {status:200,body:{...ack,secret:'leak'}},
  {status:200,body:{ok:true}},
  {status:503,body:{code:'DATABASE_URL',qaOnly:true}},
  {status:503,body:{code:'UNAVAILABLE',qaOnly:true,retrySafe:true}}
 ]){
  const f=fixture({driverSendHandler:async()=>response});
  const {port}=await f.app.listen();
  try{
   const output=await http(port,route('send'));
   assert.equal(output.status,503,JSON.stringify(response).slice(0,100));
   assert.equal(JSON.stringify(output).includes('secret'),false);
  }finally{await f.app.close();}
 }
 for(const bad of [
  {...recovered,latestRevision:3},
  {...recovered,historyRefreshRequired:false},
  {...recovered,retrySafe:true},
  {...recovered,ack:{...ack,revision:9}},
  {...recovered,productionEnabled:true}
 ]){
  const f=fixture({driverReconcileHandler:async()=>({status:200,body:bad})});
  const {port}=await f.app.listen();
  try{
   assert.equal((await http(port,route('reconcile'))).status,503);
  }finally{await f.app.close();}
 }
});
test('G60B write timeout yields UNKNOWN not safe-to-retry or fabricated persisted ACK',async()=>{
 let resolve;
 const delayed=new Promise(r=>{resolve=r;});
 let count=0;
 const f=fixture({driverSendHandler:async()=>{count++;return delayed;}});
 const {port}=await f.app.listen();
 try{
  const outcome=await http(port,route('send'));
  assert.equal(outcome.status,503);
  assert.equal(outcome.body.code,'G60B_OUTCOME_UNKNOWN');
  assert.equal(outcome.body.retrySafe,false);
  assert.equal(outcome.body.serverStored,undefined);
  assert.equal(count,1);
 }finally{resolve({status:200,body:ack});await f.app.close();}
});
test('G60B refuses public/LIVE configuration or missing trusted independent authorities',()=>{
 const cfg={...QA,driverSendHandler:async()=>({status:200,body:ack}),
  driverReconcileHandler:async()=>({status:200,body:recovered}),
  verifyStopped:async()=>({vehicleStopped:true,source:'trusted_navigation',observedAtMs:now})};
 for(const bad of [
  {environment:'production'},{localQaOnly:false},{liveEnabled:true},
  {driverSendHandler:null},{driverReconcileHandler:null},
  {verifyStopped:null},{now:null}
 ])assert.throws(()=>createG60BDriverWriteLoopbackQa({...cfg,...bad}));
});

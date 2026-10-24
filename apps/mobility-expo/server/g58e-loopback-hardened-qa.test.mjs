import test from 'node:test';
import assert from 'node:assert/strict';
import {createG58ChatLoopbackTransportQa} from './g58-chat-loopback-transport-qa.mjs';
const QA={environment:'isolated_staging',localQaOnly:true,liveEnabled:false};
const bearer='Bearer signed-synthetic-g58e-local-verified-only-token';
const path='/v1/staging/driver/chat/conversations';
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const cfg=fn=>({...QA,driverInboxHandler:fn,
 driverHistoryHandler:async()=>({status:403,body:{code:'DENIED',qaOnly:true}}),
 driverVisibleHandler:async()=>({status:403,body:{code:'DENIED',qaOnly:true}}),
 passengerHistoryHandler:async()=>({status:403,body:{code:'DENIED',qaOnly:true}}),
 passengerVisibleHandler:async()=>({status:403,body:{code:'DENIED',qaOnly:true}})
});
async function fetchInbox(port,extra={}){
 const response=await fetch('http://127.0.0.1:'+port+path,{
  headers:{authorization:bearer,...extra}
 });
 const body=await response.text();
 return {status:response.status,body:body?JSON.parse(body):null};
}
test('G58E configures finite header, request, keepalive and socket ceilings',async()=>{
 const app=createG58ChatLoopbackTransportQa(cfg(async()=>({
  status:200,body:{ok:true,qaOnly:true}
 })));
 assert.equal(app.transport,undefined);
 assert.equal(app.server.headersTimeout,2000);
 assert.equal(app.server.requestTimeout,3000);
 assert.equal(app.server.keepAliveTimeout,1000);
 assert.equal(app.server.timeout,3000);
 assert.equal(app.server.maxRequestsPerSocket,10);
 assert.equal(app.server.maxConnections,16);
 assert.equal(app.server.maxHeadersCount,32);
 const port=(await app.listen()).port;
 try{
  const ok=await fetchInbox(port);
  assert.equal(ok.status,200);
  assert.equal(ok.body.qaOnly,true);
 }finally{await app.close();}
});
test('G58E 13th concurrent handler is denied, pending 12 use bounded capacity',async()=>{
 const held=deferred();
 let entered=0;
 const app=createG58ChatLoopbackTransportQa(cfg(async()=>{
  entered++;
  await held.promise;
  return {status:200,body:{qaOnly:true,ready:true}};
 }));
 const port=(await app.listen()).port;
 const requests=Array.from({length:12},()=>fetchInbox(port));
 try{
  let ticks=0;
  while(entered!==12&&ticks++<100)await sleep(15);
  assert.equal(entered,12,'all twelve handlers entered');
  const extra=await fetchInbox(port);
  assert.equal(extra.status,503);
  assert.equal(extra.body.code,'G58E_GATEWAY_CAPACITY');
  assert.equal(entered,12);
  held.resolve();
  const replies=await Promise.all(requests);
  assert.ok(replies.every(x=>x.status===200));
  const recovered=await fetchInbox(port);
  assert.equal(recovered.status,200);
 }finally{held.resolve();await app.close();}
});
test('G58E write handler timeout returns UNKNOWN, never a false rollback or optimistic ACK',async()=>{
 const held=deferred();
 let called=0;
 const app=createG58ChatLoopbackTransportQa(cfg(async()=>{
  called++;
  return held.promise;
 }));
 const port=(await app.listen()).port;
 try{
  const result=await fetchInbox(port);
  assert.equal(result.status,503);
  assert.equal(result.body.code,'G58E_OUTCOME_UNKNOWN');
  assert.equal(result.body.readConfirmed,undefined);
  assert.equal(called,1);
  held.resolve({status:200,body:{readConfirmed:true,qaOnly:true}});
  await sleep(10);
 }finally{held.resolve({status:503,body:{qaOnly:true}});await app.close();}
});
test('G58E rejects excessive raw headers and does not call authenticated adapter',async()=>{
 let called=0;
 const app=createG58ChatLoopbackTransportQa(cfg(async()=>{
  called++;
  return {status:200,body:{qaOnly:true}};
 }));
 const port=(await app.listen()).port;
 try{
  const headers={};
  for(let i=0;i<35;i++)headers['x-qa-extra-'+i]='x';
  const r=await fetchInbox(port,headers);
  assert.ok([400,431].includes(r.status),'server must reject excess headers: '+r.status);
  if(r.status===400)assert.equal(r.body?.code,'G58E_EXCESS_HEADERS');
  assert.equal(called,0);
 }finally{await app.close();}
});
test('G58E refuses LIVE and no additional public listening hostname',async()=>{
 const app=createG58ChatLoopbackTransportQa(cfg(async()=>({
  status:200,body:{qaOnly:true}
 })));
 const listener=await app.listen();
 try{
  assert.equal(listener.address,'127.0.0.1');
  await assert.rejects(()=>app.listen(),/already bound/);
 }finally{await app.close();}
});

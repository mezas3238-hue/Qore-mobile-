import test from 'node:test';
import assert from 'node:assert/strict';
import {request} from 'node:http';
import {createG58ChatLoopbackTransportQa} from './g58-chat-loopback-transport-qa.mjs';
const uuid=n=>'58580000-0000-4858-8858-'+String(n).padStart(12,'0');
const convo=uuid(301),svc=uuid(201),msg=uuid(501),marker=uuid(601);
const bearer='synthetic-provider-verified-driver-or-passenger-jwt';
const opts={environment:'isolated_staging',localQaOnly:true,liveEnabled:false};
async function start(){
 const seen=[];
 const ok=x=>{seen.push(x);return {status:200,body:{ok:true,qaOnly:true}};};
 const app=createG58ChatLoopbackTransportQa({...opts,
  driverInboxHandler:async x=>ok(['DRIVER_INBOX',x]),
  driverHistoryHandler:async x=>ok(['DRIVER_HISTORY',x]),
  driverVisibleHandler:async x=>ok(['DRIVER_READ',x]),
  passengerHistoryHandler:async x=>ok(['PASSENGER_HISTORY',x]),
  passengerVisibleHandler:async x=>ok(['PASSENGER_READ',x])
 });
 const location=await app.listen();
 return {app,seen,location};
}
function send(port,path,{method='GET',body,auth=true,headers={},host='127.0.0.1'}={}){
 return new Promise((resolve,reject)=>{
  const bytes=body===undefined?null:Buffer.from(JSON.stringify(body));
  const hd={host:host+':'+port,
   ...(auth?{authorization:'Bearer '+bearer}:{}),
   ...(bytes?{'content-type':'application/json','content-length':String(bytes.length)}:{}),
   ...headers};
  const req=request({host:'127.0.0.1',port,path,method,headers:hd},
   res=>{const chunks=[];res.on('data',x=>chunks.push(x));
    res.on('end',()=>{const txt=Buffer.concat(chunks).toString('utf8');
     resolve({status:res.statusCode,headers:res.headers,body:JSON.parse(txt)});});});
  req.on('error',reject);
  req.end(bytes??undefined);
 });
}
test('G58 loopback exposes only the five injected private QA operations',async()=>{
 const x=await start();
 try{
  assert.equal(x.location.address,'127.0.0.1');
  const cases=[
   ['/v1/staging/driver/chat/conversations?limit=2',
    'DRIVER_INBOX'],
   ['/v1/staging/driver/chat/services/RIDE/'+svc+'/conversations/'+convo+
      '/history-with-ordered-markers?limit=2','DRIVER_HISTORY'],
   ['/v1/staging/chat/services/RIDE/'+svc+
      '/history-with-ordered-markers?limit=2','PASSENGER_HISTORY']
  ];
  for(const [path,expected] of cases){
   const r=await send(x.location.port,path);
   assert.equal(r.status,200,JSON.stringify(r));
   assert.equal(x.seen.at(-1)[0],expected);
   assert.equal(r.headers['cache-control'],'private, no-store, max-age=0');
   assert.equal(r.headers['access-control-allow-origin'],undefined);
  }
  for(const [path,expected] of [
   ['/v1/staging/driver/chat/conversations/'+convo+'/mark-visible-ordered','DRIVER_READ'],
   ['/v1/staging/chat/conversations/'+convo+'/mark-visible-ordered','PASSENGER_READ']
  ]){
   const r=await send(x.location.port,path,{method:'POST',body:{messageId:msg,marker}});
   assert.equal(r.status,200);
   assert.equal(x.seen.at(-1)[0],expected);
   assert.equal(x.seen.at(-1)[1].messageId,msg);
   assert.equal(x.seen.at(-1)[1].marker,marker);
   assert.ok(!JSON.stringify(r.body).includes(bearer));
  }
  assert.equal(x.seen.length,5);
 }finally{await x.app.close();}
});
test('G58 never forwards caller-supplied actor/role/session/query and refuses browser/origin/cookies',async()=>{
 const x=await start();
 try{
  const paths=[
   '/v1/staging/driver/chat/conversations?actorId='+uuid(2),
   '/v1/staging/driver/chat/conversations?limit=10&limit=20',
   '/v1/staging/driver/chat/conversations?token='+bearer,
   '/v1/staging/driver/chat/conversations?limit=0',
   '/v1/staging/driver/chat/conversations?limit=101',
   '/v1/staging/driver/chat/conversations?limit=01',
   '/v1/staging/driver//chat/conversations',
   '/v1/staging/driver/chat/%63onversations',
   '/v1/staging/driver/chat/conversations#fragment',
   '/v1/staging/driver/chat/conversations?cursor=short',
   '/v1/staging/admin/inbox',
   '/v1/staging/chat/messages'
  ];
  for(const path of paths){
   const out=await send(x.location.port,path);
   assert.notEqual(out.status,200,path);
  }
  for(const headers of [{origin:'https://attacker.test'},{cookie:'session=x'},
   {referer:'http://remote.test'},{authorization:'Bearer fake'}]){
   const out=await send(x.location.port,
    '/v1/staging/driver/chat/conversations',{headers});
   assert.notEqual(out.status,200);
  }
  assert.equal((await send(x.location.port,
   '/v1/staging/driver/chat/conversations',{auth:false})).status,401);
  assert.equal((await send(x.location.port,
   '/v1/staging/driver/chat/conversations',{host:'example.com'})).status,403);
  assert.equal(x.seen.length,0);
 }finally{await x.app.close();}
});
test('G58 explicit visible-read POST cannot smuggle seq or actor/role/empty JSON',async()=>{
 const x=await start();
 try{
  const path='/v1/staging/driver/chat/conversations/'+convo+'/mark-visible-ordered';
  for(const body of [{messageId:msg,marker,throughSeq:99},
   {messageId:msg,marker,actorId:uuid(2)},
   {messageId:msg,marker,role:'driver'},
   {messageId:msg},{messageId:msg,marker:'bad',sessionId:uuid(2)}]){
   assert.equal((await send(x.location.port,path,{method:'POST',body})).status,400);
  }
  assert.equal((await send(x.location.port,path,{method:'GET'})).status,404);
  assert.equal((await send(x.location.port,
   '/v1/staging/driver/chat/conversations',{method:'POST',body:{messageId:msg,marker}})).status,404);
  assert.equal(x.seen.length,0);
 }finally{await x.app.close();}
});
test('G58 gateway fails closed if injected Auth/SQL adapter throws or returns invalid response',async()=>{
 for(const answer of [null,{status:200,body:'bad'},{status:201,body:{ok:true}}]){
  const app=createG58ChatLoopbackTransportQa({...opts,
   driverInboxHandler:async()=>answer,
   driverHistoryHandler:async()=>{throw Error('private database password must not leak');},
   driverVisibleHandler:async()=>({status:503,body:{code:'G42_REVOKED',qaOnly:true}}),
   passengerHistoryHandler:async()=>({status:503,body:{code:'OFFLINE',qaOnly:true}}),
   passengerVisibleHandler:async()=>({status:401,body:{code:'UNVERIFIED',qaOnly:true}})
  });
  const {port}=await app.listen();
  try{
   const x=await send(port,'/v1/staging/driver/chat/conversations');
   assert.equal(x.status,503);
   assert.ok(!JSON.stringify(x).includes('password'));
   const h=await send(port,'/v1/staging/driver/chat/services/RIDE/'+svc+
    '/conversations/'+convo+'/history-with-ordered-markers');
   assert.equal(h.status,503);
   const denied=await send(port,'/v1/staging/driver/chat/conversations/'+convo+
    '/mark-visible-ordered',{method:'POST',body:{messageId:msg,marker}});
   assert.equal(denied.status,503);
  }finally{await app.close();}
 }
});
test('G58 cannot be constructed for production or with missing existing trusted adapters',()=>{
 for(const bad of [{environment:'production'},{localQaOnly:false},
  {liveEnabled:true},{driverInboxHandler:null},{driverVisibleHandler:null},
  {passengerHistoryHandler:null}]){
  assert.throws(()=>createG58ChatLoopbackTransportQa({...opts,
   driverInboxHandler:async()=>({status:200,body:{ok:true}}),
   driverHistoryHandler:async()=>({status:200,body:{ok:true}}),
   driverVisibleHandler:async()=>({status:200,body:{ok:true}}),
   passengerHistoryHandler:async()=>({status:200,body:{ok:true}}),
   passengerVisibleHandler:async()=>({status:200,body:{ok:true}}),...bad
  }));
 }
});

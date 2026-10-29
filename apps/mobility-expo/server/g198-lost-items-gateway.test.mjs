import test from 'node:test';
import assert from 'node:assert/strict';
import {createG198LostItemsGateway} from './g198-lost-items-gateway.mjs';
import {createQoreRadarLoopbackTransport,listenQoreRadarLoopback}
 from './g4-loopback-http-transport.mjs';
const passenger='19800000-0000-4198-8198-000000000001';
const driver='19800000-0000-4198-8198-000000000002';
const sessionId='19800000-0000-4198-8198-000000000003';
const trip='19800000-0000-4198-8198-000000000004';
const caseId='19800000-0000-4198-8198-000000000005';
const key='19800000-0000-4198-8198-000000000006';
const token='private-post-trip-session-0000000000001';
const at=1793300000000;
const openPath='/v1/staging/rider/trips/'+trip+'/lost-items';
const casePath='/v1/staging/lost-items/'+caseId;
const noop=async()=>({status:404,body:{error:'unavailable'}});
const rq=(method,path,body)=>({method,path,
 headers:{authorization:'Bearer '+token},...(body===undefined?{}:{body})});
function fixture(overrides={}){
 let role='passenger',id=passenger,revoked=false,stopped=true,sends=0;
 const gateway=createG198LostItemsGateway({
  environment:'isolated_staging',qaOnly:true,liveEnabled:false,now:()=>at,
  verifyAccessToken:async()=>({id,sessionId,tokenIatMs:at-100,
   expiresAtMs:at+30000,is_anonymous:false}),
  verifySessionNotRevoked:async()=>!revoked,
  resolveExclusiveRole:async()=>role,
  allowRequest:()=>true,verifyDriverStopped:async()=>stopped,
  openCase:async()=>({mode:'STAGING_DEMO_ONLY',caseId,tripId:trip,
   state:'OPEN',expiresAtMs:at+86400000,qaOnly:true,productionEnabled:false}),
  readCase:async()=>({mode:'STAGING_DEMO_ONLY',caseId,tripId:trip,
   state:'OPEN',canSend:true,expiresAtMs:at+86400000,messages:[],
   qaOnly:true,productionEnabled:false}),
  sendCaseMessage:async({requestKey})=>{sends++;return {
   mode:'STAGING_DEMO_ONLY',caseId,messageId:key,requestKey,
   serverPersisted:true,qaOnly:true,productionEnabled:false}},
  closeCase:async()=>({mode:'STAGING_DEMO_ONLY',caseId,state:'BLOCKED',
   qaOnly:true,productionEnabled:false}),
  driverInbox:async()=>({mode:'STAGING_DEMO_ONLY',driverId:driver,
   cases:[{caseId,tripId:trip,state:'OPEN',expiresAtMs:at+86400000}],
   qaOnly:true,productionEnabled:false}),
  ...overrides
 });
 return {gateway,asDriver:()=>{role='driver';id=driver;},
  revoked:x=>revoked=x,stopped:x=>stopped=x,sends:()=>sends};
}
test('G198 post-ride Passenger opens original case and Driver reads only assigned cases',async()=>{
 const f=fixture();
 const open=await f.gateway(rq('POST',openPath,{}));
 assert.equal(open.status,200);
 assert.equal(open.body.caseId,caseId);
 assert.equal(open.body.productionEnabled,false);
 f.asDriver();
 const inbox=await f.gateway(rq('GET','/v1/staging/driver/lost-items'));
 assert.equal(inbox.status,200);assert.equal(inbox.body.cases[0].tripId,trip);
 const own=await f.gateway(rq('GET',casePath));
 assert.equal(own.status,200);assert.equal(own.body.canSend,true);
});
test('G198 Driver cannot reply in motion; passenger cannot enumerate Driver inbox',async()=>{
 const f=fixture();
 assert.equal((await f.gateway(rq('GET','/v1/staging/driver/lost-items'))).status,403);
 f.asDriver();f.stopped(false);
 assert.equal((await f.gateway(rq('POST',casePath+'/messages',
  {requestKey:key,body:'Encontrado. Contacta soporte.'}))).status,403);
 assert.equal(f.sends(),0);
 f.stopped(true);
 const sent=await f.gateway(rq('POST',casePath+'/messages',
  {requestKey:key,body:'Encontrado. Contacta soporte.'}));
 assert.equal(sent.status,200);assert.equal(f.sends(),1);
});
test('G198 never accepts phone, link or forged actor body and revocation blocks contact',async()=>{
 const f=fixture();
 for(const body of [
  {requestKey:key,body:'Mi teléfono es 0994123456'},
  {requestKey:key,body:'https://bad.example'},
  {requestKey:key,body:'HOLA',passengerId:passenger}
 ])assert.notEqual((await f.gateway(rq('POST',casePath+'/messages',body))).status,200);
 assert.equal(f.sends(),0);
 f.revoked(true);
 assert.equal((await f.gateway(rq('GET',casePath))).status,401);
});
test('G198 G4 loopback defaults closed and honors original Passenger private case',async t=>{
 const f=fixture();
 const make=handler=>createQoreRadarLoopbackTransport({
  riderHandler:noop,offerHandler:noop,tripCommandHandler:noop,
  deliveryHandler:noop,merchantHandler:noop,financeHandler:noop,
  safetyHandler:noop,merchantManagementHandler:noop,deliveryOfferHandler:noop,
  ...(handler?{lostItemsHandler:handler}:{})
 });
 const server=make(f.gateway),base=await listenQoreRadarLoopback(server);
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const r=await fetch(base+openPath,{method:'POST',
  headers:{authorization:'Bearer '+token,'content-type':'application/json'},
  body:'{}'});
 assert.equal(r.status,200);
 const resp=await r.json();assert.equal(resp.caseId,caseId);
 const unmounted=make(),other=await listenQoreRadarLoopback(unmounted);
 t.after(()=>new Promise(resolve=>unmounted.close(resolve)));
 assert.equal((await fetch(other+casePath,{headers:{authorization:'Bearer '+token}})).status,503);
});

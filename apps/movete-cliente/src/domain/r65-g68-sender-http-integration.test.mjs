import test from 'node:test';
import assert from 'node:assert/strict';
import {createClientExperience} from './client-experience.mjs';

const T=1800000000000;
const id=n=>'68999000-0000-4689-8689-'+String(n).padStart(12,'0');
const owner=id(1),delivery=id(2),foreign=id(3);
const token='synthetic-g68-client-passenger-jwt-9876543210';
const page=(clock,who=owner)=>({ownerId:who,generatedAt:clock-100,
 expiresAt:clock+5000,nextCursor:null,items:[{
  serviceId:delivery,kind:'DELIVERY',status:'in_progress',
  createdAt:clock-1000,revision:2
 }]});
const dto=(status='disputed',extras={})=>({
 mode:'STAGING_DEMO_ONLY',deliveryId:delivery,ownerId:owner,
 state:status,revision:3,vehicleKind:'MOTO',assignmentPersisted:true,
 proofVerified:['delivered','disputed','returned'].includes(status),
 qaOnly:true,productionEnabled:false,liveDeliveriesEnabled:false,...extras
});
const http=(data=dto())=>({status:200,ok:true,redirected:false,
 headers:{get:k=>k==='content-type'?'application/json':null},
 text:async()=>JSON.stringify(data)
});
const stage={enabled:true,contractCertified:true,
 stagingRuntimeVerified:true,g68SenderContractCertified:true,
 origin:'https://staging.example.invalid',pinnedOrigin:'https://staging.example.invalid'};
function fixture({httpFlags={},fetchImpl=async()=>http(),direct=null}={}){
 let subject=owner,jwt=token,clock=T;
 const opts={now:()=>clock,
  authProvider:{readSession:async()=>({
   role:'passenger',subject,token:jwt,expiresAt:T+120000}),
   signOut:async()=>{}},
  senderCustodyHttpOptions:{...stage,...httpFlags,fetchImpl},
  ...(direct?{senderCustodyOptions:direct}:{})
 };
 const client=createClientExperience(opts);
 return {client,now:()=>clock,advance:ms=>clock+=ms,
  changeUser:x=>subject=x,rotate:t=>jwt=t};
}
async function login(f){
 assert.equal((await f.client.refreshSession()).ok,true);
 assert.equal(f.client.acceptHistory(page(f.now())),true);
}
test('R65 Client defaults OFF even with a function and no G68 runtime certification',async()=>{
 let hits=0;
 const f=fixture({httpFlags:{g68SenderContractCertified:false},
  fetchImpl:async()=>{hits++;return http();}});
 await login(f);
 assert.equal(f.client.snapshot().senderCustody.readReady,false);
 assert.equal((await f.client.readOwnDeliveryCustody(delivery)).code,
  'SENDER_CUSTODY_NOT_CERTIFIED');
 assert.equal(hits,0);
});
test('R65 Client G68 QA opt-in projects only sender-owned status, no private proofRef',async()=>{
 const urls=[];
 const f=fixture({fetchImpl:async(url,req)=>{
  urls.push([url,req.method,req.headers.Authorization]);
  return http();
 }});
 await login(f);
 assert.equal(f.client.snapshot().senderCustody.readReady,true);
 const r=await f.client.readOwnDeliveryCustody(delivery);
 assert.equal(r.ok,true);
 const snap=f.client.snapshot();
 assert.equal(snap.senderCustody.deliveryId,delivery);
 assert.equal(snap.senderCustody.state,'disputed');
 assert.equal(snap.senderCustody.proofVerified,true);
 assert.equal(snap.senderCustody.productionEnabled,false);
 assert.equal(snap.senderCustody.qaOnly,true);
 assert.equal(urls.length,1);
 assert(urls[0][0].endsWith('/sender/deliveries/'+delivery+'/custody'));
 assert.equal(urls[0][1],'GET');
 assert.equal(urls[0][2],'Bearer '+token);
 assert.equal(JSON.stringify(snap).includes(token),false);
 assert.equal(JSON.stringify(snap).includes('proofRef'),false);
});
test('R65 competing direct callback and HTTPS configuration must fail closed',async()=>{
 let hits=0;
 const f=fixture({direct:{enabled:true,contractCertified:true,
  stagingRuntimeVerified:true,readOwnDelivery:async()=>{hits++;return {ok:true,status:200,data:dto()};}},
  fetchImpl:async()=>{hits++;return http();}});
 await login(f);
 assert.equal(f.client.snapshot().senderCustody.readReady,false);
 assert.equal((await f.client.readOwnDeliveryCustody(delivery)).ok,false);
 assert.equal(hits,0);
});
test('R65 G68 false independent proof cannot be shown after an earlier verified proof',async()=>{
 let calls=0;
 const f=fixture({fetchImpl:async()=>http(calls++===0?dto('delivered'):
  dto('disputed',{proofVerified:false}))});
 await login(f);
 assert.equal((await f.client.readOwnDeliveryCustody(delivery)).ok,true);
 assert.equal(f.client.snapshot().senderCustody.proofVerified,true);
 assert.equal((await f.client.readOwnDeliveryCustody(delivery)).code,
  'SENDER_CUSTODY_UNVERIFIED');
 assert.equal(f.client.snapshot().senderCustody.proofVerified,false);
});
test('R65 G68 403 clears Passenger session and prevents returning sender proof',async()=>{
 const f=fixture({fetchImpl:async()=>({
  ok:false,status:403,redirected:false
 })});
 await login(f);
 assert.equal((await f.client.readOwnDeliveryCustody(delivery)).ok,false);
 assert.equal(f.client.snapshot().authenticated,false);
 assert.equal(f.client.snapshot().senderCustody.state,null);
});
test('R65 G68 data cannot reappear after TTL or JWT rotation',async()=>{
 const f=fixture();
 await login(f);
 await f.client.readOwnDeliveryCustody(delivery);
 f.advance(5001);
 assert.equal(f.client.snapshot().senderCustody.state,null);
 assert.equal((await f.client.readOwnDeliveryCustody(delivery)).code,
  'SENDER_DELIVERY_NOT_IN_OWN_HISTORY');
 await f.client.refreshSession();
 assert.equal(f.client.acceptHistory(page(f.now())),true);
 await f.client.readOwnDeliveryCustody(delivery);
 f.rotate('rotated-synthetic-g68-client-jwt-012345');
 await f.client.refreshSession();
 assert.equal(f.client.snapshot().history,null);
 assert.equal(f.client.snapshot().senderCustody.proofVerified,false);
});
test('R65 foreign Passenger session clears authorized owner evidence',async()=>{
 const f=fixture();
 await login(f);await f.client.readOwnDeliveryCustody(delivery);
 f.changeUser(foreign);
 assert.equal((await f.client.refreshSession()).ok,true);
 assert.equal(f.client.snapshot().senderCustody.state,null);
 assert.equal((await f.client.readOwnDeliveryCustody(delivery)).code,
  'SENDER_DELIVERY_NOT_IN_OWN_HISTORY');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createG121DeliveryRegistrationGateway} from './g121-delivery-registration-gateway.mjs';
const t=1800000000000;
const id=n=>'12100000-0000-4121-8121-'+String(n).padStart(12,'0');
const actor=id(1),requestKey=id(31),delivery=id(41);
const host='https://qore-b17-g121.onrender.com';
let current;
const identity=()=>({role:'passenger',subject:actor,
 token:'synthetic-g121-bearer-123456789',
 sessionRevision:6,authRevision:3,expiresAt:t+60000});
const receipt=(kind='MOTO',patch={})=>({
 mode:'STAGING_DEMO_ONLY',liveDeliveriesEnabled:false,
 serverPersisted:true,ownerId:actor,requestKey,deliveryId:delivery,
 vehicleKind:kind,status:'requested',revision:1,...patch
});
const response=(data=receipt(),status=200)=>({
 ok:status===200,status,redirected:false,
 headers:{get:k=>k==='content-type'?'application/json':null},
 text:async()=>JSON.stringify(data)
});
function setup(patch={}){
 current=identity();let calls=[];
 const gateway=createG121DeliveryRegistrationGateway({
  enabled:true,contractCertified:true,externalRuntimeVerified:true,
  passengerRlsVerified:true,ownerApproved:true,origin:host,pinnedOrigin:host,
  getSession:()=>current,fetchImpl:async(u,opts)=>{calls.push({u,opts});
   return response();},now:()=>t,...patch
 });
 return {gateway,calls};
}
const read=g=>g.read({requestKey,expectedSubject:actor,expectedSessionRevision:6});
test('G121 disabled without each independent certificate and pinned HTTPS',async()=>{
 let n=0;
 for(const field of ['enabled','contractCertified','externalRuntimeVerified',
  'passengerRlsVerified','ownerApproved']){
  const {gateway}=setup({[field]:false,fetchImpl:async()=>{n++;return response();}});
  assert.equal(gateway.isConfigured(),false);
  assert.equal((await read(gateway)).code,'G121_NOT_CERTIFIED');
 }
 for(const origin of ['http://qore-b17-g121.onrender.com',
  'https://evil.onrender.com','https://qore-b17-g121.onrender.com/path',
  'https://qore-b17-g121.onrender.com:8443']){
  assert.equal(setup({origin}).gateway.isConfigured(),false);
 }
 assert.equal(n,0);
});
test('G121 both MOTO and AUTO read same server deliveryId without any POST',async()=>{
 for(const kind of ['AUTO','MOTO']){
  const {gateway,calls}=setup({fetchImpl:async(u,opts)=>{
   calls.push({u,opts});return response(receipt(kind));
  }});
  const out=await read(gateway);
  assert.equal(out.ok,true);assert.equal(out.registrationOnly,true);
  assert.equal(out.deliveryId,delivery);assert.equal(out.vehicleKind,kind);
  assert.equal(out.productionEnabled,false);assert.equal(out.commercialEnabled,false);
  assert.deepEqual(Object.keys(out).sort(),[
   'ok','status','deliveryId','requestKey','vehicleKind','revision',
   'registrationOnly','commercialEnabled','qaOnly','productionEnabled'].sort());
  assert.equal(calls.length,1);
  assert.equal(calls[0].u,host+'/v1/staging/sender/deliveries/requests/'+requestKey);
  assert.equal(calls[0].opts.method,'GET');
  assert.equal(calls[0].opts.credentials,'omit');
  assert.equal(calls[0].opts.redirect,'error');
  assert.equal(calls[0].opts.headers.Authorization,'Bearer '+identity().token);
  assert.equal(calls[0].opts.body,undefined);
 }
});
test('G121 wrong actor/scope never reaches private endpoint',async()=>{
 let n=0;const {gateway}=setup({fetchImpl:async()=>{n++;return response();}});
 for(const scope of [
  {requestKey:'../other',expectedSubject:actor,expectedSessionRevision:6},
  {requestKey,expectedSubject:id(2),expectedSessionRevision:6},
  {requestKey,expectedSubject:actor,expectedSessionRevision:7}
 ]){
  assert.equal((await gateway.read(scope)).ok,false);
 }
 current={...identity(),role:'driver'};
 assert.equal((await read(gateway)).ok,false);
 assert.equal(n,0);
});
test('G121 forged 200 or priced/paid/assigned response never accepted',async()=>{
 for(const patch of [
  {ownerId:id(2)},{requestKey:id(78)},{deliveryId:'invalid'},
  {vehicleKind:'MOTO_RIDE'},{status:'delivered'},
  {liveDeliveriesEnabled:true},{serverPersisted:false},
  {revision:0},{fareGs:12000},{assignedDriver:'PRIVATE'}
 ]){
  const {gateway}=setup({fetchImpl:async()=>response(receipt('AUTO',patch))});
  assert.equal((await read(gateway)).code,'G121_UNVERIFIED_RECEIPT',JSON.stringify(patch));
 }
});
test('G121 404, 503, offline, JSON errors and redirects stay unconfirmed',async()=>{
 for(const reply of [
  response({error:'unknown'},404),response({},503),
  {...response(),redirected:true},
  {...response(),text:async()=>'{bad'},
  {...response(),headers:{get:()=> 'text/html'}}
 ]){
  const {gateway}=setup({fetchImpl:async()=>reply});
  assert.equal((await read(gateway)).ok,false);
 }
 assert.equal((await read(setup({fetchImpl:async()=>{throw Error('offline')}}).gateway)).code,'NETWORK_OR_TIMEOUT');
});
test('G121 JWT rotation during fetch invalidates private response',async()=>{
 let release;const pending=new Promise(done=>release=done);
 const {gateway}=setup({fetchImpl:async()=>pending});
 const work=read(gateway);
 await Promise.resolve();await Promise.resolve();await Promise.resolve();
 current={...identity(),token:'synthetic-g121-rotated-123456789'};
 release(response());
 assert.equal((await work).code,'STALE_SESSION_RESPONSE');
});
test('G121 concurrent reads or cancellation never turn into writes',async()=>{
 let release,calls=0;const pending=new Promise(done=>release=done);
 const {gateway}=setup({fetchImpl:async()=>{calls++;return pending;}});
 const first=read(gateway);
 assert.equal((await read(gateway)).code,'G121_IN_FLIGHT');
 gateway.cancelPending();
 release(response());
 assert.equal((await first).ok,false);
 assert.equal(calls<=1,true);
});

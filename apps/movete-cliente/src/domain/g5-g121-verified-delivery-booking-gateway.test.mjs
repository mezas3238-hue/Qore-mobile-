import test from 'node:test';
import assert from 'node:assert/strict';
import {createG5G121VerifiedDeliveryBookingGateway}
 from './g5-g121-verified-delivery-booking-gateway.mjs';
import {createClientExperience} from './client-experience.mjs';
const T=1800000000000;
const id=n=>'52400000-0000-4524-8524-'+String(n).padStart(12,'0');
const owner=id(1),other=id(2),delivery=id(3),key=id(4);
const origin='https://qore-b24-g5.onrender.com';
const flags={enabled:true,ownerApproved:true,g5ContractVerified:true,
 g121ContractVerified:true,externalRuntimeVerified:true,
 senderRlsVerified:true,ownerTariffGateVerified:true,
 origin,pinnedOrigin:origin,now:()=>T};
const body={requestKey:key,vehicleKind:'MOTO',category:'PARCEL',
 grams:1400,lengthCm:20,widthCm:10,heightCm:5,
 pickupTag:'PICKUP_NORTH',deliveryTag:'DELIVERY_SOUTH',
 restrictedItemDeclared:false};
const jwt='b24-verified-passenger-jwt-123456789';
const actor=()=>({role:'passenger',subject:owner,token:jwt,
 authRevision:1,sessionRevision:1,expiresAt:T+60000});
const g5=()=>({mode:'STAGING_DEMO_ONLY',liveDeliveriesEnabled:false,
 deliveryId:delivery,status:'requested',serverPersisted:true});
const proof=(vehicleKind='MOTO')=>({ok:true,status:200,
 deliveryId:delivery,requestKey:key,vehicleKind,revision:1,
 registrationOnly:true,commercialEnabled:false,qaOnly:true,
 productionEnabled:false});
const response=(dto,status=201)=>({ok:status>=200&&status<300,
 status,redirected:false,headers:{get:k=>k==='content-type'?'application/json':null},
 text:async()=>JSON.stringify(dto)});
function build({fetchImpl,readG121,options={},getSession}={}){
 const calls=[];
 const gateway=createG5G121VerifiedDeliveryBookingGateway({
  ...flags,...options,getSession:getSession??actor,
  readG121:readG121??(async args=>{
   calls.push({get:true,args});return proof();
  }),
  fetchImpl:fetchImpl??(async(url,req)=>{
   calls.push({post:true,url,req,body:JSON.parse(req.body)});
   return response(g5());
  })
 });
 return {gateway,calls};
}
const send=(g,b=body)=>g.send('deliveryRequest',{
 body:b,expectedSubject:owner,expectedSessionRevision:1});
test('B24 G5 POST 201 never sufficient: private G121 GET same key/vehicle proves QA',async()=>{
 const {gateway,calls}=build();
 const a=await send(gateway);
 assert.equal(a.ok,true);
 assert.equal(a.status,201);
 assert.equal(a.data.serviceId,delivery);
 assert.equal(a.data.ownerId,owner);
 assert.equal(a.data.requestKey,key);
 assert.equal(a.data.operation,'deliveryRequest');
 assert.equal(a.bookingConfirmedForProduction,false);
 assert.equal(a.commercialEnabled,false);
 assert.equal(calls.length,2);
 assert.equal(calls[0].url,origin+'/v1/staging/sender/deliveries/request');
 assert.equal(calls[0].req.method,'POST');
 assert.deepEqual(calls[0].body,body);
 assert.equal(calls[0].req.credentials,'omit');
 assert.equal(calls[1].get,true);
 assert.equal(calls[1].args.expectedSubject,owner);
 assert.equal(calls[1].args.requestKey,key);
});
test('B24 no G5 POST if any approval flag is false, invalid tags or wrong actor',async()=>{
 for(const flag of ['enabled','ownerApproved','g5ContractVerified','g121ContractVerified',
  'externalRuntimeVerified','senderRlsVerified','ownerTariffGateVerified']){
  const {gateway,calls}=build({options:{[flag]:false}});
  assert.equal(gateway.isConfigured(),false);
  assert.equal((await send(gateway)).ok,false);
  assert.equal(calls.length,0);
 }
 const {gateway,calls}=build();
 for(const b of [
  {...body,pickupTag:'Calle Palma 123'},
  {...body,deliveryTag:body.pickupTag},
  {...body,grams:11000},{...body,category:'RESTRICTED'},
  {...body,routeDistance:5000}
 ]){
  assert.equal((await send(gateway,b)).code,'G5_INVALID_DELIVERY_SCOPE');
 }
 assert.equal(calls.length,0);
 const different=await gateway.send('deliveryRequest',{
  body,expectedSubject:other,expectedSessionRevision:1});
 assert.equal(different.ok,false);
 assert.equal(calls.length,0);
});
test('B24 mismatched delivery ID or MOTO/AUTO proof cannot confirm G5',async()=>{
 for(const bad of [
  {dto:{...g5(),deliveryId:other}},
  {proof:{...proof(),vehicleKind:'AUTO'}},
  {proof:{...proof(),requestKey:other}},
  {proof:{...proof(),deliveryId:other}},
  {proof:{...proof(),productionEnabled:true}},
  {proof:{...proof(),revision:0}},
  {dto:{...g5(),commercialEnabled:true}},
  {dto:{...g5(),status:'dispatched'}}
 ]){
  let calls=0;
  const {gateway}=build({
   fetchImpl:async()=>{calls++;return response(bad.dto??g5());},
   readG121:async()=>bad.proof??proof()
  });
  assert.equal((await send(gateway)).ok,false,JSON.stringify(bad));
  assert.equal(calls,1);
 }
});
test('B24 POST response lost is uncertain; G121 independent GET can reconcile without repeat',async()=>{
 let posts=0,reads=0;
 const {gateway}=build({
  fetchImpl:async()=>{posts++;throw Error('lost ACK after commit');},
  readG121:async()=>{reads++;return proof();}
 });
 assert.equal((await send(gateway)).ok,false);
 const recovered=await gateway.reconcile('deliveryRequest',{
  requestKey:key,expectedSubject:owner,expectedSessionRevision:1});
 assert.equal(recovered.ok,true);
 assert.equal(recovered.status,200);
 assert.equal(recovered.recoveredWithoutPost,true);
 assert.equal(recovered.data.serviceId,delivery);
 assert.equal(posts,1);
 assert.equal(reads,1);
});
test('B24 foreign / unavailable G121 is not permission to repeat G5',async()=>{
 let posts=0;
 const {gateway}=build({
  fetchImpl:async()=>{posts++;return response(g5());},
  readG121:async()=>({ok:false,code:'G121_NOT_FOUND',status:404})
 });
 assert.equal((await send(gateway)).code,'BOOKING_RECONCILIATION_UNKNOWN');
 assert.equal(posts,1);
 assert.equal((await gateway.reconcile('deliveryRequest',{
  requestKey:key,expectedSubject:owner,expectedSessionRevision:1})).ok,false);
 assert.equal(posts,1);
});
test('B24 session revocation after G5 must reject successful reply',async()=>{
 let token=jwt;
 const {gateway}=build({getSession:()=>({...actor(),token}),
  fetchImpl:async()=>{token='b24-revoked-different-token-123456789';return response(g5());}
 });
 assert.equal((await send(gateway)).code,'STALE_SESSION_RESPONSE');
});
test('B24 ClientExperience: SecureStore B19 -> G5 POST -> G121 GET -> mutation acknowledged',async()=>{
 let record=null,posts=0,gets=0;
 const app=createClientExperience({now:()=>T,
  authProvider:{readSession:async()=>({role:'passenger',subject:owner,
   token:jwt,expiresAt:T+60000}),signOut:async()=>{}},
  deliveryRecoveryStore:{
   read:async()=>record,write:async x=>{record=x;},
   clear:async()=>{record=null;}
  },
  deliveryRegistrationOptions:{enabled:true,contractCertified:true,
   externalRuntimeVerified:true,passengerRlsVerified:true,ownerApproved:true,
   origin,pinnedOrigin:origin,
   fetchImpl:async()=>{gets++;return response({
    mode:'STAGING_DEMO_ONLY',liveDeliveriesEnabled:false,
    serverPersisted:true,ownerId:owner,requestKey:key,deliveryId:delivery,
    vehicleKind:'MOTO',status:'requested',revision:1
   },200)}},
  deliveryG5QaOptions:{...flags,fetchImpl:async()=>{
   posts++;assert.equal(record.requestKey,key);
   return response(g5());
  }}
 });
 assert.equal((await app.refreshSession()).ok,true);
 assert.equal(app.snapshot().deliveryQaRegistration.ready,true);
 assert.equal(app.prepareDelivery(body).ok,true);
 const answer=await app.submit();
 assert.equal(answer.ok,true);
 assert.equal(app.snapshot().mutation.phase,'acknowledged');
 assert.equal(posts,1);assert.equal(gets,1);
 assert.equal((await app.readUnconfirmedDeliveryRegistration()).ok,true);
 assert.equal(app.snapshot().deliveryRegistration.deliveryId,delivery);
 assert.equal(gets,2);
 assert.equal((await app.submit()).code,'NO_READY_REQUEST');
 assert.equal(posts,1);
 assert.equal(app.snapshot().deliveryQaRegistration.commercialEnabled,false);
});

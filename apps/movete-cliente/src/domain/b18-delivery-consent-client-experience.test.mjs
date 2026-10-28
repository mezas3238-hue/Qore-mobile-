import test from 'node:test';
import assert from 'node:assert/strict';
import {createClientExperience} from './client-experience.mjs';

const T=1800000000000;
const id=n=>'12200000-0000-4122-8122-'+String(n).padStart(12,'0');
const owner=id(1),requestKey=id(2),deliveryId=id(3),quoteId=id(4),
 quoteRequestKey=id(5),confirmKey=id(6),consentId=id(7);
const host='https://qore-b18-g122.onrender.com';
const body=k=>({requestKey,vehicleKind:k,category:'PARCEL',
 grams:1400,lengthCm:30,widthCm:12,heightCm:10,pickupTag:'PICKUP_NORTH',
 deliveryTag:'DELIVERY_SOUTH',restrictedItemDeclared:false});
const http=(data,status)=>({ok:status>=200&&status<300,status,
 redirected:false,headers:{get:k=>k==='content-type'?'application/json':null},
 text:async()=>JSON.stringify(data)});
const registration=kind=>({mode:'STAGING_DEMO_ONLY',
 liveDeliveriesEnabled:false,serverPersisted:true,ownerId:owner,
 requestKey,deliveryId,vehicleKind:kind,status:'requested',revision:1});
const fare=(amountGs=30000)=>({mode:'STAGING_DEMO_ONLY',livePaymentsEnabled:false,
 serverPriced:true,ownerId:owner,quoteId,amountGs,fareMode:'DELIVERY',
 subjectKind:'DELIVERY',subjectId:deliveryId,expiresAt:T+30000,
 fareVersion:'qa-cargo-v2',routingVerified:true,
 quote:{id:quoteId,mode:'DELIVERY',subjectKind:'DELIVERY',subjectId:deliveryId,
 ruleVersion:'qa-cargo-v2',subtotalPyg:amountGs,tollsPyg:0,
 totalPyg:amountGs,commissionBps:1200,commissionPyg:3600,
 providerPyg:amountGs-3600,expiresAt:new Date(T+30000).toISOString()}});
const consent=kind=>({mode:'STAGING_DEMO_ONLY',liveDeliveriesEnabled:false,
 paymentAuthorized:false,dispatchEnabled:false,ownerId:owner,consentId,
 deliveryId,quoteId,confirmationKey:confirmKey,vehicleKind:kind,
 acceptedTotalGs:30000,fareVersion:'qa-cargo-v2',
 status:'confirmed_qa',serverPersisted:true});
function build(kind,{allowConsent=true,tamperReceipt=false}={}){
 let token='synthetic-passenger-session-1234567890',calls=[];
 const session=()=>({role:'passenger',subject:owner,token,
  expiresAt:T+60000});
 const stage=()=>({role:'passenger',subject:owner,token,
  sessionRevision:1,authRevision:1,expiresAt:T+60000});
 const deliveryRegistrationOptions={enabled:true,contractCertified:true,
  externalRuntimeVerified:true,passengerRlsVerified:true,ownerApproved:true,
  origin:host,pinnedOrigin:host,
  fetchImpl:async(url,config)=>{
   calls.push({url,body:config.body,method:config.method});
   return http(registration(kind),200);
  }};
 const deliveryG122Options={enabled:allowConsent,contractCertified:true,
  externalRuntimeVerified:true,ownerTariffVerified:true,
  officialRoutingVerified:true,g123FenceVerified:true,ownerApproved:true,
  sourceOrigin:host,pinnedOrigin:host,
  fetchImpl:async(url,config)=>{
   calls.push({url,body:config.body,method:config.method});
   if(url.endsWith('/fares/quote'))return http(fare(),201);
   return http(consent(tamperReceipt?'AUTO':kind),200);
  }};
 const app=createClientExperience({now:()=>T,
  authProvider:{readSession:session,signOut:async()=>{}},
  gateway:{send:async()=>({ok:false,code:'NETWORK_OR_TIMEOUT'})},
  deliveryRegistrationOptions,deliveryG122Options
 });
 return {app,calls,rotate:()=>{token='rotated-passenger-session-1234567890';}};
}
test('B18 both AUTO/MOTO G121 -> G7 server quote -> G122 explicit consent, no courier',async()=>{
 for(const kind of ['AUTO','MOTO']){
  const {app,calls}=build(kind);
  assert.equal((await app.refreshSession()).ok,true);
  assert.equal(app.prepareDelivery(body(kind)).ok,true);
  assert.equal((await app.submit()).code,'NETWORK_OR_TIMEOUT');
  const reg=await app.readUnconfirmedDeliveryRegistration();
  assert.equal(reg.ok,true);
  assert.equal(app.snapshot().deliveryPriceConsent.canQuote,true);
  const q=await app.quoteRecoveredDelivery(quoteRequestKey);
  assert.equal(q.ok,true);
  assert.equal(q.quote.amountGs,30000);
  assert.equal(app.snapshot().deliveryPriceConsent.canConfirm,true);
  const result=await app.confirmRecoveredDeliveryQuote({
   confirmationKey:confirmKey,acceptedTotalGs:30000,
   acceptedFareVersion:'qa-cargo-v2'
  });
  assert.equal(result.ok,true);
  assert.equal(result.deliveryId,deliveryId);
  const state=app.snapshot();
  assert.equal(state.deliveryPriceConsent.phase,'confirmed_qa');
  assert.equal(state.deliveryPriceConsent.paymentAuthorized,false);
  assert.equal(state.deliveryPriceConsent.dispatchEnabled,false);
  assert.equal(state.mutation.phase,'failed');
  assert.deepEqual(calls.map(c=>c.method),['GET','POST','POST']);
  assert.deepEqual(JSON.parse(calls[1].body),{requestKey:quoteRequestKey,
   fareMode:'DELIVERY',subjectKind:'DELIVERY',subjectId:deliveryId});
  assert.deepEqual(JSON.parse(calls[2].body),{deliveryId,quoteId,
   confirmationKey:confirmKey,acceptedTotalGs:30000,
   acceptedFareVersion:'qa-cargo-v2'});
 }
});
test('B18 no Owner real tariff certificate blocks all price and consent traffic',async()=>{
 const {app,calls}=build('MOTO',{allowConsent:false});
 await app.refreshSession();app.prepareDelivery(body('MOTO'));await app.submit();
 await app.readUnconfirmedDeliveryRegistration();
 assert.equal(app.snapshot().deliveryPriceConsent.contractReady,false);
 assert.equal((await app.quoteRecoveredDelivery(quoteRequestKey)).code,'G122_NOT_CERTIFIED');
 assert.equal(calls.length,1);
});
test('B18 backend mismatch AUTO consent for MOTO never becomes confirmed_qa',async()=>{
 const {app,calls}=build('MOTO',{tamperReceipt:true});
 await app.refreshSession();app.prepareDelivery(body('MOTO'));await app.submit();
 await app.readUnconfirmedDeliveryRegistration();
 await app.quoteRecoveredDelivery(quoteRequestKey);
 assert.equal((await app.confirmRecoveredDeliveryQuote({
  confirmationKey:confirmKey,acceptedTotalGs:30000,
  acceptedFareVersion:'qa-cargo-v2'
 })).ok,false);
 assert.equal(app.snapshot().deliveryPriceConsent.phase,'consent_unknown');
 assert.equal(app.snapshot().deliveryPriceConsent.consentId,null);
 assert.equal(calls.length,3);
});
test('B18 cannot price a local draft without a real G121 registration',async()=>{
 const {app,calls}=build('AUTO');
 await app.refreshSession();app.prepareDelivery(body('AUTO'));
 assert.equal((await app.quoteRecoveredDelivery(quoteRequestKey)).code,
  'DELIVERY_REGISTRATION_NOT_VERIFIED');
 assert.equal(calls.length,0);
});

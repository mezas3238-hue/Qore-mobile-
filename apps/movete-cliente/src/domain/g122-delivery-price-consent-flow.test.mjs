import test from 'node:test';
import assert from 'node:assert/strict';
import {createG122DeliveryPriceConsentFlow} from './g122-delivery-price-consent-flow.mjs';
const t=1800000000000,uuid=n=>'12200000-0000-4122-8122-'+String(n).padStart(12,'0');
const owner=uuid(1),deliveryId=uuid(2),requestKey=uuid(3),quoteId=uuid(4),consentId=uuid(5);
const quoteKey=uuid(6),confirmationKey=uuid(7),host='https://qore-b18-g122.onrender.com';
let session;
const login=()=>({role:'passenger',subject:owner,
 token:'synthetic-g122-passenger-bearer-1234567890',
 authRevision:3,sessionRevision:5,expiresAt:t+60000});
const scope={ownerId:owner,requestKey,deliveryId,vehicleKind:'MOTO',sessionRevision:5};
const fare=(mod={})=>({mode:'STAGING_DEMO_ONLY',livePaymentsEnabled:false,
 serverPriced:true,ownerId:owner,quoteId,amountGs:22000,
 fareMode:'DELIVERY',subjectKind:'DELIVERY',subjectId:deliveryId,
 expiresAt:t+25000,fareVersion:'cargo-moto-approved-v1',routingVerified:true,
 quote:{id:quoteId,mode:'DELIVERY',subjectKind:'DELIVERY',subjectId:deliveryId,
 ruleVersion:'cargo-moto-approved-v1',subtotalPyg:21000,tollsPyg:1000,
 totalPyg:22000,commissionBps:1200,commissionPyg:2640,
 providerPyg:19360,expiresAt:new Date(t+25000).toISOString()},...mod});
const consent=(mod={})=>({mode:'STAGING_DEMO_ONLY',liveDeliveriesEnabled:false,
 paymentAuthorized:false,dispatchEnabled:false,ownerId:owner,consentId,
 deliveryId,quoteId,confirmationKey,vehicleKind:'MOTO',acceptedTotalGs:22000,
 fareVersion:'cargo-moto-approved-v1',status:'confirmed_qa',serverPersisted:true,...mod});
const response=(data,status)=>({ok:true,status,redirected:false,
 headers:{get:key=>key==='content-type'?'application/json':null},
 text:async()=>JSON.stringify(data)});
const flags={enabled:true,contractCertified:true,externalRuntimeVerified:true,
 ownerTariffVerified:true,officialRoutingVerified:true,
 g123FenceVerified:true,ownerApproved:true};
function make({options={},fareResponse=fare(),consentResponse=consent(),kind='MOTO'}={}){
 const events=[];session=login();
 let stamp=t;
 const flow=createG122DeliveryPriceConsentFlow({
  ...flags,sourceOrigin:host,pinnedOrigin:host,getSession:()=>session,now:()=>stamp,
  fetchImpl:async (url,options)=>{
   events.push({url,options,body:JSON.parse(options.body)});
   if(url.endsWith('/fares/quote'))return response(fareResponse,201);
   if(url.endsWith('/quotes/confirm'))return response(consentResponse,200);
   throw Error('unexpected route');
  },...options
 });
 return {flow,events,tick:ms=>stamp+=ms,scope:{...scope,vehicleKind:kind}};
}
test('B18 disabled by default and by any missing real certification',async()=>{
 for(const flag of Object.keys(flags)){
  const {flow,events}=make({options:{[flag]:false}});
  assert.equal(flow.isConfigured(),false);
  assert.equal((await flow.quote(scope,quoteKey)).code,'G122_NOT_CERTIFIED');
  assert.equal(events.length,0);
 }
 for(const bad of ['http://qore-b18-g122.onrender.com',
  'https://qore-b18-g122.onrender.com/path','https://foreign.example']){
  assert.equal(make({options:{sourceOrigin:bad}}).flow.isConfigured(),false);
 }
});
test('B18 shows exact G7 delivery PYG and consents with explicit key, never PSP/dispatch',async()=>{
 const {flow,events}=make();
 const q=await flow.quote(scope,quoteKey);
 assert.equal(q.ok,true);
 assert.equal(q.quote.amountGs,22000);
 assert.equal(flow.snapshot().canConfirm,true);
 assert.deepEqual(events[0].body,{requestKey:quoteKey,fareMode:'DELIVERY',
  subjectKind:'DELIVERY',subjectId:deliveryId});
 assert.equal(events[0].options.method,'POST');
 assert.equal(events[0].options.credentials,'omit');
 assert.equal((await flow.confirm({
  confirmationKey,acceptedTotalGs:22001,acceptedFareVersion:q.quote.fareVersion
 })).code,'PRICE_TAMPERED');
 assert.equal(events.length,1);
 const c=await flow.confirm({confirmationKey,acceptedTotalGs:q.quote.amountGs,
  acceptedFareVersion:q.quote.fareVersion});
 assert.equal(c.ok,true);
 assert.equal(c.consentId,consentId);
 assert.equal(c.productionEnabled,false);
 assert.equal(c.paymentAuthorized,false);
 assert.equal(c.dispatchEnabled,false);
 assert.equal(flow.snapshot().phase,'confirmed_qa');
 assert.deepEqual(events[1].body,{deliveryId,quoteId,confirmationKey,
  acceptedTotalGs:22000,acceptedFareVersion:'cargo-moto-approved-v1'});
 assert.equal((await flow.confirm({confirmationKey,acceptedTotalGs:22000,
  acceptedFareVersion:q.quote.fareVersion})).code,'G122_NO_FRESH_QUOTE');
 assert.equal(events.length,2);
});
test('B18 malformed quotes, foreign IDs, mismatched totals or extra fields rejected',async()=>{
 const samples=[
  {ownerId:uuid(11)},{quoteId:'not-uuid'}, {subjectId:uuid(21)},
  {amountGs:22001},{routingVerified:false},{livePaymentsEnabled:true},
  {fareMode:'AUTO'},{invoice:'FORGED'}, {expiresAt:t-1},
  {quote:{...fare().quote,totalPyg:22001}},
  {quote:{...fare().quote,providerPyg:123}},
  {quote:{...fare().quote,expiresAt:'not-a-date'}}
 ];
 for(const mod of samples){
  const {flow,events}=make({fareResponse:fare(mod)});
  assert.equal((await flow.quote(scope,quoteKey)).ok,false,JSON.stringify(mod));
  assert.equal(flow.snapshot().phase,'quote_unknown');
  assert.equal(flow.snapshot().quote,null);
  assert.equal((await flow.quote(scope,uuid(25))).code,'G122_ALREADY_STARTED');
  assert.equal(events.length,1);
 }
});
test('B18 confirmation mismatch or synthetic dispatchEnabled=true cannot authorize delivery',async()=>{
 for(const mod of [{dispatchEnabled:true},{paymentAuthorized:true},
  {deliveryId:uuid(22)},{ownerId:uuid(23)},{vehicleKind:'AUTO'},
  {confirmationKey:uuid(24)},{acceptedTotalGs:22500},
  {fareVersion:'other'},{serverPersisted:false},{status:'accepted'},
  {courierId:uuid(27)}]){
  const {flow,events}=make({consentResponse:consent(mod)});
  assert.equal((await flow.quote(scope,quoteKey)).ok,true);
  assert.equal((await flow.confirm({confirmationKey,acceptedTotalGs:22000,
   acceptedFareVersion:'cargo-moto-approved-v1'})).ok,false);
  assert.equal(flow.snapshot().phase,'consent_unknown');
  assert.equal(flow.snapshot().consentId,null);
  assert.equal(events.length,2);
 }
});
test('B18 expired quote prevents POST, then requires fresh flow',async()=>{
 const {flow,events,tick}=make();
 assert.equal((await flow.quote(scope,quoteKey)).ok,true);
 tick(26000);
 assert.equal(flow.snapshot().canConfirm,false);
 assert.equal((await flow.confirm({confirmationKey,acceptedTotalGs:22000,
  acceptedFareVersion:'cargo-moto-approved-v1'})).code,'QUOTE_EXPIRED');
 assert.equal(events.length,1);
});
test('B18 ACK lost after confirm never sends automatic POST again',async()=>{
 const {flow,events}=make({options:{
  fetchImpl:async (url,options)=>{
   events.push({url,options});
   if(url.endsWith('/fares/quote'))return response(fare(),201);
   throw Error('offline after server commit');
  }
 }});
 await flow.quote(scope,quoteKey);
 assert.equal((await flow.confirm({confirmationKey,acceptedTotalGs:22000,
  acceptedFareVersion:'cargo-moto-approved-v1'})).ok,false);
 assert.equal(flow.snapshot().phase,'consent_unknown');
 assert.equal((await flow.confirm({confirmationKey,acceptedTotalGs:22000,
  acceptedFareVersion:'cargo-moto-approved-v1'})).ok,false);
 assert.equal(events.length,2);
});
test('B18 rotated JWT in flight cannot affirm price or consent',async()=>{
 let release;const waiting=new Promise(resolve=>release=resolve),events=[];
 const {flow}=make({options:{
  fetchImpl:async(url,init)=>{events.push(init);return waiting;}
 }});
 const work=flow.quote(scope,quoteKey);
 await Promise.resolve();await Promise.resolve();await Promise.resolve();
 session={...login(),token:'rotated-passenger-bearer-12345678900'};
 release(response(fare(),201));
 assert.equal((await work).code,'G122_QUOTE_UNVERIFIED');
 assert.equal(flow.snapshot().phase,'quote_unknown');
 assert.equal(events.length,1);
});
test('B18 clear invalidates in-flight response and exposes no other account data',async()=>{
 let release;const pending=new Promise(resolve=>release=resolve);
 const {flow}=make({options:{fetchImpl:async()=>pending}});
 const request=flow.quote(scope,quoteKey);
 await Promise.resolve();await Promise.resolve();
 flow.clear();
 release(response(fare(),201));
 assert.equal((await request).ok,false);
 assert.equal(flow.snapshot().phase,'idle');
 assert.equal(flow.snapshot().deliveryId,null);
});
test('B18 bad owner/key/scope refuses any HTTP',async()=>{
 const {flow,events}=make();
 assert.equal((await flow.quote({...scope,ownerId:uuid(66)},quoteKey)).ok,false);
 assert.equal((await flow.quote(scope,'../../bad')).ok,false);
 assert.equal(events.length,0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createClientExperience} from './client-experience.mjs';
const now=1900000000000;
const id=n=>'94940000-0000-4949-8949-'+String(n).padStart(12,'0');
const owner=id(1),routeId=id(2),quoteId=id(3),routeKey=id(4);
const key=id(5),tripId=id(6),campaign=id(7),foreign=id(8);
const input={origin:'Centro de Asunción',destination:'Villa Morra',service:'economico',quoteRequestKey:routeKey};
const route={routeId,ownerId:owner,quoteRequestKey:routeKey,
 origin:input.origin,destination:input.destination,service:'economico',
 routingVerified:true,coverageVerified:true,expiresAt:now+300000,
 source:'SERVER_VERIFIED_ROUTE',status:'ROUTE_VERIFIED_QA'};
const quote={mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
 ownerId:owner,routeId,quoteId,quoteRequestKey:routeKey,fareMode:'AUTO',
 service:'economico',currency:'PYG',amountGs:30000,fareVersion:'g94_qa_1',
 expiresAt:now+120000,serverPriced:true,routingVerified:true,status:'QUOTED_QA'};
const preview={mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
 ownerId:owner,quoteId,campaignId:campaign,serviceKind:'AUTO_RIDE',
 currency:'PYG',originalFareGs:30000,commissionBps:1500,subsidyBps:1000,
 nominalCommissionGs:4500,customerSubsidyGs:3000,customerPaysGs:27000,
 driverReceivesGs:25500,platformRetainsGs:1500,fareVersion:'g94_qa_1',
 expiresAt:now+90000,serverPersisted:true};
const booked={mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
 ownerId:owner,requestKey:key,quoteId,routeId,tripId,
 revision:1,serverPersisted:true,status:'ACCEPTED_QA'};
const finance={mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
 ownerId:owner,bookingKey:key,tripId,quoteId,tripState:'searching',
 tripRevision:1,financialState:'RESERVED_QA',customerPaysGs:27000,
 driverReceivesGs:25500,customerSubsidyGs:3000,platformRetainsGs:1500,
 originalEntriesBalanced:true,reversalEntriesBalanced:false,
 pspCollected:false,pspRefunded:false,serverPersisted:true};
const response=(data,status=200)=>({status,ok:status>=200&&status<300,
 redirected:false,headers:{get:k=>k==='content-type'?'application/json':null},
 text:async()=>JSON.stringify(data)});
function setup({receipt=finance,financialCertified=true,bookFails=false}={}){
 let actor={subject:owner,role:'passenger',token:'synthetic-passenger-jwt-example-abcdefghijklmnop',
  expiresAt:now+600000};
 const calls=[];
 const c=createClientExperience({now:()=>now,
  authProvider:{readSession:async()=>actor,signOut:async()=>{}},
  autoG73HttpOptions:{enabled:true,contractCertified:true,
   stagingRuntimeVerified:true,routeProviderCertified:true,
   subsidyContractCertified:true,financialContractCertified:financialCertified,
   origin:'https://qa.example.invalid',pinnedOrigin:'https://qa.example.invalid',
   fetchImpl:async(url,req)=>{
    const path=new URL(url).pathname;
    calls.push({path,method:req.method,body:req.body??null,
     bearer:req.headers.Authorization});
    if(path.endsWith('/routes'))return response(route);
    if(path.endsWith('/prequote'))return response(quote);
    if(path.endsWith('/subsidy'))return response(preview);
    if(path.endsWith('/book'))return bookFails?response({},503):response(booked,201);
    if(path.endsWith('/bookings/'+key))return response(booked);
    if(path.endsWith('/financial-status'))return receipt===null?response({},503):response(receipt);
    throw Error('Unexpected network path');
   }
  }
 });
 return {c,calls,rotate:()=>actor={...actor,token:'rotated-passenger-jwt-example-abcdefghijklmnop'},logout:()=>c.signOut()};
}
async function bookedAuto(f){
 assert.equal((await f.c.refreshSession()).ok,true);
 assert.equal((await f.c.requestAutoQuote(input)).ok,true);
 assert.equal((await f.c.loadAutoSubsidy()).ok,true);
 assert.equal(f.c.acceptAutoPrequote({quoteId,amountGs:30000,
  fareVersion:'g94_qa_1',campaignId:campaign,customerPaysGs:27000}).ok,true);
 const result=await f.c.reserveQuotedAuto({requestKey:key});
 if(!result.ok)assert.equal((await f.c.reconcileQuotedAuto()).ok,true);
}
test('R72 only the G73+G93 confirmed booking can read G94 by GET; no PSP claim',async()=>{
 const f=setup();
 await f.c.refreshSession();
 assert.equal((await f.c.refreshAutoFinancialStatus()).code,'G94_BOOKING_NOT_VERIFIED');
 assert.equal(f.calls.length,0);
 await bookedAuto(f);
 assert.equal(f.c.snapshot().autoFinance.readReady,true);
 assert.equal(f.c.snapshot().autoFinance.financialState,null);
 const result=await f.c.refreshAutoFinancialStatus();
 assert.equal(result.ok,true);
 const found=f.c.snapshot().autoFinance;
 assert.equal(found.tripId,tripId);
 assert.equal(found.financialState,'RESERVED_QA');
 assert.equal(found.customerPaysGs,27000);
 assert.equal(found.customerSubsidyGs,3000);
 assert.equal(found.pspCollected,false);
 assert.equal(found.pspRefunded,false);
 assert.equal(found.productionEnabled,false);
 assert.deepEqual(f.calls.map(x=>x.method),['POST','POST','POST','POST','GET']);
 assert.equal(f.calls[4].path,'/v1/staging/rider/auto/bookings/'+key+'/financial-status');
 assert.equal(f.calls[4].body,null);
 assert.equal(JSON.stringify(found).includes(key),false);
 assert.equal(JSON.stringify(f.c.snapshot()).includes(f.calls[4].bearer),false);
});
test('R72 server-verified cancelled reversal and finished unsettled states never claim a refund',async()=>{
 for(const patch of [
  {tripState:'cancelled',tripRevision:2,financialState:'VOIDED_QA',reversalEntriesBalanced:true},
  {tripState:'completed',tripRevision:5,financialState:'COMPLETED_UNSETTLED_QA'}
 ]){
  const f=setup({receipt:{...finance,...patch}});await bookedAuto(f);
  assert.equal((await f.c.refreshAutoFinancialStatus()).ok,true);
  assert.equal(f.c.snapshot().autoFinance.financialState,patch.financialState);
  assert.equal(f.c.snapshot().autoFinance.pspRefunded,false);
 }
});
test('R72 rejected finance details never become visible, even if server answers 200',async()=>{
 for(const patch of [
  {ownerId:foreign},{bookingKey:foreign},{quoteId:foreign},{tripId:foreign},
  {tripRevision:0},{tripState:'cancelled'},{financialState:'VOIDED_QA'},
  {financialState:'PAID'},{reversalEntriesBalanced:true},{pspCollected:true},
  {pspRefunded:true},{originalEntriesBalanced:false},{commercialEnabled:true},
  {customerPaysGs:27500},{driverReceivesGs:25000},
  {customerSubsidyGs:2000},{platformRetainsGs:2000},{gps:'untrusted'}
 ]){
  const f=setup({receipt:{...finance,...patch}});await bookedAuto(f);
  assert.equal((await f.c.refreshAutoFinancialStatus()).ok,false,JSON.stringify(patch));
  assert.equal(f.c.snapshot().autoFinance.financialState,null);
  assert.equal(f.c.snapshot().autoFinance.customerPaysGs,null);
 }
});
test('R72 separate contract gate and missing SQL response fail closed, without financial request or values',async()=>{
 const no=setup({financialCertified:false});await bookedAuto(no);
 assert.equal(no.c.snapshot().autoFinance.readReady,false);
 assert.equal((await no.c.refreshAutoFinancialStatus()).ok,false);
 assert.equal(no.calls.some(x=>x.path.endsWith('/financial-status')),false);
 const outage=setup({receipt:null});await bookedAuto(outage);
 assert.equal((await outage.c.refreshAutoFinancialStatus()).ok,false);
 assert.equal(outage.c.snapshot().autoFinance.financialState,null);
});
test('R72 JWT rotation revokes local finance anchor and prevents reading another Passenger account',async()=>{
 const f=setup();await bookedAuto(f);
 assert.equal((await f.c.refreshAutoFinancialStatus()).ok,true);
 f.rotate();await f.c.refreshSession();
 assert.equal(f.c.snapshot().autoFinance.readReady,false);
 assert.equal(f.c.snapshot().autoFinance.financialState,null);
 assert.equal((await f.c.refreshAutoFinancialStatus()).ok,false);
});
test('R72 ambiguous booking may only use original GET reconciliation, then read finance',async()=>{
 const f=setup({bookFails:true});await bookedAuto(f);
 assert.equal(f.c.snapshot().autoFinance.readReady,true);
 assert.equal((await f.c.refreshAutoFinancialStatus()).ok,true);
 assert.equal(f.calls.filter(x=>x.path.endsWith('/book')).length,1);
 assert.equal(f.calls.filter(x=>x.path.endsWith('/bookings/'+key)).length,1);
});

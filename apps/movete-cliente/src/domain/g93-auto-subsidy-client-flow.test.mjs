import test from 'node:test';
import assert from 'node:assert/strict';
import {createClientExperience} from './client-experience.mjs';
import {projectAutoPrequoteScreen} from './f1-auto-prequote-screen-policy.mjs';

const t=1900000000000;
const id=n=>'93930000-0000-4939-8939-'+String(n).padStart(12,'0');
const owner=id(1),routeId=id(2),quoteId=id(3),
 routeKey=id(4),bookingKey=id(5),tripId=id(6),campaignId=id(7);
const input={origin:'Centro de Asunción',destination:'Villa Morra',
 service:'economico',quoteRequestKey:routeKey};
const route=()=>({routeId,ownerId:owner,quoteRequestKey:routeKey,
 origin:input.origin,destination:input.destination,service:'economico',
 routingVerified:true,coverageVerified:true,expiresAt:t+300000,
 source:'SERVER_VERIFIED_ROUTE',status:'ROUTE_VERIFIED_QA'});
const quote=()=>({mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
 ownerId:owner,routeId,quoteId,quoteRequestKey:routeKey,fareMode:'AUTO',
 service:'economico',currency:'PYG',amountGs:30000,fareVersion:'G93_auto_qa_1',
 expiresAt:t+120000,serverPriced:true,routingVerified:true,status:'QUOTED_QA'});
const subsidy=()=>({mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
 ownerId:owner,quoteId,campaignId,serviceKind:'AUTO_RIDE',currency:'PYG',
 originalFareGs:30000,commissionBps:1500,subsidyBps:1000,
 nominalCommissionGs:4500,customerSubsidyGs:3000,customerPaysGs:27000,
 driverReceivesGs:25500,platformRetainsGs:1500,
 fareVersion:'G93_auto_qa_1',expiresAt:t+90000,serverPersisted:true});
const booked=()=>({mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
 ownerId:owner,requestKey:bookingKey,quoteId,routeId,tripId,
 revision:1,serverPersisted:true,status:'ACCEPTED_QA'});
const reply=(body,status=200)=>({status,ok:status>=200&&status<300,
 redirected:false,headers:{get:k=>k==='content-type'?'application/json':null},
 text:async()=>JSON.stringify(body)});
function setup({preview=subsidy(),enabled=true}={}){
 let subject=owner,token='mock-qa-passenger-jwt-secure-abcdefghijklmnop';
 const calls=[];
 const c=createClientExperience({
  now:()=>t,
  authProvider:{readSession:async()=>({subject,role:'passenger',token,
   expiresAt:t+300000}),signOut:async()=>{}},
  autoG73HttpOptions:{
   enabled:true,contractCertified:true,stagingRuntimeVerified:true,
   routeProviderCertified:true,subsidyContractCertified:enabled,
   origin:'https://qa.onrender.com',pinnedOrigin:'https://qa.onrender.com',
   fetchImpl:async(url,req)=>{
    const path=new URL(url).pathname;
    calls.push({path,method:req.method,body:req.body});
    if(path.endsWith('/routes'))return reply(route());
    if(path.endsWith('/prequote'))return reply(quote());
    if(path.endsWith('/subsidy'))return preview===null?reply({},503):reply(preview);
    if(path.endsWith('/book'))return reply(booked(),201);
    if(path.endsWith('/bookings/'+bookingKey))return reply(booked());
    throw Error('UNEXPECTED_NETWORK_PATH');
   }
  }
 });
 return {c,calls,setSubject:s=>subject=s,setToken:s=>token=s};
}
async function quoted(f){
 assert.equal((await f.c.refreshSession()).ok,true);
 assert.equal((await f.c.requestAutoQuote(input)).ok,true);
}
const consent={quoteId,amountGs:30000,fareVersion:'G93_auto_qa_1',
 campaignId,customerPaysGs:27000};
test('R71 G93 requires independent server quote before consent/POST and shows 30k->27k only from server',async()=>{
 const f=setup();await quoted(f);
 assert.equal(f.c.snapshot().autoPrequote.subsidyRequired,true);
 assert.equal(f.c.snapshot().autoPrequote.subsidy,null);
 assert.equal(f.c.acceptAutoPrequote(consent).code,'G93_SUBSIDY_PREVIEW_REQUIRED');
 assert.equal((await f.c.reserveQuotedAuto({requestKey:bookingKey})).ok,false);
 assert.equal(f.calls.length,2);
 const ui0=projectAutoPrequoteScreen({prequote:f.c.snapshot().autoPrequote,
  authenticated:true,now:t});
 assert.equal(ui0.canAccept,false);assert.equal(ui0.canPreviewSubsidy,true);
 assert.equal((await f.c.loadAutoSubsidy()).ok,true);
 const receipt=f.c.snapshot().autoPrequote.subsidy;
 assert.equal(receipt.originalFareGs,30000);
 assert.equal(receipt.customerSubsidyGs,3000);
 assert.equal(receipt.customerPaysGs,27000);
 assert.equal(receipt.platformRetainsGs,1500);
 const previewCall=f.calls[2];
 assert.equal(previewCall.path,'/v1/staging/rider/auto/prequotes/'+quoteId+'/subsidy');
 assert.equal(previewCall.method,'POST');
 assert.equal(previewCall.body,undefined);
 const approved=projectAutoPrequoteScreen({
  prequote:f.c.snapshot().autoPrequote,authenticated:true,now:t});
 assert.equal(approved.canAccept,true);
 assert.equal(approved.subsidy.customerPaysGs,27000);
 assert.equal(f.c.acceptAutoPrequote({...consent,customerPaysGs:27500}).ok,false);
 assert.equal(f.c.acceptAutoPrequote({...consent,campaignId:id(8)}).ok,false);
 assert.equal(f.c.acceptAutoPrequote(consent).ok,true);
 assert.equal((await f.c.reserveQuotedAuto({requestKey:bookingKey})).ok,true);
 assert.equal(f.c.snapshot().autoPrequote.tripId,tripId);
 assert.deepEqual(f.calls.map(x=>x.method),['POST','POST','POST','POST']);
 assert.equal(f.calls[3].path,'/v1/staging/rider/auto/book');
 assert.equal(JSON.stringify(f.c.snapshot()).includes('mock-qa-passenger-jwt'),false);
});
test('R71 forged G93 settlement, wrong campaign, mismatched amount, expiry and extra fields block booking',async()=>{
 const invalid=[
  {ownerId:id(9)},{quoteId:id(9)},{campaignId:'not-uuid'},
  {serviceKind:'MOTO_RIDE'},{currency:'USD'},{commissionBps:1200},
  {subsidyBps:900},{originalFareGs:31000},{customerSubsidyGs:2900},
  {customerPaysGs:27500},{driverReceivesGs:25000},
  {platformRetainsGs:500},{fareVersion:'different'},
  {expiresAt:t-1},{expiresAt:t+200000},{commercialEnabled:true},
  {serverPersisted:false},{sensitiveDriverId:id(9)}
 ];
 for(const patch of invalid){
  const f=setup({preview:{...subsidy(),...patch}});
  await quoted(f);
  assert.equal((await f.c.loadAutoSubsidy()).ok,false,JSON.stringify(patch));
  assert.equal(f.c.snapshot().autoPrequote.subsidy,null);
  assert.equal(f.c.acceptAutoPrequote(consent).ok,false);
  assert.equal((await f.c.reserveQuotedAuto({requestKey:bookingKey})).ok,false);
  assert.equal(f.calls.filter(x=>x.path.endsWith('/book')).length,0);
 }
});
test('R71 G93 503 and JWT rotation never unlock stale pricing or duplicate booking',async()=>{
 const f=setup({preview:null});await quoted(f);
 assert.equal((await f.c.loadAutoSubsidy()).ok,false);
 assert.equal(f.c.snapshot().autoPrequote.subsidy,null);
 assert.equal(f.c.acceptAutoPrequote(consent).ok,false);
 assert.equal(f.calls.filter(x=>x.path.endsWith('/book')).length,0);
 const g=setup();await quoted(g);
 assert.equal((await g.c.loadAutoSubsidy()).ok,true);
 g.setToken('rotated-mock-qa-passenger-jwt-secure-abcdefghijkl');
 await g.c.refreshSession();
 assert.equal(g.c.snapshot().autoPrequote.subsidy,null);
 assert.equal(g.c.acceptAutoPrequote(consent).ok,false);
 assert.equal(g.calls.filter(x=>x.path.endsWith('/book')).length,0);
});
test('R71 synthetic legacy G73 without G93 flag is separate from actual native deployment gate',async()=>{
 const f=setup({enabled:false});await quoted(f);
 assert.equal(f.c.snapshot().autoPrequote.subsidyRequired,false);
 assert.equal((await f.c.loadAutoSubsidy()).ok,false);
 assert.equal(f.c.acceptAutoPrequote(consent).ok,true);
 // This legacy behavior exists only for injected QA fixtures. The actual
 // native G73 build requires the distinct G93 flag, checked elsewhere.
});

test('G116 new AUTO Owner commission 18 percent preserves exact 10 percent Passenger subsidy',async()=>{
 const dynamic={...subsidy(),commissionBps:1800,nominalCommissionGs:5400,
  driverReceivesGs:24600,platformRetainsGs:2400};
 const f=setup({preview:dynamic});
 await quoted(f);
 assert.equal((await f.c.loadAutoSubsidy()).ok,true);
 const shown=f.c.snapshot().autoPrequote.subsidy;
 assert.equal(shown.commissionBps,1800);
 assert.equal(shown.subsidyBps,1000);
 assert.equal(shown.customerSubsidyGs,3000);
 assert.equal(shown.customerPaysGs,27000);
 // Driver payout remains validated inside the server receipt, not exposed here.
 assert.equal(shown.platformRetainsGs,2400);
 assert.equal(f.c.acceptAutoPrequote(consent).ok,true);
 assert.equal((await f.c.reserveQuotedAuto({requestKey:bookingKey})).ok,true);
 assert.equal(f.calls.filter(x=>x.path.endsWith('/book')).length,1);
 const invalid=setup({preview:{...dynamic,platformRetainsGs:1500}});
 await quoted(invalid);
 assert.equal((await invalid.c.loadAutoSubsidy()).ok,false,
  'Client rejects rate change not matched by server ledger amounts');
});

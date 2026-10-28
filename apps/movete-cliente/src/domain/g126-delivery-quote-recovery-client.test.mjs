import test from 'node:test';
import assert from 'node:assert/strict';
import {createG122DeliveryPriceConsentFlow}
 from './g122-delivery-price-consent-flow.mjs';
import {createClientExperience} from './client-experience.mjs';

const T=1800000000000;
const id=n=>'12600000-0000-4126-8126-'+String(n).padStart(12,'0');
const owner=id(1),requestKey=id(2),deliveryId=id(3),quoteKey=id(4),
 quoteId=id(5),consentId=id(6),consentKey=id(7);
const origin='https://qore-g126-recovery.onrender.com';
const scope={ownerId:owner,requestKey,deliveryId,vehicleKind:'MOTO',
 sessionRevision:1};
const actor=()=>({subject:owner,role:'passenger',token:'g126-owner-private-token-123456789012',
 authRevision:1,sessionRevision:1,expiresAt:T+60000});
const options={enabled:true,contractCertified:true,externalRuntimeVerified:true,
 ownerTariffVerified:true,officialRoutingVerified:true,
 g123FenceVerified:true,ownerApproved:true,sourceOrigin:origin,pinnedOrigin:origin,
 now:()=>T};
const quote=()=>({mode:'STAGING_DEMO_ONLY',livePaymentsEnabled:false,
 serverPriced:true,ownerId:owner,quoteId,amountGs:22000,
 fareMode:'DELIVERY',subjectKind:'DELIVERY',subjectId:deliveryId,
 expiresAt:T+30000,fareVersion:'cargo_moto_owner_v7',routingVerified:true,
 quote:{id:quoteId,mode:'DELIVERY',subjectKind:'DELIVERY',subjectId:deliveryId,
 ruleVersion:'cargo_moto_owner_v7',subtotalPyg:22000,tollsPyg:0,
 totalPyg:22000,commissionBps:2500,commissionPyg:5500,
 providerPyg:16500,expiresAt:new Date(T+30000).toISOString()}});
const json=(data,status=201)=>({ok:status>=200&&status<300,status,
 redirected:false,headers:{get:k=>k==='content-type'?'application/json':null},
 text:async()=>JSON.stringify(data)});
const payload={requestKey:quoteKey,fareMode:'DELIVERY',subjectKind:'DELIVERY',
 subjectId:deliveryId};
const make=(args={})=>{
 let calls=[],count=0,session=actor();
 const flow=createG122DeliveryPriceConsentFlow({...options,
  g126OriginalKeyRecoveryVerified:true,getSession:()=>session,
  fetchImpl:async (url,req)=>{
   count++;calls.push({url,method:req.method,body:JSON.parse(req.body)});
   if(count===1)throw Error('server commit followed by lost ACK');
   return json(quote());
  },...args});
 return {flow,calls,setSession:s=>{session=s;}};
};
test('B22 G126 after lost ACK recovers original tariff with identical requestKey, no extra quote',async()=>{
 const {flow,calls}=make();
 const first=await flow.quote(scope,quoteKey);
 assert.equal(first.code,'NETWORK_OR_TIMEOUT');
 assert.equal(flow.snapshot().phase,'quote_unknown');
 assert.equal(flow.snapshot().canRecoverQuote,true);
 assert.equal((await flow.quote(scope,id(23))).code,'G122_ALREADY_STARTED');
 const second=await flow.recoverOriginalQuote();
 assert.equal(second.ok,true);
 assert.equal(second.recoveredWithOriginalKey,true);
 assert.equal(second.quote.amountGs,22000);
 assert.equal(second.quote.fareVersion,'cargo_moto_owner_v7');
 assert.equal(flow.snapshot().canConfirm,true);
 assert.equal(flow.snapshot().canRecoverQuote,false);
 assert.deepEqual(calls.map(x=>x.body),[payload,payload]);
 assert.equal(calls.every(x=>x.method==='POST'),true);
 assert.equal((await flow.recoverOriginalQuote()).code,'G126_NO_RECOVERABLE_QUOTE');
 assert.equal(calls.length,2);
});
test('B22 G126 must be independently certified: same old gateway still blocks recovery',async()=>{
 const {flow,calls}=make({g126OriginalKeyRecoveryVerified:false});
 await flow.quote(scope,quoteKey);
 assert.equal(flow.snapshot().canRecoverQuote,false);
 assert.equal((await flow.recoverOriginalQuote()).code,'G126_RECOVERY_NOT_CERTIFIED');
 assert.equal(calls.length,1);
});
test('B22 409 and invalid DTO cannot authorize quote or retry twice',async()=>{
 for(const second of [
  {status:409,data:quote()},
  {status:201,data:{...quote(),amountGs:25000}},
  {status:201,data:{...quote(),ownerId:id(9)}},
  {status:201,data:{...quote(),subjectId:id(9)}},
  {status:201,data:{...quote(),quote:{...quote().quote,totalPyg:25000}}}
 ]){
  let calls=[];
  const {flow}=make({fetchImpl:async(url,req)=>{
   calls.push(JSON.parse(req.body));
   if(calls.length===1)throw Error('lost ACK');
   return json(second.data,second.status);
  }});
  await flow.quote(scope,quoteKey);
  assert.equal((await flow.recoverOriginalQuote()).ok,false);
  assert.equal(flow.snapshot().phase,'quote_unknown');
  assert.equal(flow.snapshot().canRecoverQuote,false);
  assert.equal(flow.snapshot().quote,null);
  assert.equal((await flow.recoverOriginalQuote()).code,'G126_NO_RECOVERABLE_QUOTE');
  assert.deepEqual(calls,[payload,payload]);
 }
});
test('B22 JWT rotation while G126 in flight cannot reveal old Owner quote',async()=>{
 let resolve;
 const pending=new Promise(r=>resolve=r),calls=[];
 const {flow,setSession}=make({fetchImpl:async(url,req)=>{
  calls.push(JSON.parse(req.body));
  if(calls.length===1)throw Error('lost ACK');
  return pending;
 }});
 await flow.quote(scope,quoteKey);
 const inFlight=flow.recoverOriginalQuote();
 await Promise.resolve();await Promise.resolve();await Promise.resolve();
 setSession({...actor(),token:'g126-owner-rotated-token-1234567890123'});
 resolve(json(quote()));
 assert.equal((await inFlight).ok,false);
 assert.equal(flow.snapshot().quote,null);
 assert.equal(flow.snapshot().canRecoverQuote,false);
 assert.equal(calls.length,2);
});
test('B22 after clearing old session no original key can be retrieved',async()=>{
 const {flow,calls}=make();
 await flow.quote(scope,quoteKey);
 flow.clear();
 assert.equal(flow.snapshot().canRecoverQuote,false);
 assert.equal((await flow.recoverOriginalQuote()).code,'G126_NO_RECOVERABLE_QUOTE');
 assert.equal(calls.length,1);
});
test('B22 integration: same G121 delivery, original G7 quote G126 recover, explicit G122',async()=>{
 let secure=null,postCount=0,quoteKeys=[],consentCount=0;
 const vault={read:async()=>secure,
  write:async r=>{secure=r;},clear:async()=>{secure=null;}};
 const app=createClientExperience({now:()=>T,deliveryRecoveryStore:vault,
  authProvider:{readSession:async()=>({role:'passenger',subject:owner,
   token:'g126-owner-private-token-123456789012',expiresAt:T+60000}),
   signOut:async()=>{}},
  gateway:{isConfigured:()=>true,send:async()=>{postCount++;
   return {ok:false,code:'NETWORK_OR_TIMEOUT'};}},
  deliveryRegistrationOptions:{enabled:true,contractCertified:true,
   externalRuntimeVerified:true,passengerRlsVerified:true,ownerApproved:true,
   origin,pinnedOrigin:origin,
   fetchImpl:async()=>json({mode:'STAGING_DEMO_ONLY',
    liveDeliveriesEnabled:false,serverPersisted:true,ownerId:owner,
    requestKey,deliveryId,vehicleKind:'MOTO',status:'requested',revision:1},200)},
  deliveryG122Options:{...options,g126OriginalKeyRecoveryVerified:true,
   fetchImpl:async(url,req)=>{
    if(url.endsWith('/fares/quote')){
     const p=JSON.parse(req.body);quoteKeys.push(p.requestKey);
     if(quoteKeys.length===1)throw Error('lost quote ACK after SQL COMMIT');
     return json(quote());
    }
    consentCount++;
    return json({mode:'STAGING_DEMO_ONLY',liveDeliveriesEnabled:false,
     paymentAuthorized:false,dispatchEnabled:false,ownerId:owner,consentId,
     deliveryId,quoteId,confirmationKey:consentKey,vehicleKind:'MOTO',
     acceptedTotalGs:22000,fareVersion:'cargo_moto_owner_v7',
     status:'confirmed_qa',serverPersisted:true},200);
   }}
 });
 assert.equal((await app.refreshSession()).ok,true);
 assert.equal(app.prepareDelivery({requestKey,vehicleKind:'MOTO',
  category:'PARCEL',grams:2000,lengthCm:20,widthCm:10,heightCm:5,
  pickupTag:'PICKUP_WEST',deliveryTag:'DELIVERY_EAST',
  restrictedItemDeclared:false}).ok,true);
 assert.equal((await app.submit()).code,'NETWORK_OR_TIMEOUT');
 assert.equal((await app.readUnconfirmedDeliveryRegistration()).ok,true);
 assert.equal((await app.quoteRecoveredDelivery(quoteKey)).ok,false);
 assert.equal(app.snapshot().deliveryPriceConsent.canRecoverQuote,true);
 const recovered=await app.recoverOriginalDeliveryQuote();
 assert.equal(recovered.ok,true);
 assert.equal(app.snapshot().deliveryPriceConsent.canConfirm,true);
 assert.deepEqual(quoteKeys,[quoteKey,quoteKey]);
 const accepted=await app.confirmRecoveredDeliveryQuote({
  confirmationKey:consentKey,acceptedTotalGs:22000,
  acceptedFareVersion:'cargo_moto_owner_v7'});
 assert.equal(accepted.ok,true);
 assert.equal(app.snapshot().deliveryPriceConsent.phase,'confirmed_qa');
 assert.equal(app.snapshot().mutation.phase,'failed');
 assert.equal(postCount,1);
 assert.equal(consentCount,1);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readDriverPrivateDeliveryDetail} from './driver-private-delivery-detail.mjs';
const id=n=>'22222222-2222-4222-8222-'+String(n).padStart(12,'0');
const at=Date.parse('2026-10-26T19:00:00Z');
const token='verified-driver-session-token-abcdefghijklmnop';
const data=(kind='MOTO')=>({
 mode:'STAGING_DEMO_ONLY',liveDeliveriesEnabled:false,
 offerId:id(1),deliveryId:id(2),vehicleId:id(3),
 vehicleKind:kind,category:'PARCEL',grams:1250,
 dimensionsCm:{length:25,width:12,height:8},
 pickupTag:'PICKUP_QA',deliveryTag:'DELIVERY_QA',
 expiresAtMs:at+30000,confirmedAcceptance:false
});
const http=(dto,status=200)=>({status,redirected:false,
 headers:{get:()=>null},json:async()=>dto});
const run=reply=>readDriverPrivateDeliveryDetail({
 apiOrigin:'http://127.0.0.1:7777',accessToken:token,
 offerId:id(1),now:()=>at,request:async(url,options)=>{
  assert.equal(url,'http://127.0.0.1:7777/v1/staging/courier/delivery-offers/'+id(1));
  assert.equal(options.method,'GET');return reply;
 }});
test('C G10 reads actual MOTO/AUTO packages and strips sensitive details',async()=>{
 for(const kind of ['MOTO','AUTO']){
  const x=await run(http(data(kind)));
  assert.equal(x.vehicleKind,kind);assert.equal(x.deliveryId,id(2));
  assert.equal(x.qaOnly,true);assert.equal(x.productionEnabled,false);
  for(const secret of [id(3),token,'PICKUP_QA','DELIVERY_QA'])
   assert(!JSON.stringify(x).includes(secret));
 }
});
test('C refuses wrong delivery, expired/foreign offer and malformed mode',async()=>{
 for(const bad of [
  {...data(),offerId:id(11)},{...data(),deliveryId:'bad'},
  {...data(),expiresAtMs:at-1},{...data(),vehicleKind:'MOTO_RIDE'},
  {...data(),liveDeliveriesEnabled:true},{...data(),confirmedAcceptance:true},
  {...data(),passengerId:id(88)},{...data(),grams:0}
 ])await assert.rejects(()=>run(http(bad)));
});
test('C denies 404/private role failure, HTTP redirects and oversized response',async()=>{
 await assert.rejects(()=>run(http({},404)));
 await assert.rejects(()=>run({...http(data()),redirected:true}));
 await assert.rejects(()=>run({...http(data()),headers:{get:()=>String(50000)}}));
});
test('C rejects local forged hosts and unverified bearer',async()=>{
 await assert.rejects(()=>readDriverPrivateDeliveryDetail({
  apiOrigin:'http://another-host:7777',accessToken:token,offerId:id(1),
  request:async()=>http(data())
 }));
 await assert.rejects(()=>readDriverPrivateDeliveryDetail({
  apiOrigin:'http://127.0.0.1:7777',accessToken:'invalid',offerId:id(1)
 }));
});

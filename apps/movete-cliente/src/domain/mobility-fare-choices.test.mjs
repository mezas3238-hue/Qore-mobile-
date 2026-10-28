import test from 'node:test';
import assert from 'node:assert/strict';
import {projectMobilityFareChoices,formatFareGuaranies}
 from './mobility-fare-choices.mjs';
const now=1800000000000;
const id=n=>'99990000-0000-4999-8999-'+String(n).padStart(12,'0');
const validView=()=>({
 authenticated:true,account:{subject:id(1),role:'passenger'},
 mutation:{phase:'failed',operation:'deliveryRequest',requestKey:id(6)},
 autoPrequote:{subsidyRequired:true,subsidyAvailable:true,phase:'quoted',
  quote:{quoteId:id(2),amountGs:50000,expiresAt:now+20000,fareVersion:'auto_v4'},
  subsidy:{quoteId:id(2),originalFareGs:50000,customerSubsidyGs:5000,
   customerPaysGs:45000,platformRetainsGs:2500,commissionBps:1500,
   subsidyBps:1000,expiresAt:now+15000,fareVersion:'auto_v4'}},
 motoPassenger:{contractReady:true,phase:'quoted',
  quote:{quoteId:id(3),originalFareGs:22000,customerPaysGs:19800,
   customerSubsidyGs:2200,driverReceivesGs:19360,
   platformRetainsGs:440,commissionBps:1200,subsidyBps:1000,
   expiresAt:now+17000}},
 deliveryRegistration:{deliveryId:id(4),vehicleKind:'MOTO',
  requestKey:id(6)},
 deliveryPriceConsent:{contractReady:true,phase:'quoted',
  deliveryId:id(4),vehicleKind:'MOTO',
  quote:{quoteId:id(5),amountGs:30000,currency:'PYG',
   expiresAt:now+16000,fareVersion:'cargo_moto_v3'}},
 commerce:{estimatedSubtotalPyg:900000,finalTotalPyg:null}
});
test('B20 renders five categories; original and 10% subsidy ONLY passenger receipts',()=>{
 const x=projectMobilityFareChoices(validView(),now);
 assert.deepEqual(x.map(a=>a.kind),[
  'AUTO_RIDE','MOTO_RIDE','AUTO_DELIVERY','MOTO_DELIVERY','COMMERCE']);
 assert.equal(x[0].customerPaysGs,45000);
 assert.equal(x[0].originalFareGs,50000);
 assert.equal(x[0].customerSubsidyGs,5000);
 assert.equal(x[0].subsidyBps,1000);
 assert.equal(x[1].customerPaysGs,19800);
 assert.equal(x[1].originalFareGs,22000);
 assert.equal(x[1].customerSubsidyGs,2200);
 assert.equal(x[1].commissionBps,1200);
 assert.equal(x[2].priced,false);
 assert.equal(x[3].customerPaysGs,30000);
 assert.equal(x[3].customerSubsidyGs,0);
 assert.equal(x[3].subsidyBps,null);
 assert.equal(x[4].priced,false);
 assert.equal(x[4].customerPaysGs,null);
 assert(x.every(x=>x.etaMinutes===null&&x.availability==='UNVERIFIED'
  &&x.canBook===false&&x.canPay===false&&x.productionEnabled===false));
 assert.equal(formatFareGuaranies(21000),'21.000 Gs.');
 assert.equal(formatFareGuaranies(-10),null);
});
test('B20 revoked or anonymous identity never presents prices',()=>{
 for(const view of [null,{...validView(),authenticated:false},
  {...validView(),account:{subject:id(1),role:'driver'}},
  {...validView(),account:{subject:'forged',role:'passenger'}}]){
  const data=projectMobilityFareChoices(view,now);
  assert.equal(data.length,5);
  assert(data.every(x=>x.priced===false));
 }
});
test('B20 never invents 10% when driver/owner split mismatches',()=>{
 const v=validView();
 v.autoPrequote.subsidy.platformRetainsGs=2700;
 v.motoPassenger.quote.driverReceivesGs=20000;
 const rows=projectMobilityFareChoices(v,now);
 assert.equal(rows[0].priced,false);
 assert.equal(rows[1].priced,false);
});
test('B20 stale/cross quote or expired amount always leaves service unpriced',()=>{
 const v=validView();
 v.autoPrequote.subsidy.quoteId=id(99);
 v.motoPassenger.quote.expiresAt=now-1;
 v.deliveryPriceConsent.quote.fareVersion='fake altered';
 v.deliveryPriceConsent.quote.expiresAt=now-10;
 assert(projectMobilityFareChoices(v,now).every(x=>x.priced===false));
});
test('B20 MOTO delivery cannot be displayed as AUTO nor as passenger fare',()=>{
 const v=validView();
 v.deliveryRegistration.vehicleKind='AUTO';
 let rows=projectMobilityFareChoices(v,now);
 assert.equal(rows[2].priced,false);
 assert.equal(rows[3].priced,false);
 v.deliveryRegistration.vehicleKind='MOTO';
 v.deliveryPriceConsent.quote.amountGs=25000;
 rows=projectMobilityFareChoices(v,now);
 assert.equal(rows[3].customerPaysGs,25000);
 assert.equal(rows[2].priced,false);
 assert.equal(rows[0].priced,true);
 assert.equal(rows[1].priced,true);
});
test('B20 forged merchant subtotal cannot be final total',()=>{
 const v=validView();
 v.commerce.estimatedSubtotalPyg=1000000;
 v.commerce.checkoutEnabled=true;
 v.commerce.finalTotalPyg=1000000;
 assert.equal(projectMobilityFareChoices(v,now)[4].priced,false);
});
test('B20 actual booking, payment and ETA cannot be inferred from a quote',()=>{
 const v=validView();
 for(const item of projectMobilityFareChoices(v,now)){
  assert.equal(item.canBook,false);
  assert.equal(item.canPay,false);
  assert.equal(item.availability,'UNVERIFIED');
  assert.equal(item.etaMinutes,null);
 }
});

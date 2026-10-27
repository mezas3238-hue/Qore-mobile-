/**
 * B21: Commission is an Owner-controlled server rule, not a fixed constant in
 * the Passenger UI. The passenger subsidy is still independent 10% in G93/G101.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {projectMobilityFareChoices} from './mobility-fare-choices.mjs';

const t=1800000000000;
const id=n=>'92100000-0000-4921-8921-'+String(n).padStart(12,'0');
const passengerView=(autoBps,motoBps)=>{
 const originalAuto=50000,originalMoto=24000;
 const autoSubsidy=5000,motoSubsidy=2400;
 const autoFee=Math.floor((originalAuto*autoBps+5000)/10000);
 const motoFee=Math.floor((originalMoto*motoBps+5000)/10000);
 return {authenticated:true,account:{subject:id(1),role:'passenger'},
  mutation:{phase:'idle',operation:null,requestKey:null},
  autoPrequote:{subsidyRequired:true,subsidyAvailable:true,
   quote:{quoteId:id(2),amountGs:originalAuto,
    expiresAt:t+10000,fareVersion:'owner_auto_new_v2'},
   subsidy:{quoteId:id(2),originalFareGs:originalAuto,
    customerSubsidyGs:autoSubsidy,customerPaysGs:45000,
    commissionBps:autoBps,subsidyBps:1000,
    platformRetainsGs:autoFee-autoSubsidy,
    fareVersion:'owner_auto_new_v2',expiresAt:t+10000}},
  motoPassenger:{phase:'quoted',contractReady:true,
   quote:{quoteId:id(3),originalFareGs:originalMoto,
    customerSubsidyGs:motoSubsidy,customerPaysGs:originalMoto-motoSubsidy,
    commissionBps:motoBps,subsidyBps:1000,
    driverReceivesGs:originalMoto-motoFee,
    platformRetainsGs:motoFee-motoSubsidy,expiresAt:t+9000}},
  deliveryPriceConsent:{contractReady:false,quote:null},
  deliveryRegistration:{deliveryId:null,vehicleKind:null}};
};
test('B21 Owner AUTO/MOTO rates can change independently without mobile update',()=>{
 const first=projectMobilityFareChoices(passengerView(1500,1200),t);
 const changed=projectMobilityFareChoices(passengerView(1900,2400),t);
 assert.equal(first[0].commissionBps,1500);
 assert.equal(first[1].commissionBps,1200);
 assert.equal(changed[0].commissionBps,1900);
 assert.equal(changed[1].commissionBps,2400);
 assert.equal(changed[0].subsidyBps,1000);
 assert.equal(changed[1].subsidyBps,1000);
 assert.equal(changed[0].customerPaysGs,first[0].customerPaysGs);
 assert.equal(changed[1].customerPaysGs,first[1].customerPaysGs);
 assert.equal(changed[0].customerSubsidyGs,first[0].customerSubsidyGs);
 assert.equal(changed[1].customerSubsidyGs,first[1].customerSubsidyGs);
 assert.equal(changed[0].originalFareGs,first[0].originalFareGs);
 assert.equal(changed[1].originalFareGs,first[1].originalFareGs);
});
test('B21 malformed forged split never becomes price on screen',()=>{
 const v=passengerView(1900,2400);
 v.autoPrequote.subsidy.platformRetainsGs+=1;
 v.motoPassenger.quote.driverReceivesGs+=10;
 const rows=projectMobilityFareChoices(v,t);
 assert.equal(rows[0].priced,false);
 assert.equal(rows[1].priced,false);
});
test('B21 selection screen does not hardcode commissions 15%/12% or retain 5%/2%',()=>{
 const ui=readFileSync(new URL('../../app/transporte.tsx',import.meta.url),'utf8');
 assert.match(ui,/comisi[oó]n.*Admin Web/i);
 assert.doesNotMatch(ui,/Comisi[oó]n nominal 15\s*%/i);
 assert.doesNotMatch(ui,/Comisi[oó]n nominal 12\s*%/i);
 assert.doesNotMatch(ui,/retenci[oó]n bruta.*5\s*%/i);
 assert.doesNotMatch(ui,/retenci[oó]n bruta.*2\s*%/i);
});
test('B21 cargo and commerce must not borrow passenger commission defaults',()=>{
 const v=passengerView(2900,1300);
 v.deliveryPriceConsent={contractReady:false,phase:'idle',quote:null};
 const rows=projectMobilityFareChoices(v,t);
 assert.equal(rows[2].commissionBps,null);
 assert.equal(rows[3].commissionBps,null);
 assert.equal(rows[4].commissionBps,null);
 assert.equal(rows[2].subsidyBps,null);
 assert.equal(rows[3].subsidyBps,null);
 assert.equal(rows[4].subsidyBps,null);
});

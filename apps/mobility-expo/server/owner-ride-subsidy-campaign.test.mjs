import test from 'node:test';
import assert from 'node:assert/strict';
import {SERVICE_CATEGORIES,RIDE_CAMPAIGN_LIVE_ENABLED,
 quoteSyntheticRideCampaign,verifySyntheticRideCampaignQuote} from './fare-engine.mjs';
import {buildSyntheticRideCampaignSettlement,verifySyntheticRideCampaignEntries} from './staging-ledger.mjs';
const id=n=>'a000000'+n+'-0000-4000-8000-000000000001';
const DAY=86400000;
const startsAtMs=Date.parse('2026-11-01T00:00:00Z');
const campaign={campaignId:id(1),ruleVersion:'PY_OWNER_RIDE_10_2026_V1',
 startsAtMs,endsAtMs:startsAtMs+60*DAY,durationDays:60,
 ownerExtensionDecisionId:null,ownerExtensionApprovedAtMs:null};
const base={serviceKind:'AUTO_RIDE',bookingKey:id(2),tripId:id(3),
 originalFareGs:30000,campaign,atMs:startsAtMs+DAY};
test('AUTO and MOTO passenger categories are distinct from both delivery modes',()=>{
 assert.equal(RIDE_CAMPAIGN_LIVE_ENABLED,false);
 assert.deepEqual(SERVICE_CATEGORIES,['AUTO_RIDE','MOTO_RIDE',
  'AUTO_DELIVERY','MOTO_DELIVERY','MERCHANT_ORDER']);
 for(const s of ['AUTO_DELIVERY','MOTO_DELIVERY','MERCHANT_ORDER','MOTO','AUTO']){
  const q=quoteSyntheticRideCampaign({...base,serviceKind:s});
  assert.equal(q.ok,false,s);
 }
});
test('constant Owner 10% subsidy: AUTO 15/10/5 and MOTO 12/10/2, integer PYG',()=>{
 for(const [kind,commission,driver,platform] of [
  ['AUTO_RIDE',4500,25500,1500],['MOTO_RIDE',3600,26400,600]]){
  const q=quoteSyntheticRideCampaign({...base,serviceKind:kind});
  assert.equal(q.ok,true);
  assert.equal(q.commissionBps,kind==='AUTO_RIDE'?1500:1200);
  assert.equal(q.customerSubsidyBps,1000);
  assert.equal(q.grossCommissionGs,commission);
  assert.equal(q.customerSubsidyGs,3000);
  assert.equal(q.customerPaysGs,27000);
  assert.equal(q.driverReceivesGs,driver);
  assert.equal(q.platformRetainsGs,platform);
  assert.equal(q.customerPaysGs,q.driverReceivesGs+q.platformRetainsGs);
  assert.equal(verifySyntheticRideCampaignQuote(q),true);
  const ledger=buildSyntheticRideCampaignSettlement({quote:q,transactionId:'qa_'+kind});
  assert.equal(ledger.ok,true);
  assert.equal(ledger.liveEnabled,false);
  assert.equal(ledger.platformRetainsGs,platform);
  assert.equal(verifySyntheticRideCampaignEntries(ledger.entries,q),true);
  assert.deepEqual(ledger.entries.map(x=>x.amountPyg),[27000,3000,driver,commission]);
 }
});
test('60 day campaign active through last ms, cannot subsidize before or after boundary',()=>{
 assert.equal(quoteSyntheticRideCampaign({...base,atMs:startsAtMs-1}).ok,false);
 assert.equal(quoteSyntheticRideCampaign({...base,atMs:startsAtMs}).ok,true);
 assert.equal(quoteSyntheticRideCampaign({...base,atMs:campaign.endsAtMs-1}).ok,true);
 assert.equal(quoteSyntheticRideCampaign({...base,atMs:campaign.endsAtMs}).ok,false);
 for(const p of [
  {...campaign,durationDays:90},
  {...campaign,endsAtMs:campaign.endsAtMs+DAY},
  {...campaign,ownerExtensionDecisionId:id(4)},
  {...campaign,ruleVersion:'../../wrong'},
  {...campaign,campaignId:'not-uuid'}]){
  assert.equal(quoteSyntheticRideCampaign({...base,campaign:p}).ok,false);
 }
});
test('90 days needs recorded verified Owner extension, never automatic',()=>{
 const ninety={...campaign,durationDays:90,endsAtMs:startsAtMs+90*DAY,
  ownerExtensionDecisionId:id(4),ownerExtensionApprovedAtMs:startsAtMs+30*DAY};
 assert.equal(quoteSyntheticRideCampaign({...base,campaign:ninety,atMs:startsAtMs+31*DAY}).ok,true);
 for(const patch of [
  {ownerExtensionDecisionId:null},
  {ownerExtensionApprovedAtMs:null},
  {ownerExtensionApprovedAtMs:startsAtMs-1},
  {ownerExtensionApprovedAtMs:startsAtMs+50*DAY}
 ])assert.equal(quoteSyntheticRideCampaign({...base,campaign:{...ninety,...patch},atMs:startsAtMs+31*DAY}).ok,false);
});
test('tampered quote, rates, policy or ledger fail closed, no silent delivery subsidy',()=>{
 const quote=quoteSyntheticRideCampaign(base);
 for(const altered of [
  {...quote,commercialEnabled:true},
  {...quote,customerPaysGs:27001},
  {...quote,customerSubsidyGs:2999},
  {...quote,commissionBps:1000},
  {...quote,driverReceivesGs:25000},
  {...quote,platformRetainsGs:2000},
  {...quote,serviceKind:'AUTO_DELIVERY'},
  {...quote,bookingKey:'missing'},
  {...quote,campaign:{...campaign,endsAtMs:campaign.endsAtMs+DAY}},
  {...quote,extra:'caller-injected'}
 ])assert.equal(verifySyntheticRideCampaignQuote(altered),false);
 const ledger=buildSyntheticRideCampaignSettlement({quote,transactionId:'booking_same'});
 assert.equal(ledger.ok,true);
 for(const changed of [
  ledger.entries.map((e,i)=>i===1?{...e,amountPyg:e.amountPyg+1}:e),
  ledger.entries.map((e,i)=>i===0?{...e,account:'synthetic_wrong'}:e),
  ledger.entries.map((e,i)=>i===2?{...e,side:'debit'}:e),
  [...ledger.entries,{account:'extra',side:'debit',amountPyg:0}]
 ])assert.equal(verifySyntheticRideCampaignEntries(changed,quote),false);
});
test('half-up rounding remains safe and balanced on PYG edges',()=>{
 for(const k of ['AUTO_RIDE','MOTO_RIDE'])for(const fare of [1,2,3,5,6,9,10,11,19,33,99,101,1001,99999,100000000]){
  const q=quoteSyntheticRideCampaign({...base,serviceKind:k,originalFareGs:fare});
  assert.equal(q.ok,true,String(fare));
  assert.equal(q.customerPaysGs,q.driverReceivesGs+q.platformRetainsGs);
  assert.equal(buildSyntheticRideCampaignSettlement({quote:q,transactionId:'edge'}).ok,true);
 }
 for(const fare of [-1,0,1.5,Number.MAX_SAFE_INTEGER,NaN])
  assert.equal(quoteSyntheticRideCampaign({...base,originalFareGs:fare}).ok,false);
});
test('repeated same booking and campaign computation deterministic but NOT a persistent replay guarantee',()=>{
 const first=quoteSyntheticRideCampaign(base);
 const second=quoteSyntheticRideCampaign({...base,campaign:{...campaign}});
 assert.deepEqual(first,second);
 assert.deepEqual(buildSyntheticRideCampaignSettlement({quote:first,transactionId:'idem'}),
  buildSyntheticRideCampaignSettlement({quote:second,transactionId:'idem'}));
});

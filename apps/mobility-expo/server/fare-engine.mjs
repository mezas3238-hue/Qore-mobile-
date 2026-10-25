/** QORE synthetic STAGING fares: no billing or collections. Integer PYG only. */
export const FARE_LIVE_ENABLED=false;
const modes=new Set(['AUTO','MOTO','DELIVERY','MERCHANT_DELIVERY']);
const integer=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const round=(a,b)=>Math.floor((a+Math.floor(b/2))/b);
export function quoteSyntheticFare(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))return {ok:false,reason:'Invalid synthetic fare inputs',liveEnabled:false};
 const {mode,distanceMeters,durationSeconds,basePyg,perKmPyg,perMinutePyg,minPyg,tollsPyg=0,commissionBps,ruleVersion}=input;
 if(!modes.has(mode)||!integer(distanceMeters,0,500000)||!integer(durationSeconds,0,86400)||!integer(basePyg,0,1000000)||!integer(perKmPyg,0,100000)||!integer(perMinutePyg,0,20000)||!integer(minPyg,0,1000000)||!integer(tollsPyg,0,1000000)||!integer(commissionBps,0,3000)||typeof ruleVersion!=='string'||!/^[a-zA-Z0-9._-]{1,48}$/.test(ruleVersion))return {ok:false,reason:'Invalid synthetic fare inputs',liveEnabled:false};
 const distanceCharge=round(distanceMeters*perKmPyg,1000);
 const timeCharge=round(durationSeconds*perMinutePyg,60);
 const subtotal=Math.max(minPyg,basePyg+distanceCharge+timeCharge);
 const totalPyg=subtotal+tollsPyg;
 if(!integer(totalPyg,0,100000000))return {ok:false,reason:'Synthetic fare exceeds limit',liveEnabled:false};
 const commissionPyg=round(subtotal*commissionBps,10000);
 return {ok:true,liveEnabled:false,mode,ruleVersion,totalPyg,subtotalPyg:subtotal,tollsPyg,commissionBps,commissionPyg,providerPyg:totalPyg-commissionPyg,breakdown:{basePyg,distanceChargePyg:distanceCharge,timeChargePyg:timeCharge,minPyg}};
}
export function verifySyntheticQuote(q){
 if(q?.ok!==true||q.liveEnabled!==false||!modes.has(q.mode)||!integer(q.totalPyg,0,100000000)||!integer(q.subtotalPyg,0,100000000)||!integer(q.tollsPyg,0,1000000)||!integer(q.commissionBps,0,3000)||!integer(q.commissionPyg,0,q.totalPyg)||!integer(q.providerPyg,0,q.totalPyg))return false;
 const b=q.breakdown;
 if(typeof q.ruleVersion!=='string'||!/^[a-zA-Z0-9._-]{1,48}$/.test(q.ruleVersion)||!b||!integer(b.basePyg,0,1000000)||!integer(b.distanceChargePyg,0,50000000)||!integer(b.timeChargePyg,0,28800000)||!integer(b.minPyg,0,1000000))return false;
 return q.subtotalPyg===Math.max(b.minPyg,b.basePyg+b.distanceChargePyg+b.timeChargePyg)&&q.totalPyg===q.subtotalPyg+q.tollsPyg&&q.commissionPyg===round(q.subtotalPyg*q.commissionBps,10000)&&q.providerPyg+q.commissionPyg===q.totalPyg;
}


/**
 * Owner ride policy (STAGING QA, never a payment or a live quote).
 * These four product categories are distinct: MOTO_RIDE is passenger transport
 * and is NEVER a synonym for MOTO_DELIVERY. Delivery/merchant pricing is NOT
 * eligible for this policy without another explicit Owner decision.
 *
 * Only invoke from a trusted backend after resolving the booking/identity,
 * approved official route, verified legal eligibility and a server-owned
 * campaign configuration. A public request must not provide policy/rates.
 */
export const SERVICE_CATEGORIES=Object.freeze([
 'AUTO_RIDE','MOTO_RIDE','AUTO_DELIVERY','MOTO_DELIVERY','MERCHANT_ORDER'
]);
export const RIDE_CAMPAIGN_LIVE_ENABLED=false;
const DAY_MS=86_400_000;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COMMISSION=Object.freeze({AUTO_RIDE:1500,MOTO_RIDE:1200});
const roundBps=(base,bps)=>Number((BigInt(base)*BigInt(bps)+5000n)/10000n);
const safeEpoch=x=>Number.isSafeInteger(x)&&x>0&&x<8640000000000000;
const uuid=x=>typeof x==='string'&&UUID.test(x);
const owns=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&
 Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const campaignKeys=[
 'campaignId','ruleVersion','startsAtMs','endsAtMs','durationDays',
 'ownerExtensionDecisionId','ownerExtensionApprovedAtMs'
];
const quoteKeys=[
 'mode','commercialEnabled','serviceKind','bookingKey','tripId',
 'originalFareGs','commissionBps','customerSubsidyBps','grossCommissionGs',
 'customerSubsidyGs','customerPaysGs','driverReceivesGs','platformRetainsGs',
 'campaign','calculatedAtMs'
];
function verifiedCampaign(config,atMs){
 if(!owns(config,campaignKeys)||!uuid(config.campaignId)||
    typeof config.ruleVersion!=='string'||
    !/^[a-zA-Z0-9._-]{1,48}$/.test(config.ruleVersion)||
    !safeEpoch(config.startsAtMs)||!safeEpoch(config.endsAtMs)||
    ![60,90].includes(config.durationDays)||
    config.endsAtMs-config.startsAtMs!==config.durationDays*DAY_MS||
    !safeEpoch(atMs)||atMs<config.startsAtMs||atMs>=config.endsAtMs)
  return false;
 // An extension must be backed by a distinct, auditable Owner decision that
 // was verified by the backend, never a client boolean. This shape alone is NOT
 // proof of authority; the loading adapter must validate the decision record.
 if(config.durationDays===60)return config.ownerExtensionDecisionId===null&&
   config.ownerExtensionApprovedAtMs===null;
 return uuid(config.ownerExtensionDecisionId)&&
  safeEpoch(config.ownerExtensionApprovedAtMs)&&
  config.ownerExtensionApprovedAtMs>=config.startsAtMs&&
  config.ownerExtensionApprovedAtMs<=atMs;
}
/** Pure server QA computation; does not authorize a promotion or reserve funds. */
export function quoteSyntheticRideCampaign({
 serviceKind,bookingKey,tripId,originalFareGs,campaign,atMs
}={}){
 const fail=reason=>({ok:false,reason,commercialEnabled:false});
 if(!Object.hasOwn(COMMISSION,serviceKind))return fail('RIDE_SERVICE_REQUIRED');
 if(!uuid(bookingKey)||!uuid(tripId)||
    !integer(originalFareGs,1,100000000))return fail('INVALID_SERVER_BOOKING_FARE');
 if(!verifiedCampaign(campaign,atMs))return fail('CAMPAIGN_INACTIVE_OR_UNVERIFIED');
 const commissionBps=COMMISSION[serviceKind],customerSubsidyBps=1000;
 const grossCommissionGs=roundBps(originalFareGs,commissionBps);
 const customerSubsidyGs=roundBps(originalFareGs,customerSubsidyBps);
 const customerPaysGs=originalFareGs-customerSubsidyGs;
 const driverReceivesGs=originalFareGs-grossCommissionGs;
 const platformRetainsGs=grossCommissionGs-customerSubsidyGs;
 if(![grossCommissionGs,customerSubsidyGs,customerPaysGs,
   driverReceivesGs,platformRetainsGs].every(x=>integer(x,0,100000000))||
   customerPaysGs!==driverReceivesGs+platformRetainsGs)
  return fail('UNBALANCED_RIDE_POLICY');
 return Object.freeze({ok:true,mode:'STAGING_DEMO_ONLY',commercialEnabled:false,
  serviceKind,bookingKey,tripId,originalFareGs,commissionBps,
  customerSubsidyBps,grossCommissionGs,customerSubsidyGs,customerPaysGs,
  driverReceivesGs,platformRetainsGs,campaign:Object.freeze({...campaign}),
  calculatedAtMs:atMs});
}
/** Exact accounting receipt validation rejects forged amounts or expired offers. */
export function verifySyntheticRideCampaignQuote(q){
 if(!q||q.ok!==true||!owns(q,[ 'ok',...quoteKeys])||
    q.mode!=='STAGING_DEMO_ONLY'||q.commercialEnabled!==false||
    !owns(q.campaign,campaignKeys))return false;
 const computed=quoteSyntheticRideCampaign({
  serviceKind:q.serviceKind,bookingKey:q.bookingKey,tripId:q.tripId,
  originalFareGs:q.originalFareGs,campaign:q.campaign,atMs:q.calculatedAtMs
 });
 return computed.ok===true&&quoteKeys.every(k=>k==='campaign'
  ?campaignKeys.every(p=>computed.campaign[p]===q.campaign[p])
  :computed[k]===q[k]);
}

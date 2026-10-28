/**
 * B20: pricing selector inspired by multimodal mobility UX.
 * Read-only projection of ALREADY validated, in-session QA receipts.
 * NEVER computes a server fare, asks for GPS, infers ETA, or unlocks booking.
 * One G7 cargo quote can price only its authenticated requested vehicle.
 */
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const id=x=>typeof x==='string'&&UUID.test(x);
const integer=(v,min=0,max=100000000)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const validDate=(ms,now)=>Number.isSafeInteger(ms)&&ms>now+1000&&ms<=now+3600000;
const base=[
 {kind:'AUTO_RIDE',label:'AUTO · Pasajeros',category:'RIDE',vehicleKind:'AUTO'},
 {kind:'MOTO_RIDE',label:'MOTO · Pasajeros',category:'RIDE',vehicleKind:'MOTO'},
 {kind:'AUTO_DELIVERY',label:'ENVÍOS · Auto',category:'DELIVERY',vehicleKind:'AUTO'},
 {kind:'MOTO_DELIVERY',label:'ENVÍOS · Moto',category:'DELIVERY',vehicleKind:'MOTO'},
 {kind:'COMMERCE',label:'COMERCIOS · Entregas',category:'COMMERCE',vehicleKind:null}
];
const blocked=row=>Object.freeze({...row,priced:false,customerPaysGs:null,
 originalFareGs:null,customerSubsidyGs:null,commissionBps:null,subsidyBps:null,
 expiresAt:null,quoteId:null,fareVersion:null,availability:'UNVERIFIED',
 etaMinutes:null,canBook:false,canPay:false,qaOnly:true,productionEnabled:false});
function passenger(q,original,now,expected){
 if(!q||!id(q.quoteId)||!validDate(q.expiresAt,now)
  ||!integer(q.originalFareGs,1)
  ||!integer(q.customerPaysGs)||!integer(q.customerSubsidyGs)
  ||!integer(q.commissionBps,0,3000)||q.subsidyBps!==1000
  ||!integer(q.platformRetainsGs,-100000000,100000000)
  ||q.originalFareGs!==original
  ||q.customerPaysGs+q.customerSubsidyGs!==q.originalFareGs
  ||q.customerSubsidyGs!==Math.floor((q.originalFareGs*1000+5000)/10000)
  ||(expected==='MOTO'&&!integer(q.driverReceivesGs)))return null;
 const cut=Math.floor((original*q.commissionBps+5000)/10000);
 if(q.platformRetainsGs!==cut-q.customerSubsidyGs)return null;
 if(expected==='MOTO'&&q.driverReceivesGs+cut!==original)return null;
 return {customerPaysGs:q.customerPaysGs,originalFareGs:original,
  customerSubsidyGs:q.customerSubsidyGs,commissionBps:q.commissionBps,
  subsidyBps:1000,expiresAt:q.expiresAt,quoteId:q.quoteId,
  fareVersion:typeof q.fareVersion==='string'?q.fareVersion:null};
}
export function projectMobilityFareChoices(view,now=Date.now()){
 const rows=base.map(blocked);
 if(view?.authenticated!==true||!id(view?.account?.subject)
  ||view?.account?.role!=='passenger'||!Number.isSafeInteger(now))
  return Object.freeze(rows);
 const a=view.autoPrequote;
 const aQuote=a?.quote;
 const subsidy=a?.subsidy;
 if(a?.subsidyRequired===true&&a?.subsidyAvailable===true
  &&id(aQuote?.quoteId)&&subsidy?.quoteId===aQuote.quoteId
  &&integer(aQuote.amountGs,1)&&validDate(aQuote.expiresAt,now)
  &&aQuote.amountGs===subsidy.originalFareGs
  &&subsidy.fareVersion===aQuote.fareVersion){
  const p=passenger(subsidy,aQuote.amountGs,now,'AUTO');
  if(p&&subsidy.expiresAt<=aQuote.expiresAt)
   rows[0]=Object.freeze({...rows[0],...p,priced:true});
 }
 const m=view.motoPassenger;
 if(m?.contractReady===true&&['quoted','accepted','booking','booked'].includes(m.phase)){
  const p=passenger(m.quote,m.quote?.originalFareGs,now,'MOTO');
  if(p)rows[1]=Object.freeze({...rows[1],...p,priced:true});
 }
 const d=view.deliveryPriceConsent,reg=view.deliveryRegistration;
 if(d?.contractReady===true&&['quoted','consenting','confirmed_qa'].includes(d.phase)
  &&id(d.deliveryId)&&d.deliveryId===reg?.deliveryId
  &&d.vehicleKind===reg?.vehicleKind&&
  d.deliveryId!==view?.motoPassenger?.tripId
  &&reg?.requestKey===view.mutation?.requestKey
  &&view.mutation?.operation==='deliveryRequest'
  &&id(d.quote?.quoteId)&&integer(d.quote.amountGs,1)
  &&d.quote.currency==='PYG'&&validDate(d.quote.expiresAt,now)
  &&typeof d.quote.fareVersion==='string'
  &&/^[a-z0-9._-]{1,48}$/i.test(d.quote.fareVersion)){
  const ix=d.vehicleKind==='AUTO'?2:d.vehicleKind==='MOTO'?3:-1;
  if(ix!==-1)rows[ix]=Object.freeze({...rows[ix],priced:true,
   customerPaysGs:d.quote.amountGs,originalFareGs:d.quote.amountGs,
   customerSubsidyGs:0,commissionBps:null,subsidyBps:null,
   expiresAt:d.quote.expiresAt,quoteId:d.quote.quoteId,
   fareVersion:d.quote.fareVersion});
 }
 // Commerce final checkout still requires authoritative goods + delivery and
 // payment; a local basket subtotal is never a service quote.
 return Object.freeze(rows);
}
export function formatFareGuaranies(amount){
 return integer(amount,0)?new Intl.NumberFormat('es-PY',{
  maximumFractionDigits:0}).format(amount)+' Gs.':null;
}

/**
 * F1 AUTO — consumer-side pre-dispatch consent transaction, STAGING QA ONLY.
 * A must publish and certify route resolution + authoritative prequote +
 * quote-bound idempotent booking + own GET reconciliation before enabling.
 * No route, price, availability, payment, dispatch or HTTP is fabricated here.
 */
const ID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const SERVICES=new Set(['economico','confort','xl']);
const fail=code=>Object.freeze({ok:false,code});
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const uuid=x=>typeof x==='string'&&ID.test(x);
const exact=(x,names)=>obj(x)&&Object.keys(x).length===names.length
 &&names.every(k=>Object.hasOwn(x,k));
const Q=['mode','commercialEnabled','ownerId','routeId','quoteId',
 'quoteRequestKey','fareMode','service','currency','amountGs',
 'fareVersion','expiresAt','serverPriced','routingVerified','status'];
const R=['mode','commercialEnabled','ownerId','requestKey','quoteId',
 'routeId','tripId','revision','serverPersisted','status'];
const validVersion=x=>typeof x==='string'&&/^[a-z0-9._-]{1,48}$/i.test(x);
function validQuote(x,scope,now){
 return exact(x,Q)&&x.mode==='STAGING_DEMO_ONLY'&&x.commercialEnabled===false
  &&x.ownerId===scope.ownerId&&x.routeId===scope.routeId
  &&x.quoteRequestKey===scope.quoteRequestKey
  &&uuid(x.quoteId)&&x.fareMode==='AUTO'&&x.service===scope.service
  &&x.currency==='PYG'&&Number.isSafeInteger(x.amountGs)
  &&x.amountGs>=1&&x.amountGs<=100000000
  &&validVersion(x.fareVersion)&&Number.isSafeInteger(x.expiresAt)
  &&x.expiresAt>now&&x.expiresAt<=now+3600000
  &&x.serverPriced===true&&x.routingVerified===true&&x.status==='QUOTED_QA';
}
function validReceipt(x,s,bookingKey){
 return exact(x,R)&&x.mode==='STAGING_DEMO_ONLY'
  &&x.commercialEnabled===false&&x.ownerId===s.ownerId
  &&x.requestKey===bookingKey&&x.quoteId===s.quote.quoteId
  &&x.routeId===s.routeId&&uuid(x.tripId)
  &&Number.isSafeInteger(x.revision)&&x.revision>=1
  &&x.serverPersisted===true&&x.status==='ACCEPTED_QA';
}
export function createF1AutoPrequoteConsent({
 enabled=false,quoteContractCertified=false,bookingContractCertified=false,
 reconciliationContractCertified=false,stagingRuntimeVerified=false,
 quoteGateway=null,bookingGateway=null,reconciliationGateway=null,
 getActor=null,now=()=>Date.now()
}={}){
 const quoteReady=enabled===true&&quoteContractCertified===true
  &&stagingRuntimeVerified===true&&typeof quoteGateway==='function'
  &&typeof getActor==='function';
 const bookReady=quoteReady&&bookingContractCertified===true
  &&typeof bookingGateway==='function';
 const reconcileReady=bookReady&&reconciliationContractCertified===true
  &&typeof reconciliationGateway==='function';
 let state={phase:'idle'},generation=0;
 function clear(){generation++;state={phase:'idle'};}
 function discard(){
  if(['sending','ambiguous'].includes(state.phase))
   return fail('BOOKING_RECONCILIATION_REQUIRED');
  if(state.phase==='confirmed')return fail('BOOKING_ALREADY_CONFIRMED');
  clear();return Object.freeze({ok:true});
 }
 function expire(){
  if(['quoted','accepted'].includes(state.phase)
   &&state.quote?.expiresAt<=now()){state={...state,phase:'expired',quote:null};}
 }
 function snapshot(){
  expire();
  return Object.freeze({phase:state.phase,
   quote:state.quote&&state.quote.expiresAt>now()?Object.freeze({quoteId:state.quote.quoteId,
    amountGs:state.quote.amountGs,currency:'PYG',
    fareVersion:state.quote.fareVersion,expiresAt:state.quote.expiresAt}):null,
   quoteAvailable:quoteReady,bookingAvailable:bookReady,
   canAccept:state.phase==='quoted',
   canReserve:state.phase==='accepted'&&bookReady,
   requiresReconciliation:state.phase==='ambiguous',
   tripId:state.phase==='confirmed'?state.tripId:null,
   productionEnabled:false});
 }
 async function actorMatches(scope){
  let actor;try{actor=await getActor();}catch{return false;}
  return obj(actor)&&actor.role==='passenger'
   &&actor.subject===scope.ownerId&&uuid(actor.subject)
   &&Number.isSafeInteger(actor.sessionRevision)
   &&actor.sessionRevision===scope.sessionRevision
   // A valid-looking owner/revision is insufficient if the Passenger lease
   // expired or will expire before network work is safe to begin.
   &&Number.isSafeInteger(actor.expiresAt)
   &&actor.expiresAt>now()+1000;
 }
 function prepare({routeId,service,quoteRequestKey,ownerId,sessionRevision}={}){
  if(!quoteReady)return fail('PREQUOTE_BACKEND_NOT_CERTIFIED');
  if(state.phase!=='idle')return fail('PREQUOTE_ALREADY_ACTIVE');
  if(!uuid(routeId)||!uuid(quoteRequestKey)||!uuid(ownerId)
   ||!SERVICES.has(service)||!Number.isSafeInteger(sessionRevision)
   ||sessionRevision<0)return fail('INVALID_PREQUOTE_SCOPE');
  generation++;
  state={phase:'ready',routeId,service,quoteRequestKey,ownerId,
   sessionRevision,quote:null,bookingRequestKey:null};
  return Object.freeze({ok:true,qaOnly:true});
 }
 async function load(){
  if(!quoteReady||state.phase!=='ready')return fail('PREQUOTE_NOT_READY');
  const run=++generation,scope={...state};
  if(!await actorMatches(scope)){clear();return fail('SESSION_CHANGED');}
  if(run!==generation)return fail('STALE_RESPONSE');
  state={...state,phase:'quoting'};
  let result;try{result=await quoteGateway(Object.freeze({
   routeId:scope.routeId,service:scope.service,
   quoteRequestKey:scope.quoteRequestKey,ownerId:scope.ownerId,
   sessionRevision:scope.sessionRevision
  }));}catch{result=null;}
  if(run!==generation)return fail('STALE_RESPONSE');
  if(!await actorMatches(scope)){clear();return fail('SESSION_CHANGED');}
  if(run!==generation)return fail('STALE_RESPONSE');
  if(result?.ok!==true||result.status!==200
   ||!validQuote(result.data,scope,now())){
   state={...state,phase:'failed'};return fail('PREQUOTE_NOT_VERIFIED');
  }
  state={...state,phase:'quoted',quote:Object.freeze({...result.data})};
  return Object.freeze({ok:true,qaOnly:true,quote:snapshot().quote});
 }
 function accept({quoteId,amountGs,fareVersion}={}){
  expire();
  if(state.phase!=='quoted')return fail('PREQUOTE_NOT_ACCEPTABLE');
  if(!uuid(quoteId)||quoteId!==state.quote.quoteId
   ||amountGs!==state.quote.amountGs||fareVersion!==state.quote.fareVersion)
   return fail('PRICE_OR_QUOTE_CHANGED');
  if(state.quote.expiresAt<=now())return fail('QUOTE_EXPIRED');
  state={...state,phase:'accepted'};
  return Object.freeze({ok:true,qaOnly:true});
 }
 async function reserve({requestKey}={}){
  expire();
  if(!bookReady)return fail('QUOTE_BOUND_BOOKING_NOT_CERTIFIED');
  if(state.phase!=='accepted')return fail('PREQUOTE_NOT_ACCEPTED');
  if(!uuid(requestKey)||requestKey===state.quoteRequestKey)
   return fail('INVALID_BOOKING_KEY');
  const run=++generation,s={...state},scope=Object.freeze({
   requestKey,quoteId:s.quote.quoteId,routeId:s.routeId,
   fareVersion:s.quote.fareVersion,service:s.service,
   ownerId:s.ownerId,sessionRevision:s.sessionRevision
  });
  if(!await actorMatches(s)){clear();return fail('SESSION_CHANGED');}
  if(run!==generation)return fail('STALE_RESPONSE');
  if(s.quote.expiresAt<=now()){state={...state,phase:'expired',quote:null};
   return fail('QUOTE_EXPIRED');}
  // Lock BEFORE transport. Any network ambiguity requires read-only GET,
  // NEVER an automatic POST replay or a fresh booking key.
  state={...state,phase:'sending',bookingRequestKey:requestKey};
  let result;try{result=await bookingGateway(scope);}catch{result=null;}
  if(run!==generation)return fail('STALE_RESPONSE');
  if(!await actorMatches(s)){clear();return fail('SESSION_CHANGED');}
  if(run!==generation)return fail('STALE_RESPONSE');
  // An HTTP 201 arriving after quote expiry cannot by itself prove the
  // server accepted the tariff while valid. Keep the key latched and require
  // the independent owner-scoped GET rather than trusting a stale ACK.
  if(result?.ok===true&&result.status===201
   &&s.quote.expiresAt>now()
   &&validReceipt(result.data,s,requestKey)){
   state={...state,phase:'confirmed',tripId:result.data.tripId,
    serverRevision:result.data.revision};
   return Object.freeze({ok:true,tripId:result.data.tripId,
    qaOnly:true,productionEnabled:false});
  }
  state={...state,phase:'ambiguous'};
  return fail('BOOKING_RECONCILIATION_REQUIRED');
 }
 async function reconcile(){
  if(!reconcileReady)return fail('RECONCILIATION_NOT_CERTIFIED');
  if(state.phase!=='ambiguous')return fail('NO_AMBIGUOUS_BOOKING');
  const run=++generation,s={...state};
  if(!await actorMatches(s)){clear();return fail('SESSION_CHANGED');}
  if(run!==generation)return fail('STALE_RESPONSE');
  let result;try{result=await reconciliationGateway(Object.freeze({
   requestKey:s.bookingRequestKey,quoteId:s.quote.quoteId,
   routeId:s.routeId,ownerId:s.ownerId,sessionRevision:s.sessionRevision
  }));}catch{result=null;}
  if(run!==generation)return fail('STALE_RESPONSE');
  if(!await actorMatches(s)){clear();return fail('SESSION_CHANGED');}
  if(run!==generation)return fail('STALE_RESPONSE');
  if(result?.ok!==true||result.status!==200
   ||!validReceipt(result.data,s,s.bookingRequestKey))
   return fail('BOOKING_STILL_UNCONFIRMED');
  state={...state,phase:'confirmed',tripId:result.data.tripId,
    serverRevision:result.data.revision};
  return Object.freeze({ok:true,tripId:result.data.tripId,
   recoveredWithoutPost:true,qaOnly:true,productionEnabled:false});
 }
 function verifiedBooking(){
  // Internal continuation proof only. Nothing from snapshot/UI or an HTTP
  // status alone qualifies: quote and booking receipts passed owner checks.
  if(!bookReady||state.phase!=='confirmed'
   ||!uuid(state.tripId)||!uuid(state.bookingRequestKey)
   ||!uuid(state.ownerId)||!uuid(state.routeId)
   ||!uuid(state.quote?.quoteId)
   ||!Number.isSafeInteger(state.serverRevision)||state.serverRevision<1)
   return null;
  return Object.freeze({tripId:state.tripId,subject:state.ownerId,
   requestKey:state.bookingRequestKey,routeId:state.routeId,
   quoteId:state.quote.quoteId,serverRevision:state.serverRevision,
   sessionRevision:state.sessionRevision,qaOnly:true,productionEnabled:false});
 }
 return Object.freeze({isQuoteConfigured:()=>quoteReady,
  isBookingConfigured:()=>bookReady,snapshot,verifiedBooking,prepare,load,accept,
  reserve,reconcile,discard,clear,productionEnabled:false});
}

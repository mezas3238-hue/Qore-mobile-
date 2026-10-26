/** G100 MOTO_RIDE Passenger transaction. SQL contract already exists in A,
 * but there is NO mounted HTTPS mobile endpoint yet. Defaults OFF.
 * Never reuse AUTO/DOCUMENT DELIVERY routes, tariffs, idempotency or receipts.
 */
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const fail=code=>Object.freeze({ok:false,code});
const valid=x=>typeof x==='string'&&UUID.test(x);
const obj=x=>x&&typeof x==='object'&&!Array.isArray(x);
const keys=(x,fields)=>obj(x)&&Object.keys(x).length===fields.length
 &&fields.every(k=>Object.hasOwn(x,k));
const Q=['mode','commercialEnabled','ownerId','serviceKind','service','quoteId',
 'quoteRequestKey','campaignId','currency','amountGs','commissionBps',
 'subsidyBps','customerPaysGs','customerSubsidyGs','driverReceivesGs',
 'platformRetainsGs','expiresAt','driverAssigned','pspCollected','serverPersisted'];
const B=['mode','commercialEnabled','ownerId','serviceKind','service',
 'bookingKey','quoteId','tripId','tripState','tripRevision','cancellationKey',
 'cancellationEventId','currency','amountGs','customerPaysGs','customerSubsidyGs',
 'driverReceivesGs','platformRetainsGs','commissionBps','subsidyBps',
 'financialState','reversalEntriesBalanced','driverAssigned','pspCollected',
 'pspRefunded','serverPersisted'];
const whole=x=>Number.isSafeInteger(x)&&x>=0&&x<=100000000;
const money=x=>whole(x)&&x>0;
const fieldsOK=x=>x.mode==='STAGING_DEMO_ONLY'&&x.commercialEnabled===false
 &&x.serviceKind==='MOTO_RIDE'&&x.service==='moto_pasajero'
 &&x.currency==='PYG'&&Number.isSafeInteger(x.commissionBps)
 &&x.commissionBps>=1000&&x.commissionBps<=3000&&x.subsidyBps===1000
 &&money(x.amountGs)&&whole(x.customerPaysGs)&&whole(x.customerSubsidyGs)
 &&whole(x.driverReceivesGs)&&whole(x.platformRetainsGs)
 &&x.driverReceivesGs+Math.floor((x.amountGs*x.commissionBps+5000)/10000)===x.amountGs
 &&x.customerSubsidyGs===Math.floor((x.amountGs*1000+5000)/10000)
 &&x.customerPaysGs+x.customerSubsidyGs===x.amountGs
 &&x.platformRetainsGs===Math.floor((x.amountGs*x.commissionBps+5000)/10000)-x.customerSubsidyGs
 &&x.driverReceivesGs+x.platformRetainsGs===x.customerPaysGs
 &&x.driverAssigned===false&&x.pspCollected===false
 &&x.serverPersisted===true;
const cleanText=x=>typeof x==='string'&&x.length>=3&&x.length<=120
 &&x.trim()===x&&!/[\x00-\x1f\x7f]/.test(x);
function quoteOK(x,scope,t){
 return keys(x,Q)&&fieldsOK(x)&&x.ownerId===scope.subject
  &&valid(x.quoteId)&&valid(x.campaignId)
  &&x.quoteRequestKey===scope.requestKey
  &&Number.isSafeInteger(x.expiresAt)&&x.expiresAt>t
  &&x.expiresAt<=t+3600000;
}
function bookingOK(x,scope,phase){
 return keys(x,B)&&fieldsOK(x)&&x.ownerId===scope.subject
  &&x.quoteId===scope.quote.quoteId&&x.bookingKey===scope.bookingKey
  &&valid(x.tripId)&&Number.isSafeInteger(x.tripRevision)
  &&x.amountGs===scope.quote.amountGs
  &&x.customerPaysGs===scope.quote.customerPaysGs
  &&x.customerSubsidyGs===scope.quote.customerSubsidyGs
  &&x.driverReceivesGs===scope.quote.driverReceivesGs
  &&x.platformRetainsGs===scope.quote.platformRetainsGs
  &&x.commissionBps===scope.quote.commissionBps
  &&x.pspRefunded===false
  &&(phase==='book'?
   x.tripState==='searching'&&x.tripRevision===1
   &&x.financialState==='RESERVED_QA'
   &&x.cancellationKey===null&&x.cancellationEventId===null
   &&x.reversalEntriesBalanced===false
   :x.tripState==='cancelled'&&x.tripRevision===2
    &&x.financialState==='VOIDED_QA'
    &&x.cancellationKey===scope.cancellationKey
    &&valid(x.cancellationEventId)
    &&x.reversalEntriesBalanced===true);
}
export function createG100MotoPassengerFlow({
 enabled=false,contractCertified=false,externalRuntimeVerified=false,
 motoLegalVerified=false,motoRouteVerified=false,
 getActor=null,recoveryStore=null,quoteGateway=null,bookGateway=null,
 bookingReadGateway=null,cancelGateway=null,cancelReadGateway=null,
 now=Date.now,onChange=()=>{}
}={}){
 const persistent=recoveryStore!==null;
 const canSave=Boolean(recoveryStore&&['read','write','clear'].every(k=>typeof recoveryStore[k]==='function'));
 const ready=(!persistent||canSave)&&enabled===true&&contractCertified===true
  &&externalRuntimeVerified===true&&motoLegalVerified===true
  &&motoRouteVerified===true&&typeof getActor==='function'
  &&[quoteGateway,bookGateway,bookingReadGateway,cancelGateway,
    cancelReadGateway].every(fn=>typeof fn==='function');
 let state={phase:'idle'},epoch=0,bootstrapped=!canSave;
 const makeRecord=(s,cancellationKey=null)=>Object.freeze({
  version:1,ownerId:s.subject,quoteId:s.quote.quoteId,
  bookingKey:s.bookingKey,cancellationKey,
  tripId:cancellationKey?s.tripId:null,createdAt:now()
 });
 const savedOK=(r,owner)=>keys(r,['version','ownerId','quoteId',
  'bookingKey','cancellationKey','tripId','createdAt'])
  &&r.version===1&&r.ownerId===owner
  &&valid(r.quoteId)&&valid(r.bookingKey)&&r.quoteId!==r.bookingKey
  &&(r.cancellationKey===null&&r.tripId===null
   ||valid(r.cancellationKey)&&valid(r.tripId)
    &&r.cancellationKey!==r.bookingKey&&r.cancellationKey!==r.quoteId)
  &&Number.isSafeInteger(r.createdAt)
  &&r.createdAt>=now()-604800000&&r.createdAt<=now()+60000;
 const actor=()=>{try{
  const a=getActor();return obj(a)&&a.role==='passenger'&&valid(a.subject)
   &&Number.isSafeInteger(a.sessionRevision)&&a.sessionRevision>=0
   &&Number.isSafeInteger(a.expiresAt)&&a.expiresAt>now()+1000?a:null;
 }catch{return null;}};
 const same=(s)=>{const a=actor();return a&&a.subject===s.subject
  &&a.sessionRevision===s.sessionRevision;};
 const publish=s=>{state=s;onChange();};
 function clear(silent=false){epoch++;bootstrapped=!canSave;if(silent===true)state={phase:'idle'};else publish({phase:'idle'});}
 // Passenger may abandon an unbooked quote and choose AUTO instead.
 // Once booking has been sent or outcome is unknown, never erase recovery scope.
 function discardQuote(){
  if(!['quoted','accepted'].includes(state.phase)||!same(state))
   return fail('MOTO_QUOTE_NOT_DISCARDABLE');
  epoch++;publish({phase:'idle'});
  return Object.freeze({ok:true,qaOnly:true,productionEnabled:false});
 }
 function snapshot(){
  const s=state,a=actor(),mine=Boolean(ready&&a&&s.subject===a.subject
   &&s.sessionRevision===a.sessionRevision);
  return Object.freeze({contractReady:ready&&bootstrapped&&Boolean(a),
   phase:mine?s.phase:'idle',busy:mine&&['quoting','booking','cancelling','reading','restoring','resetting'].includes(s.phase),
   quote:mine&&s.quote?Object.freeze({
    quoteId:s.quote.quoteId,originalFareGs:s.quote.amountGs,
    customerPaysGs:s.quote.customerPaysGs,customerSubsidyGs:s.quote.customerSubsidyGs,
    driverReceivesGs:s.quote.driverReceivesGs,platformRetainsGs:s.quote.platformRetainsGs,
    commissionBps:s.quote.commissionBps,subsidyBps:1000,expiresAt:s.quote.expiresAt
   }):null,tripId:mine?s.tripId??null:null,
   needsReadback:mine&&['bookingUnknown','cancelUnknown','restoreUnknown'].includes(s.phase),
   cancelled:mine&&s.phase==='cancelled',
   error:mine?s.error??null:null,qaOnly:true,productionEnabled:false});
 }
 async function requestQuote({origin,destination,quoteRequestKey,safetyAcknowledged}={}){
  const a=actor();
  if(!ready||!bootstrapped||!a)return fail('MOTO_G100_NOT_CERTIFIED');
  if(state.phase!=='idle')return fail('MOTO_TRANSACTION_ALREADY_ACTIVE');
  if(!cleanText(origin)||!cleanText(destination)
   ||origin.toLocaleLowerCase('es')===destination.toLocaleLowerCase('es')
   ||safetyAcknowledged!==true||!valid(quoteRequestKey))
   return fail('MOTO_INVALID_PRIVATE_ROUTE_INTENT');
  const seq=++epoch,s={phase:'quoting',subject:a.subject,
   sessionRevision:a.sessionRevision,requestKey:quoteRequestKey};
  publish(s);
  let result;try{result=await quoteGateway(Object.freeze({
   ownerId:a.subject,sessionRevision:a.sessionRevision,
   origin,destination,quoteRequestKey,serviceKind:'MOTO_RIDE'}));}catch{}
  if(seq!==epoch||!same(s))return fail('MOTO_STALE_SESSION');
  if(result?.ok!==true||!quoteOK(result.data,s,now())){
   publish({...s,phase:'idle',error:'MOTO_QUOTE_NOT_VERIFIED'});
   return fail('MOTO_QUOTE_NOT_VERIFIED');
  }
  publish({...s,phase:'quoted',quote:Object.freeze({...result.data})});
  return Object.freeze({ok:true,qaOnly:true,productionEnabled:false});
 }
 function acceptQuote({quoteId,customerPaysGs}={}){
  const s=state;
  if(s.phase!=='quoted'||!same(s))return fail('MOTO_QUOTE_NOT_READY');
  if(s.quote.expiresAt<=now()||s.quote.quoteId!==quoteId
   ||s.quote.customerPaysGs!==customerPaysGs)return fail('MOTO_QUOTE_CHANGED_OR_EXPIRED');
  publish({...s,phase:'accepted'});return Object.freeze({ok:true});
 }
 async function book({bookingKey}={}){
  const s=state;if(s.phase!=='accepted'||!same(s)
   ||!valid(bookingKey)||bookingKey===s.requestKey
   ||s.quote.expiresAt<=now())return fail('MOTO_BOOK_NOT_READY');
  const seq=++epoch,next={...s,phase:'booking',bookingKey};
  publish(next);
  if(canSave){
   try{await recoveryStore.write(makeRecord(next));}
   catch{
    if(seq===epoch&&same(s))publish({...next,phase:'bookingUnknown',
     error:'MOTO_SECURE_SAVE_FAILED_NO_POST'});
    return fail('MOTO_SECURE_SAVE_FAILED_NO_POST');
   }
   if(seq!==epoch||!same(s))return fail('MOTO_STALE_SESSION');
  }
  let result;try{result=await bookGateway(Object.freeze({
   ownerId:s.subject,sessionRevision:s.sessionRevision,
   quoteId:s.quote.quoteId,bookingKey}));}catch{}
  if(seq!==epoch||!same(s))return fail('MOTO_STALE_SESSION');
  if(result?.ok===true&&bookingOK(result.data,next,'book')){
   publish({...next,phase:'booked',tripId:result.data.tripId});
   return Object.freeze({ok:true,qaOnly:true,productionEnabled:false});
  }
  publish({...next,phase:'bookingUnknown',error:'MOTO_BOOK_READBACK_REQUIRED'});
  return fail('MOTO_BOOK_READBACK_REQUIRED');
 }
 async function readBooking(){
  const s=state;if(s.phase!=='bookingUnknown'||!same(s))
   return fail('MOTO_NO_BOOKING_AMBIGUITY');
  const seq=++epoch;publish({...s,phase:'reading'});
  let result;try{result=await bookingReadGateway(Object.freeze({
   ownerId:s.subject,sessionRevision:s.sessionRevision,bookingKey:s.bookingKey}));}catch{}
  if(seq!==epoch||!same(s))return fail('MOTO_STALE_SESSION');
  if(result?.ok===true&&bookingOK(result.data,s,'book')){
   publish({...s,phase:'booked',tripId:result.data.tripId,error:null});
   return Object.freeze({ok:true,recoveredWithoutPost:true});
  }
  publish({...s,phase:'bookingUnknown',error:'MOTO_BOOK_STILL_UNKNOWN'});
  return fail('MOTO_BOOK_STILL_UNKNOWN');
 }
 async function cancel({cancellationKey}={}){
  const s=state;if(s.phase!=='booked'||!same(s)||!valid(cancellationKey)
   ||cancellationKey===s.bookingKey||cancellationKey===s.requestKey)
   return fail('MOTO_CANCEL_NOT_READY');
  const seq=++epoch,next={...s,phase:'cancelling',cancellationKey};
  publish(next);
  if(canSave){
   try{await recoveryStore.write(makeRecord(next,cancellationKey));}
   catch{
    if(seq===epoch&&same(s))publish({...next,phase:'cancelUnknown',
     error:'MOTO_SECURE_SAVE_FAILED_NO_POST'});
    return fail('MOTO_SECURE_SAVE_FAILED_NO_POST');
   }
   if(seq!==epoch||!same(s))return fail('MOTO_STALE_SESSION');
  }
  let result;try{result=await cancelGateway(Object.freeze({
   ownerId:s.subject,sessionRevision:s.sessionRevision,
   bookingKey:s.bookingKey,cancellationKey}));}catch{}
  if(seq!==epoch||!same(s))return fail('MOTO_STALE_SESSION');
  if(result?.ok===true&&bookingOK(result.data,next,'cancel')
   &&result.data.tripId===s.tripId){
   publish({...next,phase:'cancelled'});
   return Object.freeze({ok:true,qaOnly:true,productionEnabled:false});
  }
  publish({...next,phase:'cancelUnknown',error:'MOTO_CANCEL_READBACK_REQUIRED'});
  return fail('MOTO_CANCEL_READBACK_REQUIRED');
 }
 async function readCancellation(){
  const s=state;if(s.phase!=='cancelUnknown'||!same(s))
   return fail('MOTO_NO_CANCEL_AMBIGUITY');
  const seq=++epoch;publish({...s,phase:'reading'});
  let result;try{result=await cancelReadGateway(Object.freeze({
   ownerId:s.subject,sessionRevision:s.sessionRevision,bookingKey:s.bookingKey}));}catch{}
  if(seq!==epoch||!same(s))return fail('MOTO_STALE_SESSION');
  if(result?.ok===true&&bookingOK(result.data,s,'cancel')
   &&result.data.tripId===s.tripId){
   publish({...s,phase:'cancelled',error:null});
   return Object.freeze({ok:true,recoveredWithoutPost:true});
  }
  publish({...s,phase:'cancelUnknown',error:'MOTO_CANCEL_STILL_UNKNOWN'});
  return fail('MOTO_CANCEL_STILL_UNKNOWN');
 }
 // Crash-safe R81: never re-send a POST after process death. Validate server GET.
 async function restore(){
  if(!canSave||!ready)return fail('MOTO_RECOVERY_NOT_CONFIGURED');
  if(!['idle','restoreUnknown'].includes(state.phase))return fail('MOTO_RECOVERY_BUSY');
  const a=actor();if(!a)return fail('MOTO_RECOVERY_AUTH_REQUIRED');
  const seq=++epoch,s={phase:'restoring',subject:a.subject,
   sessionRevision:a.sessionRevision};
  bootstrapped=false;publish(s);
  let record;try{record=await recoveryStore.read();}
  catch{
   if(seq===epoch&&same(s))publish({...s,phase:'restoreUnknown',
    error:'MOTO_SECURE_READ_FAILED'});
   return fail('MOTO_SECURE_READ_FAILED');
  }
  if(seq!==epoch||!same(s))return fail('MOTO_STALE_SESSION');
  if(record==null){
   bootstrapped=true;publish({phase:'idle'});
   return Object.freeze({ok:true,nothingToRecover:true,qaOnly:true});
  }
  if(!savedOK(record,a.subject)){
   publish({...s,phase:'restoreUnknown',error:'MOTO_SAVED_SCOPE_INVALID'});
   return fail('MOTO_SAVED_SCOPE_INVALID');
  }
  const cancelling=valid(record.cancellationKey);
  let response;try{
   response=await (cancelling?cancelReadGateway:bookingReadGateway)(
    Object.freeze({ownerId:a.subject,sessionRevision:a.sessionRevision,
     bookingKey:record.bookingKey}));
  }catch{}
  if(seq!==epoch||!same(s))return fail('MOTO_STALE_SESSION');
  const data=response?.data;
  const quote=obj(data)?{
   quoteId:record.quoteId,amountGs:data.amountGs,
   customerPaysGs:data.customerPaysGs,customerSubsidyGs:data.customerSubsidyGs,
   driverReceivesGs:data.driverReceivesGs,platformRetainsGs:data.platformRetainsGs,
   commissionBps:data.commissionBps,expiresAt:0
  }:null;
  const scope={...s,bookingKey:record.bookingKey,
   cancellationKey:record.cancellationKey,quote};
  if(response?.ok!==true||!quote||!bookingOK(data,scope,cancelling?'cancel':'book')
   ||cancelling&&data.tripId!==record.tripId){
   publish({...s,phase:'restoreUnknown',error:'MOTO_PRIVATE_GET_UNVERIFIED'});
   return fail('MOTO_PRIVATE_GET_UNVERIFIED');
  }
  bootstrapped=true;
  publish({...s,phase:cancelling?'cancelled':'booked',quote,
   bookingKey:record.bookingKey,tripId:data.tripId,
   cancellationKey:record.cancellationKey,error:null});
  return Object.freeze({ok:true,recoveredWithoutPost:true,
   qaOnly:true,productionEnabled:false});
 }
 async function clearConfirmedCancellation(){
  const s=state;
  if(s.phase!=='cancelled'||!same(s))return fail('MOTO_CONFIRMED_CANCEL_REQUIRED');
  const seq=++epoch;publish({...s,phase:'resetting'});
  if(canSave){
   try{await recoveryStore.clear();}
   catch{
    if(seq===epoch&&same(s))publish({...s,phase:'cancelled',
     error:'MOTO_SECURE_PURGE_FAILED'});
    return fail('MOTO_SECURE_PURGE_FAILED');
   }
  }
  if(seq!==epoch||!same(s))return fail('MOTO_STALE_SESSION');
  clear();bootstrapped=true;
  return Object.freeze({ok:true,qaOnly:true,productionEnabled:false});
 }
 return Object.freeze({snapshot,clear,discardQuote,restore,clearConfirmedCancellation,
  requestQuote,acceptQuote,book,readBooking,cancel,readCancellation,productionEnabled:false});
}

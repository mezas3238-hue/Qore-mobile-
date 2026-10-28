import {validateG45ReserveRequest} from './g45-order-qa-contract.mjs';
/** G148 Buyer QA order: write original idempotency key BEFORE HTTP POST,
 * reconcile on timeout/restart without re-reserving stock, cancel once.
 * No checkout, dispatch, PSP or LIVE; the authority remains G45/G144.
 */
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const uuid=x=>typeof x==='string'&&UUID.test(x)&&x===x.toLowerCase();
const fail=code=>Object.freeze({ok:false,code,qaOnly:true,paymentEnabled:false});
const validRow=x=>x&&x.version===1&&uuid(x.ownerId)&&uuid(x.requestKey)
 &&uuid(x.branchId)&&Number.isSafeInteger(x.createdAt)&&x.createdAt>0
 &&['AUTO','MOTO'].includes(x.vehicleKind)
 &&(x.cancelKey===null||uuid(x.cancelKey))
 &&Object.keys(x).length===7;
const same=(a,b)=>a&&b&&a.authenticated===true&&b.authenticated===true
 &&a.account?.subject===b.account?.subject
 &&a.privateViewRevision===b.privateViewRevision;
export function createG148CommerceDurableOrder({store,api,now=Date.now}={}){
 const capable=store&&['read','write','markCancel','clearMatching']
  .every(x=>typeof store[x]==='function')
  &&api&&['reserveCommerceQa','recoverCommerceQa','cancelCommerceQa',
   'snapshot','isCommerceQaReady'].every(x=>typeof api[x]==='function')
  &&typeof now==='function';
 let busy=false;
 function identity(){
  const s=api.snapshot();
  if(!s?.authenticated||!uuid(s.account?.subject))return null;
  return s;
 }
 async function guarded(task){
  if(!capable||api.isCommerceQaReady()!==true)return fail('G148_NOT_CERTIFIED');
  if(busy)return fail('G148_BUSY');
  const before=identity();if(!before)return fail('AUTH_REQUIRED');
  busy=true;
  try{
   const result=await task(before,before.account.subject);
   return same(before,identity())?result:fail('STALE_SESSION');
  }catch{return fail('G148_PRIVATE_STORE_UNAVAILABLE');}
  finally{busy=false;}
 }
 async function reserve(body){
  return guarded(async(before,ownerId)=>{
   if(!validateG45ReserveRequest(body))return fail('INVALID_QA_ORDER');
   if(await store.read(ownerId)!==null)return fail('ORIGINAL_ORDER_RECOVERY_REQUIRED');
   const timestamp=now();
   if(!Number.isSafeInteger(timestamp)||timestamp<=0)return fail('CLOCK_UNAVAILABLE');
   // Atomic write rejects a concurrent record; no POST can happen first.
   const row={version:1,ownerId,requestKey:body.requestKey,
    branchId:body.branchId,vehicleKind:body.vehicleKind,
    createdAt:timestamp,cancelKey:null};
   if(!validRow(row))return fail('INVALID_PRIVATE_RECORD');
   await store.write(row);
   if(!same(before,identity()))return fail('STALE_SESSION');
   let answer;
   try{answer=await api.reserveCommerceQa(body);}
   catch{return fail('POST_RESULT_UNKNOWN_RECOVER_ORIGINAL');}
   if(answer?.ok!==true)return fail('POST_RESULT_UNKNOWN_RECOVER_ORIGINAL');
   if(answer.receipt?.requestKey!==body.requestKey||
    answer.receipt?.branchId!==body.branchId||
    !uuid(answer.receipt?.orderId)||answer.receipt?.paymentConfirmed!==false)
    return fail('UNSAFE_RESERVATION_RECEIPT');
   return Object.freeze({ok:true,receipt:answer.receipt,qaOnly:true,
    paymentEnabled:false});
  });
 }
 async function recover(){
  return guarded(async(_,ownerId)=>{
   const row=await store.read(ownerId);
   if(!validRow(row)||row.ownerId!==ownerId)return fail('ORIGINAL_ORDER_NOT_PREPARED');
   let response;try{response=await api.recoverCommerceQa(row.requestKey);}
   catch{return fail('RECOVERY_UNAVAILABLE');}
   if(response?.ok!==true)return fail(response?.code??'RECOVERY_UNAVAILABLE');
   const receipt=response.receipt;
   if(receipt?.requestKey!==row.requestKey||receipt?.branchId!==row.branchId||
    !uuid(receipt?.orderId)||receipt.paymentConfirmed!==false)
    return fail('UNSAFE_ORIGINAL_RECEIPT');
   return Object.freeze({ok:true,receipt,requestKey:row.requestKey,
    cancellationPending:row.cancelKey!==null,qaOnly:true,paymentEnabled:false});
  });
 }
 async function cancel(cancelKey){
  return guarded(async(before,ownerId)=>{
   if(!uuid(cancelKey))return fail('INVALID_CANCEL_KEY');
   const row=await store.read(ownerId);
   if(!validRow(row)||row.ownerId!==ownerId)return fail('ORIGINAL_ORDER_NOT_PREPARED');
   // A lost cancel ACK must reuse the first persisted key, never mint a
   // new cancellation on a retry even if the UI supplied another UUID.
   const effectiveKey=row.cancelKey??cancelKey;
   let beforeCancel;try{beforeCancel=await api.recoverCommerceQa(row.requestKey);}
   catch{return fail('RECOVERY_UNAVAILABLE');}
   if(beforeCancel?.ok!==true)return fail('ORIGINAL_ORDER_NOT_VERIFIED');
   const original=beforeCancel.receipt;
   if(original?.requestKey!==row.requestKey||original?.branchId!==row.branchId||
    !uuid(original.orderId)||original.paymentConfirmed!==false)
    return fail('UNSAFE_ORIGINAL_RECEIPT');
   if(original.status==='cancelled')
    return Object.freeze({ok:true,receipt:original,qaOnly:true,
     paymentEnabled:false,alreadyCancelled:true});
   if(!['requested','confirmed'].includes(original.status))
    return fail('ORDER_NOT_CANCELLABLE');
   if(row.cancelKey===null)await store.markCancel(ownerId,row.requestKey,effectiveKey);
   if(!same(before,identity()))return fail('STALE_SESSION');
   let answer;try{answer=await api.cancelCommerceQa({orderId:original.orderId,cancelKey:effectiveKey});}
   catch{return fail('CANCEL_RESULT_UNKNOWN_RECOVER_ORIGINAL');}
   if(answer?.ok!==true)return fail('CANCEL_RESULT_UNKNOWN_RECOVER_ORIGINAL');
   if(answer.receipt?.orderId!==original.orderId||
    answer.receipt.refundConfirmed!==false)
    return fail('UNSAFE_CANCEL_RECEIPT');
   return Object.freeze({ok:true,receipt:answer.receipt,
    qaOnly:true,paymentEnabled:false,alreadyCancelled:false});
  });
 }
 async function releaseCancelled(){
  return guarded(async(_,ownerId)=>{
   const row=await store.read(ownerId);
   if(!validRow(row)||row.ownerId!==ownerId)return fail('ORIGINAL_ORDER_NOT_PREPARED');
   const answer=await api.recoverCommerceQa(row.requestKey);
   if(answer?.ok!==true)return fail('SERVER_CANCELLATION_NOT_CONFIRMED');
   const receipt=answer.receipt;
   if(receipt?.status!=='cancelled'||receipt.requestKey!==row.requestKey||
    receipt.branchId!==row.branchId||receipt.paymentConfirmed!==false)
    return fail('SERVER_CANCELLATION_NOT_CONFIRMED');
   await store.clearMatching(ownerId,row.requestKey);
   return Object.freeze({ok:true,receipt,qaOnly:true,paymentEnabled:false});
  });
 }
 return Object.freeze({isConfigured:()=>Boolean(capable&&api.isCommerceQaReady()),
  reserve,recover,cancel,releaseCancelled});
}

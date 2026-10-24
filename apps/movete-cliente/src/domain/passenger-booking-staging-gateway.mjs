/**
 * R56 — Passenger booking STAGING adapter: HTTP 201 alone is NOT evidence
 * of a persisted service. G11 OpenAPI Success is still a generic object;
 * this adapter proposes a strict QA-only receipt, never a live booking.
 * All capabilities remain OFF without separately certified contracts.
 */
import {createClientGateway} from './client-gateway.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS=new Set(['rideRequest','deliveryRequest']);
const RECEIPT=['mode','commercialEnabled','ownerId','requestKey','operation',
 'serviceId','revision','serverPersisted','status'];
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const validId=x=>typeof x==='string'&&UUID.test(x);
const fail=code=>Object.freeze({ok:false,code});
const exact=x=>object(x)&&Object.keys(x).length===RECEIPT.length
 &&RECEIPT.every(key=>Object.hasOwn(x,key));
function certifiedQaReceipt(dto,{operation,requestKey,subject}){
 return exact(dto)&&dto.mode==='STAGING_DEMO_ONLY'
  &&dto.commercialEnabled===false
  &&dto.ownerId===subject&&validId(dto.ownerId)
  &&dto.requestKey===requestKey&&validId(dto.requestKey)
  &&dto.operation===operation&&KINDS.has(dto.operation)
  &&validId(dto.serviceId)
  &&Number.isSafeInteger(dto.revision)&&dto.revision>=1
  &&dto.serverPersisted===true&&dto.status==='ACCEPTED_QA';
}
export function createPassengerBookingStagingGateway({
 enabled=false,contractCertified=false,stagingRuntimeVerified=false,
 qaReceiptContractCertified=false,reconciliationContractCertified=false,
 reconciliationRead=null,origin,pinnedOrigin,getSession,fetchImpl,
 onSessionInvalid=()=>{},now=()=>Date.now(),timeoutMs=8000,maxBytes=32768
}={}){
 const permitted=enabled===true&&contractCertified===true
  &&stagingRuntimeVerified===true&&qaReceiptContractCertified===true
  &&typeof getSession==='function';
 const transport=createClientGateway({
  enabled:permitted,contractCertified:permitted,
  certifiedOperations:permitted?['rideRequest','deliveryRequest']:[],
  origin,pinnedOrigin,getSession,fetchImpl,onSessionInvalid,
  now,timeoutMs,maxBytes
 });
 const ready=permitted&&transport.isConfigured();
 // Reconciliation is a SEPARATE owner-certified, read-only capability.
 // No endpoint/URL is fabricated here; the backend contract is still absent.
 const canReconcile=ready&&reconciliationContractCertified===true
  &&typeof reconciliationRead==='function';
 let busy=false;
 async function send(operation,{body,expectedSessionRevision=null,expectedSubject=null}={}){
  if(!ready)return fail('BOOKING_STAGING_NOT_CERTIFIED');
  if(!KINDS.has(operation)||!object(body)||!validId(body.requestKey))
   return fail('INVALID_BOOKING_REQUEST');
  if(busy)return fail('BOOKING_IN_FLIGHT');
  busy=true;
  try{
   // Snapshot captured BEFORE network, including issuer/session revision.
   let actor;
   try{actor=await getSession();}catch{return fail('AUTH_UNAVAILABLE');}
   if(!object(actor)||actor.role!=='passenger'||!validId(actor.subject)
    ||!validId(expectedSubject)||actor.subject!==expectedSubject
    ||!Number.isSafeInteger(actor.sessionRevision)
    ||actor.sessionRevision!==expectedSessionRevision)
    return fail('STALE_SESSION_RESPONSE');
   const answer=await transport.send(operation,{
    body,expectedSessionRevision
   });
   if(!answer?.ok)return answer??fail('BOOKING_UNCONFIRMED');
   // Revalidate AFTER transport and before projecting any receipt.
   let after;
   try{after=await getSession();}catch{return fail('STALE_SESSION_RESPONSE');}
   if(!object(after)||after.subject!==actor.subject
    ||after.token!==actor.token
    ||after.sessionRevision!==actor.sessionRevision
    ||after.expiresAt!==actor.expiresAt)
    return fail('STALE_SESSION_RESPONSE');
   if(!certifiedQaReceipt(answer.data,{
    operation,requestKey:body.requestKey,subject:actor.subject
   }))return fail('BOOKING_RECEIPT_NOT_CERTIFIED');
   return Object.freeze({ok:true,status:201,qaOnly:true,
    commercialEnabled:false,bookingConfirmedForProduction:false,
    data:Object.freeze({...answer.data})});
  }catch{
   // Timeout or exception after POST may hide a committed QA row.
   return fail('NETWORK_OR_TIMEOUT');
  }finally{busy=false;}
 }
 async function reconcile(operation,{requestKey,expectedSessionRevision=null,
  expectedSubject=null}={}){
  if(!canReconcile)return fail('BOOKING_RECONCILIATION_NOT_CERTIFIED');
  if(!KINDS.has(operation)||!validId(requestKey)||!validId(expectedSubject)
   ||!Number.isSafeInteger(expectedSessionRevision)
   ||expectedSessionRevision<0)return fail('INVALID_RECONCILIATION_SCOPE');
  if(busy)return fail('BOOKING_IN_FLIGHT');
  busy=true;
  try{
   let before;
   try{before=await getSession();}catch{return fail('AUTH_UNAVAILABLE');}
   if(!object(before)||before.role!=='passenger'
    ||before.subject!==expectedSubject
    ||before.sessionRevision!==expectedSessionRevision
    ||typeof before.token!=='string'||before.token.length<20
    ||!Number.isSafeInteger(before.expiresAt)
    ||before.expiresAt<=now()+1000)
    return fail('STALE_SESSION_RESPONSE');
   // The callback must be a separately certified READ. Never call send().
   let answer;
   try{answer=await reconciliationRead(Object.freeze({
    operation,requestKey,expectedSubject,expectedSessionRevision,
    bearer:before.token
   }));}catch{return fail('BOOKING_RECONCILIATION_UNKNOWN');}
   let after;
   try{after=await getSession();}catch{return fail('STALE_SESSION_RESPONSE');}
   if(!object(after)||after.role!=='passenger'
    ||after.subject!==before.subject||after.token!==before.token
    ||after.authRevision!==before.authRevision
    ||after.sessionRevision!==before.sessionRevision
    ||after.expiresAt!==before.expiresAt
    ||after.expiresAt<=now()+1000)
    return fail('STALE_SESSION_RESPONSE');
   if(answer?.ok!==true||answer.status!==200
    ||!certifiedQaReceipt(answer.data,{
     operation,requestKey,subject:expectedSubject
    }))
    // Missing or inconclusive evidence is NEVER permission to POST again.
    return fail('BOOKING_RECONCILIATION_UNKNOWN');
   return Object.freeze({ok:true,status:200,qaOnly:true,
    commercialEnabled:false,bookingConfirmedForProduction:false,
    recoveredWithoutPost:true,data:Object.freeze({...answer.data})});
  }catch{return fail('BOOKING_RECONCILIATION_UNKNOWN');}
  finally{busy=false;}
 }
 return Object.freeze({
  isConfigured:()=>Boolean(ready),send,reconcile,
  bookingReconciliationRequired:true,productionEnabled:false
 });
}

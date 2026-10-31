import test from 'node:test';
import assert from 'node:assert/strict';
import {createG254PrivateDocumentReminderWorker,G254_KYC_REMINDER_LIVE_ENABLED}
 from './g254-private-kyc-reminder-worker.mjs';

const driver='25400000-0000-4254-8254-000000000001';
const document='25400000-0000-4254-8254-000000000002';
const now=Date.parse('2026-10-31T15:00:00Z');
const validUntilMs=now+3*86400000;
const alert={alertId:17,driverId:driver,
 eventKey:'G251:'+document+':3:'+validUntilMs+':D07',
 documentRevision:3,validUntilMs,kind:'seguro',band:'D07'};
const token='ExpoPushToken[abcdefghijklmno1234567]';
const device={driverId:driver,token,active:true,notificationsConsent:true,
 registeredByVerifiedSession:true};
const receipt={acceptedForProcessing:true,handsetDelivered:false,
 driverApproved:false,productionEnabled:false,providerTicketId:'abcde12345678'};
const create=(override={})=>{
 const calls=[];
 const opts={
  environment:'isolated_staging',qaOnly:true,liveEnabled:false,now:()=>now,
  claimNextAlert:async()=>{calls.push('claim');return alert;},
  verifyCurrentAttestation:async x=>{calls.push({check:x});return true;},
  findVerifiedDevice:async x=>{calls.push({device:x});return device;},
  sendGenericReminder:async x=>{calls.push({send:x});return receipt;},
  ackProcessingTicket:async x=>{calls.push({ack:x});return true;},
  ...override
 };
 return {worker:createG254PrivateDocumentReminderWorker(opts),calls};
};
test('G254 remains STAGING-only with minimal generic push and no claim of delivery',async()=>{
 assert.equal(G254_KYC_REMINDER_LIVE_ENABLED,false);
 const {worker,calls}=create();
 const out=await worker();
 assert.equal(out.status,'ACCEPTED_FOR_PROCESSING_NOT_DELIVERED');
 assert.equal(out.providerAcceptedForProcessing,true);
 assert.equal(out.handsetDelivered,false);
 assert.equal(out.commercialDispatchAuthorized,false);
 assert.equal(calls.filter(x=>x.check).length,2);
 const sent=calls.find(x=>x.send).send;
 assert.equal(sent.recipientDriverId,driver);
 assert.equal(sent.token,token);
 assert.deepEqual(sent.message,{
  title:'QORE · Documentación',
  body:'Revisá tus documentos en la aplicación QORE Driver.',
  data:{kind:'QORE_STAGING_KYC_REMINDER'}
 });
 assert.equal(JSON.stringify(sent.message).includes(driver),false);
 assert.equal(JSON.stringify(sent.message).includes(document),false);
 assert.equal(JSON.stringify(sent.message).includes('seguro'),false);
 assert.deepEqual(calls.find(x=>x.ack).ack,{
  alertId:17,eventKey:alert.eventKey,providerTicketId:receipt.providerTicketId});
});
test('G254 does not call push when source proof is revoked',async()=>{
 const {worker,calls}=create({verifyCurrentAttestation:async()=>false});
 assert.equal((await worker()).status,'STALE_OR_REVOKED');
 assert.equal(calls.some(x=>x.send),false);
});
test('G254 does not push when attestation changes while device lookup runs',async()=>{
 let count=0;
 const {worker,calls}=create({
  verifyCurrentAttestation:async()=>++count===1
 });
 assert.equal((await worker()).status,'RENEWED_BEFORE_SEND');
 assert.equal(count,2);
 assert.equal(calls.some(x=>x.send),false);
});
test('G254 refuses invalid or unverifiable private outbox claim',async()=>{
 for(const v of [
  {...alert,driverId:'forged'}, {...alert,band:'NOT_VALID'},
  {...alert,documentRevision:0}, {...alert,kind:'passport'},
  {...alert,documentName:'confidential'}, {...alert,eventKey:'fake'},
  {...alert,validUntilMs:-1}, {...alert,alertId:0}
 ]){
  const {worker,calls}=create({claimNextAlert:async()=>v});
  assert.equal((await worker()).status,'INVALID_PRIVATE_CLAIM');
  assert.equal(calls.some(x=>x.send),false);
 }
});
test('G254 requires verified session, consent, active Expo token',async()=>{
 for(const bad of [
  {...device,active:false},{...device,notificationsConsent:false},
  {...device,registeredByVerifiedSession:false},
  {...device,driverId:document},{...device,token:'not-a-push-token'},
  {...device,phone:'unsafe'},null
 ]){
  const {worker,calls}=create({findVerifiedDevice:async()=>bad});
  assert.equal((await worker()).status,'NO_CONSENTING_VERIFIED_DEVICE');
  assert.equal(calls.some(x=>x.send),false);
 }
});
test('G254 avoids obsolete D07 push when time crosses into D01',async()=>{
 const {worker,calls}=create({now:()=>validUntilMs-1000});
 assert.equal((await worker()).status,'ALERT_WINDOW_CHANGED');
 assert.equal(calls.some(x=>x.send),false);
});
test('G254 does not confuse accepted ticket with handset delivery or driver approval',async()=>{
 for(const r of [
  {...receipt,handsetDelivered:true},
  {...receipt,driverApproved:true},
  {...receipt,productionEnabled:true},
  {...receipt,providerTicketId:'oops'},
  {...receipt,deviceToken:token},null
 ]){
  const {worker,calls}=create({sendGenericReminder:async()=>r});
  assert.equal((await worker()).status,'UNTRUSTED_PROVIDER_RECEIPT');
  assert.equal(calls.some(x=>x.ack),false);
 }
});
test('G254 fails closed on provider failure and unknown ACK, never auto retries',async()=>{
 for(const override of [
  {sendGenericReminder:async()=>{throw Error('private provider body')}},
  {ackProcessingTicket:async()=>false},
  {ackProcessingTicket:async()=>{throw Error('SQL connection failed')}}
 ]){
  const {worker,calls}=create(override);
  const r=await worker();
  assert.match(r.status,/NO_RETRY$/);
  assert.equal(calls.filter(x=>x.send).length<=1,true);
  assert.equal(r.providerAcceptedForProcessing,false);
 }
});
test('G254 idle, claim errors and no simultaneous duplicates',async()=>{
 const idle=create({claimNextAlert:async()=>null});
 assert.equal((await idle.worker()).status,'IDLE');
 const failed=create({claimNextAlert:async()=>{throw Error('private db')}});
 assert.equal((await failed.worker()).status,'CLAIM_UNAVAILABLE');
 let release;
 const active=create({claimNextAlert:()=>new Promise(resolve=>{release=resolve;})});
 const first=active.worker();
 assert.equal((await active.worker()).status,'IN_FLIGHT');
 release(null);
 assert.equal((await first).status,'IDLE');
});
test('G254 refuses all production or missing trusted callbacks',()=>{
 for(const change of [{environment:'production'},{qaOnly:false},
  {liveEnabled:true},{claimNextAlert:null},{verifyCurrentAttestation:null},
  {sendGenericReminder:null}]){
  assert.throws(()=>create(change),/G254_PRIVATE_STAGING_OUTBOX_REQUIRED/);
 }
});

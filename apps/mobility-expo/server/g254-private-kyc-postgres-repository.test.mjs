import test from 'node:test';
import assert from 'node:assert/strict';
import {createG254PrivateKycPgClaimRepository,G254_PG_ADAPTER_LIVE_ENABLED}
 from './g254-private-kyc-postgres-repository.mjs';
import {createG254PrivateDocumentReminderWorker}
 from './g254-private-kyc-reminder-worker.mjs';
const workerId='25400000-0000-4254-8254-000000000001';
const driverId='25400000-0000-4254-8254-000000000002';
const docId='25400000-0000-4254-8254-000000000003';
const at=Date.parse('2026-10-31T15:00:00Z');
const expiry=at+6*86400000;
const alert={alertId:4,eventKey:'G251:'+docId+':3:'+expiry+':D07',
 driverId,kind:'seguro',band:'D07',documentRevision:3,validUntilMs:expiry};
const envelope=(status,extra={})=>({
 mode:'STAGING_DEMO_ONLY',status,qaOnly:true,productionEnabled:false,...extra
});
const create=(query)=>createG254PrivateKycPgClaimRepository({
 environment:'isolated_staging',qaOnly:true,liveEnabled:false,
 workerId,client:{query}
});
test('G254 Postgres adapter uses only bound owner SQL with claimed alert scope',async()=>{
 assert.equal(G254_PG_ADAPTER_LIVE_ENABLED,false);
 const calls=[];
 const repo=create(async(text,params)=>{
  calls.push({text,params});
  if(text.includes('claim_reminder_owner'))return {rows:[{
   result:envelope('CLAIMED',{alert})}]};
  if(text.includes('claim_still_valid_owner'))return {rows:[{result:true}]};
  if(text.includes('ack_ticket_owner'))return {rows:[{result:true}]};
  throw Error('unexpected query');
 });
 assert.deepEqual(await repo.claimNextAlert(),alert);
 assert.equal(await repo.verifyCurrentAttestation(alert),true);
 assert.equal(await repo.ackProcessingTicket({alertId:alert.alertId,
  eventKey:alert.eventKey,providerTicketId:'receipt_12345'}),true);
 assert.deepEqual(calls.map(c=>c.params),[
  [workerId],[workerId,4,alert.eventKey],
  [workerId,4,alert.eventKey,'receipt_12345']
 ]);
 assert.equal(calls.every(c=>c.text.includes('$1::uuid')),true);
});
test('G254 correctly distinguishes disabled from an idle real queue',async()=>{
 const disabled=create(async()=>({rows:[{result:envelope('DISABLED')}]}));
 assert.deepEqual(await disabled.claimNextAlert(),{
  state:'WORKER_DISABLED',qaOnly:true,productionEnabled:false});
 const empty=create(async()=>({rows:[{result:envelope('IDLE')}]}));
 assert.equal(await empty.claimNextAlert(),null);
 const worker=createG254PrivateDocumentReminderWorker({
  environment:'isolated_staging',qaOnly:true,liveEnabled:false,
  claimNextAlert:disabled.claimNextAlert,
  verifyCurrentAttestation:async()=>{throw Error('should not check');},
  findVerifiedDevice:async()=>{throw Error('should not find');},
  sendGenericReminder:async()=>{throw Error('should not send');},
  ackProcessingTicket:async()=>{throw Error('should not ack');},
  now:()=>at
 });
 assert.equal((await worker()).status,'WORKER_DISABLED');
});
test('G254 rejects forged SQL modes, unbounded rows and extra private fields',async()=>{
 for(const invalid of [
  envelope('CLAIMED',{alert:{...alert,documentPath:'private'}}),
  envelope('CLAIMED',{alert:{...alert,driverId:'bad'}}),
  envelope('CLAIMED',{alert:{...alert,documentRevision:0}}),
  envelope('CLAIMED',{alert:{...alert,eventKey:'forged'}}),
  envelope('DISABLED',{productionEnabled:true}),
  envelope('IDLE',{phone:'leak'}),
  envelope('WRONG')
 ]){
  const db=create(async()=>({rows:[{result:invalid}]}));
  await assert.rejects(db.claimNextAlert(),/G254_UNTRUSTED_CLAIM/);
 }
 const db=create(async()=>({rows:[]}));
 await assert.rejects(db.claimNextAlert(),/G254_UNTRUSTED_DATABASE_RESULT/);
});
test('G254 cannot bypass authoritative false document recheck',async()=>{
 const db=create(async(text)=>({rows:[{result:
  text.includes('claim_still_valid_owner')?false:envelope('IDLE')}]}));
 assert.equal(await db.verifyCurrentAttestation(alert),false);
 await assert.rejects(db.verifyCurrentAttestation({
  ...alert,document:'private'}),/G254_UNVERIFIED_CLAIM_SCOPE/);
});
test('G254 treats SQL connection outage and malformed ACK as failure',async()=>{
 const db=create(async()=>{throw Error('sensitive SQL message');});
 await assert.rejects(db.claimNextAlert(),/G254_DATABASE_UNAVAILABLE/);
 await assert.rejects(db.ackProcessingTicket({alertId:4,
  eventKey:alert.eventKey,providerTicketId:'abc'}),/G254_INVALID_ACK/);
 const wrong=create(async()=>({rows:[{result:{notBoolean:true}}]}));
 await assert.rejects(wrong.ackProcessingTicket({alertId:4,
  eventKey:alert.eventKey,providerTicketId:'receipt_12345'}),
  /G254_UNTRUSTED_ACK/);
});
test('G254 refuses frontend SDK and any non-isolated context',()=>{
 for(const props of [
  {environment:'production'},{qaOnly:false},{liveEnabled:true},
  {workerId:'invalid'},{client:{rpc:()=>{},query:()=>{}}},
  {client:{from:()=>{}}},{client:null}
 ]){
  assert.throws(()=>createG254PrivateKycPgClaimRepository({
   environment:'isolated_staging',qaOnly:true,liveEnabled:false,
   workerId,client:{query:async()=>({rows:[]})},...props
  }),/G254_TRUSTED_POSTGRES_OWNER_ONLY/);
 }
});

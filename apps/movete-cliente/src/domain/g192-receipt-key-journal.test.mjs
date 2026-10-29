import test from 'node:test';
import assert from 'node:assert/strict';
import {createG192ReceiptKeyJournal} from './g192-receipt-key-journal.mjs';
const sender='18700000-0000-4187-8187-000000000001';
const recipient='18700000-0000-4187-8187-000000000002';
const original='18700000-0000-4187-8187-000000000021';
const other='18700000-0000-4187-8187-000000000022';
const key='18700000-0000-4187-8187-000000000031';
const recipientKey='18700000-0000-4187-8187-000000000032';
const store=(overrides={})=>{
 const cells=new Map();let writes=0;
 const make=()=>createG192ReceiptKeyJournal({
  readSecure:async k=>cells.get(k)??null,
  writeSecure:async(k,v)=>{writes++;cells.set(k,v)},
  deleteSecure:async k=>{cells.delete(k)},
  now:()=>1800000000000,...overrides
 });
 return {make,cells,writes:()=>writes};
};
const bind=()=>({subject:sender,kind:'bind',deliveryId:original,
 requestKey:key,recipientId:recipient});
const confirm=()=>({subject:recipient,kind:'confirm',deliveryId:original,
 requestKey:recipientKey});
const senderProof=()=>({mode:'STAGING_DEMO_ONLY',deliveryId:original,
 ownerId:sender,recipientBound:true,bindingKey:key,paymentAuthorized:false,
 qaOnly:true,productionEnabled:false});
const recipientProof=()=>({mode:'STAGING_DEMO_ONLY',deliveryId:original,
 recipientConfirmed:true,confirmationId:recipientKey,
 paymentAuthorized:false,qaOnly:true,productionEnabled:false});
test('G192 never POST without durable readback and never overwrite original key',async()=>{
 const {make,writes}=store();const first=make();
 const saved=await first.arm(bind());
 assert.equal(saved.version,1);assert.equal(writes(),1);
 const reloaded=await make().read(sender,'bind');
 assert.deepEqual(reloaded,saved);
 await assert.rejects(first.arm(bind()),/G192_UNRESOLVED_ORIGINAL_KEY/);
 await assert.rejects(make().arm({...bind(),requestKey:recipientKey}),
  /G192_UNRESOLVED_ORIGINAL_KEY/);
 assert.equal(writes(),1);
});
test('G192 real Keystore write failure or failed readback never returns success',async()=>{
 const missing=store({writeSecure:async()=>{throw Error('locked Keystore')}});
 await assert.rejects(missing.make().arm(confirm()),/locked Keystore/);
 const nonPersistent=store({writeSecure:async()=>{}});
 await assert.rejects(nonPersistent.make().arm(confirm()),
  /G192_DURABLE_WRITE_NOT_VERIFIED/);
});
test('G192 independent sender and recipient recover after new app instance or logout',async()=>{
 const {make}=store();
 const a=make();await a.arm(bind());await a.arm(confirm());
 const b=make();
 assert.equal((await b.read(sender,'bind')).requestKey,key);
 assert.equal((await b.read(recipient,'confirm')).requestKey,recipientKey);
 assert.equal(await b.read(sender,'confirm'),null);
 assert.equal(await b.read(recipient,'bind'),null);
 assert.equal(await b.read(other,'confirm'),null);
});
test('G192 cannot clear lost ACK without original matching independent GET',async()=>{
 const {make}=store();const j=make();await j.arm(confirm());
 const args={subject:recipient,kind:'confirm',deliveryId:original,
  requestKey:recipientKey};
 for(const proof of [
  null,{...recipientProof(),confirmationId:key},
  {...recipientProof(),recipientConfirmed:false},
  {...recipientProof(),paymentAuthorized:true},
  {...recipientProof(),deliveryId:other},
  {...recipientProof(),productionEnabled:true}
 ]){
  await assert.rejects(j.clearVerified({...args,verifiedServerReceipt:proof}),
   /G192_VERIFIED_SERVER_GET_REQUIRED/);
 }
 await assert.rejects(j.clearVerified({...args,requestKey:key,
  verifiedServerReceipt:recipientProof()}),/G192_VERIFIED_SERVER_GET_REQUIRED|G192_PENDING_KEY_MISMATCH/);
 assert.equal((await j.read(recipient,'confirm')).requestKey,recipientKey);
 assert.equal(await j.clearVerified({...args,verifiedServerReceipt:recipientProof()}),true);
 assert.equal(await j.read(recipient,'confirm'),null);
});
test('G192 sender release needs independently verified original delivery read',async()=>{
 const {make}=store();const j=make();await j.arm(bind());
 const args={subject:sender,kind:'bind',deliveryId:original,requestKey:key};
 await assert.rejects(j.clearVerified({...args,verifiedServerReceipt:{
  ...senderProof(),ownerId:recipient}}),/G192_VERIFIED_SERVER_GET_REQUIRED/);
 await assert.rejects(j.clearVerified({...args,verifiedServerReceipt:{
  ...senderProof(),recipientBound:false}}),/G192_VERIFIED_SERVER_GET_REQUIRED/);
 await assert.rejects(j.clearVerified({...args,verifiedServerReceipt:{
  ...senderProof(),bindingKey:recipientKey}}),/G192_VERIFIED_SERVER_GET_REQUIRED/);
 assert.equal(await j.clearVerified({...args,verifiedServerReceipt:senderProof()}),true);
 assert.equal(await j.read(sender,'bind'),null);
});
test('G192 rejects corrupt persisted entry, wrong role, and scope without deleting it',async()=>{
 const {make,cells}=store();const j=make();
 await j.arm(confirm());
 const name=[...cells.keys()][0];cells.set(name,'{broken');
 await assert.rejects(j.read(recipient,'confirm'),/INVALID_G192_SECURE_JOURNAL/);
 assert.equal(cells.has(name),true);
 await assert.rejects(j.arm({...confirm(),recipientId:sender}),/INVALID_G192_SECURE_JOURNAL/);
 await assert.rejects(j.read('not-an-id','confirm'),/INVALID_G192_SCOPE/);
});
test('G192 serialized concurrent writes: one original key survives across races',async()=>{
 const {make,writes}=store();const j=make();
 const [a,b]=await Promise.allSettled([j.arm(bind()),j.arm({...bind(),requestKey:recipientKey})]);
 assert.equal(a.status,'fulfilled');
 assert.equal(b.status,'rejected');assert.equal(writes(),1);
 assert.equal((await j.read(sender,'bind')).requestKey,key);
});

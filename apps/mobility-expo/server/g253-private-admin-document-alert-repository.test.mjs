import test from 'node:test';
import assert from 'node:assert/strict';
import {G253_LIVE_ENABLED,createG253PrivateAdminAlertsRepository}
 from './g253-private-admin-document-alert-repository.mjs';
const id=n=>'25300000-0000-4253-8253-'+String(n).padStart(12,'0');
const actor=id(1),driver=id(2);
const at=Date.parse('2026-10-31T14:00:00Z');
const rows={items:[{driverId:driver,kind:'seguro',band:'D07',
 validUntilMs:at+5*86400000}],hasMore:false,persistedAtMs:at};
const create=(extra={})=>createG253PrivateAdminAlertsRepository({
 environment:'isolated_staging',qaOnly:true,liveEnabled:false,
 client:{rpc:async()=>({data:rows,error:null})},...extra
});
test('G253 reads only independently scoped Admin source from owner RPC',async()=>{
 assert.equal(G253_LIVE_ENABLED,false);
 const calls=[];
 const db=create({client:{rpc:async(name,params)=>{
  calls.push({name,params});return {data:rows,error:null};
 }}});
 const result=await db.readDocumentAlerts({actorId:actor,limit:50});
 assert.deepEqual(result,rows);
 assert.deepEqual(calls,[{name:'mobility_stage_g253_admin_document_alert_page_owner',
  params:{_admin:actor}}]);
 assert.equal(JSON.stringify(result).includes('objectKey'),false);
});
test('G253 refuses unknown role, malformed scope and unbounded paging',async()=>{
 const db=create();
 for(const args of [{actorId:'bad',limit:50},
  {actorId:actor,limit:100},{actorId:actor,limit:0},
  {actorId:actor},{limit:50}]){
  await assert.rejects(db.readDocumentAlerts(args),/G253_ADMIN_SCOPE_REQUIRED/);
 }
});
test('G253 never trusts PII or forged database response',async()=>{
 for(const bad of [
  {...rows,items:[{...rows.items[0],privatePhone:'secret'}]},
  {...rows,items:[{...rows.items[0],kind:'unknown'}]},
  {...rows,items:[...rows.items,rows.items[0]]},
  {...rows,hasMore:true},
  {...rows,adminDispatchEnabled:true},
  {...rows,items:[{...rows.items[0],driverId:'wrong'}]},
  {...rows,persistedAtMs:-1},
  {...rows,items:[{...rows.items[0],validUntilMs:0}]}
 ]){
  await assert.rejects(create({
   client:{rpc:async()=>({data:bad,error:null})}
  }).readDocumentAlerts({actorId:actor,limit:50}),/G253_PRIVATE_SQL_UNTRUSTED/);
 }
});
test('G253 does not treat SQL errors as empty report',async()=>{
 await assert.rejects(create({
  client:{rpc:async()=>{throw Error('secret')}}}
 ).readDocumentAlerts({actorId:actor,limit:50}),/G253_PRIVATE_SQL_UNAVAILABLE/);
 await assert.rejects(create({
  client:{rpc:async()=>({data:null,error:{message:'denied'}})}
 }).readDocumentAlerts({actorId:actor,limit:50}),/G253_PRIVATE_SQL_UNAVAILABLE/);
});
test('G253 server-only disabled for production, anon and client without RPC',()=>{
 for(const opts of [{environment:'production'},{qaOnly:false},
  {liveEnabled:true},{client:null},{client:{from(){}}}]){
  assert.throws(()=>create(opts),/G253_OWNER_SQL_ONLY/);
 }
});

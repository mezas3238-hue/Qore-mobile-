import test from 'node:test';
import assert from 'node:assert/strict';
import {createG58DelegatedChatSqlQa} from './g58-delegated-chat-sql-qa.mjs';
const uuid=n=>'58580100-0000-4858-8858-'+String(n).padStart(12,'0');
const ticket=uuid(101),marker=uuid(501),beforeId=uuid(201);
const drv='mobility_g56_driver_gateway_ci',pax='mobility_g49_chat_gateway_ci';
function fx(extra={}){
 const calls=[];
 let role=null;
 const conn={
  async query(sql,args){
   calls.push({sql,args});
   if(sql.startsWith('SET LOCAL ROLE ')){
    role=sql.slice('SET LOCAL ROLE '.length);return {rows:[]};
   }
   if(sql.includes('AS effective_role'))return {rows:[{
    effective_role:role,database:'qore_disposable_chain',
    application_name:'qore_ci_disposable_chain'
   }]};
   if(sql.startsWith('SELECT public.'))
    return {rows:[{data:{readConfirmed:true,qaOnly:true}}]};
   return {rows:[]};
  },
  async release(){calls.push({sql:'RELEASE'});}
 };
 const cfg={environment:'isolated_staging',localQaOnly:true,liveEnabled:false,
  openConnection:async()=>conn,...extra};
 return {api:createG58DelegatedChatSqlQa(cfg),calls,conn};
}
test('G58 only executes allowlisted G57A/B functions inside scoped SQL transaction',async()=>{
 const cases=[
  [{operation:'DRIVER_INBOX',ticket,expectedRevision:null,beforeMs:null,
    beforeId:null,limit:50},drv,
   'SELECT public.mobility_stage_g56_driver_inbox_qa($1,$2,$3,$4,$5) AS data'],
  [{operation:'DRIVER_HISTORY_ORDERED_MARKERS',ticket,
    expectedRevision:3,beforeSeq:8,limit:5},drv,
   'SELECT public.mobility_stage_g57b_driver_history_markers_qa($1,$2,$3,$4) AS data'],
  [{operation:'DRIVER_MARK_VISIBLE_ORDERED',ticket,marker},drv,
   'SELECT public.mobility_stage_g57b_driver_mark_visible_qa($1,$2) AS data'],
  [{operation:'CHAT_HISTORY_ORDERED_MARKERS',ticket,
    expectedRevision:null,beforeSeq:null,limit:100},pax,
   'SELECT public.mobility_stage_g57_history_markers_qa($1,$2,$3,$4) AS data'],
  [{operation:'CHAT_MARK_VISIBLE_ORDERED',ticket,marker},pax,
   'SELECT public.mobility_stage_g57_mark_visible_ordered_qa($1,$2) AS data']
 ];
 for(const [command,role,sql] of cases){
  const f=fx();
  assert.deepEqual(await f.api.executeScopedTicket(command),
   {data:{readConfirmed:true,qaOnly:true}});
  assert.deepEqual(f.calls.map(x=>x.sql),[
   'BEGIN','SET LOCAL ROLE '+role,
   "SELECT current_user AS effective_role, current_database() AS database, current_setting('application_name') AS application_name",
   sql,'COMMIT','RELEASE']);
  assert.deepEqual(f.calls[3].args,command.operation==='DRIVER_INBOX'?
   [ticket,null,null,null,50]:command.operation.endsWith('MARK_VISIBLE_ORDERED')?
   [ticket,marker]:[ticket,command.expectedRevision,command.beforeSeq,command.limit]);
 }
});
test('G58 invalid operation, SQL injection in IDs and forged actor fields never obtain connection',async()=>{
 const f=fx();
 for(const command of [
  {operation:'OWNER_MINT',ticket},
  {operation:'DRIVER_OPEN',ticket},
  {operation:'DRIVER_MARK_VISIBLE_ORDERED',ticket,marker,actorId:uuid(7)},
  {operation:'DRIVER_MARK_VISIBLE_ORDERED',ticket,marker,sql:'DROP TABLE auth.users'},
  {operation:'DRIVER_MARK_VISIBLE_ORDERED',ticket,marker:'1);DELETE FROM auth.users;--'},
  {operation:'DRIVER_INBOX',ticket,expectedRevision:null,beforeMs:2,
   beforeId:null,limit:20},
  {operation:'DRIVER_INBOX',ticket,expectedRevision:10,beforeMs:3,
   beforeId:uuid(10),limit:101},
  {operation:'CHAT_HISTORY_ORDERED_MARKERS',ticket,
   expectedRevision:null,beforeSeq:999,limit:2},
  {operation:'CHAT_HISTORY_ORDERED_MARKERS',ticket,
   expectedRevision:3,beforeSeq:null,limit:2},
  {operation:'CHAT_HISTORY_ORDERED_MARKERS',ticket,
   expectedRevision:null,beforeSeq:null,limit:0}
 ]){
  assert.deepEqual(await f.api.executeScopedTicket(command),{error:{code:'G5802'}});
 }
 assert.equal(f.calls.length,0);
});
test('G58 rejects mismatched SQL role/database, unwinds transaction and masks secret errors',async()=>{
 for(const response of [
  {effective_role:pax,database:'qore_disposable_chain',
   application_name:'qore_ci_disposable_chain'},
  {effective_role:drv,database:'production',
   application_name:'qore_ci_disposable_chain'},
  {effective_role:drv,database:'qore_disposable_chain',
   application_name:'untrusted'}
 ]){
  const calls=[];
  const api=createG58DelegatedChatSqlQa({...fx().api,
   environment:'isolated_staging',localQaOnly:true,liveEnabled:false,
   openConnection:async()=>({
    async query(sql){calls.push(sql);
     return sql.includes('AS effective_role')?{rows:[response]}:{rows:[]};},
    async release(){calls.push('RELEASE')}
   })
  });
  const result=await api.executeScopedTicket({
   operation:'DRIVER_MARK_VISIBLE_ORDERED',ticket,marker});
  assert.deepEqual(result,{error:{code:'G5803'}});
  assert.ok(calls.includes('ROLLBACK'));
  assert.ok(!calls.includes('COMMIT'));
  assert.equal(calls.at(-1),'RELEASE');
 }
 const f=fx({openConnection:async()=>({
  async query(sql){if(sql.startsWith('SELECT public.')){
   const e=Error('postgres password=supersecret');e.code='XX000';throw e;
  }
   if(sql.includes('AS effective_role'))return {rows:[{
    effective_role:drv,database:'qore_disposable_chain',
    application_name:'qore_ci_disposable_chain'
   }]};
   return {rows:[]};
  },async release(){}
 })});
 assert.deepEqual(await f.api.executeScopedTicket({
  operation:'DRIVER_MARK_VISIBLE_ORDERED',ticket,marker}),{error:{code:'G5803'}});
});
test('G58 known SQL-state conflicts are private and still trigger ROLLBACK',async()=>{
 const calls=[];
 const api=createG58DelegatedChatSqlQa({
  environment:'isolated_staging',localQaOnly:true,liveEnabled:false,
  openConnection:async()=>({
   async query(sql){calls.push(sql);
    if(sql.includes('AS effective_role'))return {rows:[{
     effective_role:pax,database:'qore_disposable_chain',
     application_name:'qore_ci_disposable_chain'
    }]};
    if(sql.startsWith('SELECT public.')){
     const error=Error('private marker');error.code='G5708';throw error;
    }
    return {rows:[]};
   },
   async release(){calls.push('RELEASE')}
  })
 });
 assert.deepEqual(await api.executeScopedTicket({
  operation:'CHAT_MARK_VISIBLE_ORDERED',ticket,marker}),{error:{code:'G5708'}});
 assert.ok(calls.includes('ROLLBACK'));
 assert.ok(!calls.includes('COMMIT'));
});
test('G58 cannot enable LIVE or invent a SQL session factory',()=>{
 for(const changed of [
  {environment:'production'},{localQaOnly:false},{liveEnabled:true},
  {openConnection:null}
 ]){
  assert.throws(()=>createG58DelegatedChatSqlQa({
   environment:'isolated_staging',localQaOnly:true,liveEnabled:false,
   openConnection:async()=>{},...changed}));
 }
});

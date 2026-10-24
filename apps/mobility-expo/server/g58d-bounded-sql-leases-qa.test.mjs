import test from 'node:test';
import assert from 'node:assert/strict';
import {createG58DBoundedSqlLeasesQa} from './g58d-bounded-sql-leases-qa.mjs';
import {createG58DelegatedChatSqlQa} from './g58-delegated-chat-sql-qa.mjs';
const QA={environment:'isolated_staging',localQaOnly:true,liveEnabled:false};
const uuid='58584000-0000-4858-8858-000000000001';
const cmd={operation:'CHAT_OPEN',ticket:uuid};
const hold=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
test('G58D allows only bounded leases and requires release before another actor can query',async()=>{
 const calls=[];
 const gate=createG58DBoundedSqlLeasesQa({...QA,maxActive:2,
  openConnection:async()=>({
   async query(sql){return {rows:[],sql};},
   release(force){calls.push(force);}
  })
 });
 const first=await gate.openConnection(),second=await gate.openConnection();
 await assert.rejects(()=>gate.openConnection(),/CAPACITY_EXHAUSTED/);
 assert.equal((await first.query('SELECT 1')).sql,'SELECT 1');
 await first.release();
 const third=await gate.openConnection();
 await first.release();
 await second.release();
 await third.release();
 assert.deepEqual(calls,[false,false,false]);
 await assert.rejects(()=>first.query('SELECT 1'),/POISONED_SQL_CONNECTION/);
});
test('G58D query timeout poisons the client; rollback cannot revive it; release destroys',async()=>{
 const h=hold(),discard=[];
 const gate=createG58DBoundedSqlLeasesQa({...QA,queryTimeoutMs:20,
  openConnection:async()=>({
   query:()=>h.promise,
   release:force=>{discard.push(force);}
  })
 });
 const conn=await gate.openConnection();
 await assert.rejects(()=>conn.query('SELECT pg_sleep(10)'),/G58D_SQL_DEADLINE/);
 await assert.rejects(()=>conn.query('COMMIT'),/POISONED_SQL_CONNECTION/);
 await conn.release();
 assert.deepEqual(discard,[true]);
 h.resolve({rows:[]});
 const next=await gate.openConnection();
 await next.release();
});
test('G58D late connection arrival after acquisition timeout is safely discarded',async()=>{
 const h=hold(),releases=[];
 const gate=createG58DBoundedSqlLeasesQa({...QA,maxActive:1,
  acquireTimeoutMs:15,openConnection:async()=>h.promise});
 await assert.rejects(()=>gate.openConnection(),/G58D_SQL_DEADLINE/);
 h.resolve({query:async()=>({rows:[]}),release:force=>{releases.push(force);}});
 await sleep(5);
 assert.deepEqual(releases,[true]);
 const reused=await gate.openConnection();
 assert.ok(reused);
 await reused.release();
 assert.deepEqual(releases,[true,false]);
});
test('G58D malformed/throwing query poisons and force-discards; released lease idempotent',async()=>{
 let discard=0;
 const gate=createG58DBoundedSqlLeasesQa({...QA,openConnection:async()=>({
  query:()=>{throw Error('private database password must not be logged');},
  release:force=>{if(force)discard++;}
 })});
 const c=await gate.openConnection();
 await assert.rejects(()=>c.query('SELECT public.safe_rpc($1)',[uuid]));
 await c.release();
 await c.release();
 assert.equal(discard,1);
 const n=await gate.openConnection();
 await assert.rejects(()=>n.query('DROP TABLE injected /* never executed */',{}),/INVALID_QUERY_SHAPE/);
 await n.release();
 assert.equal(discard,2);
});
test('G58D delegated executor never COMMITs or retries when a SQL request hangs',async()=>{
 const h=hold(),events=[];
 const gate=createG58DBoundedSqlLeasesQa({...QA,queryTimeoutMs:20,
  openConnection:async()=>({
   async query(sql){
    events.push(sql);
    if(sql.startsWith('SELECT public.'))return h.promise;
    if(sql.includes('AS effective_role'))return {rows:[{
     effective_role:'mobility_g49_chat_gateway_ci',
     database:'qore_disposable_chain',
     application_name:'qore_ci_disposable_chain'}]};
    return {rows:[]};
   },
   release:force=>events.push('RELEASE/'+force)
  })
 });
 const executor=createG58DelegatedChatSqlQa({...QA,
  openConnection:gate.openConnection});
 const r=await executor.executeScopedTicket(cmd);
 assert.deepEqual(r,{error:{code:'G5803'}});
 assert.equal(events.includes('COMMIT'),false);
 assert.equal(events.includes('ROLLBACK'),false,
  'a poisoned leased connection must never be reused for ROLLBACK');
 assert.equal(events.at(-1),'RELEASE/true');
 h.resolve({rows:[{data:{serverStored:true}}]});
});
test('G58D refuses mode LIVE, unlimited resources and missing connection factory',()=>{
 for(const bad of [{environment:'production'},{localQaOnly:false},
  {liveEnabled:true},{openConnection:null},{maxActive:0},{maxActive:17},
  {acquireTimeoutMs:1},{acquireTimeoutMs:10001},
  {queryTimeoutMs:1},{queryTimeoutMs:10001}]){
  assert.throws(()=>createG58DBoundedSqlLeasesQa({
   ...QA,openConnection:async()=>{},...bad
  }));
 }
});

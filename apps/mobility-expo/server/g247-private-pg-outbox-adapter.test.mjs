import test from 'node:test';
import assert from 'node:assert/strict';
import {createG247PrivatePgOutboxAdapter,sweepG247Bounded,
 G247_OUTBOX_LIVE_ENABLED} from './g247-private-pg-outbox-adapter.mjs';
const id=n=>'24700000-0000-4247-8247-'+String(n).padStart(12,'0');
const receipt=(processed,inserted,nextCursor=null)=>({
 mode:'STAGING_DEMO_ONLY',processed,inserted,
 duplicate:processed-inserted,nextCursor,qaOnly:true,
 productionEnabled:false,driverDispatchAuthorized:false
});
const create=(respond)=>createG247PrivatePgOutboxAdapter({
 environment:'isolated_staging',qaOnly:true,liveEnabled:false,
 client:{rpc:respond}
});
test('G247 SQL adapter is private and uses owner RPC only',async()=>{
 assert.equal(G247_OUTBOX_LIVE_ENABLED,false);
 const queries=[];
 const adapter=create(async(name,params)=>{
  queries.push({name,params});
  return {data:receipt(3,2),error:null};
 });
 assert.equal((await adapter.sweepPage({limit:3})).duplicate,1);
 assert.deepEqual(queries,[{name:'mobility_stage_g247_scan_expiry_owner_qa',
  params:{_after_document:null,_limit:3}}]);
});
test('G247 bounded sweep follows deterministic SQL keyset and returns checkpoints',async()=>{
 const called=[];
 const adapter=create(async(name,params)=>{
  called.push(params._after_document);
  return {data:params._after_document===null?receipt(2,2,id(1)):
   params._after_document===id(1)?receipt(2,1,id(2)):
   receipt(1,0)};
 });
 const first=await sweepG247Bounded({adapter,limit:2,maxPages:2});
 assert.deepEqual(first,{complete:false,resumeCursor:id(2),
  processed:4,inserted:3,duplicate:1,qaOnly:true,productionEnabled:false});
 const next=await sweepG247Bounded({
  adapter,afterDocument:first.resumeCursor,limit:2,maxPages:2
 });
 assert.deepEqual(next,{complete:true,resumeCursor:null,
  processed:1,inserted:0,duplicate:1,qaOnly:true,productionEnabled:false});
 assert.deepEqual(called,[null,id(1),id(2)]);
});
test('G247 rejects wrong SQL mode, forged counters and invalid cursor',async()=>{
 const invalid=[
  {...receipt(2,1),productionEnabled:true},
  {...receipt(2,1),secret:'sensitive'},
  {...receipt(2,1),inserted:3},
  {...receipt(2,1),driverDispatchAuthorized:true},
  {...receipt(1,1),nextCursor:id(3)},
  {...receipt(2,1),nextCursor:'../../admin'},
  {...receipt(2,1),nextCursor:id(1)}
 ];
 for(const x of invalid){
  const adapter=create(async()=>({data:x,error:null}));
  await assert.rejects(adapter.sweepPage({afterDocument:id(1),limit:2}),
   /G247_UNTRUSTED_SQL_RECEIPT/);
 }
});
test('G247 rejects SQL failures and production client',async()=>{
 await assert.rejects(create(async()=>{throw Error('secrets');}).sweepPage(),
  /G247_SQL_UNAVAILABLE/);
 await assert.rejects(create(async()=>({data:null,error:{code:'P7471'}})).sweepPage(),
  /G247_SQL_UNAVAILABLE/);
 for(const opts of [{environment:'production'},
  {liveEnabled:true},{qaOnly:false},{client:null}]){
  assert.throws(()=>createG247PrivatePgOutboxAdapter({
   client:{rpc:async()=>({data:receipt(0,0)})},
   environment:'isolated_staging',qaOnly:true,liveEnabled:false,...opts
  }),/G247_PRIVATE_OWNER_SQL_REQUIRED/);
 }
});
test('G247 parameters prohibit unbounded scans',async()=>{
 const adapter=create(async()=>({data:receipt(0,0)}));
 await assert.rejects(adapter.sweepPage({limit:100}),
  /G247_INVALID_PAGE/);
 await assert.rejects(adapter.sweepPage({afterDocument:'fake'}),
  /G247_INVALID_PAGE/);
 await assert.rejects(sweepG247Bounded({adapter,maxPages:1000}),
  /G247_BOUNDED_SWEEP_REQUIRED/);
});
test('G247 prevents cyclic pagination and does not return misleading success',async()=>{
 const adapter=create(async()=>({data:receipt(2,2,id(2))}));
 await assert.rejects(sweepG247Bounded({adapter,limit:2,maxPages:3}),
  /G247_UNTRUSTED_SQL_RECEIPT/);
});

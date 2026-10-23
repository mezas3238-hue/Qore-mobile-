import test from 'node:test';
import assert from 'node:assert/strict';
import {createQoreBackofficeSqlReadRepository} from './g28-backoffice-sql-read-repository.mjs';
const admin='11111111-1111-4111-8111-111111111111';
const ms=Date.parse('2026-10-23T10:00:00Z');
const position=String(ms).padStart(13,'0')+admin.replaceAll('-','');
const args={scope:'admin.incidents.read',actorId:admin,anchorMs:ms,after:null,limit:50};
test('G28 SQL reads are backend-only, scoped and use exact keyset RPC arguments',async()=>{
 const calls=[];
 const repo=createQoreBackofficeSqlReadRepository({rpc:async(name,params)=>{
  calls.push({name,params});
  return {data:{revision:0,items:[],hasMore:false},error:null};
 }});
 const page=await repo(args);
 assert.deepEqual(page,{revision:0,items:[],hasMore:false});
 assert.deepEqual(calls,[{name:'mobility_stage_g28_admin_incident_page',
  params:{_actor:admin,_anchor_ms:ms,_after:null,_limit:50}}]);
 await repo({...args,after:position});
 assert.equal(calls[1].params._after,position);
});
test('G28 keeps other scopes fail-closed until real sources are certified',async()=>{
 let called=0;
 const repo=createQoreBackofficeSqlReadRepository({rpc:async()=>{
  called++;return {data:{revision:0,items:[],hasMore:false},error:null};
 }});
 for(const scope of ['admin.zones.read',
  'owner.finance.read','owner.finance.write','unknown']){
  await assert.rejects(()=>repo({...args,scope}),/not yet independently certified/);
 }
 assert.equal(called,0);
});
test('G28 malicious cursor, actor or oversized page fails before DB',async()=>{
 let called=0;
 const repo=createQoreBackofficeSqlReadRepository({rpc:async()=>{called++;return null;}});
 for(const params of [
  {...args,actorId:'invalid'}, {...args,anchorMs:-1},
  {...args,anchorMs:NaN}, {...args,after:'fake'},
  {...args,after:position+'.'}, {...args,limit:100},
  {...args,limit:0}
 ]){
  await assert.rejects(()=>repo(params));
 }
 assert.equal(called,0);
});
test('G28 SQL errors and partial records never masquerade as empty history',async()=>{
 for(const response of [
  null,{data:null,error:null},{error:{code:'42501'}},
  {data:{revision:0,items:[],hasMore:true}},
  {data:{revision:-1,items:[],hasMore:false}},
  {data:{revision:0,items:Array(51).fill({}),hasMore:false}},
  {data:{revision:0,items:[],hasMore:false,secrets:'wrong'}},
 ]){
  const repo=createQoreBackofficeSqlReadRepository({rpc:async()=>response});
  await assert.rejects(()=>repo(args),/SQL unavailable/);
 }
});
test('G28 does not run with an absent or untrusted RPC adapter',()=>{
 assert.throws(()=>createQoreBackofficeSqlReadRepository({rpc:null}),/required/);
});


test('G29 only source-backed Admin KYC reads can reach private vehicle RPC',async()=>{
 const calls=[];
 const repo=createQoreBackofficeSqlReadRepository({rpc:async(name,params)=>{
  calls.push({name,params});
  return {data:{revision:1,items:[],hasMore:false},error:null};
 }});
 const kyc={...args,scope:'admin.kyc.read',after:null};
 assert.deepEqual(await repo(kyc),{revision:1,items:[],hasMore:false});
 await repo({...kyc,after:admin.replaceAll('-','')});
 assert.equal(calls.length,2);
 assert.deepEqual(calls[0],{name:'mobility_stage_g29_admin_kyc_page',
  params:{_actor:admin,_anchor_ms:ms,_after:null,_limit:50}});
 for(const after of ['f'.repeat(31),'a'.repeat(33),position,'bad']){
  await assert.rejects(()=>repo({...kyc,after}),/Malformed/);
 }
 assert.equal(calls.length,2);
});


test('G30 private audit scope uses the real append-only sources and timestamp keyset',async()=>{
 const calls=[];
 const repo=createQoreBackofficeSqlReadRepository({rpc:async(name,params)=>{
  calls.push({name,params});
  return {data:{revision:2,items:[],hasMore:false},error:null};
 }});
 const audit={...args,scope:'admin.audit.read'};
 assert.deepEqual(await repo(audit),{revision:2,items:[],hasMore:false});
 await repo({...audit,after:position});
 assert.equal(calls.length,2);
 assert.deepEqual(calls[0],{name:'mobility_stage_g30_admin_audit_page',
  params:{_actor:admin,_anchor_ms:ms,_after:null,_limit:50}});
 for(const after of ['bad',admin.replaceAll('-',''),position+'00']){
  await assert.rejects(()=>repo({...audit,after}),/Malformed/);
 }
 assert.equal(calls.length,2);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createMerchantCaseQueryFlow} from './merchant-case-query-flow.mjs';

const T=1800000000000;
const id=n=>'123e4567-e89b-42d3-a456-'+String(n).padStart(12,'0');
const actor={role:'admin',subject:id(99),mfaVerified:true,authRevision:4};
const row=n=>({caseId:id(n),subjectKind:'MERCHANT_ORDER',
 reason:'LATE_DELIVERY',severity:'MEDIUM',state:'RECEIVED_QA',
 createdAt:T-2000,updatedAt:T-1000,revision:2});
const dto=(options={})=>({scope:'ADMIN_MERCHANT_CASES_QA_PAGE',
 qaOnly:true,generatedAt:T-500,expiresAt:T+10000,revision:8,
 hasGlobalTotal:false,notificationsEnabled:false,operationsEnabled:false,
 nextCursor:null,items:[row(1)],...options});
const C='a'.repeat(44),D='b'.repeat(44);
const deferred=()=>{let resolve,reject;
 const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
 return {promise,resolve,reject};
};
function setup(readPage=async()=>dto()){
 let active={...actor},certified=true,time=T;
 const flow=createMerchantCaseQueryFlow({
  readPage,getActor:()=>active,isCertified:()=>certified,now:()=>time
 });
 return {flow,setActor:x=>{active=x;},setCertified:x=>{certified=x;},
  setTime:x=>{time=x;}};
}
test('R44 defaults fail closed without an admin or certified transport',async()=>{
 const empty=createMerchantCaseQueryFlow();
 assert.equal((await empty.load()).code,'ADMIN_AUTH_REQUIRED');
 assert.equal(empty.snapshot(),null);
 const missing=createMerchantCaseQueryFlow({getActor:()=>actor,isCertified:()=>true,now:()=>T});
 assert.equal((await missing.load()).code,'MERCHANT_CASE_API_NOT_CERTIFIED');
 assert.equal(missing.snapshot(),null);
});
test('R44 refresh projects QA metadata; no action or global total',async()=>{
 const {flow}=setup(async()=>dto({nextCursor:C}));
 assert.deepEqual(await flow.load(),{ok:true,pageNumber:1});
 const snap=flow.snapshot();
 assert.equal(snap.page.items.length,1);
 assert.equal(snap.pageNumber,1);
 assert.equal(snap.hasNext,true);
 assert.equal(snap.totalKnown,false);
 assert.equal(snap.page.operationsEnabled,false);
 for(const action of ['assign','notify','send','resolve','refund'])
  assert.equal(action in flow,false);
});
test('R44 next and previous use only previously verified page cursors',async()=>{
 const requests=[];
 const {flow}=setup(async({cursor})=>{
  requests.push(cursor);
  return cursor===null?dto({nextCursor:C}):
   dto({items:[row(2)],nextCursor:null});
 });
 assert.equal((await flow.load('next')).code,'NO_VALID_MERCHANT_CASE_PAGE');
 assert.equal((await flow.load('refresh')).ok,true);
 assert.equal((await flow.load('previous')).code,'NO_PREVIOUS_PAGE');
 assert.equal((await flow.load('next')).ok,true);
 assert.equal(flow.snapshot().pageNumber,2);
 assert.equal(flow.snapshot().hasPrevious,true);
 assert.equal((await flow.load('next')).code,'NO_ADDITIONAL_PAGE');
 assert.equal((await flow.load('previous')).ok,true);
 assert.deepEqual(requests,[null,C,null]);
});
test('R44 refuses repeated opaque cursors, no infinite page navigation',async()=>{
 const {flow}=setup(async()=>dto({nextCursor:C}));
 assert.equal((await flow.load()).ok,true);
 assert.equal((await flow.load('next')).code,'REPEATED_MERCHANT_CASE_CURSOR');
 assert.equal(flow.snapshot(),null);
});
test('R44 clear during await discards the old response',async()=>{
 const work=deferred();
 const {flow}=setup(()=>work.promise);
 const pending=flow.load();
 assert.equal(flow.snapshot(),null);
 flow.clear();
 work.resolve(dto());
 assert.equal((await pending).code,'STALE_QUERY_RESPONSE');
 assert.equal(flow.snapshot(),null);
});
test('R44 changing account or JWT during await never returns prior cases',async()=>{
 for(const changed of [{...actor,subject:id(123)},{...actor,authRevision:5},
  {...actor,role:'owner'},{...actor,mfaVerified:false},null]){
  const work=deferred();
  const control=setup(()=>work.promise);
  const pending=control.flow.load();
  control.setActor(changed);
  work.resolve(dto());
  assert.equal((await pending).ok,false);
  assert.equal(control.flow.snapshot(),null);
 }
});
test('R44 loses backend certification during request and purges data',async()=>{
 const work=deferred();
 const control=setup(()=>work.promise);
 const pending=control.flow.load();
 control.setCertified(false);work.resolve(dto());
 assert.equal((await pending).ok,false);
 assert.equal(control.flow.snapshot(),null);
});
test('R44 cannot race parallel requests into one visible snapshot',async()=>{
 const work=deferred();
 const {flow}=setup(()=>work.promise);
 const pending=flow.load();
 assert.equal((await flow.load()).code,'MERCHANT_CASE_READ_IN_FLIGHT');
 work.resolve(dto());
 assert.equal((await pending).ok,true);
});
test('R44 PII fields or invalid MerchantOrder scope reject full page',async()=>{
 for(const bad of [dto({phone:'0981'}),dto({items:[{...row(1),subjectKind:'RIDE'}]}),
  dto({items:[{...row(1),address:'private'}]})]){
  const {flow}=setup(async()=>bad);
  assert.equal((await flow.load()).ok,false);
  assert.equal(flow.snapshot(),null);
 }
});
test('R44 regressive revision across pages rejects and clears prior data',async()=>{
 const {flow}=setup(async({cursor})=>cursor===null?
  dto({revision:8,nextCursor:C}):dto({revision:7,items:[row(2)]}));
 assert.equal((await flow.load()).ok,true);
 assert.equal((await flow.load('next')).code,'REGRESSIVE_CASE_REVISION');
 assert.equal(flow.snapshot(),null);
});
test('R44 TTL expiry makes page and its pagination cursor inaccessible',async()=>{
 const control=setup(async()=>dto({nextCursor:C}));
 assert.equal((await control.flow.load()).ok,true);
 control.setTime(T+10000);
 assert.equal(control.flow.snapshot(),null);
 assert.equal((await control.flow.load('next')).code,'NO_VALID_MERCHANT_CASE_PAGE');
});
test('R44 network failure clears snapshot; stale rejected promise does not clear new run',async()=>{
 let throwNetwork=false;
 const control=setup(async()=>{if(throwNetwork)throw Error('contains private detail');
  return dto();});
 assert.equal((await control.flow.load()).ok,true);
 throwNetwork=true;
 assert.equal((await control.flow.load()).code,'MERCHANT_CASE_READ_FAILED');
 assert.equal(control.flow.snapshot(),null);
});
test('R44 invalid direction and revoked role cannot expose old snapshot',async()=>{
 const control=setup();
 assert.equal((await control.flow.load()).ok,true);
 assert.equal((await control.flow.load('filter-local')).code,'INVALID_CASE_DIRECTION');
 assert.equal(control.flow.snapshot(),null);
 assert.equal((await control.flow.load()).ok,true);
 control.setActor({...actor,role:'driver'});
 assert.equal(control.flow.snapshot(),null);
});

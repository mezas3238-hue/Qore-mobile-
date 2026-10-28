import test from 'node:test';
import assert from 'node:assert/strict';
import {guardCommerceBranchSelection} from './commerce-branch-selection-guard.mjs';
const T=1800000000000;
const id=n=>'123e4567-e89b-42d3-a456-'+String(n).padStart(12,'0');
const row=(n=1,changes={})=>({branchId:id(n),branchTag:'SUCURSAL_'+n,
 merchantKind:'SUPERMARKET',municipality:'Asunción',serviceKind:'MOTO_DELIVERY',
 eligibleByPolicy:false,orderEnabled:false,...changes});
const view=(patch={},actorPatch={})=>({
 authenticated:true,account:{subject:id(80),role:'passenger'},
 privateViewRevision:7,
 branchDirectory:{readReady:true,loading:false,error:null,
  expiresAt:T+30000,pageNumber:1,municipality:'Asunción',
  serviceKind:'MOTO_DELIVERY',items:[row()],
  hasNext:true,hasPrevious:false,globalTotalKnown:false,
  ordersEnabled:false,paymentsEnabled:false,availabilityVerified:false,
  serverSnapshotConsistent:false,...patch},
 ...actorPatch
});
const input={branchId:id(1),vertical:'SUPERMARKET',
 municipality:'Asunción',serviceKind:'MOTO_DELIVERY',now:T};
const check=(shown=view(),current=shown,options=input)=>
 guardCommerceBranchSelection(shown,current,options);
test('R50 selects only an already certified G44 branch for local catalog lookup',()=>{
 const r=check();
 assert.equal(r.ok,true);assert.equal(r.branchId,id(1));
 assert.equal(r.ordersEnabled,false);assert.equal(r.paymentsEnabled,false);
 assert.equal(r.availabilityVerified,false);
 assert.equal(r.scope,'CURRENT_VERIFIED_BRANCH_PAGE_ONLY');
});
test('R50 refuses account switch, logout, role switch and JWT rotation',()=>{
 const old=view();
 for(const changed of [
  view({}, {authenticated:false}),
  view({}, {account:{subject:id(99),role:'passenger'}}),
  view({}, {account:{subject:id(80),role:'driver'}}),
  view({}, {privateViewRevision:8})
 ])assert.equal(check(old,changed).code,'BRANCH_SESSION_CHANGED');
});
test('R50 expires page at the exact boundary and rejects a renewed different TTL',()=>{
 const old=view();
 assert.equal(check(old,old,{...input,now:T+29999}).ok,true);
 assert.equal(check(old,old,{...input,now:T+30000}).code,'BRANCH_PAGE_EXPIRED');
 assert.equal(check(old,view({expiresAt:T+50000})).code,'BRANCH_PAGE_CHANGED');
});
test('R50 refuses switched municipality or delivery mode from the same rendered row',()=>{
 const old=view();
 assert.equal(check(old,view({municipality:'San Lorenzo'})).code,'BRANCH_PAGE_CHANGED');
 assert.equal(check(old,view({serviceKind:'AUTO_DELIVERY'})).code,'BRANCH_PAGE_CHANGED');
 assert.equal(check(old,old,{...input,municipality:'San Lorenzo'}).code,'BRANCH_PAGE_CHANGED');
});
test('R50 cannot pick a branch outside selected category',()=>{
 assert.equal(check(view(),view(),{...input,vertical:'PHARMACY'}).code,
  'BRANCH_NOT_IN_SELECTED_CATEGORY');
 assert.equal(check(view(),view(),{...input,branchId:id(2)}).code,
  'BRANCH_NOT_IN_SELECTED_CATEGORY');
});
test('R50 rejects any replacement, reorder or modification inside same page',()=>{
 const old=view({items:[row(1),row(2)]});
 for(const changed of [
  [row(2),row(1)],[row(1,{branchTag:'REPLACED'}),row(2)],
  [row(1),row(2,{merchantKind:'RESTAURANT'})],
  [row(1),row(2,{orderEnabled:true})]
 ])assert.equal(check(old,view({items:changed})).code,'BRANCH_PAGE_CHANGED');
});
test('R50 loading, loss of API certification and operational flags fail closed',()=>{
 const old=view();
 for(const patch of [{loading:true},{readReady:false},
  {error:'DENIED'},{ordersEnabled:true},{paymentsEnabled:true},
  {availabilityVerified:true},{serverSnapshotConsistent:true},
  {globalTotalKnown:true}]){
  assert.equal(check(old,view(patch)).code,'BRANCH_DIRECTORY_NOT_CERTIFIED');
 }
});
test('R50 no PII extra or duplicate branch IDs can enter a selected page',()=>{
 const extra=view({items:[row(1,{phone:'0981...'})]});
 assert.equal(check(extra,extra).code,'BRANCH_PAGE_CHANGED');
 const dup=view({items:[row(1),row(1)]});
 assert.equal(check(dup,dup).code,'BRANCH_PAGE_CHANGED');
});
test('R50 invalid IDs, unauthorized page, and broken snapshots never select a branch',()=>{
 for(const broken of [null,{},[],undefined,false]){
  assert.equal(guardCommerceBranchSelection(broken,view(),input).ok,false);
  assert.equal(guardCommerceBranchSelection(view(),broken,input).ok,false);
 }
 for(const brokenId of ['../../token','',id(99)+'junk']){
  assert.equal(check(view(),view(),{...input,branchId:brokenId}).code,
   'INVALID_BRANCH_SELECTION');
 }
});
test('R50 no global record limit: page cap 100, not platform users/branches',()=>{
 const items=Array.from({length:100},(_,n)=>row(n+1));
 const page=view({items});
 assert.equal(check(page,page).ok,true);
 const oversized=view({items:[...items,row(101)]});
 assert.equal(check(oversized,oversized).code,'BRANCH_PAGE_CHANGED');
});

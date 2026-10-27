import test from 'node:test';
import assert from 'node:assert/strict';
import {certifyOwnerCommissionReadback as verify}
 from './owner-commission-readback.mjs';
const policy=(kind='AUTO_RIDE',commissionBps=1500,version=2)=>({
 serviceKind:kind,commissionBps,subsidyBps:1000,version,
 mode:'STAGING_DEMO_ONLY',productionEnabled:false
});
const check=(a={})=>verify({written:policy(),readback:policy(),
 previousVersion:1,service:'AUTO_RIDE',...a});
test('G116 accepts only independent identical POST and GET persistent versions',()=>{
 assert.equal(check().ok,true);
 assert.equal(check({readback:policy('MOTO_RIDE')}).ok,false);
 assert.equal(check({readback:policy('AUTO_RIDE',1200)}).code,
  'G116_POLICY_NOT_PERSISTED');
 assert.equal(check({readback:policy('AUTO_RIDE',1500,3)}).code,
  'G116_POLICY_VERSION_MISMATCH');
});
test('G116 never accepts a fake changed 10% passenger subsidy',()=>{
 assert.equal(check({readback:{...policy(),subsidyBps:800}}).code,
  'G116_INVALID_POLICY');
 assert.equal(check({written:{...policy(),subsidyBps:0}}).ok,false);
});
test('G116 rejects stale revision, invalid mode, disputed effective version',()=>{
 assert.equal(check({previousVersion:2}).code,
  'G116_POLICY_VERSION_MISMATCH');
 assert.equal(check({written:{...policy(),mode:'PRODUCTION'}}).ok,false);
 assert.equal(check({readback:{...policy(),productionEnabled:true}}).ok,false);
 assert.equal(check({service:'COMMERCE'}).ok,false);
});
test('G116 rejects malformed receipts and missing persisted evidence',()=>{
 for(const x of [null,undefined,{},'ok',{...policy(),commissionBps:999},
  {...policy(),commissionBps:3050}]){
  assert.equal(check({readback:x}).ok,false);
 }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createOwnerPolicyScopeFence} from './owner-policy-scope-fence.mjs';
test('Owner cargo AUTO/ASUNCION cannot override selected MOTO',()=>{
 const f=createOwnerPolicyScopeFence(),a=f.select('AUTO','ASUNCION',true);
 const m=f.select('MOTO','ASUNCION',true);
 assert.equal(f.current(a),false);assert.equal(f.current(m),true);
});
test('Changing municipal zone invalidates old GET, even returning to same zone (ABA)',()=>{
 const f=createOwnerPolicyScopeFence(),a=f.select('MOTO','ASUNCION',true);
 f.select('MOTO','LUQUE',true);
 const b=f.select('MOTO','ASUNCION',true);
 assert.equal(f.current(a),false);assert.equal(f.current(b),true);
});
test('Role downgrade makes old Owner POST and subsequent GET readback unusable',()=>{
 const f=createOwnerPolicyScopeFence(),a=f.select('AUTO_RIDE',true);
 f.select('AUTO_RIDE',false);
 assert.equal(f.current(a),false);
});
test('Same selection remains valid; gateway replacement invalidates old request',()=>{
 const f=createOwnerPolicyScopeFence(),first={},second={};
 const token=f.select('AUTO','ASUNCION',true,first);
 assert.equal(token,f.select('AUTO','ASUNCION',true,first));
 assert.equal(f.current(token),true);
 f.select('AUTO','ASUNCION',true,second);
 assert.equal(f.current(token),false);
});
test('Explicit selection change invalidates synchronous event before React render',()=>{
 const f=createOwnerPolicyScopeFence(),token=f.select('AUTO','ASUNCION',true);
 f.invalidate();assert.equal(f.current(token),false);
});

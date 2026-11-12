import test from 'node:test';
import assert from 'node:assert/strict';
import {allowedSupportActions} from './support-action-options.mjs';
const agent='11111111-1111-4111-8111-111111111111';
const foreign='22222222-2222-4222-8222-222222222222';
test('G314 no Support action appears while backend OFF',()=>{
 const x={status:'OPEN',assigned_support_id:agent};
 assert.deepEqual(allowedSupportActions(x,agent),[]);
 assert.deepEqual(allowedSupportActions(x,agent,false),[]);
});
test('G314 unassigned and other-agent ticket actions stay hidden',()=>{
 assert.deepEqual(allowedSupportActions({status:'OPEN',assigned_support_id:null},agent,true),[]);
 assert.deepEqual(allowedSupportActions({status:'OPEN',assigned_support_id:foreign},agent,true),[]);
});
test('G314 only allowed state transitions appear and no payouts/KYC',()=>{
 const opening=allowedSupportActions({status:'OPEN',assigned_support_id:agent},agent,true);
 assert.deepEqual(opening.map(x=>x.action),['ACKNOWLEDGE','ESCALATE_SAFETY','ESCALATE_FINANCE']);
 const waiting=allowedSupportActions({status:'WAITING_CUSTOMER',assigned_support_id:agent},agent,true);
 assert.deepEqual(waiting.map(x=>x.action),['RESOLVE_INFORMATIONAL']);
 assert.deepEqual(allowedSupportActions({status:'RESOLVED',assigned_support_id:agent},agent,true),[]);
 assert.deepEqual(allowedSupportActions({status:'ESCALATED',assigned_support_id:agent},agent,true),[]);
 const progress=allowedSupportActions({status:'IN_PROGRESS',assigned_support_id:agent},agent,true);
 assert(progress.some(x=>x.action==='REQUEST_INFORMATION'));
 assert(progress.every(x=>!['PAYOUT','APPROVE_KYC'].includes(x.action)));
 assert.equal(Object.isFrozen(progress),true);
});

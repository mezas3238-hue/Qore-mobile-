import test from 'node:test';
import assert from 'node:assert/strict';
import {AUDIT_LIVE_ENABLED,createSyntheticAuditEvent,verifySyntheticAuditSequence} from './staging-operations-audit.mjs';
const id='00000000-0000-4000-8000-000000000001';
const event=(sequence,extra={})=>createSyntheticAuditEvent({event:'REQUEST_CREATED',entityId:id,actorId:id,occurredAtMs:1000,sequence,...extra});
test('staging audit event is minimal and cannot be live',()=>{const r=event(1,{name:'private',gps:{lat:1},token:'secret'});assert.equal(AUDIT_LIVE_ENABLED,false);assert.equal(r.ok,true);assert.equal(JSON.stringify(r).includes('private'),false);assert.equal(JSON.stringify(r).includes('secret'),false);assert.equal(JSON.stringify(r).includes('gps'),false);});
test('sequence must be gap-free and ordered',()=>{assert.equal(verifySyntheticAuditSequence([event(1).record,event(2).record]),true);assert.equal(verifySyntheticAuditSequence([event(1).record,event(3).record]),false);assert.equal(verifySyntheticAuditSequence([event(2).record]),false);});
test('reject malformed events',()=>{assert.equal(event(0).ok,false);assert.equal(event(1,{event:'LIVE_PAYMENT'}).ok,false);assert.equal(event(1,{actorId:'bad'}).ok,false);assert.equal(event(1,{occurredAtMs:NaN}).ok,false);});

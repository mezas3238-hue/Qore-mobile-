import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuthenticatedStagingDispatchPersistence} from './dispatch-persistence-contract.mjs';
const a='00000000-0000-4000-8000-000000000001';
const b='00000000-0000-4000-8000-000000000002';
const args={mode:'SYNTHETIC_STAGING',liveEnabled:false,actorId:a,tripId:a,offerId:a,decisionKey:a};
test('server identity overrides client identity',async()=>{
 let actual=null;
 const repo=Object.fromEntries(['request','offer','accept','transition','snapshot'].map(k=>[k,async p=>{actual=p.actorId;return {ok:true,liveEnabled:false};}]));
 const api=createAuthenticatedStagingDispatchPersistence(repo,async()=>b);
 assert.equal((await api.accept(args,{})).ok,true);
 assert.equal(actual,b);
});
test('unverified sessions cannot call repository',async()=>{
 let calls=0;
 const repo=Object.fromEntries(['request','offer','accept','transition','snapshot'].map(k=>[k,async()=>{calls++;return {ok:true,liveEnabled:false};}]));
 const api=createAuthenticatedStagingDispatchPersistence(repo,async()=>null);
 assert.equal((await api.accept(args,{})).ok,false);
 assert.equal(calls,0);
});

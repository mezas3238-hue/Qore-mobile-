import test from 'node:test';
import assert from 'node:assert/strict';
import {createSupabaseStagingSafetyRepository,SUPABASE_SAFETY_LIVE_ENABLED}
 from './g8-supabase-safety-repository.mjs';
const actor='11111111-1111-4111-8111-111111111111';
const admin='22222222-2222-4222-8222-222222222222';
const subject='33333333-3333-4333-8333-333333333333';
const key='44444444-4444-4444-8444-444444444444';
const incident='55555555-5555-4555-8555-555555555555';
const suspension='66666666-6666-4666-8666-666666666666';
const event='77777777-7777-4777-8777-777777777777';
const base=id=>({mode:'SYNTHETIC_STAGING',liveEnabled:false,actorId:id});
function fixture(){
 const state={calls:[],row:{id:incident,reporter_id:actor,subject_kind:'DELIVERY',
  subject_id:subject,category:'SOS',severity:'CRITICAL',status:'open',revision:1,
  created_at:'2026-10-22T12:00:00Z',changed_at:'2026-10-22T12:00:00Z'}};
 const client={async rpc(name,params){state.calls.push({name,params});return {data:
  name==='mobility_stage_safety_report'?incident:
   name==='mobility_stage_suspension_apply'?suspension:event,error:null};},
  from(){const filter={};const chain={select(){return chain;},
   eq(k,v){filter[k]=v;return chain;},async maybeSingle(){return {data:
    filter.id===incident&&filter.reporter_id===actor?{...state.row}:null,error:null};}};
   return chain;}};
 return {client,state};
}
test('safety repository is server-only and permanently non-live',()=>{
 assert.equal(SUPABASE_SAFETY_LIVE_ENABLED,false);
 assert.throws(()=>createSupabaseStagingSafetyRepository({}),/server-only/i);
});
test('report binds verified reporter and rejects malformed SOS',async()=>{
 const f=fixture(),repo=createSupabaseStagingSafetyRepository(f.client);
 const result=await repo.report({...base(actor),requestKey:key,subjectKind:'DELIVERY',
  subjectId:subject,category:'SOS',severity:'CRITICAL'});
 assert.deepEqual(result,{ok:true,liveEnabled:false,incidentId:incident});
 assert.equal(f.state.calls[0].params._reporter_id,actor);
 await assert.rejects(repo.report({...base(actor),requestKey:key,subjectKind:'DELIVERY',
  subjectId:subject,category:'SOS',severity:'HIGH'}),/invalid/i);
});
test('admin operations pass only coded reasons and server actor',async()=>{
 const f=fixture(),repo=createSupabaseStagingSafetyRepository(f.client);
 await repo.transition({...base(admin),incidentId:incident,event:'triage',
  reasonCode:'IDENTITY_CHECK',eventKey:key});
 await repo.applySuspension({...base(admin),targetUserId:actor,scope:'DRIVER',
  reasonCode:'SAFETY_REVIEW',requestKey:key});
 await repo.liftSuspension({...base(admin),suspensionId:suspension,
  reasonCode:'REVIEW_CLEARED',eventKey:key});
 assert.equal(f.state.calls[0].params._admin_id,admin);
 assert.equal(f.state.calls[1].params._subject_user_id,actor);
 assert.equal(f.state.calls[2].params._suspension_id,suspension);
 await assert.rejects(repo.transition({...base(admin),incidentId:incident,event:'triage',
  reasonCode:'free form note',eventKey:key}),/invalid/i);
});
test('incident snapshot is reporter-filtered and validates durable shape',async()=>{
 const f=fixture(),repo=createSupabaseStagingSafetyRepository(f.client);
 assert.equal((await repo.incidentSnapshot({...base(actor),incidentId:incident}))
  .incident.severity,'CRITICAL');
 f.state.row.severity='HIGH';
 await assert.rejects(repo.incidentSnapshot({...base(actor),incidentId:incident}),/malformed/i);
 await assert.rejects(repo.incidentSnapshot({...base(admin),incidentId:incident}),/unavailable/i);
});

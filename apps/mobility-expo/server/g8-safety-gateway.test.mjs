import test from 'node:test';
import assert from 'node:assert/strict';
import {createQoreSafetyGateway} from './g8-safety-gateway.mjs';
const ref='staging1234567890abcd';
const user='11111111-1111-4111-8111-111111111111';
const admin='22222222-2222-4222-8222-222222222222';
const subject='33333333-3333-4333-8333-333333333333';
const key='44444444-4444-4444-8444-444444444444';
const incident='55555555-5555-4555-8555-555555555555';
const suspension='66666666-6666-4666-8666-666666666666';
const eventId='77777777-7777-4777-8777-777777777777';
const bearer=id=>'synthetic_safety_'+id.replaceAll('-','')+'_bearer';
const headers=id=>({authorization:'Bearer '+bearer(id)});
function fixture(){
 const calls=[];
 const gateway=createQoreSafetyGateway({projectRef:ref,
  verifyAccessToken:async token=>{const id=[user,admin].find(x=>bearer(x)===token);
   if(!id)throw Error('bad');return {id,is_anonymous:false,
    email_confirmed_at:'2026-10-22T12:00:00Z'};},
  authorizeAdmin:async id=>id===admin,allowRequest:()=>true,
  reportIncident:async input=>{calls.push({op:'report',input});return {ok:true,
   liveEnabled:false,incidentId:incident};},
  transitionIncident:async input=>{calls.push({op:'transition',input});return {ok:true,
   liveEnabled:false,eventId};},
  applySuspension:async input=>{calls.push({op:'apply',input});return {ok:true,
   liveEnabled:false,suspensionId:suspension};},
  liftSuspension:async input=>{calls.push({op:'lift',input});return {ok:true,
   liveEnabled:false,eventId};},
  loadIncident:async input=>{calls.push({op:'status',input});return {ok:true,
   liveEnabled:false,incident:{id:incident,status:'open'}};},
 });
 return {gateway,calls};
}
const report={requestKey:key,subjectKind:'DELIVERY',subjectId:subject,
 category:'SOS',severity:'CRITICAL'};
test('participant reports strict incident without actor, coordinates or free text',async()=>{
 const f=fixture(),out=await f.gateway({method:'POST',
  path:'/v1/staging/safety/incidents/report',headers:headers(user),body:report});
 assert.equal(out.status,201);assert.equal(out.body.externalResponseDispatched,false);
 assert.equal(f.calls[0].input.actorId,user);
 for(const forged of [{...report,reporterId:user},{...report,lat:-25},
  {...report,note:'private'},{...report,severity:'HIGH'}])
  assert.equal((await f.gateway({method:'POST',path:'/v1/staging/safety/incidents/report',
   headers:headers(user),body:forged})).status,400);
});
test('reporter reads private incident while persistence verifies ownership',async()=>{
 const f=fixture(),out=await f.gateway({method:'GET',
  path:`/v1/staging/safety/incidents/${incident}/status`,headers:headers(user)});
 assert.equal(out.status,200);assert.equal(out.body.incident.id,incident);
 assert.deepEqual(f.calls[0].input,{actorId:user,incidentId:incident});
});
test('admin-only transitions and suspensions derive admin from JWT',async()=>{
 const f=fixture();
 const transition=`/v1/staging/admin/safety/incidents/${incident}/transition`;
 assert.equal((await f.gateway({method:'POST',path:transition,headers:headers(user),
  body:{event:'triage',reasonCode:'IDENTITY_CHECK',eventKey:key}})).status,403);
 assert.equal((await f.gateway({method:'POST',path:transition,headers:headers(admin),
  body:{event:'triage',reasonCode:'IDENTITY_CHECK',eventKey:key}})).status,200);
 const apply=await f.gateway({method:'POST',
  path:'/v1/staging/admin/safety/suspensions/apply',headers:headers(admin),
  body:{targetUserId:user,scope:'DRIVER',reasonCode:'SAFETY_REVIEW',requestKey:key}});
 assert.equal(apply.status,201);assert.equal(apply.body.suspensionId,suspension);
 const lift=await f.gateway({method:'POST',
  path:`/v1/staging/admin/safety/suspensions/${suspension}/lift`,headers:headers(admin),
  body:{reasonCode:'REVIEW_CLEARED',eventKey:key}});
 assert.equal(lift.status,200);assert.equal(lift.body.active,false);
 assert.equal(f.calls.at(-1).input.actorId,admin);
});
test('invalid Auth, reason codes, limiter and live receipts fail closed',async()=>{
 const f=fixture();
 assert.equal((await f.gateway({method:'POST',path:'/v1/staging/safety/incidents/report',
  headers:{},body:report})).status,401);
 const path=`/v1/staging/admin/safety/incidents/${incident}/transition`;
 assert.equal((await f.gateway({method:'POST',path,headers:headers(admin),
  body:{event:'triage',reasonCode:'raw text',eventKey:key}})).status,400);
 const base={projectRef:ref,verifyAccessToken:async()=>({id:user,is_anonymous:false,
  email_confirmed_at:'2026-10-22T12:00:00Z'}),authorizeAdmin:async()=>false,
  reportIncident:async()=>({ok:true,liveEnabled:true,incidentId:incident}),
  transitionIncident:async()=>{},applySuspension:async()=>{},liftSuspension:async()=>{},
  loadIncident:async()=>{}};
 const limited=createQoreSafetyGateway({...base,allowRequest:()=>false});
 assert.equal((await limited({method:'POST',path:'/v1/staging/safety/incidents/report',
  headers:headers(user),body:report})).status,429);
 const broken=createQoreSafetyGateway({...base,allowRequest:()=>true});
 assert.equal((await broken({method:'POST',path:'/v1/staging/safety/incidents/report',
  headers:headers(user),body:report})).status,409);
});

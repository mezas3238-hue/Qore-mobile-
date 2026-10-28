import test from 'node:test';
import assert from 'node:assert/strict';
import {createQoreBackofficeRoleAuthority} from './g27-backoffice-role-authority.mjs';
import {createQoreBackofficeReadGateway} from './g27-backoffice-read-gateway.mjs';
import {createQoreBackofficeSqlReadRepository} from './g28-backoffice-sql-read-repository.mjs';
import {createQoreBackofficeLoopbackTransport,listenQoreBackofficeLoopback}
 from './g27-backoffice-loopback-transport.mjs';

const now=Date.parse('2026-10-23T12:00:00Z');
const admin='11111111-1111-4111-8111-111111111111';
const outsider='22222222-2222-4222-8222-222222222222';
const token='syntheticVerifiedJwtLongEnoughForQA123456789';
const path='/v1/staging/admin/incidents/queue';
const row={incidentId:'33333333-3333-4333-8333-333333333333',
 category:'SAFETY',severity:'HIGH',status:'OPEN',
 createdAt:now-2000,revision:2};
function build(overrides={}){
 let active=true;const calls=[];
 const rpc=async(name,params)=>{
  calls.push({name,params});
  switch(name){
   case 'mobility_stage_g27_backoffice_role_of':
    return {data:active&&params._user===admin?'admin':null,error:null};
   case 'mobility_stage_g27_backoffice_has_scope':
    return {data:active&&params._user===admin&&
     params._scope==='admin.incidents.read',error:null};
   case 'mobility_stage_g28_admin_incident_page':
    return {data:{revision:2,items:[row],hasMore:false},error:null};
   default:return {error:{code:'UNAVAILABLE'}};
  }
 };
 const roleAuthority=createQoreBackofficeRoleAuthority({rpc});
 const repository=createQoreBackofficeSqlReadRepository({rpc});
 const gateway=createQoreBackofficeReadGateway({
  projectRef:'staging1234567890abcd',
  cursorSecrets:{current:'independent-synthetic-admin-hmac-signing-material-2026'},
  now:()=>now,
  verifyAccessToken:async t=>t===token?{
   id:admin,sessionId:'session-synthetic-0001',
   expiresAtMs:now+1000000,is_anonymous:false,
   email_confirmed_at:'2026-10-22T12:00:00Z'
  }:Promise.reject(Error('JWT denied')),
  ...roleAuthority,
  verifyBackofficeMfa:async()=>({
   verifiedByProvider:true,assuranceLevel:'aal2',userId:admin,
   sessionId:'session-synthetic-0001',
   verifiedAtMs:now-1000,expiresAtMs:now+500000
  }),
  allowRequest:()=>true,loadPage:repository,...overrides
 });
 return {gateway,calls,setActive:v=>{active=v;}};
}
test('G28: complete local HTTP path verifies JWT MFA private role RPC scope and real-page DTO',async t=>{
 const g=build();
 const server=createQoreBackofficeLoopbackTransport({readHandler:g.gateway});
 const origin=await listenQoreBackofficeLoopback(server);
 t.after(async()=>new Promise(resolve=>server.close(resolve)));
 const headers={authorization:'Bearer '+token};
 const response=await fetch(origin+path,{headers});
 assert.equal(response.status,200);
 const data=await response.json();
 assert.equal(data.scope,'admin.incidents.read');
 assert.equal(data.items.length,1);
 assert.deepEqual(data.items[0],row);
 assert.equal(data.nextCursor,null);
 assert.doesNotMatch(JSON.stringify(data),/reporter_id|document|location|email|object_key/);
 assert.deepEqual(g.calls.map(x=>x.name),[
  'mobility_stage_g27_backoffice_role_of',
  'mobility_stage_g27_backoffice_has_scope',
  'mobility_stage_g28_admin_incident_page'
 ]);
 const readCall=g.calls.at(-1);
 assert.equal(readCall.params._actor,admin);
 assert.equal(readCall.params._limit,50);
 assert.equal(readCall.params._anchor_ms,now);
 assert.equal(response.headers.get('cache-control'),'private, no-store, max-age=0');
 assert.equal(response.headers.get('access-control-allow-origin'),null);
 g.setActive(false);
 const denied=await fetch(origin+path,{headers});
 assert.equal(denied.status,403);
 assert.equal(g.calls.filter(x=>x.name==='mobility_stage_g28_admin_incident_page').length,1);
});
test('G28: strong MFA, permission and unknown scopes remain fail closed',async()=>{
 const invalidMfa=build({verifyBackofficeMfa:async()=>({
  verifiedByProvider:false,assuranceLevel:'aal1'
 })});
 assert.equal((await invalidMfa.gateway({
  method:'GET',path,headers:{authorization:'Bearer '+token}
 })).status,403);
 assert.equal(invalidMfa.calls.some(x=>x.name==='mobility_stage_g28_admin_incident_page'),false);
 const otherScope=build();
 const x=await otherScope.gateway({method:'GET',
  path:'/v1/staging/admin/zones/overview',
  headers:{authorization:'Bearer '+token}
 });
 assert.equal(x.status,403);
 const noJwt=build();
 assert.equal((await noJwt.gateway({method:'GET',path,
  headers:{authorization:'Bearer INVALID_TOKEN_VALUE12345678901234567'}
 })).status,401);
 assert.equal(noJwt.calls.length,0);
 assert.ok(outsider!==admin);
});

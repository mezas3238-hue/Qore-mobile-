import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyBackofficeG263} from './g263-backoffice-authority-audit.mjs';

const REF='mrjzxftsdxzepzbcuids';
const PUB='sb_publishable_'+'p'.repeat(36);
const SECRET='sb_secret_'+'s'.repeat(36);
const owner='00000000-0000-4000-8000-000000000911';
const approver='00000000-0000-4000-8000-000000000912';
const fixed={ref:REF,environment:'staging',liveTripsEnabled:false,
 publicKey:PUB,serviceKey:SECRET,
 signupGate:async()=>({certified:true})};
function stub({native=[{user_id:owner,role:'admin'}],backoffice=[],
 g27=null,users=[{id:owner,is_anonymous:false,
 app_metadata:{qore_stage_qa:true,qore_qa_slot:'owner_admin'}}]}={}){
 const calls=[];
 const fetcher=async(u,o)=>{
  const url=new URL(u);calls.push({url:url.pathname,method:o.method,headers:o.headers});
  assert.equal(url.hostname,REF+'.supabase.co');
  assert.equal(o.method,'GET');
  assert.equal(o.headers.apikey,SECRET);
  assert.equal(o.headers.Authorization,undefined);
  let response;
  if(url.pathname==='/auth/v1/admin/users')response={users};
  else if(url.pathname==='/rest/v1/user_roles')response=native;
  else if(url.pathname==='/rest/v1/mobility_stage_backoffice_roles')response=backoffice;
  else if(url.pathname==='/rest/v1/rpc/mobility_stage_g27_backoffice_role_of')response=g27;
  else throw Error('Unexpected provider route');
  return {status:200,json:async()=>response};
 };
 return {calls,fetcher};
}
const run=(x,opts={})=>verifyBackofficeG263({...fixed,fetcher:x.fetcher,...opts});

test('G263 rejects G251 legacy admin role as insufficient for G27 independently approved backoffice',async()=>{
 const x=stub();
 const v=await run(x);
 assert.equal(v.adminBackofficeCertified,false);
 assert.equal(v.code,'ADMIN_NATIVE_ROLE_CONFLICT_G27');
 assert.equal(x.calls.length,2);
 assert.equal(v.externalJourneysCertified,0);
});
test('G263 requires an independent signed approval and active status',async()=>{
 for(const backoffice of [[],
  [{user_id:owner,role:'owner',status:'pending',approved_by:approver}],
  [{user_id:owner,role:'owner',status:'active',approved_by:owner}]]){
  const x=stub({native:[],backoffice});
  const v=await run(x);
  assert.equal(v.adminBackofficeCertified,false);
  assert.equal(v.code,'INDEPENDENT_BACKOFFICE_APPROVAL_REQUIRED');
 }
});
test('G263 certifies read-only G27 only for active independent approver and exact provider RPC',async()=>{
 const x=stub({native:[],backoffice:[{
  user_id:owner,role:'owner',status:'active',approved_by:approver
 }],g27:'owner'});
 const result=await run(x);
 assert.deepEqual(result,{
  mode:'STAGING_ADMIN_G27_READ_ONLY',code:'ADMIN_G27_INDEPENDENTLY_APPROVED',
  adminBackofficeCertified:true,commercialEnabled:false,externalJourneysCertified:0
 });
 assert.equal(x.calls.length,4);
});
test('G263 provider may not contradict independent backoffice data',async()=>{
 const x=stub({native:[],backoffice:[{
  user_id:owner,role:'owner',status:'active',approved_by:approver
 }],g27:null});
 assert.equal((await run(x)).code,'G27_REAL_ROLE_NOT_CONFIRMED');
});
test('G263 rejects LIVE, production, missing Admin and provider failures without approval',async()=>{
 const x=stub();
 assert.equal((await run(x,{environment:'production'})).adminBackofficeCertified,false);
 assert.equal((await run(x,{liveTripsEnabled:true})).adminBackofficeCertified,false);
 assert.equal(x.calls.length,0);
 assert.equal((await run(stub({users:[]}))).code,'OWNER_ADMIN_AUTH_IDENTITY_MISSING');
 const bad=await run({fetcher:async()=>{throw Error('private outage')}});
 assert.equal(bad.adminBackofficeCertified,false);
 assert.equal(bad.code,'PROVIDER_OR_BACKOFFICE_EVIDENCE_UNAVAILABLE');
});

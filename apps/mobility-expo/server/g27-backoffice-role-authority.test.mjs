import test from 'node:test';
import assert from 'node:assert/strict';
import {createQoreBackofficeRoleAuthority} from './g27-backoffice-role-authority.mjs';
const admin='11111111-1111-4111-8111-111111111111';
const owner='22222222-2222-4222-8222-222222222222';
test('G27 independent role lookup and five permission scopes go only through private RPC',async()=>{
 const calls=[];
 const a=createQoreBackofficeRoleAuthority({rpc:async(name,args)=>{
  calls.push({name,args});
  if(name==='mobility_stage_g27_backoffice_role_of')
   return {data:args._user===admin?'admin':'owner',error:null};
  return {data:args._scope===(args._user===admin?
   'admin.kyc.read':'owner.finance.read'),error:null};
 }});
 assert.equal(await a.loadExclusiveBackofficeRole(admin),'admin');
 assert.equal(await a.loadExclusiveBackofficeRole(owner),'owner');
 assert.equal(await a.authorizePermission({userId:admin,scope:'admin.kyc.read'}),true);
 assert.equal(await a.authorizePermission({userId:admin,scope:'owner.finance.read'}),false);
 assert.equal(await a.authorizePermission({userId:owner,scope:'owner.finance.read'}),true);
 assert.equal(await a.authorizePermission({userId:owner,scope:'admin.kyc.read'}),false);
 assert.equal(calls.length,6);
 assert.deepEqual(calls[0],{name:'mobility_stage_g27_backoffice_role_of',
  args:{_user:admin}});
 assert.deepEqual(calls[2],{name:'mobility_stage_g27_backoffice_has_scope',
  args:{_user:admin,_scope:'admin.kyc.read'}});
});
test('G27 rejects injected owner role, malformed actor, scope privilege escalation',async()=>{
 let calls=0;
 const a=createQoreBackofficeRoleAuthority({rpc:async()=>{
  calls++;return {data:'owner',error:null};
 }});
 await assert.rejects(()=>a.loadExclusiveBackofficeRole('bad'));
 assert.equal(await a.authorizePermission({userId:admin,scope:'owner.finance.write'}),false);
 assert.equal(await a.authorizePermission({userId:owner,scope:'service_role'}),false);
 assert.equal(calls,0);
});
test('G27 backend role RPC permits inactive result null, denies arrays/errors/unavailability',async()=>{
 const a=createQoreBackofficeRoleAuthority({rpc:async()=>({data:null,error:null})});
 assert.equal(await a.loadExclusiveBackofficeRole(admin),null);
 for(const response of [
  {data:['admin','owner'],error:null},
  {data:{role:'admin'},error:null},
  {data:'service_role',error:null},
  {error:{code:'PGRST123'}},null
 ]){
  const f=createQoreBackofficeRoleAuthority({rpc:async()=>response});
  await assert.rejects(()=>f.loadExclusiveBackofficeRole(admin));
 }
 for(const response of [{data:1},{data:'true'},{error:{code:'permission_denied'}}]){
  const f=createQoreBackofficeRoleAuthority({rpc:async()=>response});
  await assert.rejects(()=>f.authorizePermission({userId:admin,scope:'admin.kyc.read'}));
 }
});
test('G27 never invents a privileged authority if RPC is not connected',()=>{
 assert.throws(()=>createQoreBackofficeRoleAuthority({rpc:null}),/required/);
});

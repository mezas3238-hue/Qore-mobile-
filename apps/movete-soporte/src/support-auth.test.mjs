import test from 'node:test';
import assert from 'node:assert/strict';
import {verifySupportAccess,supportPasswordLogin,supportTotpVerify} from './support-auth.mjs';
import {readSupportCases} from './support-gateway.mjs';
const user='11111111-1111-4111-8111-111111111111',factor='22222222-2222-4222-8222-222222222222';
const caseItem={ticket_id:'33333333-3333-4333-8333-333333333333',
 case_code:'MF-2026-007',category:'COMERCIO',summary:'Pedido demorado para cliente',
 status:'OPEN',priority:'NORMAL',assigned_support_id:user,updated_at:'2026-11-01T12:00:00Z'};
function fixture({role='support',aal='aal2',verified=true,factors=1,
 userId=user,roleError=false,changeRole=false,tooMuchData=false}={}){
 const calls=[];let roleCount=0,currentLevel=aal;
 const db={auth:{
  getSession:async()=>({data:{session:{user:{id:userId},access_token:'support-private-verified-session-token-1234567890',
   expires_at:Math.floor(Date.now()/1000)+3600}},error:null}),
  getUser:async()=>({data:{user:{id:userId,is_anonymous:false,email_confirmed_at:'2026-11-01T09:00:00Z'}},error:verified?null:'invalid'}),
  signInWithPassword:async()=>({error:null}),signOut:async()=>{calls.push('logout');return {error:null}},
  mfa:{
   getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel},error:null}),
   listFactors:async()=>({data:{totp:Array.from({length:factors},()=>({factor_type:'totp',status:'verified',id:factor}))},error:null}),
   challengeAndVerify:async()=>{currentLevel='aal2';return {error:null}}
  }
 },rpc:async name=>{calls.push('rpc:'+name);roleCount++;return {data:changeRole&&roleCount>1?null:role,error:roleError?'denied':null}},
 from:table=>{calls.push('from:'+table);return {select:columns=>{
  calls.push('columns:'+columns);return {order:()=>({limit:async()=>({
   data:[tooMuchData?{...caseItem,customer_phone:'NOPE'}:caseItem],error:null
  })})};
 }}}};
 return {db,calls};
}
test('Support role + AAL2 + verified factor is necessary to see own tickets',async()=>{
 const f=fixture(),s=await verifySupportAccess(f.db);
 assert.equal(s?.userId,user);
 const result=await readSupportCases(f.db);
 assert.equal(result.ok,true);
 assert.equal(result.cases.length,1);
 assert.equal(result.cases[0].case_code,'MF-2026-007');
 assert(f.calls.includes('rpc:mobility_stage_support_my_role'));
 assert(!JSON.stringify(result).includes('support-private-verified-session-token'));
});
test('No Owner/Admin/Driver/Passenger role can inherit Support portal',async()=>{
 for(const role of ['owner','admin','driver','passenger',null,'superadmin']){
  const f=fixture({role});assert.equal(await verifySupportAccess(f.db),null);
  const page=await readSupportCases(f.db);assert.equal(page.ok,false);
  assert.equal(f.calls.some(s=>s.startsWith('from:')),false);
 }
});
test('AAL1 and unverified users never touch support data even if role RPC responds',async()=>{
 for(const o of [{aal:'aal1'},{factors:0},{verified:false},{roleError:true},{userId:'incorrect'}]){
  const f=fixture(o);assert.equal(await verifySupportAccess(f.db),null);
  assert.equal((await readSupportCases(f.db)).ok,false);
  assert.equal(f.calls.some(s=>s.startsWith('from:')),false);
 }
});
test('Extra personally identifying server fields fail closed rather than render',async()=>{
 const f=fixture({tooMuchData:true});
 assert.equal((await readSupportCases(f.db)).code,'UNTRUSTED_CASES');
});
test('Role revoked during case query invalidates response, zero case content released',async()=>{
 const f=fixture({changeRole:true});const r=await readSupportCases(f.db);
 assert.equal(r.ok,false);assert.equal(r.code,'SESSION_CHANGED');
 assert.equal(Object.hasOwn(r,'cases'),false);
});
test('Password alone yields MFA_REQUIRED, OTP then checks independent support role',async()=>{
 const f=fixture({aal:'aal1'});
 const p=await supportPasswordLogin(f.db,'agent@movetefacil.example','safePassword123');
 assert.equal(p.code,'MFA_REQUIRED');
 const verified=await supportTotpVerify(f.db,factor,'123456');
 assert.equal(verified.ok,true);
});
test('Password and MFA never elevate Owner; failed role verification signs out',async()=>{
 const f=fixture({role:'owner'});
 assert.equal((await supportPasswordLogin(f.db,'owner@example.com','safePassword123')).code,'SUPPORT_ROLE_REQUIRED');
 assert(f.calls.includes('logout'));
 const q=fixture({aal:'aal1',role:'owner'});
 assert.equal((await supportTotpVerify(q.db,factor,'123456')).code,'SUPPORT_ROLE_REQUIRED');
 assert(q.calls.includes('logout'));
});

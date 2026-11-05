import test from 'node:test';
import assert from 'node:assert/strict';
import {enqueueSupportAction} from './support-action-gateway.mjs';
const user='11111111-1111-4111-8111-111111111111';
const factor='22222222-2222-4222-8222-222222222222';
const ticket='33333333-3333-4333-8333-333333333333';
const idem='44444444-4444-4444-8444-444444444444';
const intent={ticket_id:ticket,expected_status:'OPEN',
 action:'ESCALATE_SAFETY',idempotency_key:idem};

function fixture({role='support',aal='aal2',roleAfter='support',receipt='good',throwInvoke=false}={}){
 const calls=[];let roleReads=0;
 const db={
  auth:{
   getSession:async()=>({data:{session:{user:{id:user},
    access_token:'valid-support-session-token-long-enough',
    expires_at:Math.floor(Date.now()/1000)+3600}},error:null}),
   getUser:async()=>({data:{user:{id:user,is_anonymous:false,email_confirmed_at:'verified'}},error:null}),
   mfa:{
    getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:aal},error:null}),
    listFactors:async()=>({data:{totp:[{id:factor,factor_type:'totp',status:'verified'}]},error:null})
   }
  },
  rpc:async name=>{
   calls.push(['role',name]);roleReads++;
   return {data:roleReads>1?roleAfter:role,error:null};
  },
  functions:{invoke:async(name,options)=>{
   calls.push(['invoke',name,options.body]);
   if(throwInvoke)throw Error('NETWORK');
   if(receipt==='error')return {error:{message:'unavailable'}};
   return {error:null,data:{
    request_id:'55555555-5555-4555-8555-555555555555',
    ticket_id:ticket,action:'ESCALATE_SAFETY',
    outcome:receipt==='fake'?'PAID':'QUEUED'
   }};
  }}
 };
 return {db,calls};
}
test('G311 action backend disabled by default; never touches auth or server',async()=>{
 const f=fixture();
 assert.deepEqual(await enqueueSupportAction(f.db,intent),
  {ok:false,code:'ACTION_BACKEND_DISABLED'});
 assert.deepEqual(f.calls,[]);
});
test('G311 server queue only after Support role plus TOTP AAL2',async()=>{
 const f=fixture();
 const res=await enqueueSupportAction(f.db,intent,{approved:true});
 assert.equal(res.ok,true);
 assert.equal(res.outcome,'QUEUED');
 assert.equal(f.calls.filter(x=>x[0]==='invoke').length,1);
 assert.deepEqual(f.calls.find(x=>x[0]==='invoke'),
  ['invoke','qore-support-actions',intent]);
 assert.equal(Object.hasOwn(res,'cases'),false);
 assert.equal(Object.hasOwn(res,'paid'),false);
});
test('G311 roles other than support and AAL1 can never invoke Edge Function',async()=>{
 for(const options of [{role:'owner'},{role:'driver'},{role:'admin'},
  {role:'passenger'},{role:null},{aal:'aal1'}]){
  const f=fixture(options);
  assert.equal((await enqueueSupportAction(f.db,intent,{approved:true})).ok,false);
  assert.equal(f.calls.some(x=>x[0]==='invoke'),false);
 }
});
test('G311 a forged arbitrary field or request cannot reach Edge Function',async()=>{
 for(const input of [{...intent,amount:99},{...intent,action:'CHANGE_COMMISSION'},
  {...intent,user_id:user},{...intent,summary:'free text'},null]){
  const f=fixture();
  assert.equal((await enqueueSupportAction(f.db,input,{approved:true})).code,'INVALID_ACTION');
  assert.equal(f.calls.some(x=>x[0]==='invoke'),false);
 }
});
test('G311 reject unexpected receipt and revoked roles after queue request',async()=>{
 const revoked=fixture({roleAfter:null});
 assert.equal((await enqueueSupportAction(revoked.db,intent,{approved:true})).code,'SESSION_CHANGED');
 const fake=fixture({receipt:'fake'});
 assert.equal((await enqueueSupportAction(fake.db,intent,{approved:true})).code,'UNTRUSTED_RECEIPT');
 const error=fixture({receipt:'error'});
 assert.equal((await enqueueSupportAction(error.db,intent,{approved:true})).code,'SERVER_NOT_READY');
 const offline=fixture({throwInvoke:true});
 assert.equal((await enqueueSupportAction(offline.db,intent,{approved:true})).code,'NETWORK_UNAVAILABLE');
});

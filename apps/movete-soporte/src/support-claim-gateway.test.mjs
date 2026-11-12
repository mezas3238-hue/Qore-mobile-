import test from 'node:test';
import assert from 'node:assert/strict';
import {claimSupportCase} from './support-claim-gateway.mjs';
const user='11111111-1111-4111-8111-111111111111';
const factor='22222222-2222-4222-8222-222222222222';
const ticket='33333333-3333-4333-8333-333333333333';
const idem='44444444-4444-4444-8444-444444444444';
const intent={ticket_id:ticket,idempotency_key:idem};
function fixture({role='support',after='support',aal='aal2',receipt='valid',throwInvoke=false}={}){
 const calls=[];let reads=0;
 const db={
  auth:{
   getSession:async()=>({data:{session:{user:{id:user},
    access_token:'long-valid-token-for-synthetic-test-only',
    expires_at:Math.floor(Date.now()/1000)+3600}},error:null}),
   getUser:async()=>({data:{user:{id:user,is_anonymous:false,email_confirmed_at:'verified'}},error:null}),
   mfa:{
    getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:aal},error:null}),
    listFactors:async()=>({data:{totp:[{id:factor,factor_type:'totp',status:'verified'}]},error:null})
   }
  },
  rpc:async(name)=>{
   calls.push(['role',name]);reads++;
   return {data:reads>1?after:role,error:null};
  },
  functions:{invoke:async(name,options)=>{
   calls.push(['claim',name,options.body]);
   if(throwInvoke)throw Error('offline');
   if(receipt==='error')return {error:{message:'denied'}};
   return {data:{
    claim_id:'55555555-5555-4555-8555-555555555555',
    ticket_id:ticket,outcome:receipt==='invalid'?'PAID':'CLAIMED'
   },error:null};
  }}
 };
 return {db,calls};
}
test('G320 claim disabled gate never calls Auth or function',async()=>{
 const f=fixture();
 assert.deepEqual(await claimSupportCase(f.db,intent),
  {ok:false,code:'CLAIM_BACKEND_DISABLED'});
 assert.deepEqual(f.calls,[]);
});
test('G320 verified AAL2 Support may request claim only via fixed function',async()=>{
 const f=fixture();
 const response=await claimSupportCase(f.db,intent,{approved:true});
 assert.equal(response.ok,true);
 assert.equal(response.outcome,'CLAIMED');
 assert.deepEqual(f.calls.filter(x=>x[0]==='claim'),
  [['claim','qore-support-claim',intent]]);
 assert.equal(Object.hasOwn(response,'resolved'),false);
});
test('G320 non-support or AAL1 session denied before any claim',async()=>{
 for(const opts of [{role:'owner'},{role:'admin'},{role:'driver'},
  {role:null},{role:'passenger'},{aal:'aal1'}]){
  const f=fixture(opts);
  assert.equal((await claimSupportCase(f.db,intent,{approved:true})).ok,false);
  assert.equal(f.calls.some(x=>x[0]==='claim'),false);
 }
});
test('G320 forged user/amount/PII fields cannot reach backend',async()=>{
 for(const key of ['actor_id','session_id','assigned_support_id','amount','phone','status']){
  const f=fixture();
  const result=await claimSupportCase(f.db,{...intent,[key]:'forged'},{approved:true});
  assert.equal(result.code,'INVALID_CLAIM');
  assert.equal(f.calls.some(x=>x[0]==='claim'),false);
 }
});
test('G320 invalid receipt or revoked session cannot fake assignment',async()=>{
 const changed=fixture({after:null});
 assert.equal((await claimSupportCase(changed.db,intent,{approved:true})).code,'SESSION_CHANGED');
 const invalid=fixture({receipt:'invalid'});
 assert.equal((await claimSupportCase(invalid.db,intent,{approved:true})).code,'INVALID_RECEIPT');
 const denied=fixture({receipt:'error'});
 assert.equal((await claimSupportCase(denied.db,intent,{approved:true})).code,'CLAIM_NOT_AUTHORIZED');
 const offline=fixture({throwInvoke:true});
 assert.equal((await claimSupportCase(offline.db,intent,{approved:true})).code,'NETWORK_UNAVAILABLE');
});

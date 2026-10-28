import test from 'node:test';
import assert from 'node:assert/strict';
import {createOwnerCommissionGateway} from './owner-commission-gateway.mjs';
const owner='11600000-0000-4116-8116-000000000001';
const key='11600000-0000-4116-8116-000000000031';
const token='qa-owner-browser-aal2-session-001';
const origin='https://g116-commission-ci.invalid';
const clock=1900000000000;
const data=(bps=1500,version=1)=>({serviceKind:'AUTO_RIDE',commissionBps:bps,
 subsidyBps:1000,version,mode:'STAGING_DEMO_ONLY',productionEnabled:false});
const response=(value,status=200)=>({status,ok:status===200,redirected:false,
 headers:{get:k=>k==='content-type'?'application/json; charset=utf-8':null},
 text:async()=>JSON.stringify(value)});
function fixture({enabled=true,role='owner',mfa=true,reply=null}={}){
 let session={subject:owner,role,mfaVerified:mfa,token,expiresAt:clock+600000};
 let writes=0,reads=0;
 const getSession=async()=>session;
 const gateway=createOwnerCommissionGateway({
  enabled,contractCertified:true,origin,pinnedOrigin:origin,now:()=>clock,
  getSession,fetchImpl:async(url,opts)=>{
   assert.equal(url,origin+'/v1/staging/owner/commissions/AUTO_RIDE');
   assert.equal(opts.redirect,'error');
   assert.equal(opts.credentials,'omit');
   assert.equal(opts.headers.Authorization,'Bearer '+token);
   if(opts.method==='POST'){
    writes++;const body=JSON.parse(opts.body);
    assert.deepEqual(body,{requestKey:key,commissionBps:1800});
   }else{reads++;assert.equal(opts.method,'GET');}
   return reply??response(data(opts.method==='POST'?1800:1500,opts.method==='POST'?2:1));
  }
 });
 return {gateway,reads:()=>reads,writes:()=>writes,rotate:next=>session=next};
}
test('G116 Owner browser reads and saves strictly server-valued commission, never subsidy',async()=>{
 const f=fixture();
 const original=await f.gateway.read('AUTO_RIDE');
 assert.deepEqual(original.data,data());
 const result=await f.gateway.change('AUTO_RIDE',{requestKey:key,commissionBps:1800});
 assert.deepEqual(result.data,data(1800,2));
 assert.equal(f.writes(),1);
 assert.equal(f.reads(),1);
});
test('G116 no browser write without Owner MFA or configured HTTPS',async()=>{
 for(const f of [fixture({role:'admin'}),fixture({role:'passenger'}),
  fixture({mfa:false}),fixture({enabled:false})]){
  assert.equal((await f.gateway.change('AUTO_RIDE',
   {requestKey:key,commissionBps:1800})).ok,false);
  assert.equal(f.writes(),0);
 }
});
test('G116 body cannot alter subsidy, percentages or unauthorized service',async()=>{
 const f=fixture();
 for(const body of [{requestKey:key,commissionBps:900},
  {requestKey:key,commissionBps:3100},
  {requestKey:key,commissionBps:1800,subsidyBps:0}]){
  assert.equal((await f.gateway.change('AUTO_RIDE',body)).ok,false);
 }
 assert.equal((await f.gateway.read('MERCHANT_ORDER')).ok,false);
 assert.equal(f.writes(),0);
});
test('G116 invalid server receipt and Owner JWT rotation cannot claim success',async()=>{
 const invalid=fixture({reply:response({...data(1800,2),subsidyBps:900})});
 assert.equal((await invalid.gateway.change('AUTO_RIDE',
  {requestKey:key,commissionBps:1800})).code,'INVALID_POLICY_RECEIPT');
 const f=fixture({reply:response(data())});
 f.rotate({subject:owner,role:'owner',mfaVerified:true,
  token:'changed-qa-owner-token-00001',expiresAt:clock+600000});
 assert.equal((await f.gateway.read('AUTO_RIDE')).ok,false);
});

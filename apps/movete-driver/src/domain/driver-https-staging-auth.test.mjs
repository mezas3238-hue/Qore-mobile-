import test from 'node:test';
import assert from 'node:assert/strict';
import {createDriverHttpsStagingAuthAdapter,
 DRIVER_HTTPS_AUTH_LIVE_ENABLED}
 from './driver-https-staging-auth.mjs';
const id='61610000-0000-4161-8161-000000000001';
const other='61610000-0000-4161-8161-000000000002';
const at=Date.parse('2026-10-24T12:00:00Z');
const token='driver-provider-sdk-bearer-000000000000000';
const origin='https://api-staging.movetefacil.example';
const user={id,is_anonymous:false,email_confirmed_at:'2026-10-20T00:00:00Z',
 app_metadata:{role:'owner'}};
function fixture(extra={}){
 const calls=[];
 let changed;
 const auth={
  getSession:async()=>({error:null,data:{session:{
   access_token:token,user:{id},
   expires_at:Math.floor(at/1000)+600}}}),
  getUser:async jwt=>{calls.push(['getUser',jwt]);return {
   error:null,data:{user}};},
  onAuthStateChange:fn=>{changed=fn;return {
   data:{subscription:{unsubscribe:()=>{calls.push(['unsubscribe']);}}}
  };}
 };
 const config={auth,apiOrigin:origin,
  approvedStagingHost:'api-staging.movetefacil.example',
  allowedByOwner:true,liveEnabled:false,now:()=>at,
  verifyExclusiveDriverRole:async request=>{
   calls.push(['role',request]);return true;
  },...extra};
 return {client:createDriverHttpsStagingAuthAdapter(config),
  calls,changed:()=>changed?.('SIGNED_OUT',{access_token:'dont leak'})};
}
test('G61B signed SDK identity plus independent exclusive server role only',async()=>{
 assert.equal(DRIVER_HTTPS_AUTH_LIVE_ENABLED,false);
 const f=fixture();
 const result=await f.client.getSession();
 assert.deepEqual(result,{role:'driver',userId:id,accessToken:token});
 assert.equal(Object.isFrozen(result),true);
 assert.deepEqual(f.calls,[['getUser',token],['role',{
  apiOrigin:origin,userId:id,accessToken:token}]]);
 assert(!JSON.stringify(result).includes('app_metadata'));
 let count=0;
 const stop=f.client.subscribe((...args)=>{
  count++;assert.deepEqual(args,[]);
 });
 f.changed();
 assert.equal(count,1);
 stop();
 assert.deepEqual(f.calls.at(-1),['unsubscribe']);
});
test('G61B no enabled client without authorized HTTPS, trusted SDK and role source',()=>{
 for(const change of [
  {allowedByOwner:false},{liveEnabled:true},
  {apiOrigin:'http://api-staging.movetefacil.example'},
  {apiOrigin:'https://attacker.example'},
  {approvedStagingHost:'api.production.example'},
  {auth:{}},{auth:null},{verifyExclusiveDriverRole:null},
  {now:null}
 ])assert.throws(()=>fixture(change));
});
test('G61B private signed metadata and unverified role never unlock Driver',async()=>{
 const role=fixture({verifyExclusiveDriverRole:async()=>false});
 await assert.rejects(()=>role.client.getSession());
 const missed=fixture({verifyExclusiveDriverRole:async()=>{
  throw Error('server inaccessible')}});
 await assert.rejects(()=>missed.client.getSession());
 const array=fixture({verifyExclusiveDriverRole:async()=>['driver']});
 await assert.rejects(()=>array.client.getSession());
});
test('G61B invalid token, SDK errors, user mismatch, anonymous and unverified contact deny',async()=>{
 const base=fixture();
 const invalidSessions=[
  {user:{id},access_token:'short',
   expires_at:Math.floor(at/1000)+600},
  {user:{id},access_token:token,
   expires_at:Math.floor(at/1000)+10},
  {user:{id:'wrong'},access_token:token,
   expires_at:Math.floor(at/1000)+600}
 ];
 for(const record of invalidSessions){
  const auth={getSession:async()=>({data:{session:record},error:null}),
   getUser:async()=>({data:{user},error:null}),
   onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})};
  await assert.rejects(()=>fixture({auth}).client.getSession());
 }
 for(const invalid of [
  {...user,id:other},
  {...user,is_anonymous:true},
  {...user,email_confirmed_at:null},
  {...user,id:'bad'}
 ]){
  const auth={
   getSession:async()=>({data:{session:{
    user:{id},access_token:token,
    expires_at:Math.floor(at/1000)+600}},error:null}),
   getUser:async()=>({data:{user:invalid},error:null}),
   onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})
  };
  await assert.rejects(()=>fixture({auth}).client.getSession());
 }
 assert.equal((await fixture({auth:{
  getSession:async()=>({data:{session:null},error:null}),
  getUser:async()=>{throw Error('unexpected')},
  onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})
 }}).client.getSession()),null);
});

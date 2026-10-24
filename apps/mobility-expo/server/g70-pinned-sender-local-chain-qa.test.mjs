import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,randomUUID,sign} from 'node:crypto';
import {request as httpRequest} from 'node:http';
import {createG70PinnedSenderLocalChainQa,G70_PUBLIC_HTTPS_ENABLED}
 from './g70-pinned-sender-local-chain-qa.mjs';
import {G70_SENDER_LOOPBACK_LIVE_ENABLED}
 from './g70-sender-custody-loopback-qa.mjs';
const at=Date.parse('2026-10-24T18:00:00Z'),seconds=Math.floor(at/1000);
const issuer='https://qore-mobility-isolated.supabase.co/auth/v1';
const kp=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const kid='g70-test-pinned-es256';
const publicKeys=new Map([[kid,{alg:'ES256',
 jwk:kp.publicKey.export({format:'jwk'})}]]);
const uuid=n=>'70700000-0000-4070-8070-'+String(n).padStart(12,'0');
const sender=uuid(1),stranger=uuid(2),driver=uuid(3),
 senderSession=uuid(101),strangerSession=uuid(102),driverSession=uuid(103),
 delivery=uuid(201);
const sess=new Map([[sender,senderSession],[stranger,strangerSession],[driver,driverSession]]);
const bearer=(actor,extra={})=>{
 const a=Buffer.from(JSON.stringify({alg:'ES256',typ:'JWT',kid})).toString('base64url');
 const b=Buffer.from(JSON.stringify({iss:issuer,aud:'authenticated',role:'authenticated',
  sub:actor,session_id:sess.get(actor),iat:seconds-20,exp:seconds+600,
  is_anonymous:false,app_metadata:{role:'admin'},...extra})).toString('base64url');
 const c=sign('sha256',Buffer.from(a+'.'+b),
  {key:kp.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
 return a+'.'+b+'.'+c;
};
const token=bearer(sender);
const path='/v1/staging/sender/deliveries/'+delivery+'/custody';
const dto={mode:'STAGING_DEMO_ONLY',deliveryId:delivery,ownerId:sender,
 state:'requested',revision:1,vehicleKind:'MOTO',assignmentPersisted:false,
 proofVerified:false,qaOnly:true,productionEnabled:false,liveDeliveriesEnabled:false};
function fixture(extra={}){
 const valid=new Map([[sender,true],[stranger,true],[driver,true]]);
 const roles=new Map([[sender,'passenger'],[stranger,'passenger'],[driver,'driver']]);
 const proofs=new Map();
 const calls={provider:[],session:[],owner:[],exchange:[],roles:[]};
 const cfg={
  environment:'isolated_staging',localQaOnly:true,liveEnabled:false,
  issuer,audience:'authenticated',publicKeys,now:()=>at,
  readProviderUser:async who=>{calls.provider.push(who);return {
   id:who,is_anonymous:false,email_confirmed_at:'2026-10-23T10:00:00Z'};},
  readProviderSession:async({userId,sessionId})=>{
   calls.session.push({userId,sessionId});
   return {userId,sessionId,active:valid.get(userId)===true,
    expiresAtMs:at+1000000,assuranceLevel:'aal1',verifiedAtMs:at-500};
  },
  readPrivateSessionGrant:async({userId,sessionId})=>
   valid.get(userId)===true&&sess.get(userId)===sessionId,
  readExclusiveRole:async who=>{calls.roles.push(who);return roles.get(who);},
  allowRequest:()=>true,
  createSyntheticAttestation:async scope=>{
   calls.owner.push(scope);
   if(!valid.get(scope.senderId))throw Error('session revoked');
   const proof=randomUUID();
   proofs.set(proof,{...scope});
   return proof;
  },
  exchangeScopedProof:async proof=>{
   calls.exchange.push(proof);
   const scope=proofs.get(proof);
   if(!scope)throw Error('G69 proof replay');
   proofs.delete(proof);
   if(!valid.get(scope.senderId)||roles.get(scope.senderId)!=='passenger'
    ||scope.senderId!==sender||scope.deliveryId!==delivery)
    throw Error('G68 denied');
   return dto;
  },...extra
 };
 return {app:createG70PinnedSenderLocalChainQa(cfg),valid,roles,proofs,calls};
}
async function get(port,tokenValue=token,requestedPath=path,options={}){
 const res=await fetch('http://127.0.0.1:'+port+requestedPath,{
  method:options.method??'GET',
  headers:{authorization:'Bearer '+tokenValue,...(options.headers??{})},
  ...('body'in options?{body:options.body}:{})
 });
 return {status:res.status,body:await res.json(),headers:res.headers};
}
async function raw(port,{path:uri=path,method='GET',headers={}}={}){
 return await new Promise((resolve,reject)=>{
  const req=httpRequest({host:'127.0.0.1',port,path:uri,method,
   headers},res=>{
    let content='';res.on('data',x=>{content+=x.toString()});
    res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(content)}));
   });
  req.on('error',reject);req.end();
 });
}
test('G70 signed ES256 JWT -> provider G42 -> exclusive Passenger -> proof -> local HTTP',async()=>{
 assert.equal(G70_PUBLIC_HTTPS_ENABLED,false);
 assert.equal(G70_SENDER_LOOPBACK_LIVE_ENABLED,false);
 const f=fixture();
 const {port,address}=await f.app.listen();
 try{
  assert.equal(address,'127.0.0.1');
  const result=await get(port);
  assert.equal(result.status,200,JSON.stringify(result));
  assert.deepEqual(result.body,dto);
  assert.deepEqual(f.calls.roles,[sender]);
  assert.equal(f.calls.owner.length,1);
  assert.deepEqual(f.calls.owner[0],{
   senderId:sender,sessionId:senderSession,tokenIatMs:(seconds-20)*1000,
   deliveryId:delivery
  });
  assert.equal(f.calls.exchange.length,1);
  assert.equal(f.proofs.size,0,'read proof consumed exactly once');
  assert.equal(result.headers.get('access-control-allow-origin'),null);
  assert.equal(result.headers.get('cache-control'),'private, no-store, max-age=0');
  const serialized=JSON.stringify(result);
  for(const forbidden of [token,senderSession,f.calls.exchange[0],'proofRef',
   'courierId','phone','content_sha256'])
   assert.equal(serialized.includes(forbidden),false);
 }finally{await f.app.close();}
});
test('G70 rejects unauthenticated, Driver, foreign Passenger and revoked G42 provider',async()=>{
 const f=fixture();const {port}=await f.app.listen();
 try{
  for(const bad of [
   bearer(driver),bearer(stranger),
   token.slice(0,-6)+'foobar',
   bearer(sender,{aud:'service_role'}),
   bearer(sender,{iss:'https://untrusted.example/auth/v1'}),
   bearer(sender,{session_id:uuid(999)}),
   bearer(sender,{exp:seconds-1}),
   bearer(sender,{role:'admin'})
  ])assert.notEqual((await get(port,bad)).status,200);
  assert.equal(f.calls.owner.length,1,
   'foreign authenticated Passenger reaches private G69, but cannot view sender delivery');
  f.valid.set(sender,false);
  const revoked=await get(port);
  assert.notEqual(revoked.status,200);
  assert.equal(f.calls.owner.length,1);
 }finally{await f.app.close();}
});
test('G70 rejects cookies, Origin, unknown routes, query strings, POST and body, duplicate auth',async()=>{
 const f=fixture();const {port}=await f.app.listen();
 try{
  for(const p of [
   path+'?ownerId='+sender,path+'%2Fextra',
   '/v1/staging/driver/deliveries/'+delivery+'/custody',
   '/v1/staging/sender/deliveries/'+delivery+'/proof-mint',
   '/v1/staging/sender/deliveries/'+uuid(999)+'/custody?x=1'
  ])assert.notEqual((await get(port,token,p)).status,200);
  for(const options of [
   {headers:{Origin:'https://evil.example'}},
   {headers:{Cookie:'auth=forged'}},
   {headers:{Referer:'https://evil.example'}},
   {headers:{'content-type':'application/json'}}
  ]){
   const result=await get(port,token,path,options);
   assert.notEqual(result.status,200,JSON.stringify(options));
  }
  const foreignHost=await raw(port,{headers:{
   authorization:'Bearer '+token,host:'evil.example'
  }});
  assert.notEqual(foreignHost.status,200);
  const post=await get(port,token,path,{method:'POST',body:'{}'});
  assert.equal(post.status,404);
  const duplicated=await raw(port,{headers:{
   authorization:['Bearer '+token,'Bearer '+token]
  }});
  assert.notEqual(duplicated.status,200);
  assert.equal(f.calls.owner.length,0);
  const unexpectedBody=await raw(port,{headers:{
   authorization:'Bearer '+token,'content-length':'1'
  }});
  assert.notEqual(unexpectedBody.status,200);
  assert.equal(f.calls.owner.length,0);
 }finally{await f.app.close();}
});
test('G70 no success from untrusted SQL result, wrong owner, leaked PII, offline G69',async()=>{
 const extraCases=[
  {exchangeScopedProof:async()=>({...dto,ownerId:stranger})},
  {exchangeScopedProof:async()=>({...dto,proofRef:randomUUID()})},
  {exchangeScopedProof:async()=>({...dto,revision:-1})},
  {exchangeScopedProof:async()=>({...dto,state:'delivered',revision:4,
   assignmentPersisted:true,proofVerified:false})},
  {exchangeScopedProof:async()=>{throw Error('SQL offline')}},
  {createSyntheticAttestation:async()=>{throw Error('Owner mint refused')}}
 ];
 for(const extra of extraCases){
  const f=fixture(extra);const {port}=await f.app.listen();
  try{
   const response=await get(port);
   assert.equal(response.status,503);
   assert.equal(response.body.productionEnabled,false);
   assert.equal(response.body.retrySafe,false);
   assert(!JSON.stringify(response).includes(token));
  }finally{await f.app.close();}
 }
});
test('G70 listener cannot start in production or with missing pinned signer/authorities',()=>{
 for(const bad of [
  {environment:'production'},{localQaOnly:false},{liveEnabled:true},
  {publicKeys:new Map()},{readProviderUser:null},{readProviderSession:null},
  {readPrivateSessionGrant:null},{readExclusiveRole:null},
  {allowRequest:null},{createSyntheticAttestation:null},{exchangeScopedProof:null}
 ])assert.throws(()=>fixture(bad));
});

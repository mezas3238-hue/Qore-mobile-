import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,randomUUID,sign} from 'node:crypto';
import {createG60DDriverVerifiedLocalChainQa}
 from './g60d-pinned-driver-local-chain-qa.mjs';
const at=Date.parse('2026-10-24T10:30:00Z');
const seconds=Math.floor(at/1000);
const issuer='https://qore-mobility-isolated.supabase.co/auth/v1';
const keys=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const kid='g60d-pinned-es256';
const publicKeys=new Map([[kid,{alg:'ES256',
 jwk:keys.publicKey.export({format:'jwk'})}]]);
const id=n=>'60604000-0000-4060-8060-'+String(n).padStart(12,'0');
const driver=id(1),passenger=id(2),driverSession=id(101),passengerSession=id(102);
const service=id(201),conversation=id(301),key=id(401),body='Ya estoy en camino';
const userIds=new Map([[driver,driverSession],[passenger,passengerSession]]);
const roles=new Map([[driver,'driver'],[passenger,'passenger']]);
function jwt(actor,claims={}){
 const head=Buffer.from(JSON.stringify({alg:'ES256',typ:'JWT',kid})).toString('base64url');
 const payload=Buffer.from(JSON.stringify({
  iss:issuer,aud:'authenticated',role:'authenticated',
  sub:actor,session_id:userIds.get(actor),iat:seconds-30,exp:seconds+600,
  is_anonymous:false,app_metadata:{role:'admin'},...claims
 })).toString('base64url');
 const sig=sign('sha256',Buffer.from(head+'.'+payload),
  {key:keys.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
 return head+'.'+payload+'.'+sig;
}
const token=jwt(driver),passengerToken=jwt(passenger);
const route=op=>'/v1/staging/driver/chat/services/RIDE/'+service+
 '/conversations/'+conversation+'/'+op;
const ack=(key,body)=>({conversationId:conversation,serviceId:service,
 requestKey:key,messageId:id(999),senderRole:'driver',body,
 createdAt:at-100,revision:2,serverStored:true});
function fixture(extra={}){
 const grants=new Map([[driver,true],[passenger,true]]);
 const stopped=new Map([[driver,true]]);
 const calls={proofs:[],redeemed:[],motion:[],roles:[]};
 const proofs=new Map(),messages=new Map();
 const cfg={environment:'isolated_staging',localQaOnly:true,liveEnabled:false,
 issuer,audience:'authenticated',publicKeys,now:()=>at,
 readProviderUser:async actor=>userIds.has(actor)?{
  id:actor,is_anonymous:false,
  email_confirmed_at:'2026-10-23T00:00:00Z'}:null,
 readProviderSession:async({userId,sessionId})=>
  userIds.get(userId)===sessionId?{
   userId,sessionId,active:true,expiresAtMs:at+900000,
   assuranceLevel:'aal1',verifiedAtMs:at-1000}:null,
 readPrivateSessionGrant:async({userId,sessionId})=>
  grants.get(userId)===true&&userIds.get(userId)===sessionId,
 readExclusiveRole:async actor=>{calls.roles.push(actor);return roles.get(actor);},
 readStoppedEvidence:async proof=>{calls.motion.push(proof);
  return {driverId:proof.driverId,serviceKind:proof.serviceKind,
   serviceId:proof.serviceId,conversationId:proof.conversationId,
   vehicleStopped:stopped.get(proof.driverId)===true,
   source:'trusted_navigation',observedAtMs:at-500};},
 allowRequest:()=>true,
 createSyntheticAttestation:async scope=>{
  calls.proofs.push(scope);
  if(grants.get(scope.driverId)!==true)
   throw Error('G60D stub G42 grant vanished');
  const proof=randomUUID();
  proofs.set(proof,{...scope});
  return {proof,expiresAtMs:at+10000,qaOnly:true,productionEnabled:false};
 },
 exchangeScopedProof:async proof=>{
  calls.redeemed.push(proof);
  const p=proofs.get(proof);
  if(!p)return {error:{code:'G6012'}};
  proofs.delete(proof);
  if(grants.get(p.driverId)!==true)return {error:{code:'G6013'}};
  if(roles.get(p.driverId)!=='driver')return {error:{code:'G5603'}};
  if(p.operation==='DRIVER_SEND'){
   const stored=messages.get(p.requestKey);
   if(stored&&stored.body!==p.body)return {error:{code:'G5009'}};
   const msg=stored??ack(p.requestKey,p.body);
   messages.set(p.requestKey,msg);
   return {data:msg};
  }
  const found=messages.get(p.requestKey);
  if(!found)return {data:{state:'NOT_YET_OBSERVED',serverStored:false,
   retrySafe:false,reconcileAgain:true,qaOnly:true,productionEnabled:false}};
  if(found.body!==p.body)return {error:{code:'G5919'}};
  return {data:{state:'COMMITTED',serverStored:true,retrySafe:false,
   reconcileAgain:false,qaOnly:true,productionEnabled:false,
   latestRevision:3,historyRefreshRequired:true,ack:found}};
 },
 ...extra
 };
 return {app:createG60DDriverVerifiedLocalChainQa(cfg),
  grants,stopped,calls,messages};
}
async function request(port,operation,bearer=token,
 payload={requestKey:key,body}){
 const response=await fetch('http://127.0.0.1:'+port+route(operation),{
  method:'POST',headers:{
   authorization:'Bearer '+bearer,'content-type':'application/json'},
  body:JSON.stringify(payload)
 });
 return {status:response.status,body:await response.json(),
  headers:response.headers};
}
test('G60D signed G42 JWT -> provider G42 grant -> role/stop -> single proof -> G60B HTTP',async()=>{
 const f=fixture();const {address,port}=await f.app.listen();
 try{
  assert.equal(address,'127.0.0.1');
  const pre=await request(port,'reconcile');
  assert.equal(pre.status,503);
  assert.equal(pre.body.code,'G60C_OUTCOME_UNKNOWN_RECONCILE_AGAIN');
  const s=await request(port,'send');
  assert.equal(s.status,200,JSON.stringify(s));
  assert.deepEqual(s.body,ack(key,body));
  const r=await request(port,'reconcile');
  assert.equal(r.status,200,JSON.stringify(r));
  assert.equal(r.body.ack.revision,2);
  assert.equal(r.body.latestRevision,3);
  assert.equal(r.body.historyRefreshRequired,true);
  assert.equal(f.calls.motion.length,1,'only send requires server-side vehicle stopped');
  assert.equal(f.calls.proofs.length,3);
  assert.deepEqual(f.calls.proofs.map(x=>x.operation),
   ['DRIVER_RECONCILE','DRIVER_SEND','DRIVER_RECONCILE']);
  assert.deepEqual(f.calls.proofs.map(x=>x.driverId),[driver,driver,driver]);
  assert.deepEqual(f.calls.proofs.map(x=>x.sessionId),
   [driverSession,driverSession,driverSession]);
  assert.equal(f.messages.size,1);
  assert.equal(s.headers.get('access-control-allow-origin'),null);
  assert.equal(s.headers.get('cache-control'),'private, no-store, max-age=0');
  assert(!JSON.stringify(r.body).includes(token));
  assert(!JSON.stringify(r.body).includes(driver));
 }finally{await f.app.close();}
});
test('G60D identical requestKey deduplicates; changed body conflicts; original ACK fixed',async()=>{
 const f=fixture();const {port}=await f.app.listen();
 try{
  const s1=await request(port,'send');
  const s2=await request(port,'send');
  assert.deepEqual(s1.body,s2.body);
  assert.equal(f.messages.size,1);
  const altered=await request(port,'send',token,{requestKey:key,body:'Body diferente'});
  assert.equal(altered.status,409);
  const reconciled=await request(port,'reconcile');
  assert.equal(reconciled.status,200);
  assert.deepEqual(reconciled.body.ack,s1.body);
 }finally{await f.app.close();}
});
test('G60D signed wrong actor, changed token claims, revoked provider or role never reaches SQL',async()=>{
 const f=fixture();const {port}=await f.app.listen();
 try{
  for(const jwtBad of [
   passengerToken,
   token.slice(0,-5)+'xxxxx',
   jwt(driver,{aud:'service_role'}),
   jwt(driver,{iss:'https://evil.example/auth/v1'}),
   jwt(driver,{session_id:id(999)}),
   jwt(driver,{exp:seconds-20}),
   jwt(driver,{role:'driver'})
  ]){
   const result=await request(port,'send',jwtBad);
   assert.notEqual(result.status,200);
  }
  assert.equal(f.calls.proofs.length,0);
  f.grants.set(driver,false);
  assert.notEqual((await request(port,'send')).status,200);
  f.grants.set(driver,true);
  f.stopped.set(driver,false);
  assert.notEqual((await request(port,'send')).status,200);
  assert.equal(f.calls.proofs.length,0);
 }finally{await f.app.close();}
});
test('G60D refuses forged actor, role, telemetry, extra scope from mobile',async()=>{
 const f=fixture();const {port}=await f.app.listen();
 try{
  for(const payload of [
   {requestKey:key,body,driverId:driver},
   {requestKey:key,body,actorId:driver},
   {requestKey:key,body,sessionId:driverSession},
   {requestKey:key,body,role:'driver'},
   {requestKey:key,body,vehicleStopped:true},
   {requestKey:key,body,sql:'SELECT owner'}
  ]){
   const r=await request(port,'send',token,payload);
   assert.equal(r.status,400,JSON.stringify(payload));
  }
  assert.equal(f.calls.proofs.length,0);
 }finally{await f.app.close();}
});
test('G60D tampered telematics/role, provider outage, proof source unavailable fail closed',async()=>{
 const base=fixture();
 await base.app.close();
 const failCases=[
  {readStoppedEvidence:async input=>({
   ...input,vehicleStopped:true,source:'driver_toggle',observedAtMs:at})},
  {readStoppedEvidence:async input=>({
   ...input,driverId:passenger,vehicleStopped:true,
   source:'trusted_navigation',observedAtMs:at})},
  {readProviderSession:async()=>{throw Error('provider down')}},
  {readExclusiveRole:async()=>['passenger','driver']},
  {createSyntheticAttestation:async()=>{throw Error('DB unreachable')}}
 ];
 for(const extra of failCases){
  const f=fixture(extra);
  const {port}=await f.app.listen();
  try{
   const result=await request(port,'send');
   assert.notEqual(result.status,200);
   assert.equal(result.body.serverStored,undefined);
  }finally{await f.app.close();}
 }
});
test('G60D cannot run as LIVE or without every independent authority',()=>{
 for(const bad of [
  {environment:'production'},{liveEnabled:true},{localQaOnly:false},
  {publicKeys:new Map()},{readProviderUser:null},
  {readProviderSession:null},{readPrivateSessionGrant:null},
  {readExclusiveRole:null},{readStoppedEvidence:null},
  {createSyntheticAttestation:null},{exchangeScopedProof:null},
  {allowRequest:null}
 ])assert.throws(()=>fixture(bad));
});

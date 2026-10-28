/**
 * G117 - TRUE cross-branch integration (without LIVE)
 * Genuine Admin B HTTPS-pinned browser codec (injected, never outbound) ->
 * Owner A JWT+AAL2 gateway -> localhost-only A HTTP -> PG16 durable G116 RPC.
 * No UI mocks for quote math, no fake commission persistence, no PSP.
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {createQoreRadarLoopbackTransport,listenQoreRadarLoopback}
 from './g4-loopback-http-transport.mjs';
import {createG116OwnerCommissionGateway} from './g116-owner-commission-gateway.mjs';
import {createOwnerCommissionGateway}
 from '../../movete-admin/src/owner-commission-gateway.mjs';

if(process.env.CI!=='true'||process.env.PGHOST!=='localhost'
 ||process.env.PGPORT!=='5432'
 ||process.env.PGDATABASE!=='qore_disposable_chain'
 ||process.env.PGAPPNAME!=='qore_ci_disposable_chain')
 throw Error('G117 refuses anything but GitHub disposable PostgreSQL16');
const owner='11700000-0000-4117-8117-000000000001';
const administrator='11700000-0000-4117-8117-000000000002';
const ownerSession='11700000-0000-4117-8117-000000000011';
const adminSession='11700000-0000-4117-8117-000000000012';
const autoKey='11700000-0000-4117-8117-000000000021';
const motoKey='11700000-0000-4117-8117-000000000022';
const token='g117-verified-synthetic-owner-aal2-token';
const adminToken='g117-verified-synthetic-admin-aal2-token';
const invalid=async()=>({status:404,body:{error:'Not found'}});
const legalUUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
function sql(statement){
 const output=execFileSync('psql',['-X','-q','-A','-t','-v',
  'ON_ERROR_STOP=1','-c',statement],{encoding:'utf8',timeout:15000,
  maxBuffer:500000,stdio:['ignore','pipe','pipe']});
 return output.trim().split('\n').at(-1)?.trim()??'';
}
function queryJson(statement){const s=sql(statement);return s?JSON.parse(s):null;}
const quoted=x=>"'"+x+"'";
function callRpc(name,args){
 const signatures={
  mobility_stage_g116_read_commission_qa:['service'],
  mobility_stage_g116_set_commission_qa:['actor','service','bps','key']
 };
 const keys=signatures[name];
 if(!keys||Object.keys(args).length!==keys.length||
  !keys.every(k=>Object.hasOwn(args,k)))throw Error('G117 SQL allowlist');
 const values=keys.map(key=>{
  const value=args[key];
  if(key==='bps'){
   if(!Number.isSafeInteger(value)||value<1000||value>3000)
    throw Error('G117 invalid bps');
   return String(value);
  }
  if(key==='service'&&['AUTO_RIDE','MOTO_RIDE','DELIVERY_AUTO',
   'DELIVERY_MOTO','COMMERCE'].includes(value))
   return quoted(value);
  if(typeof value==='string'&&legalUUID.test(value))return quoted(value);
  throw Error('G117 untrusted SQL parameter');
 });
 return queryJson('SET ROLE service_role; SELECT public.'+name+
  '('+values.join(',')+')::text;');
}
async function main(){
 assert.equal(sql("SELECT (current_database()='qore_disposable_chain'"+
  " AND current_setting('application_name')='qore_ci_disposable_chain')::text"),
  'true');
 sql("INSERT INTO auth.users(id) VALUES('"+owner+"'),('"+administrator+"');"+
  "DELETE FROM public.user_roles WHERE user_id IN ('"+owner+"','"+administrator+"');"+
  "INSERT INTO public.mobility_stage_backoffice_roles(user_id,role,status,approved_by)"+
  " VALUES('"+owner+"','owner','active','"+owner+"'),"+
  "('"+administrator+"','admin','active','"+owner+"');");
 const readPolicy=async({serviceKind})=>callRpc(
  'mobility_stage_g116_read_commission_qa',{service:serviceKind});
 const changePolicy=async({actorId,serviceKind,commissionBps,requestKey})=>
  callRpc('mobility_stage_g116_set_commission_qa',{
   actor:actorId,service:serviceKind,bps:commissionBps,key:requestKey
  });
 const fakeHttps='https://qore-g117-owner-ci.invalid';
 let revoked=false;
 const now=Date.now();
 const api=createG116OwnerCommissionGateway({
  projectRef:'staging1234567890abcd',environment:'isolated_staging',
  qaOnly:true,liveEnabled:false,
  verifyAccessToken:async value=>{
   if(value===token)return {id:owner,sessionId:ownerSession,
    is_anonymous:false,expiresAtMs:now+600000};
   if(value===adminToken)return {id:administrator,sessionId:adminSession,
    is_anonymous:false,expiresAtMs:now+600000};
   throw Error('G117 untrusted token');
  },
  verifySessionNotRevoked:async({userId})=>!revoked&&userId===owner||
   userId===administrator&&!revoked,
  loadExclusiveBackofficeRole:async userId=>{
   if(!legalUUID.test(userId))throw Error('untrusted role scope');
   return sql("SET ROLE service_role; SELECT "+
    "public.mobility_stage_g27_backoffice_role_of('"+userId+"')");
  },
  verifyBackofficeMfa:async({userId,sessionId})=>({
   verifiedByProvider:true,userId,sessionId,assuranceLevel:'aal2',
   verifiedAtMs:now-1000,expiresAtMs:now+300000
  }),
  allowRequest:()=>true,readPolicy,changePolicy,now:()=>now
 });
 const server=createQoreRadarLoopbackTransport({
  riderHandler:invalid,offerHandler:invalid,tripCommandHandler:invalid,
  deliveryHandler:invalid,merchantHandler:invalid,financeHandler:invalid,
  safetyHandler:invalid,merchantManagementHandler:invalid,
  deliveryOfferHandler:invalid,ownerCommissionHandler:api
 });
 let origin;
 try{
  origin=await listenQoreRadarLoopback(server);
  assert.equal(new URL(origin).hostname,'127.0.0.1');
  let readRequests=0,writeRequests=0;
  let activeToken=token;
  const B=createOwnerCommissionGateway({
   enabled:true,contractCertified:true,origin:fakeHttps,
   pinnedOrigin:fakeHttps,
   getSession:async()=>({
    role:'owner',mfaVerified:true,subject:owner,token:activeToken,
    expiresAt:now+600000
   }),
   now:()=>now,
   fetchImpl:(url,opts)=>{
    const destination=new URL(url);
    assert.equal(destination.origin,fakeHttps);
    assert.equal(destination.search,'');
    assert.equal(destination.hash,'');
    assert(['/v1/staging/owner/commissions/AUTO_RIDE',
      '/v1/staging/owner/commissions/MOTO_RIDE',
      '/v1/staging/owner/commissions/DELIVERY_AUTO',
      '/v1/staging/owner/commissions/DELIVERY_MOTO',
      '/v1/staging/owner/commissions/COMMERCE'].includes(destination.pathname));
    assert.equal(opts.credentials,'omit');
    assert.equal(opts.redirect,'error');
    if(opts.method==='GET')readRequests++;
    else if(opts.method==='POST')writeRequests++;
    else throw Error('Unapproved browser method');
    return fetch(origin+destination.pathname,{...opts,redirect:'error'});
   }
  });
  assert.equal(B.isConfigured(),true);
  const originalAuto=await B.read('AUTO_RIDE');
  const originalMoto=await B.read('MOTO_RIDE');
  assert.equal(originalAuto.ok,true,JSON.stringify(originalAuto));
  assert.equal(originalMoto.ok,true,JSON.stringify(originalMoto));
  assert.deepEqual(
   [originalAuto.data.commissionBps,originalMoto.data.commissionBps],
   [1800,1200]);
  const changedAuto=await B.change('AUTO_RIDE',{
   requestKey:autoKey,commissionBps:2000
  });
  assert.equal(changedAuto.ok,true,JSON.stringify(changedAuto));
  assert.equal(changedAuto.data.version,3);
  assert.equal(changedAuto.data.subsidyBps,1000);
  const changedMoto=await B.change('MOTO_RIDE',{
   requestKey:motoKey,commissionBps:1400
  });
  assert.equal(changedMoto.ok,true,JSON.stringify(changedMoto));
  assert.equal(changedMoto.data.version,2);
  assert.equal(changedMoto.data.subsidyBps,1000);
  const afterAuto=await B.read('AUTO_RIDE'),afterMoto=await B.read('MOTO_RIDE');
  assert.equal(afterAuto.data.commissionBps,2000);
  assert.equal(afterMoto.data.commissionBps,1400);
  assert.equal(readRequests,4);
  assert.equal(writeRequests,2);
  const p=queryJson("SELECT pg_catalog.jsonb_build_object("+
   "'policies',(SELECT count(*) FROM public.mobility_stage_g116_commission_policy"+
   " WHERE ((service_kind='AUTO_RIDE' AND version=3) OR (service_kind='MOTO_RIDE' AND version=2)) AND changed_by='"+owner+"'),"+
   "'audit',(SELECT count(*) FROM public.mobility_stage_g116_commission_audit"+
   " WHERE owner_id='"+owner+"'),"+
   "'distinctKeys',(SELECT count(DISTINCT request_key) FROM "+
   "public.mobility_stage_g116_commission_audit WHERE owner_id='"+owner+"'))::text");
  assert.deepEqual(p,{policies:2,audit:2,distinctKeys:2});
  // A replay cannot create a new audit row; PostgreSQL returns same receipt.
  const replay=await B.change('AUTO_RIDE',{
   requestKey:autoKey,commissionBps:2000
  });
  assert.equal(replay.ok,true);
  assert.equal(replay.data.version,3);
  assert.equal(sql("SELECT count(*) FROM public.mobility_stage_g116_commission_audit"+
   " WHERE owner_id='"+owner+"'"),'2');
  // Admin role cannot write even if an invalid B caller claims Owner.
  activeToken=adminToken;
  const denied=await B.change('AUTO_RIDE',{
   requestKey:'11700000-0000-4117-8117-000000000023',commissionBps:1900
  });
  assert.equal(denied.ok,false);
  assert.equal(sql("SELECT commission_bps FROM public.mobility_stage_g116_commission_policy"+
   " WHERE service_kind='AUTO_RIDE'"),'2000');
  activeToken=token;revoked=true;
  const revokedReply=await B.read('AUTO_RIDE');
  assert.equal(revokedReply.ok,false);
  assert.equal(sql("SELECT count(*) FROM public.mobility_stage_g116_commission_audit"+
   " WHERE owner_id='"+owner+"'"),'2');
  // G136: one real Owner web -> A JWT/AAL2 HTTP -> PG16 read, write,
  // independent readback per additional platform. Not merchant settlement.
  activeToken=token;revoked=false;
  const nonRides=[
   ['DELIVERY_AUTO',800,'11700000-0000-4117-8117-000000000031'],
   ['DELIVERY_MOTO',750,'11700000-0000-4117-8117-000000000032'],
   ['COMMERCE',1200,'11700000-0000-4117-8117-000000000033']
  ];
  for(const [kind,bps,requestKey] of nonRides){
   const before=await B.read(kind);
   assert.equal(before.ok,true,JSON.stringify(before));
   assert.equal(before.data.commissionBps,0);
   assert.equal(before.data.subsidyBps,0);
   const saved=await B.change(kind,{requestKey,commissionBps:bps});
   assert.equal(saved.ok,true,JSON.stringify(saved));
   assert.equal(saved.data.version,2);
   assert.equal(saved.data.subsidyBps,0);
   const verified=await B.read(kind);
   assert.equal(verified.ok,true,JSON.stringify(verified));
   assert.deepEqual(verified.data,saved.data);
   assert.equal(sql("SELECT commission_bps FROM "+
    "public.mobility_stage_g116_commission_policy WHERE service_kind='"+
    kind+"'"),String(bps));
  }
  assert.equal(sql("SELECT count(*) FROM public.mobility_stage_g116_commission_audit"+
   " WHERE owner_id='"+owner+"'"),'5');
  assert.equal(sql("SELECT count(*) FROM public.mobility_stage_g116_commission_policy"+
   " WHERE service_kind IN ('DELIVERY_AUTO','DELIVERY_MOTO','COMMERCE')"+
   " AND version=2"),'3');
  assert.equal((await B.read('AUTO_RIDE')).data.subsidyBps,1000);
  assert.equal((await B.read('MOTO_RIDE')).data.subsidyBps,1000);
  console.log('G136 Owner cross-service PASS: B Admin -> A AAL2 HTTP -> original PostgreSQL16 policies and audit for AUTO/MOTO passengers, AUTO/MOTO cargo, COMMERCE; immutable passenger subsidy, no commercial settlement.');
  console.log('G117 CROSS-BRANCH PASS: B Owner web gateway HTTPS-pinned -> A Owner JWT/AAL2 HTTP localhost -> REAL PG16 G116 commission AUTO 18->20 and MOTO 12->14; unchanged 10% subsidy, audit exactly 2, replay idempotent, Admin/revoked denied; no live.');
 }finally{
  server.close();if(server.listening)await once(server,'close');
 }
}
await main();

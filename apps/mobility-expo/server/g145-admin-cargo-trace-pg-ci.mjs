/**
 * G145: original G122 consented AUTO/MOTO cargo through A Admin HTTP and
 * the SAME disposable PostgreSQL16, never synthetic "already delivered".
 * This does not activate a merchant checkout, courier GPS, payment or LIVE.
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createG145AdminCargoTraceGateway} from './g145-admin-cargo-trace-gateway.mjs';
import {createQoreRadarLoopbackTransport,listenQoreRadarLoopback}
 from './g4-loopback-http-transport.mjs';
if(process.env.CI!=='true'||process.env.PGHOST!=='localhost'||
 process.env.PGPORT!=='5432'||process.env.PGDATABASE!=='qore_disposable_chain'||
 process.env.PGAPPNAME!=='qore_ci_disposable_chain')
 throw Error('G145 only in disposable CI PostgreSQL16');
// G27 Admin is a SEPARATE exclusive backoffice identity from the G122
// native QA tariff approver; dual native roles must remain forbidden.
const tariffApprover='12200000-0000-4122-8122-000000000001';
const admin='14500000-0000-4145-8145-000000000002';
const senders=['12200000-0000-4122-8122-000000000011',
 '12200000-0000-4122-8122-000000000012'];
const session='14500000-0000-4145-8145-000000000001';
const token='g145-private-backoffice-token-qa-00000000000001';
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
let now=Date.now(),revoked=false,mfaEnabled=true,roleOverride=null,sourceCalls=0;
const noop=async()=>({status:404,body:{error:'Not found'}});
function sql(statement){
 return execFileSync('psql',['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-c',statement],{
  encoding:'utf8',timeout:12000,maxBuffer:1000000,
  stdio:['ignore','pipe','pipe']
 }).trim().split('\n').at(-1)?.trim()??'';
}
const read=s=>JSON.parse(sql(s));
assert.equal(sql("SELECT (to_regprocedure('public.mobility_stage_g145_delivery_trace_qa(uuid,uuid)') IS NOT NULL)::text"),'true');
assert.equal(sql("SELECT (has_function_privilege('anon','public.mobility_stage_g145_delivery_trace_qa(uuid,uuid)','EXECUTE') OR has_function_privilege('authenticated','public.mobility_stage_g145_delivery_trace_qa(uuid,uuid)','EXECUTE'))::text"),'false');
// G145 SQL is intentionally read-only. The disposable test's privileged
// setup seeds an independent G27 authority, never a native admin role.
sql("INSERT INTO auth.users(id) VALUES ('"+admin+"') ON CONFLICT DO NOTHING");
sql("INSERT INTO public.mobility_stage_backoffice_roles("+
 "user_id,role,status,approved_by) VALUES ('"+admin+"','admin','active','"+
 tariffApprover+"') ON CONFLICT DO NOTHING");
assert.equal(sql("SET ROLE service_role; SELECT public.mobility_stage_g27_backoffice_role_of('"+admin+"')::text"),'admin');
const rows=read("SELECT COALESCE(jsonb_agg(jsonb_build_object("+
 "'id',d.id,'key',d.request_key,'kind',d.requested_vehicle_kind,"+
 "'quoteId',c.quote_id) ORDER BY d.requested_vehicle_kind),'[]'::jsonb) "+
 "FROM public.mobility_stage_deliveries d "+
 "JOIN public.mobility_stage_g122_delivery_price_consents c "+
 "ON c.delivery_id=d.id AND c.sender_id=d.sender_id "+
 "WHERE d.sender_id IN ('"+senders.join("','")+"')");
assert.equal(rows.length,2,'G122 must persist both original consents');
const found=new Set(rows.map(r=>r.kind));
assert.deepEqual([...found].sort(),['AUTO','MOTO']);
for(const r of rows)assert([r.id,r.key,r.quoteId].every(x=>UUID.test(x)));
const gateway=createG145AdminCargoTraceGateway({
 environment:'isolated_staging',qaOnly:true,liveEnabled:false,
 now:()=>now,
 verifyAccessToken:async bearer=>{
  if(bearer!==token)throw Error('IdP rejected');
  return {id:admin,sessionId:session,expiresAtMs:now+60000,
   is_anonymous:false};
 },
 verifySessionNotRevoked:async()=>!revoked,
 loadExclusiveBackofficeRole:async id=>{
  if(id!==admin)return null;
  return roleOverride??sql("SET ROLE service_role; SELECT public.mobility_stage_g27_backoffice_role_of('"+admin+"')::text");
 },
 verifyBackofficeMfa:async({userId,sessionId})=>({
  verifiedByProvider:mfaEnabled,assuranceLevel:'aal2',userId,sessionId,
  verifiedAtMs:now-1000,expiresAtMs:now+30000
 }),
 allowRequest:()=>true,
 loadCargoTraceReceipt:async({actorId,deliveryId})=>{
  sourceCalls++;
  if(actorId!==admin||!UUID.test(deliveryId))
   throw Error('G145 attempted unverified SQL scope');
  const raw=sql("SET ROLE service_role; SELECT "+
   "public.mobility_stage_g145_delivery_trace_qa('"+actorId+"','"+
   deliveryId+"')::text");
  return raw?JSON.parse(raw):null;
 }
});
const server=createQoreRadarLoopbackTransport({
 riderHandler:noop,offerHandler:noop,tripCommandHandler:noop,
 deliveryHandler:noop,merchantHandler:noop,financeHandler:noop,
 safetyHandler:noop,merchantManagementHandler:noop,deliveryOfferHandler:noop,
 adminCargoTraceHandler:gateway
});
async function request(origin,path,{bearer=token,method='GET',body}={}){
 const res=await fetch(origin+path,{method,headers:{
  ...(bearer?{authorization:'Bearer '+bearer}:{}),
  ...(body?{'content-type':'application/json'}:{})
 },...(body?{body:JSON.stringify(body)}:{})});
 return {status:res.status,body:await res.json()};
}
const origin=await listenQoreRadarLoopback(server);
try{
 for(const row of rows){
  const kind=row.kind==='MOTO'?'DELIVERY_MOTO':'DELIVERY_AUTO';
  const path='/v1/staging/admin/services/'+kind+'/'+row.id+'/trace';
  const out=await request(origin,path);
  assert.equal(out.status,200,JSON.stringify(out.body));
  const d=out.body;
  assert.equal(d.serviceId,row.id);
  assert.equal(d.serviceKind,kind);
  assert.equal(d.quoteId,row.quoteId,'never invent pre-quote identifier');
  assert.equal(d.bookingRequestKey,row.key);
  assert.equal(d.status,'requested');
  assert.equal(d.revision,1);
  assert.equal(d.assignment.state,'NOT_ASSIGNABLE');
  assert.equal(d.assignment.legalGate,'G38_BLOCKED');
  assert.equal(d.ledger,null,'persisted quote is not payment or balanced settlement');
  assert.equal(d.events.length,1);
  assert.equal(d.events[0].status,'requested');
  assert.equal(d.events[0].serviceId,row.id);
  assert.equal(d.serverPersisted,true);
  assert.equal(d.productionEnabled,false);
  const wrongKind=kind==='DELIVERY_AUTO'?'DELIVERY_MOTO':'DELIVERY_AUTO';
  assert.equal((await request(origin,path.replace(kind,wrongKind))).status,503,
   'vehicle kind must be derived from original SQL only');
  assert.equal((await request(origin,path,{bearer:null})).status,401);
  assert.equal((await request(origin,path,{bearer:'x'.repeat(40)})).status,401);
  const prev=sourceCalls;revoked=true;
  assert.equal((await request(origin,path)).status,401);
  assert.equal(sourceCalls,prev,'revoked session cannot even touch SQL');
  revoked=false;mfaEnabled=false;
  assert.equal((await request(origin,path)).status,403);
  assert.equal(sourceCalls,prev);
  mfaEnabled=true;roleOverride='owner';
  assert.equal((await request(origin,path)).status,403);
  assert.equal(sourceCalls,prev);
  roleOverride=null;
  assert.equal((await request(origin,path,{method:'POST',body:{}})).status,404);
  console.log('G145 '+kind+' original G5 request/G122 quote consent -> G145 SQL -> G4 HTTP Admin AAL2 trace, same serviceId and quoteId, no invented ledger, foreign/revoked denied');
 }
 console.log('G145 PASS: two original price-consented cargo services, source-backed PostgreSQL, not a delivery completion or PSP');
} finally{
 await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
}

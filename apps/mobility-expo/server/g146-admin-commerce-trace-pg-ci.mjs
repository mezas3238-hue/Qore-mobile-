/** G146: ORIGINAL G139 Client B -> A HTTP -> G45 PostgreSQL order -> D Admin
 * same orderId/requestKey with no fabricated quote, payment or delivery.
 * Disposable PG16 only. Provider authority is isolated QA fixture.
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createG146AdminCommerceTraceGateway}
 from './g146-admin-commerce-trace-gateway.mjs';
import {createQoreRadarLoopbackTransport,listenQoreRadarLoopback}
 from './g4-loopback-http-transport.mjs';
import {createServiceTraceGateway}
 from '../../movete-admin/src/service-trace-gateway.mjs';
if(process.env.CI!=='true'||process.env.PGHOST!=='localhost'||
 process.env.PGPORT!=='5432'||process.env.PGDATABASE!=='qore_disposable_chain'||
 process.env.PGAPPNAME!=='qore_ci_disposable_chain')
 throw Error('G146 refuses non-disposable PostgreSQL16');
const admin='14600000-0000-4146-8146-000000000002';
const session='14600000-0000-4146-8146-000000000003';
const requestKey='13800000-0000-4138-8138-000000000201';
const token='g146-admin-private-aal2-ci-bearer-00000000000000001';
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const noop=async()=>({status:404,body:{error:'Not found'}});
function sql(statement){
 return execFileSync('psql',['-X','-q','-A','-t','-v','ON_ERROR_STOP=1',
  '-c',statement],{encoding:'utf8',timeout:12000,maxBuffer:1000000,
  stdio:['ignore','pipe','pipe']}).trim().split('\n').at(-1)?.trim()??'';
}
const decode=statement=>JSON.parse(sql(statement));
assert.equal(sql("SELECT (to_regprocedure('public.mobility_stage_g146_commerce_trace_qa(uuid,uuid)') IS NOT NULL)::text"),'true');
assert.equal(sql("SELECT (has_function_privilege('authenticated','public.mobility_stage_g146_commerce_trace_qa(uuid,uuid)','EXECUTE') OR has_function_privilege('anon','public.mobility_stage_g146_commerce_trace_qa(uuid,uuid)','EXECUTE'))::text"),'false');
const stockBeforeAdminRead=sql("SELECT stock_units FROM public.mobility_stage_catalog_items WHERE id='13800000-0000-4138-8138-000000000040'");
const existing=decode("SELECT jsonb_build_object('id',o.id,'key',r.request_key,'status',o.status,'revision',o.revision,'subtotal',o.subtotal_pyg,'branchId',o.branch_id,'vehicleKind',o.requested_vehicle_kind) "+
 "FROM public.mobility_stage_merchant_orders o "+
 "JOIN public.mobility_stage_g45_order_receipts r ON r.order_id=o.id "+
 "WHERE r.request_key='"+requestKey+"'");
assert(uuid.test(existing.id)&&existing.status==='cancelled'&&
 existing.revision===2&&existing.subtotal===25000,
 'Original G139 Buyer reserve/cancel must persist in the SAME PG16 run');
sql("INSERT INTO auth.users(id) VALUES ('"+admin+"') ON CONFLICT DO NOTHING");
sql("DELETE FROM public.user_roles WHERE user_id='"+admin+"'");
sql("INSERT INTO public.mobility_stage_backoffice_roles(user_id,role,status,approved_by) "+
 "VALUES ('"+admin+"','admin','active','12200000-0000-4122-8122-000000000001') "+
 "ON CONFLICT DO NOTHING");
assert.equal(sql("SET ROLE service_role; SELECT public.mobility_stage_g27_backoffice_role_of('"+admin+"')::text"),'admin');
let revoked=false,mfa=true,role='admin',reads=0;
const trust={
 environment:'isolated_staging',qaOnly:true,liveEnabled:false,
 now:()=>Date.now(),
 verifyAccessToken:async bearer=>{
  if(bearer!==token)throw Error('Bad IdP');
  return {id:admin,sessionId:session,expiresAtMs:Date.now()+60000,
   is_anonymous:false};
 },
 verifySessionNotRevoked:async()=>!revoked,
 loadExclusiveBackofficeRole:async userId=>{
  if(userId!==admin)return null;
  return role==='admin'?sql("SET ROLE service_role; SELECT public.mobility_stage_g27_backoffice_role_of('"+admin+"')::text"):role;
 },
 verifyBackofficeMfa:async({userId,sessionId})=>({
  verifiedByProvider:mfa,assuranceLevel:'aal2',userId,sessionId,
  verifiedAtMs:Date.now()-1000,expiresAtMs:Date.now()+30000
 }),
 allowRequest:()=>true,
 loadCommerceTraceReceipt:async({actorId,orderId})=>{
  reads++;
  if(actorId!==admin||!uuid.test(orderId))
   throw Error('G146 identity or SQL scope invalid');
  return decode("SET ROLE service_role; SELECT COALESCE("+
   "public.mobility_stage_g146_commerce_trace_qa('"+actorId+"','"+
   orderId+"'),'null'::jsonb)::text");
 }
};
const gateway=createG146AdminCommerceTraceGateway(trust);
const server=createQoreRadarLoopbackTransport({
 riderHandler:noop,offerHandler:noop,tripCommandHandler:noop,
 deliveryHandler:noop,merchantHandler:noop,financeHandler:noop,
 safetyHandler:noop,merchantManagementHandler:noop,deliveryOfferHandler:noop,
 adminCommerceTraceHandler:gateway
});
const base=await listenQoreRadarLoopback(server);
const path='/v1/staging/admin/services/COMMERCE/'+existing.id+'/trace';
const http=async(uri,{bearer=token}={})=>{
 const res=await fetch(base+uri,{headers:bearer?{authorization:'Bearer '+bearer}:{}});
 return {status:res.status,body:await res.json()};
};
try{
 const result=await http(path);
 assert.equal(result.status,200,JSON.stringify(result.body));
 const d=result.body;
 assert.equal(d.serviceId,existing.id);
 assert.equal(d.bookingRequestKey,requestKey);
 assert.equal(d.quoteId,null,'G45 stock reservation does NOT mint G7 quote');
 assert.equal(d.branchId,existing.branchId);
 assert.equal(d.vehicleKind,existing.vehicleKind);
 assert.equal(d.orderSubtotalGs,existing.subtotal,'G45 original catalog subtotal only');
 assert.equal(d.status,'cancelled');
 assert.equal(d.revision,2);
 assert.equal(d.events.length,2);
 assert.deepEqual(d.events.map(e=>[e.sequence,e.status]),
  [[1,'requested'],[2,'cancelled']]);
 assert(d.events.every(e=>e.serviceId===existing.id));
 assert.equal(d.assignment.state,'NOT_ASSIGNABLE');
 assert.equal(d.ledger,null,'stock reservation is NOT a paid ledger');
 assert.equal(d.productionEnabled,false);
 const origin='https://qore-g146-ci.onrender.com';
 const dExpires=Date.now()+60000;
 const dClient=createServiceTraceGateway({
  enabled:true,contractCertified:true,origin,pinnedOrigin:origin,
  getSession:async()=>({role:'admin',mfaVerified:true,subject:admin,
   authRevision:1,token,expiresAt:dExpires}),
  fetchImpl:(url,opts)=>{
   const u=new URL(url);
   assert.equal(u.origin,origin);
   assert.equal(u.pathname,path);
   assert.equal(opts.method,'GET');
   return fetch(base+u.pathname,{...opts,redirect:'error'});
  }
 });
 const ui=await dClient.read('COMMERCE',existing.id);
 assert.equal(ui.ok,true,JSON.stringify(ui));
 assert.equal(ui.data.serviceId,existing.id);
 assert.equal(ui.data.quoteId,null);
 assert.equal(ui.data.branchId,existing.branchId);
 assert.equal(ui.data.vehicleKind,existing.vehicleKind);
 assert.equal(ui.data.orderSubtotalGs,existing.subtotal);
 assert.equal(ui.data.ledger,null);
 assert.equal(ui.data.events.length,2);
 const before=reads;
 assert.equal((await http(path,{bearer:null})).status,401);
 assert.equal((await http(path,{bearer:'x'.repeat(40)})).status,401);
 revoked=true;assert.equal((await http(path)).status,401);revoked=false;
 mfa=false;assert.equal((await http(path)).status,403);mfa=true;
 role='owner';assert.equal((await http(path)).status,403);role='admin';
 assert.equal(reads,before,'denied identities cannot query PG');
 assert.equal((await http(path.replace('COMMERCE','AUTO_RIDE'))).status,503);
 assert.equal((await http(path.replace(existing.id,'ffffffff-ffff-4fff-8fff-ffffffffffff'))).status,404);
 assert.equal(sql("SELECT stock_units FROM public.mobility_stage_catalog_items WHERE id='13800000-0000-4138-8138-000000000040'"),stockBeforeAdminRead,
  'Admin GET must never reserve stock or alter the G139 cancellation');
 console.log('G146 PASS: ORIGINAL G139 Buyer order / G45 PostgreSQL requestKey and orderId -> A HTTP -> D Admin, no fake quote/ledger, AAL2/revocation/foreign blocked');
}finally{
 await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
}

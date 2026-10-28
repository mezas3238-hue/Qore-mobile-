/** G156: ORIGINAL Client G139 / Merchant G148 / linked G150 -> staff inbox. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createG156MerchantInboxGateway} from './g156-merchant-inbox-gateway.mjs';
import {createQoreRadarLoopbackTransport,listenQoreRadarLoopback}
 from './g4-loopback-http-transport.mjs';
if(process.env.CI!=='true'||process.env.PGHOST!=='localhost'||
 process.env.PGPORT!=='5432'||process.env.PGDATABASE!=='qore_disposable_chain'||
 process.env.PGAPPNAME!=='qore_ci_disposable_chain')
 throw Error('G156 only in disposable PG16 CI');
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const seller='13800000-0000-4138-8138-000000000002';
const buyer='13800000-0000-4138-8138-000000000001';
const merchant='13800000-0000-4138-8138-000000000020';
const key='13800000-0000-4138-8138-000000000242';
const session='15600000-0000-4156-8156-000000000001';
const otherSession='15600000-0000-4156-8156-000000000002';
const token='g156-merchant-verified-provider-token-0000000000001';
const otherToken='g156-buyer-verified-provider-token-00000000000002';
const at=Date.now()-60000;
const qs=x=>"'"+x+"'";
const sql=s=>execFileSync('psql',['-X','-q','-A','-t',
 '-v','ON_ERROR_STOP=1','-c',s],{encoding:'utf8',timeout:15000,
 maxBuffer:1000000,stdio:['ignore','pipe','pipe']})
 .trim().split('\n').at(-1)?.trim()??'';
const read=s=>JSON.parse(sql(s));
const source=read("SELECT jsonb_build_object('id',id,'branch',branch_id,"+
 "'delivery',delivery_id,'state',status,'rev',revision,'total',subtotal_pyg) "+
 "FROM public.mobility_stage_merchant_orders WHERE request_key="+qs(key));
assert(UUID.test(source.id));assert(UUID.test(source.delivery));
assert.equal(source.state,'ready');assert.equal(source.rev,5);
assert.equal(source.total,25000);
for(const [actor,sid] of [[seller,session],[buyer,otherSession]]){
 sql("INSERT INTO public.mobility_stage_g42_provider_session_grants("+
 "user_id,session_id,provider_confirmed_at,token_allowed_from,valid_until,evidence_kind) "+
 "VALUES("+qs(actor)+","+qs(sid)+",clock_timestamp()-interval '1 hour',"+
 "clock_timestamp()-interval '2 minutes',clock_timestamp()+interval '1 hour',"+
 "'QA_SYNTHETIC_PROVIDER_SESSION_ONLY')");
}
const active=(actor,sid)=>sql("SELECT public.mobility_stage_g42_session_active("+
 qs(actor)+","+qs(sid)+","+at+")::text")==='true';
const inbox=createG156MerchantInboxGateway({
 environment:'isolated_staging',qaOnly:true,liveEnabled:false,
 verifyAccessToken:async t=>{
  const n=t===token?0:t===otherToken?1:-1;
  if(n<0)throw Error('Invalid bearer');
  return {id:n===0?seller:buyer,sessionId:n===0?session:otherSession,
   tokenIatMs:at,expiresAtMs:Date.now()+60000,is_anonymous:false};
 },
 verifySessionNotRevoked:async({userId,sessionId})=>active(userId,sessionId),
 allowRequest:()=>true,
 loadInbox:async({actorId,merchantId,sessionId,tokenIatMs})=>{
  if(![actorId,merchantId,sessionId].every(v=>UUID.test(v))||
   !Number.isSafeInteger(tokenIatMs))throw Error('Invalid SQL projection');
  return read("SET ROLE service_role; SELECT "+
   "public.mobility_stage_g156_merchant_inbox_qa("+
   [actorId,merchantId,sessionId].map(qs).join(',')+","+tokenIatMs+")::text");
 }
});
const noop=async()=>({status:404,body:{error:'unavailable'}});
const server=createQoreRadarLoopbackTransport({
 riderHandler:noop,offerHandler:noop,tripCommandHandler:noop,
 deliveryHandler:noop,merchantHandler:noop,financeHandler:noop,
 safetyHandler:noop,merchantManagementHandler:noop,
 deliveryOfferHandler:noop,merchantInboxHandler:inbox
});
const origin=await listenQoreRadarLoopback(server);
const path='/v1/staging/merchant/'+merchant+'/orders/inbox';
async function get(bearer,requestPath=path){
 const r=await fetch(origin+requestPath,{method:'GET',redirect:'error',
  headers:{authorization:'Bearer '+bearer}});
 assert.equal(r.headers.get('cache-control'),'private, no-store, max-age=0');
 return {status:r.status,body:await r.json()};
}
try{
 const result=await get(token);
 assert.equal(result.status,200,JSON.stringify(result.body));
 assert.equal(result.body.merchantId,merchant);
 assert.equal(result.body.liveCommerceEnabled,false);
 const order=result.body.orders.find(o=>o.orderId===source.id);
 assert(order,JSON.stringify(result.body));
 assert.equal(order.branchId,source.branch);
 assert.equal(order.deliveryId,source.delivery);
 assert.equal(order.status,'ready');
 assert.equal(order.revision,5);
 assert.equal(order.subtotalPyg,25000);
 assert.equal(order.vehicleKind,'MOTO');
 assert.equal(order.lineCount,1);assert.equal(order.itemUnits,2);
 assert(!JSON.stringify(result.body).includes(buyer),'Inbox must not leak buyer identity');
 assert.deepEqual((await get(token)).body.orders,result.body.orders);
 assert.equal((await get(otherToken)).status,403,'Buyer cannot access staff');
 assert.equal((await get(token,
  '/v1/staging/merchant/15600000-0000-4156-8156-000000000020/orders/inbox')).status,403,
  'Other merchant ID must not leak records');
 assert.equal((await get('bad-merchant-bearer-provider-00000000000000')).status,401);
 assert.equal((await get(token,path+'?limit=200')).status,404);
 assert.equal(sql("SELECT has_function_privilege('authenticated',"+
  "'public.mobility_stage_g156_merchant_inbox_qa(uuid,uuid,uuid,bigint)',"+
  "'EXECUTE')::text"),'false');
 sql("UPDATE public.mobility_stage_g42_provider_session_grants "+
  "SET revoked_at=clock_timestamp(),revision=revision+1 "+
  "WHERE user_id="+qs(seller)+" AND session_id="+qs(session));
 assert.equal((await get(token)).status,401,'G42 revoked session denied');
 assert.equal(sql("SELECT status FROM public.mobility_stage_merchant_orders WHERE id="+qs(source.id)),'ready');
 console.log('G156 PASS: real original B/G139 order -> G148 prepared -> G150 priced-linked -> G42 staff private inbox HTTP PG16 exact branch/weight/price/revision; Buyer, foreign merchant, revoked and public SQL denied; no LIVE/PSP.');
}finally{
 await new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve()));
}

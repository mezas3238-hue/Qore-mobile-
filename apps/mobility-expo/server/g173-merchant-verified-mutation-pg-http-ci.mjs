/** G173 real PG16 source: G139 Buyer -> G148 merchant original event,
 * G42 grant -> G173 atomic replay -> HTTP verified staff -> G6 same row.
 * No fabricated order, identity, payment, courier, or commercial go-live.
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createG173MerchantVerifiedMutationGateway}
 from './g173-merchant-verified-mutation-gateway.mjs';
import {createQoreRadarLoopbackTransport,listenQoreRadarLoopback}
 from './g4-loopback-http-transport.mjs';
if(process.env.CI!=='true'||process.env.PGHOST!=='localhost'||
 process.env.PGPORT!=='5432'||process.env.PGDATABASE!=='qore_disposable_chain'||
 process.env.PGAPPNAME!=='qore_ci_disposable_chain')
 throw Error('G173 only in disposable PG16 CI');
const seller='13800000-0000-4138-8138-000000000002';
const session='17300000-0000-4173-8173-000000000001';
const token='g173-independently-verified-staff-provider-token-0000001';
const foreign='g173-foreign-staff-provider-token-000000000000002';
const now=Date.now(),iat=now-60000;
const qs=x=>"'"+x+"'";
const sql=q=>execFileSync('psql',['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-c',q],{
 encoding:'utf8',timeout:15000,maxBuffer:1000000,stdio:['ignore','pipe','pipe']
}).trim().split('\n').at(-1)?.trim()??'';
const read=q=>JSON.parse(sql(q));
const source=read("SELECT jsonb_build_object('order',o.id,'status',o.status,"+
 "'revision',o.revision,'event',e.id,'key',e.request_key,'actor',e.actor_id) "+
 "FROM public.mobility_stage_merchant_orders o "+
 "JOIN public.mobility_stage_merchant_order_events e ON e.order_id=o.id "+
 "AND e.action='ready' WHERE o.request_key='13800000-0000-4138-8138-000000000242'");
assert.equal(source.actor,seller);
assert(['ready','handed_to_courier','delivered'].includes(source.status));
const count=()=>Number(sql("SELECT count(*) FROM public.mobility_stage_merchant_order_events "+
 "WHERE order_id="+qs(source.order)));
const before=count();
sql("INSERT INTO public.mobility_stage_g42_provider_session_grants("+
 "user_id,session_id,provider_confirmed_at,token_allowed_from,valid_until,evidence_kind) "+
 "VALUES("+qs(seller)+","+qs(session)+",clock_timestamp()-interval '1 hour',"+
 "clock_timestamp()-interval '2 minutes',clock_timestamp()+interval '1 hour',"+
 "'QA_SYNTHETIC_PROVIDER_SESSION_ONLY')");
const active=()=>sql("SELECT public.mobility_stage_g42_session_active("+
 qs(seller)+","+qs(session)+","+iat+")::text")==='true';
assert(active());
assert.equal(sql("SELECT has_function_privilege('authenticated',"+
 "'public.mobility_stage_g173_merchant_transition_qa(uuid,uuid,bigint,uuid,text,uuid)',"+
 "'EXECUTE')::text"),'false');
assert.equal(sql("SELECT has_function_privilege('authenticated',"+
 "'public.mobility_stage_g173_merchant_attach_qa(uuid,uuid,bigint,uuid,uuid,uuid)',"+
 "'EXECUTE')::text"),'false');
let calls=0;
const trusted=createG173MerchantVerifiedMutationGateway({
 environment:'isolated_staging',qaOnly:true,liveEnabled:false,now:()=>Date.now(),
 verifyAccessToken:async bearer=>{
  if(bearer!==token)throw Error('Foreign original account');
  return {id:seller,sessionId:session,tokenIatMs:iat,
   expiresAtMs:Date.now()+60000,is_anonymous:false};
 },
 verifySessionNotRevoked:async()=>active(),
 allowRequest:()=>true,
 legacyGateway:async()=>({status:503,body:{error:'Legacy path inaccessible'}}),
 runMutation:async x=>{
  calls++;
  const name=x.kind==='transition'?
   'mobility_stage_g173_merchant_transition_qa':
   'mobility_stage_g173_merchant_attach_qa';
  const fields=x.kind==='transition'?
   [x.actorId,x.sessionId,x.tokenIatMs,x.orderId,x.event,x.eventKey]:
   [x.actorId,x.sessionId,x.tokenIatMs,x.orderId,x.deliveryId,x.requestKey];
  const qfields=fields.map(x=>typeof x==='number'?String(x):qs(x)).join(',');
  return sql("SET ROLE service_role; SELECT public."+name+"("+qfields+")::text");
 }
});
const noop=async()=>({status:404,body:{error:'not configured'}});
const server=createQoreRadarLoopbackTransport({
 riderHandler:noop,offerHandler:noop,tripCommandHandler:noop,
 deliveryHandler:noop,merchantHandler:trusted,financeHandler:noop,
 safetyHandler:noop,merchantManagementHandler:noop,deliveryOfferHandler:noop
});
const origin=await listenQoreRadarLoopback(server);
const path='/v1/staging/merchant/orders/'+source.order+'/transition';
async function post(bearer,event='ready',requestKey=source.key){
 const response=await fetch(origin+path,{method:'POST',redirect:'error',
  headers:{authorization:'Bearer '+bearer,'content-type':'application/json'},
  body:JSON.stringify({event,eventKey:requestKey})});
 return {status:response.status,body:await response.json()};
}
try{
 assert.equal((await post(foreign)).status,401);
 assert.equal(calls,0);
 const first=await post(token);
 assert.equal(first.status,200,JSON.stringify(first.body));
 assert.equal(first.body.eventId,source.event);
 assert.equal(first.body.orderId,source.order);
 assert.equal(first.body.serverPersisted,true);
 assert.equal(first.body.liveCommerceEnabled,false);
 assert.equal((await post(token)).body.eventId,source.event);
 assert.equal(count(),before,'Lost ACK replay must not mint a second event');
 assert.equal(sql('SELECT revision FROM public.mobility_stage_merchant_orders WHERE id='+qs(source.order)),
  String(source.revision));
 assert.equal((await post(token,'cancel',source.key)).status,400);
 assert.equal((await post(token,'ready','17300000-0000-4173-8173-000000000099')).status,409,
  'Current merchant state cannot be advanced twice');
 assert.equal(count(),before);
 // Staff suspension is immediately effective even for a previously
 // committed immutable requestKey. G173 locks the source membership row.
 const merchant=sql("SELECT merchant_id FROM public.mobility_stage_merchant_orders WHERE id="+qs(source.order));
 sql("UPDATE public.mobility_stage_merchant_staff SET active=false "+
  "WHERE user_id="+qs(seller)+" AND merchant_id="+qs(merchant));
 assert.equal((await post(token)).status,409,'Former staff cannot replay original event');
 assert.equal(count(),before);
 sql("UPDATE public.mobility_stage_merchant_staff SET active=true "+
  "WHERE user_id="+qs(seller)+" AND merchant_id="+qs(merchant));
 sql("UPDATE public.mobility_stage_g42_provider_session_grants "+
 "SET revoked_at=clock_timestamp(),revision=revision+1 "+
 "WHERE user_id="+qs(seller)+" AND session_id="+qs(session));
 assert.equal((await post(token)).status,401);
 assert.equal(count(),before);
 // Even a previously accepted G148 request key must fail at the SQL row lock
 // once the source grant is revoked.
 assert.throws(()=>sql("SET ROLE service_role; SELECT public."+
  "mobility_stage_g173_merchant_transition_qa("+
  [seller,session].map(qs).join(',')+","+iat+","+qs(source.order)+
  ",'ready',"+qs(source.key)+")"),/P1731|verified merchant session denied/);
 assert.equal(count(),before);
 console.log('G173 PASS: ORIGINAL G139/G148 merchant event immutable via real G42 transactional PostgreSQL and authenticated HTTP. Foreign, revocation, invalid state, replay and public SQL denied; no LIVE/PSP.');
}finally{
 await new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve()));
}

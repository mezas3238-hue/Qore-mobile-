/** G155 original completed AUTO + delivered MOTO cargo -> authenticated
 *  two-sided verified ratings through A HTTP to same PostgreSQL16.
 *  Commerce pending and unsigned delivery are NEVER rateable.
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createG155VerifiedRatingGateway} from './g155-verified-rating-gateway.mjs';
import {createG155VerifiedRatingClient}
 from '../../movete-cliente/src/domain/g155-verified-rating-client.mjs';
import {createQoreRadarLoopbackTransport,listenQoreRadarLoopback}
 from './g4-loopback-http-transport.mjs';
if(process.env.CI!=='true'||process.env.PGHOST!=='localhost'||
 process.env.PGPORT!=='5432'||process.env.PGDATABASE!=='qore_disposable_chain'||
 process.env.PGAPPNAME!=='qore_ci_disposable_chain')
 throw Error('G155 CI only in disposable PostgreSQL16');
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const autoBuyer='10900000-0000-4109-8109-000000000021';
const autoDriver='10900000-0000-4109-8109-000000000022';
const cargoBuyer='88888888-8888-4888-8888-888888888888';
const cargoCourier='11111111-1111-4111-8111-111111111111';
const commerceBuyer='13800000-0000-4138-8138-000000000001';
const ids=[autoBuyer,autoDriver,cargoBuyer,cargoCourier,commerceBuyer];
const key=n=>'15500000-0000-4154-8154-'+String(n).padStart(12,'0');
const tokens=ids.map((_,i)=>'g155-private-confirmed-g42-ci-token-0000000000000'+i);
const sessions=ids.map((_,i)=>key(100+i));
const iat=Date.now()-60000;
const sql=s=>execFileSync('psql',['-X','-q','-A','-t',
 '-v','ON_ERROR_STOP=1','-c',s],{encoding:'utf8',timeout:15000,
  maxBuffer:1000000,stdio:['ignore','pipe','pipe']}).trim().split('\n').at(-1)?.trim()??'';
const qs=x=>"'"+x+"'";
const read=s=>JSON.parse(sql(s));
const autoTrip=sql("SELECT id FROM public.mobility_stage_auto_demo_trips "+
 "WHERE request_key='10900000-0000-4109-8109-000000000023' AND status='completed'");
const motoDelivery=sql("SELECT id FROM public.mobility_stage_deliveries "+
 "WHERE request_key='51000000-0000-4000-8000-000000000003' AND status='delivered'");
const commerceOrder=sql("SELECT id FROM public.mobility_stage_merchant_orders "+
 "WHERE request_key='13800000-0000-4138-8138-000000000242'");
assert(UUID.test(autoTrip),'G109 real completed AUTO must exist');
assert(UUID.test(motoDelivery),'G5 delivered cargo with custody proof must exist');
assert(UUID.test(commerceOrder),'G150 original non-delivered commerce must exist');
for(let i=0;i<ids.length;i++){
 assert.equal(sql("SELECT count(*) FROM public.user_roles WHERE user_id="+qs(ids[i])),'1');
 sql("INSERT INTO public.mobility_stage_g42_provider_session_grants("+
  "user_id,session_id,provider_confirmed_at,token_allowed_from,valid_until,evidence_kind) "+
  "VALUES("+qs(ids[i])+","+qs(sessions[i])+",clock_timestamp()-interval '1 hour',"+
  "clock_timestamp()-interval '2 minutes',clock_timestamp()+interval '1 hour',"+
  "'QA_SYNTHETIC_PROVIDER_SESSION_ONLY')");
}
let revoked=false;
const verified=async bearer=>{
 const i=tokens.indexOf(bearer);
 if(i<0)throw Error('Unknown provider token');
 return {id:ids[i],sessionId:sessions[i],tokenIatMs:iat,
  expiresAtMs:Date.now()+300000,is_anonymous:false};
};
const gateway=createG155VerifiedRatingGateway({
 environment:'isolated_staging',qaOnly:true,liveEnabled:false,
 verifyAccessToken:verified,
 verifySessionNotRevoked:async({userId,sessionId})=>
  !revoked&&ids.some((id,i)=>id===userId&&sessions[i]===sessionId),
 allowRequest:()=>true,
 submitRating:async p=>{
  if(!UUID.test(p.reviewerId)||!UUID.test(p.sessionId)||!UUID.test(p.requestKey)
   ||!UUID.test(p.serviceId)||!Number.isSafeInteger(p.stars)||
   !Number.isSafeInteger(p.tokenIatMs)||
   !(p.incidentCode===null||/^[A-Z_]+$/.test(p.incidentCode)))
   throw Error('Malformed SQL projection');
  const result=read("SET ROLE service_role; SELECT "+
   "public.mobility_stage_g155_submit_rating_qa("+
   [p.reviewerId,p.sessionId].map(qs).join(',')+","+
   p.tokenIatMs+","+qs(p.requestKey)+","+qs(p.serviceKind)+","+
   qs(p.serviceId)+","+qs(p.ratedKind)+","+p.stars+","+
   (p.incidentCode===null?'NULL':qs(p.incidentCode))+")::text");
  return result;
 }
});
const noop=async()=>({status:404,body:{error:'unavailable'}});
const server=createQoreRadarLoopbackTransport({
 riderHandler:noop,offerHandler:noop,tripCommandHandler:noop,
 deliveryHandler:noop,merchantHandler:noop,financeHandler:noop,
 safetyHandler:noop,merchantManagementHandler:noop,
 deliveryOfferHandler:noop,ratingHandler:gateway
});
const base=await listenQoreRadarLoopback(server);
const path='/v1/staging/reputation/ratings';
const payload=(serviceKind,serviceId,ratedKind,stars,requestKey,incidentCode=null)=>
 ({requestKey,serviceKind,serviceId,ratedKind,stars,incidentCode});
async function send(i,body,token=tokens[i]){
 const r=await fetch(base+path,{method:'POST',redirect:'error',
  headers:{authorization:'Bearer '+token,'content-type':'application/json'},
  body:JSON.stringify(body)});
 return {status:r.status,body:await r.json()};
}
try{
 const ride=payload('AUTO_RIDE',autoTrip,'DRIVER',5,key(1));
 // Execute the REAL Buyer B HTTP gateway against the same A / PostgreSQL row.
 const origin='https://g155-ci-qore.onrender.com',expiresAt=Date.now()+90000;
 const buyerClient=createG155VerifiedRatingClient({
  enabled:true,ownerApproved:true,contractVerified:true,
  originalCompletionVerified:true,externalRuntimeVerified:true,
  providerRevocationVerified:true,origin,pinnedOrigin:origin,
  getSession:async()=>({role:'passenger',subject:autoBuyer,
   token:tokens[0],expiresAt}),
  fetchImpl:(url,opts)=>{
   const u=new URL(url);
   assert.equal(u.origin,origin);
   assert.equal(u.pathname,path);
   assert.equal(opts.method,'POST');
   assert.equal(opts.credentials,'omit');
   return fetch(base+u.pathname,{...opts,redirect:'error'});
  }
 });
 assert.equal(buyerClient.isConfigured(),true);
 const bResult=await buyerClient.submit(ride);
 assert.equal(bResult.ok,true,JSON.stringify(bResult));
 assert.equal(bResult.dispatchPriorityChanged,false);
 const first=await send(0,ride);
 assert.equal(first.body.ratingId,bResult.ratingId,'B first POST and A replay must share original rating');
 assert.equal(first.status,201,JSON.stringify(first.body));
 assert(UUID.test(first.body.ratingId));
 assert.equal(first.body.dispatchPriorityChanged,false);
 assert.equal(first.body.automatedSuspension,false);
 const repeat=await send(0,ride);
 assert.equal(repeat.status,201);
 assert.equal(first.body.ratingId,repeat.body.ratingId);
 assert.equal((await send(0,{...ride,stars:1})).status,409,'Replay cannot rewrite stars');
 assert.equal((await send(0,{...ride,requestKey:key(2)})).status,409,
  'One review per participant and service even with a new key');
 assert.equal((await send(1,ride)).status,409,'Driver cannot rate themself');
 assert.equal((await send(3,ride)).status,409,'Foreign actor never rates AUTO driver');
 const reverse=await send(1,payload('AUTO_RIDE',autoTrip,'CLIENT',4,key(3)));
 assert.equal(reverse.status,201,JSON.stringify(reverse.body));
 const courier=await send(2,payload('DELIVERY_MOTO',motoDelivery,'COURIER',1,
  key(4),'SUSPECTED_FRAUD'));
 assert.equal(courier.status,201,JSON.stringify(courier.body));
 assert(!JSON.stringify(courier.body).includes('SUSPECTED_FRAUD'),
  'Private incident not present in public receipt');
 const sender=await send(3,payload('DELIVERY_MOTO',motoDelivery,'CLIENT',4,key(5)));
 assert.equal(sender.status,201,JSON.stringify(sender.body));
 assert.equal((await send(2,payload('DELIVERY_AUTO',motoDelivery,'COURIER',5,key(6)))).status,409,
  'Wrong vehicle service kind is forbidden');
 assert.equal((await send(4,payload('COMMERCE',commerceOrder,'MERCHANT',5,key(7)))).status,409,
  'Ready but not delivered merchant order is not rateable');
 assert.equal((await send(4,payload('COMMERCE',commerceOrder,'COURIER',5,key(8)))).status,409,
  'Merchant order courier cannot be rated before verified delivery');
 assert.equal((await send(0,{...ride,requestKey:key(9),stars:0})).status,400);
 assert.equal((await send(0,{...ride,requestKey:key(9),stars:6})).status,400);
 assert.equal((await send(0,{...ride,requestKey:key(9),incidentCode:'PHONE_NUMBER'})).status,400);
 assert.equal((await send(0,{...ride,requestKey:key(9),comment:'fake public accusation'})).status,400);
 const unknown=await send(0,payload('AUTO_RIDE',key(999),'DRIVER',5,key(10)));
 assert.equal(unknown.status,409);
 assert.equal((await send(0,ride,'untrusted-provider-token-01234567890123')).status,401);
 const stats=read("SET ROLE service_role; SELECT "+
  "public.mobility_stage_g155_reputation_qa('COURIER',"+qs(cargoCourier)+")::text");
 assert.deepEqual({count:stats.verifiedCount,avg:stats.averageStars,
  qualified:stats.reputationQualified,dispatch:stats.dispatchPriorityApproved},
  {count:1,avg:null,qualified:false,dispatch:false});
 assert.equal(sql("SELECT count(*) FROM public.mobility_stage_g155_verified_ratings"),'4');
 assert.equal(sql("SELECT count(*) FROM public.mobility_stage_g155_verified_ratings "+
  "WHERE incident_code='SUSPECTED_FRAUD'"),'1');
 assert.equal(sql("SELECT has_table_privilege('authenticated',"+
  "'public.mobility_stage_g155_verified_ratings','SELECT')::text"),'false');
 assert.equal(sql("SELECT has_function_privilege('authenticated',"+
  "'public.mobility_stage_g155_submit_rating_qa(uuid,uuid,bigint,uuid,text,uuid,text,integer,text)',"+
  "'EXECUTE')::text"),'false');
 revoked=true;
 assert.equal((await send(2,payload('DELIVERY_MOTO',motoDelivery,'COURIER',1,key(4),'SUSPECTED_FRAUD'))).status,401);
 assert.equal(sql("SELECT count(*) FROM public.mobility_stage_g155_verified_ratings"),'4');
 console.log('G155 PASS: B authenticated Client and original completed AUTO and G5 proved MOTO -> private two-sided verified ratings; idempotency, incident privacy, foreign/early/forged/revoked denied; no score-based dispatch or automatic bans.');
}finally{
 await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
}

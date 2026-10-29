/** G158 E2E: ORIGINAL completed G67 cargo -> B G155 HTTP persisted
 * -> G157 allegation -> A Admin bearer/AAL2 HTTP -> D typed Admin client.
 * No fabricated finding, suspension, PSP, LIVE or disabled legal fence.
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createQoreRadarLoopbackTransport,listenQoreRadarLoopback}
 from './g4-loopback-http-transport.mjs';
import {createG158AdminFraudQaGateway} from './g158-admin-fraud-qa-gateway.mjs';
import {createG158FraudReportsClient}
 from '../../movete-admin/src/g158-fraud-reports-gateway.mjs';
if(process.env.CI!=='true'||process.env.PGHOST!=='localhost'||
 process.env.PGPORT!=='5432'||process.env.PGDATABASE!=='qore_disposable_chain'||
 process.env.PGAPPNAME!=='qore_ci_disposable_chain')
 throw Error('G158 only on disposable PG16');
const admin='15800000-0000-4158-8158-000000000001';
const owner='15800000-0000-4158-8158-000000000002';
const reviewer='10900000-0000-4109-8109-000000000021';
const session='15800000-0000-4158-8158-000000000003';
const token='g158-independent-admin-idp-aal2-ci-bearer-0000000000001';
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const sql=q=>execFileSync('psql',['-X','-q','-A','-t','-v','ON_ERROR_STOP=1',
 '-c',q],{encoding:'utf8',timeout:15000,maxBuffer:1000000,
 stdio:['ignore','pipe','pipe']}).trim().split('\n').at(-1)?.trim()??'';
const read=q=>JSON.parse(sql(q));
const q=x=>"'"+x+"'";
const fromG155=read("SELECT jsonb_build_object('sourceRatingId',r.id,"+
 "'ratedKind',r.rated_kind,'ratedId',r.rated_id,'reporterId',r.reviewer_id,"+
 "'serviceId',r.service_id,'deliveryStatus',d.status,'proofConsumed',p.consumed_at IS NOT NULL) "+
 "FROM public.mobility_stage_g155_verified_ratings r "+
 "JOIN public.mobility_stage_deliveries d ON d.id=r.service_id "+
 "JOIN public.mobility_stage_g67_delivery_proofs p ON p.delivery_id=d.id "+
 "AND p.proof_ref=d.proof_ref AND p.courier_id=d.courier_id "+
 "WHERE r.incident_code='SUSPECTED_FRAUD' AND r.rated_kind='COURIER'");
assert(uuid.test(fromG155.sourceRatingId)&&uuid.test(fromG155.ratedId)
 &&fromG155.deliveryStatus==='delivered'&&fromG155.proofConsumed===true);
assert.equal(sql("SELECT count(*) FROM public.mobility_stage_g157_fraud_signals"),'1');
assert.equal(sql("SELECT count(*) FROM public.mobility_stage_g157_fraud_signals "+
 "WHERE source_rating_id="+q(fromG155.sourceRatingId)),'1',
 'Same original G155 report must be the only G157 source');
for(const id of [admin,owner]){
 sql("INSERT INTO auth.users(id) VALUES("+q(id)+") ON CONFLICT DO NOTHING");
 sql("DELETE FROM public.user_roles WHERE user_id="+q(id));
}
sql("INSERT INTO public.mobility_stage_backoffice_roles(user_id,role,status,approved_by) "+
 "VALUES("+q(admin)+",'admin','active',"+q(reviewer)+"),"+
 "("+q(owner)+",'owner','active',"+q(reviewer)+") ON CONFLICT DO NOTHING");
assert.equal(sql("SET ROLE service_role; SELECT public.mobility_stage_g27_backoffice_role_of("+q(admin)+")"),'admin');
assert.equal(sql("SET ROLE service_role; SELECT public.mobility_stage_g27_backoffice_has_scope("+
 q(admin)+",'admin.incidents.read')::text"),'true');
const suspensionsBefore=sql("SELECT count(*) FROM public.mobility_stage_operational_suspensions");
let revoked=false,mfa=true,role='admin',sourceReads=0;
const auth={
 environment:'isolated_staging',qaOnly:true,liveEnabled:false,
 verifyAccessToken:async bearer=>{
  if(bearer!==token)throw Error('Wrong provider bearer');
  return {id:admin,sessionId:session,is_anonymous:false,
   expiresAtMs:Date.now()+60000};
 },
 verifySessionNotRevoked:async()=>!revoked,
 loadExclusiveBackofficeRole:async id=>id===admin&&role==='admin'
  ?sql("SET ROLE service_role; SELECT public.mobility_stage_g27_backoffice_role_of("+q(id)+")")
  :role,
 authorizePermission:async({userId,scope})=>userId===admin
  &&sql("SET ROLE service_role; SELECT public.mobility_stage_g27_backoffice_has_scope("+
   q(userId)+","+q(scope)+")::text")==='true',
 verifyBackofficeMfa:async({userId,sessionId,at})=>({
  verifiedByProvider:mfa,assuranceLevel:mfa?'aal2':'aal1',
  userId,sessionId,verifiedAtMs:at-20000,
  expiresAtMs:at+30000
 }),
 allowRequest:()=>true,
 loadFraudReviewQueue:async({actorId,limit})=>{
  sourceReads++;
  return read("SET ROLE service_role; SELECT public.mobility_stage_g157_admin_review_queue_qa("+
   q(actorId)+","+limit+")::text");
 }
};
const gateway=createG158AdminFraudQaGateway(auth);
const noop=async()=>({status:404,body:{error:'Not found'}});
const server=createQoreRadarLoopbackTransport({
 riderHandler:noop,offerHandler:noop,tripCommandHandler:noop,
 deliveryHandler:noop,merchantHandler:noop,financeHandler:noop,
 safetyHandler:noop,merchantManagementHandler:noop,deliveryOfferHandler:noop,
 adminFraudHandler:gateway
});
const base=await listenQoreRadarLoopback(server);
const host='https://qore-g158-private-admin-ci.onrender.com';
const path='/v1/staging/admin/fraud/verified-reports';
const expiresAt=Date.now()+60000;
const client=createG158FraudReportsClient({
 enabled:true,ownerApproved:true,contractVerified:true,
 externalRuntimeVerified:true,serverMfaVerified:true,
 serverRbacVerified:true,serverRevocationVerified:true,
 origin:host,pinnedOrigin:host,
 getSession:async()=>({role:'admin',mfaVerified:true,subject:admin,
  token,expiresAt}),
 fetchImpl:(url,opts)=>{
  const u=new URL(url);
  assert.equal(u.origin,host);assert.equal(u.pathname,path);
  assert.equal(opts.method,'GET');assert.equal(opts.credentials,'omit');
  return fetch(base+u.pathname,{...opts,redirect:'error'});
 }
});
async function call(t=token){
 const response=await fetch(base+path,{
  method:'GET',redirect:'error',headers:{authorization:'Bearer '+t}
 });
 return {status:response.status,body:await response.json()};
}
try{
 assert.equal(client.isConfigured(),true);
 const first=await client.fetchReports();
 assert.equal(first.ok,true,JSON.stringify(first));
 assert.equal(first.page.items.length,1);
 assert.equal(first.page.items[0].ratedId,fromG155.ratedId);
 assert.equal(first.page.items[0].ratedKind,'COURIER');
 assert.equal(first.page.items[0].recentReports,1);
 assert.equal(first.page.items[0].independentReporters,1);
 assert.equal(first.page.items[0].distinctServices,1);
 assert.equal(first.page.items[0].reviewTier,'SINGLE_SOURCE_REVIEW');
 assert.equal(first.page.automaticSuspension,false);
 assert.equal(first.page.dispatchPenaltyApplied,false);
 assert.equal(first.page.allegationOnly,true);
 const pass=await call();assert.equal(pass.status,200);
 assert.equal(pass.body.viewerId,admin);
 assert.equal(pass.body.findingEstablished,false);
 assert.equal(JSON.stringify(pass.body).includes(fromG155.reporterId),false,
  'Report author identity must never leave server');
 assert.equal(JSON.stringify(pass.body).includes('SUSPECTED_FRAUD'),false,
  'Uninvestigated accusation never publicly attached');
 assert.equal((await call('bogus-invalid-idp-ci-token-00000000')).status,401);
 assert.equal(sourceReads,2,'Unauthorized bearer must not query PostgreSQL');
 mfa=false;assert.equal((await call()).status,403);
 assert.equal(sourceReads,2,'No query without provider AAL2');
 mfa=true;role='owner';assert.equal((await call()).status,403);
 role='admin';revoked=true;assert.equal((await call()).status,401);
 assert.equal(sourceReads,2,'No query after revocation');
 revoked=false;
 const noBody=await fetch(base+path,{method:'POST',
  headers:{authorization:'Bearer '+token,'content-type':'application/json'},
  body:JSON.stringify({limit:99999})});
 assert.equal(noBody.status,404,'No unbounded public endpoint');
 assert.equal(sql("SELECT count(*) FROM public.mobility_stage_operational_suspensions"),suspensionsBefore,
  'Reading allegations must NEVER apply sanctions');
 assert.equal(sql("SELECT count(*) FROM public.mobility_stage_g157_fraud_signals"),'1');
 console.log('G158 PASS original G67 delivered cargo -> G155 verified fraud report -> G157 PG16 -> A JWT/AAL2/RBAC private GET -> D Admin; foreign/MFA/revoked denied; no PII or sanctions');
}finally{
 await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
}

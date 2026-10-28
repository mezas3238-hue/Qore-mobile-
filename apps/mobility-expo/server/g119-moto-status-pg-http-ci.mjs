/** G119 authenticated MOTO Rider tracking through real A HTTP and PG16.
 * Privileged QA-seeded accepted MOTO state is NOT proof of lawful dispatch.
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createQoreRadarLoopbackTransport,listenQoreRadarLoopback}
 from './g4-loopback-http-transport.mjs';
import {createG101MotoPassengerGateway,createG101MotoPassengerRepository}
 from './g101-moto-passenger-gateway.mjs';
import {createG119MotoStatusGateway} from '../../../ci-b-client/apps/movete-cliente/src/domain/g119-moto-ride-status-gateway.mjs';
if(process.env.CI!=='true'||process.env.PGHOST!=='localhost'
 ||process.env.PGPORT!=='5432'||process.env.PGDATABASE!=='qore_disposable_chain'
 ||process.env.PGAPPNAME!=='qore_ci_disposable_chain')
 throw Error('G119 requires CI disposable PG16 and loopback');
const passenger='11900000-0000-4119-8119-000000000001';
const other='11900000-0000-4119-8119-000000000002';
const driver='11900000-0000-4119-8119-000000000003';
const vehicle='11900000-0000-4119-8119-000000000010';
const offer='11900000-0000-4119-8119-000000000011';
const booking='11900000-0000-4119-8119-000000000020';
const token='verified-moto-passenger-119-abcdefghijkl';
const foreign='verified-other-passenger-119-abcdefghijkl';
const noop=async()=>({status:404,body:{error:'Not found'}});
const sql=x=>execFileSync('psql',['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-c',x],
 {encoding:'utf8',maxBuffer:400000,timeout:20000}).trim().split('\n').at(-1)?.trim()??'';
function rpc(name,args){
 const list={
  mobility_stage_g118_moto_status_qa:['_passenger','_booking']
 }[name];
 if(!list||Object.keys(args).length!==list.length
  ||!list.every(x=>Object.hasOwn(args,x)))throw Error('G119 private RPC allowlist');
 const vals=list.map(k=>{
  if(typeof args[k]!=='string'
   ||!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(args[k]))
   throw Error('G119 invalid private RPC');
  return "'"+args[k]+"'";
 });
 const t=sql('SET ROLE service_role; SELECT public.'+name+'('+vals.join(',')+')::text;');
 return Promise.resolve({data:t?JSON.parse(t):null,error:null});
}
async function fetchStatus(base,key,auth=token){
 const response=await fetch(base+'/v1/staging/rider/moto/bookings/'+key+'/status',{
  method:'GET',headers:{authorization:'Bearer '+auth},redirect:'error'
 });
 assert.equal(response.headers.get('cache-control'),'private, no-store, max-age=0');
 return {status:response.status,body:await response.json()};
}
async function main(){
 sql("INSERT INTO auth.users(id) VALUES('"+passenger+"'),('"+other+"'),('"+driver+"');");
 const q=JSON.parse(sql("SELECT public.mobility_stage_g100_moto_quote_qa('"+passenger+
  "','11900000-0000-4119-8119-000000000021','CENTRO_FIXTURE','AEROPUERTO',"+
  "'MOTO_TEST_ZONE',5000,600)::text;"));
 const received=JSON.parse(sql("SELECT public.mobility_stage_g100_moto_book_qa('"+passenger+
  "','"+q.quoteId+"','"+booking+"')::text;"));
 const trip=received.tripId;
 assert.equal(received.tripState,'searching');
 const repo=createG101MotoPassengerRepository({rpc});
 const gateway=createG101MotoPassengerGateway({
  projectRef:'staging1234567890abcd',
  verifyAccessToken:async x=>{
   const id=x===token?passenger:x===foreign?other:null;
   if(!id)throw Error('Bad signed JWT');
   return {id,is_anonymous:false,email_confirmed_at:'2026-10-25T00:00:00Z'};
  },
  authorizePassenger:async x=>[passenger,other].includes(x),
  allowRequest:()=>true,
  resolveVerifiedMotoRoute:async()=>{throw Error('G119 does not issue new map quotes');},
  repository:repo
 });
 const server=createQoreRadarLoopbackTransport({
  riderHandler:noop,offerHandler:noop,tripCommandHandler:noop,
  deliveryHandler:noop,merchantHandler:noop,financeHandler:noop,
  safetyHandler:noop,merchantManagementHandler:noop,deliveryOfferHandler:noop,
  motoHandler:gateway
 });
 try{
  const base=await listenQoreRadarLoopback(server);
  const fixedNow=Date.now();
  const bSource='https://g119-cross-branch-qa.invalid';
  const bGateway=createG119MotoStatusGateway({
   enabled:true,contractCertified:true,stagingRuntimeVerified:true,
   origin:bSource,pinnedOrigin:bSource,now:()=>fixedNow,
   getSession:async()=>({subject:passenger,role:'passenger',token,
    expiresAt:fixedNow+600000}),
   fetchImpl:async(url,init)=>{
    const parsed=new URL(url);
    assert.equal(parsed.origin,bSource);
    assert.equal(parsed.search,'');
    assert.equal(init.method,'GET');
    assert.equal(init.credentials,'omit');
    return fetch(base+parsed.pathname,{...init,redirect:'error'});
   }
  });
  async function checkClient(version,status){
   const view=await bGateway.read({bookingKey:booking,
    expectedTripId:trip,minimumRevision:version});
   assert.equal(view.ok,true,JSON.stringify(view));
   assert.equal(view.data.tripState,status);
   assert.equal(view.data.tripRevision,version);
   assert.equal(view.data.subsidyBps,1000);
   assert.equal(view.data.gpsVerified,false);
   assert.equal(view.data.etaAvailable,false);
  }

  const searching=await fetchStatus(base,booking);
  assert.equal(searching.status,200,JSON.stringify(searching.body));
  assert.equal(searching.body.tripId,trip);
  assert.equal(searching.body.tripState,'searching');
  assert.equal(searching.body.tripRevision,1);
  assert.equal(searching.body.driverAssigned,false);
  assert.equal(searching.body.subsidyBps,1000);
  await checkClient(1,'searching');
  assert.equal((await fetchStatus(base,booking,foreign)).status,404);
  assert.equal((await fetchStatus(base,booking,'invalid-token-aaa')).status,401);
  // G118 refuses a dispatch without certified MOTO territory even if a Driver
  // is supplied; this test does NOT mint a legal permit.
  let denied=false;
  try{sql("SELECT public.mobility_stage_g118_moto_offer_qa('"+booking+"','"+
   driver+"','"+vehicle+"','11900000-0000-4119-8119-000000000022');");}
  catch{denied=true;}
  assert.equal(denied,true,'Unverified MOTO territory must deny offers');
  // Clearly synthetic pre-accepted SQL fixture, created only by privileged
  // disposable PG migration owner, NEVER by the service_role/Driver app.
  sql("UPDATE public.mobility_stage_g100_moto_trips SET status='accepted',"+
   "revision=2,driver_id='"+driver+"',vehicle_id='"+vehicle+"',"+
   "accepted_offer_id='"+offer+"' WHERE id='"+trip+"';");
  async function expect(state,revision,command){
   const read=await fetchStatus(base,booking);
   assert.equal(read.status,200,JSON.stringify(read.body));
   assert.equal(read.body.tripId,trip);
   assert.equal(read.body.tripState,state);
   assert.equal(read.body.tripRevision,revision);
   assert.equal(read.body.driverAssigned,true);
   assert.equal(read.body.driverIdentityExposed,false);
   assert.equal(read.body.gpsVerified,false);
   assert.equal(read.body.etaAvailable,false);
   assert.equal(read.body.pspCollected,false);
   await checkClient(revision,state);
   if(command){
    const res=JSON.parse(sql('SET ROLE service_role; SELECT public.'+
      "mobility_stage_g118_moto_driver_step_qa('"+booking+"','"+driver+"',"+
      revision+",'"+command+"','11900000-0000-4119-8119-"+
      (revision===2?'000000000031':revision===3?'000000000032':'000000000033')+
      "')::text;"));
    assert.equal(res.tripRevision,revision+1);
   }
  }
  await expect('accepted',2,'arriving');
  await expect('arriving',3,'in_progress');
  await expect('in_progress',4,'completed');
  await expect('completed',5);
  assert.equal(sql("SELECT count(*) FROM public.mobility_stage_g118_moto_events "+
   "WHERE trip_id='"+trip+"'"),'3');
  const final=await fetchStatus(base,booking);
  assert.equal(final.body.financialState,'COMPLETED_UNSETTLED_QA');
  assert.equal(final.body.customerPaysGs,received.customerPaysGs);
  assert.equal(final.body.commissionBps,received.commissionBps);
  const serialized=JSON.stringify(final.body);
  assert(!serialized.includes(driver));
  assert(!serialized.includes(vehicle));
  assert(!serialized.includes('latitude'));
  console.log('G119 CROSS-BRANCH PASS: A PG16 MOTO trip statuses accepted by real B Client gateway, identity and finance pinned; no live');
  console.log('G119 PASS: one MOTO booking -> private HTTP searching, synthetic-only accepted, arriving, in_progress, completed via PG16; exact rider identity and fare, no GPS/ETA/PSP; unverified offers denied');
 }finally{await new Promise(resolve=>server.close(resolve));}
}
await main();

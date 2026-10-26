/**
 * G120: actual native Driver inbox and offer-decision codecs cause the
 * FIRST positive PostgreSQL acceptance of the SAME synthetic G109 ride.
 * Must execute AFTER G109 offer fixture but BEFORE G38 legal veto installation.
 * G109 later completes this exact trip with G38 active; this test does NOT
 * authorize new bookings, fake licensed zones or commercial Driver operations.
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createQoreRadarLoopbackTransport,listenQoreRadarLoopback}
 from './g4-loopback-http-transport.mjs';
import {createQoreOfferGateway} from './g4-offer-gateway.mjs';
import {createDriverPrivateInboxRepository}
 from './g16-driver-private-inbox-repository.mjs';
import {createDriverPrivateInboxGateway}
 from './g16-driver-private-inbox-gateway.mjs';
import {readDriverPrivateInbox}
 from '../../movete-driver/src/domain/driver-inbox.mjs';
import {decidePrivateDriverOffer}
 from '../../movete-driver/src/domain/driver-offer-decision.mjs';

if(process.env.CI!=='true'||process.env.PGHOST!=='localhost'||
 process.env.PGPORT!=='5432'||process.env.PGDATABASE!=='qore_disposable_chain'||
 process.env.PGAPPNAME!=='qore_ci_disposable_chain')
 throw Error('G120 requires disposable local PostgreSQL16 CI');
const id=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const driver='10900000-0000-4109-8109-000000000022';
const passenger='10900000-0000-4109-8109-000000000021';
const requestKey='10900000-0000-4109-8109-000000000023';
const decisionKey='10900000-0000-4109-8109-000000000028';
const token='g120-verified-native-driver-synthetic-session-1234567890';
const foreign='g120-foreign-passenger-session-123456789012345';
const noop=async()=>({status:404,body:{error:'Not found'}});
function psql(s){
 const out=execFileSync('psql',['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-c',s],
  {encoding:'utf8',timeout:12000,maxBuffer:1000000,
   stdio:['ignore','pipe','pipe']});
 return out.trim().split('\n').at(-1)?.trim()??'';
}
function json(s){return JSON.parse(psql(s));}
const verified=async value=>{
 if(value===token)return {id:driver,is_anonymous:false,
  email_confirmed_at:'2026-10-26T00:00:00Z'};
 if(value===foreign)return {id:passenger,is_anonymous:false,
  email_confirmed_at:'2026-10-26T00:00:00Z'};
 throw Error('G120 token not verified');
};
const isDriver=async actor=>{
 if(!id.test(actor))return false;
 return psql("SET ROLE service_role; SELECT "+
  "(count(*)=1 AND count(*) FILTER (WHERE role='driver')=1)::text "+
  "FROM public.user_roles WHERE user_id='"+actor+"'")==='true';
};
async function main(){
 assert.equal(psql("SELECT (current_database()='qore_disposable_chain' "+
  "AND current_setting('application_name')='qore_ci_disposable_chain' "+
  "AND to_regclass('public.mobility_stage_g38_trusted_offer_proofs') IS NULL)::text"),'true');
 const tripId=psql("SET ROLE service_role; SELECT id::text "+
  "FROM public.mobility_stage_auto_demo_trips WHERE request_key='"+requestKey+"'");
 assert(id.test(tripId));
 const before=json("SELECT jsonb_build_object('status',status,'revision',revision,"+
  "'driverId',driver_id)::text FROM public.mobility_stage_auto_demo_trips "+
  "WHERE id='"+tripId+"'");
 assert.deepEqual(before,{status:'searching',revision:1,driverId:null});
 const inboxDb=createDriverPrivateInboxRepository({
  rpc:async(name,args)=>{
   const param=name==='mobility_stage_poll_driver_auto_offers'?'_driver_id':
    name==='mobility_stage_poll_courier_delivery_offers'?'_courier_id':null;
   if(param===null||Object.keys(args).length!==1||!id.test(args[param]??''))
    throw Error('G120 refused SQL request');
   return {data:json("SET ROLE service_role; SELECT COALESCE("+
    "jsonb_agg(to_jsonb(r)),'[]'::jsonb)::text FROM public."+
    name+"('"+args[param]+"') r"),error:null};
  }
 });
 const inbox=createDriverPrivateInboxGateway({
  projectRef:'staging1234567890abcd',verifyAccessToken:verified,
  authorizeDriver:isDriver,allowRequest:()=>true,
  listForDriver:x=>inboxDb.listForDriver(x)
 });
 const offerApi=createQoreOfferGateway({
  projectRef:'staging1234567890abcd',verifyAccessToken:verified,
  authorizeDriver:isDriver,allowRequest:()=>true,
  loadOfferForDriver:async({offerId,driverId})=>{
   if(!id.test(offerId)||!id.test(driverId))return null;
   return json("SET ROLE service_role; SELECT COALESCE((SELECT "+
    "jsonb_build_object('offerId',o.id,'tripId',o.trip_id,"+
    "'driverId',o.driver_id,'status',o.status,"+
    "'expiresAtMs',(EXTRACT(EPOCH FROM o.expires_at)*1000)::bigint,"+
    "'service',t.service,'originTag',t.origin_tag,"+
    "'destinationTag',t.destination_tag) "+
    "FROM public.mobility_stage_auto_demo_offers o "+
    "JOIN public.mobility_stage_auto_demo_trips t ON t.id=o.trip_id "+
    "WHERE o.id='"+offerId+"' AND o.driver_id='"+driverId+"' "+
    "AND t.status='searching'),'null'::jsonb)::text");
  },
  acceptOffer:async p=>psql("SET ROLE service_role; SELECT "+
   "public.mobility_stage_auto_demo_accept_offer('"+p._offer_id+"','"+
   p._driver_id+"','"+p._decision_key+"')::text"),
  declineOffer:async p=>psql("SET ROLE service_role; SELECT "+
   "public.mobility_stage_auto_demo_decline_offer('"+p._offer_id+"','"+
   p._driver_id+"','"+p._decision_key+"')::text")
 });
 const server=createQoreRadarLoopbackTransport({
  riderHandler:noop,offerHandler:offerApi,driverInboxHandler:inbox,
  tripCommandHandler:noop,deliveryHandler:noop,merchantHandler:noop,
  financeHandler:noop,safetyHandler:noop,merchantManagementHandler:noop,
  deliveryOfferHandler:noop
 });
 let origin;
 try{
  origin=await listenQoreRadarLoopback(server);
  const offers=await readDriverPrivateInbox({
   apiOrigin:origin,accessToken:token,request:fetch,now:Date.now
  });
  assert.equal(offers.length,1,'G120 actual inbox must contain one offer');
  assert.equal(offers[0].kind,'AUTO_RIDE');
  assert.equal(offers[0].serviceId,tripId);
  const stolen=await fetch(origin+'/v1/staging/driver/inbox',{
   headers:{authorization:'Bearer '+foreign}});
  assert.equal(stolen.status,403,'Passenger cannot poll private Driver inbox');
  const accepted=await decidePrivateDriverOffer({
   apiOrigin:origin,accessToken:token,
   kind:offers[0].kind,offerId:offers[0].offerId,
   requestKey:decisionKey,action:'accept',request:fetch
  });
  assert.equal(accepted.outcome,'accepted');
  assert(id.test(accepted.receiptId));
  assert.equal(accepted.liveEnabled,false);
  const after=json("SELECT jsonb_build_object('tripId',id,"+
   "'status',status,'revision',revision,'driverId',driver_id) "+
   "FROM public.mobility_stage_auto_demo_trips WHERE id='"+tripId+"'");
  assert.deepEqual(after,{tripId,status:'accepted',revision:2,driverId:driver});
  const events=json("SELECT COALESCE(jsonb_agg(jsonb_build_object("+
   "'id',id,'nextStatus',next_status)),'[]'::jsonb) "+
   "FROM public.mobility_stage_auto_demo_events WHERE trip_id='"+tripId+"'");
  assert.equal(events.length,1);
  assert.equal(events[0].nextStatus,'accepted');
  assert.equal(events[0].id,accepted.receiptId);
  // Only SQL owner reads the private G36 slot registry, never the Driver API.
  const slot=psql("SELECT count(*) FROM public.mobility_stage_g36_driver_slots "+
   "WHERE driver_id='"+driver+"' AND assignment_id='"+tripId+"' "+
   "AND assignment_kind='AUTO_RIDE'");
  assert.equal(slot,'1');
  assert.deepEqual(await readDriverPrivateInbox({
   apiOrigin:origin,accessToken:token,request:fetch,now:Date.now
  }),[],'Accepted offer may not reappear in Driver inbox');
  console.log('G120 NATIVE DRIVER ACCEPT PASS: actual native G16 GET finds private PostgreSQL AUTO offer, native G4 POST accepts same tripId, immutable revision 2 and G36 Driver slot persist; G38 not yet installed, synthetic CI ONLY, NO LIVE');
 }finally{
  if(server.listening)await new Promise((resolve,reject)=>
   server.close(e=>e?reject(e):resolve()));
 }
}
await main();

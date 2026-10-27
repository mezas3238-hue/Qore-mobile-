/**
 * G125 real disposable PG16 + authenticated G7 loopback HTTP.
 * Routing evidence below is a SYNTHETIC TRUSTED-ADAPTER FIXTURE,
 * not a commercial route, GPS, provider subscription or live permission.
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createQoreFinanceGateway} from './g7-finance-gateway.mjs';
import {createQoreRadarLoopbackTransport,listenQoreRadarLoopback}
 from './g4-loopback-http-transport.mjs';
import {createG125CargoPricingContext} from './g125-cargo-pricing-context.mjs';
if(process.env.CI!=='true'||process.env.PGHOST!=='localhost'||
 process.env.PGPORT!=='5432'||process.env.PGDATABASE!=='qore_disposable_chain'||
 process.env.PGAPPNAME!=='qore_ci_disposable_chain')
 throw Error('G125 refuses non-disposable PostgreSQL');
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const senders=['12500000-0000-4125-8125-000000000011',
 '12500000-0000-4125-8125-000000000012'];
const bookingKeys=['12500000-0000-4125-8125-000000000021',
 '12500000-0000-4125-8125-000000000022'];
const quoteKeys=['12500000-0000-4125-8125-000000000031',
 '12500000-0000-4125-8125-000000000032'];
const evidenceIds=['12500000-0000-4125-8125-000000000041',
 '12500000-0000-4125-8125-000000000042'];
const decisionKeys=['12500000-0000-4125-8125-000000000051',
 '12500000-0000-4125-8125-000000000052'];
const tokens=['g125-verified-passenger-moto-test-token-000001',
 'g125-verified-passenger-auto-test-token-000002'];
const noop=async()=>({status:404,body:{error:'Not found'}});
function sql(q){
 const out=execFileSync('psql',['-X','-q','-A','-t',
  '-v','ON_ERROR_STOP=1','-c',q],{encoding:'utf8',timeout:15000,
  maxBuffer:1000000,stdio:['ignore','pipe','pipe']});
 return out.trim().split('\n').at(-1)?.trim()??'';
}
const json=q=>JSON.parse(sql(q));
const safeUUID=x=>{if(!UUID.test(x??''))throw Error('G125 untrusted UUID');return "'"+x+"'";};
function rpc(name,args){
 const signatures={
  mobility_stage_g125_record_cargo_road_qa:[
   '_sender','_delivery','_evidence','_vehicle','_zone','_pickup','_destination',
   '_meters','_seconds','_tolls','_verified_at_ms','_expires_at_ms']
 };
 const keys=signatures[name];
 if(!keys||Object.keys(args).length!==keys.length||
  !keys.every(k=>Object.hasOwn(args,k)))throw Error('G125 unexpected SQL arguments');
 const values=keys.map(k=>{
  const v=args[k];
  if(['_sender','_delivery','_evidence'].includes(k))return safeUUID(v);
  if(typeof v==='string'&&/^[A-Z_]{3,60}$/.test(v))return "'"+v+"'";
  if(Number.isSafeInteger(v)&&v>=0&&v<=9000000000000)return String(v);
  throw Error('G125 SQL whitelist denied '+k);
 });
 return json('SET ROLE service_role; SELECT public.'+name+
  '('+values.join(',')+')::text');
}
function loadDelivery({actorId,deliveryId}){
 return json("SELECT COALESCE((SELECT jsonb_build_object("+
  "'id',id,'sender_id',sender_id,'requested_vehicle_kind',requested_vehicle_kind,"+
  "'status',status,'courier_id',courier_id,'pickup_tag',pickup_tag,"+
  "'delivery_tag',delivery_tag) FROM public.mobility_stage_deliveries "+
  "WHERE id="+safeUUID(deliveryId)+" AND sender_id="+safeUUID(actorId)+
  "),'null'::jsonb)::text");
}
function requestDelivery(actor,kind,key){
 const id=sql("SET ROLE service_role; SELECT public.mobility_stage_delivery_request("+
  safeUUID(actor)+","+safeUUID(key)+",'"+kind+
  "'::public.mobility_vehicle_kind,"+
  "'PARCEL'::public.mobility_stage_delivery_category,"+
  "2000,30,20,10,'PICKUP_EAST','DELIVERY_WEST',false)::text");
 assert(UUID.test(id));return id;
}
const actor=async token=>{
 const n=tokens.indexOf(token);
 if(n===-1)throw Error('G125 unverified QA session');
 return {id:senders[n],is_anonymous:false,
  email_confirmed_at:'2026-10-26T00:00:00Z'};
};
async function http(origin,token,body){
 const res=await fetch(origin+'/v1/staging/fares/quote',{
  method:'POST',redirect:'error',
  headers:{authorization:'Bearer '+token,'content-type':'application/json'},
  body:JSON.stringify(body)});
 assert.equal(res.headers.get('cache-control'),'private, no-store, max-age=0');
 return {status:res.status,data:await res.json()};
}
function quoteFare({actorId,requestKey,fareMode,subjectKind,subjectId,
 zoneTag,distanceMeters,durationSeconds,tollsPyg}){
 if(![actorId,requestKey,subjectId].every(UUID.test.bind(UUID))||
  fareMode!=='DELIVERY'||subjectKind!=='DELIVERY'||
  !/^(MOTO|AUTO)_ASUNCION$/.test(zoneTag)||
  ![distanceMeters,durationSeconds,tollsPyg].every(Number.isSafeInteger))
  throw Error('G125 quote adapter invalid');
 const qid=sql("SET ROLE service_role; SELECT public.mobility_stage_fare_quote("+
  safeUUID(actorId)+","+safeUUID(requestKey)+","+
  "'DELIVERY'::public.mobility_stage_fare_mode,"+
  "'DELIVERY'::public.mobility_stage_fare_subject,"+safeUUID(subjectId)+
  ",'"+zoneTag+"',"+distanceMeters+","+durationSeconds+","+tollsPyg+")::text");
 const row=json("SELECT jsonb_build_object('id',q.id,'mode',q.mode,"+
  "'subjectKind',q.subject_kind,'subjectId',q.subject_id,"+
  "'ruleVersion',r.rule_key,'subtotalPyg',q.subtotal_pyg,"+
  "'tollsPyg',q.tolls_pyg,'totalPyg',q.total_pyg,"+
  "'commissionBps',q.commission_bps,'commissionPyg',q.commission_pyg,"+
  "'providerPyg',q.provider_pyg,'expiresAt',q.expires_at) "+
  "FROM public.mobility_stage_fare_quotes q "+
  "JOIN public.mobility_stage_fare_rules r ON r.id=q.rule_id "+
  "WHERE q.id="+safeUUID(qid));
 return {ok:true,liveEnabled:false,quote:row};
}
async function main(){
 assert.equal(sql("SELECT (current_database()='qore_disposable_chain' AND "+
  "to_regclass('public.mobility_stage_g125_cargo_road_attestations') "+
  "IS NOT NULL)::text"),'true');
 sql("INSERT INTO auth.users(id) VALUES "+senders.map(x=>'('+safeUUID(x)+')').join(','));
 const kinds=['MOTO','AUTO'],saved=[];
 for(let i=0;i<2;i++){
  const d=requestDelivery(senders[i],kinds[i],bookingKeys[i]);
  saved.push(d);
  assert.equal(loadDelivery({actorId:senders[i],deliveryId:d}).sender_id,senders[i]);
  // Any old G7 service-role call with untrusted distance is now denied.
  assert.throws(()=>sql("SET ROLE service_role; SELECT "+
   "public.mobility_stage_fare_quote("+safeUUID(senders[i])+","+
   safeUUID(quoteKeys[i])+",'DELIVERY'::public.mobility_stage_fare_mode,"+
   "'DELIVERY'::public.mobility_stage_fare_subject,"+safeUUID(d)+
   ",'"+kinds[i]+"_ASUNCION',5000,700,0)::text"),/Command failed/);
 }
 // A provider must return the SAME immutable attestation on retries of this
 // original request. Changing verified_at for the same evidenceId is denied.
 const proofIssuedAt=[Date.now(),Date.now()];
 const contexts=senders.map((sender,i)=>
  createG125CargoPricingContext({
   enabled:true,now:Date.now,
   loadSenderDelivery:async args=>loadDelivery(args),
   resolveVerifiedCargoRoute:async q=>{
    assert.equal(q.actorId,sender);
    assert.equal(q.deliveryId,saved[i]);
    assert.equal(q.vehicleKind,kinds[i]);
    const now=proofIssuedAt[i];
    // CI fixture simulates independent certified router. No real provider.
    return {source:'INDEPENDENT_ROAD_ROUTING_AUTHORITY',
     coverageVerified:true,routingVerified:true,tollsVerified:true,
     trafficAware:true,fallbackUsed:false,actorId:sender,
     deliveryId:saved[i],vehicleKind:kinds[i],
     pickupTag:'PICKUP_EAST',deliveryTag:'DELIVERY_WEST',
     evidenceId:evidenceIds[i],zoneTag:kinds[i]+'_ASUNCION',
     distanceMeters:5000,durationSeconds:700,tollsPyg:0,
     verifiedAtMs:now-1000,expiresAtMs:now+59000};
   },
   recordVerifiedRoute:async p=>rpc('mobility_stage_g125_record_cargo_road_qa',{
    _sender:p.actorId,_delivery:p.deliveryId,_evidence:p.evidenceId,
    _vehicle:p.vehicleKind,_zone:p.zoneTag,
    _pickup:p.pickupTag,_destination:p.deliveryTag,
    _meters:p.distanceMeters,_seconds:p.durationSeconds,_tolls:p.tollsPyg,
    _verified_at_ms:p.verifiedAtMs,_expires_at_ms:p.expiresAtMs
   })
  }));
 const finance=createQoreFinanceGateway({
  projectRef:'staging1234567890abcd',verifyAccessToken:actor,
  authorizePassenger:async id=>senders.includes(id),allowRequest:()=>true,
  loadPricingContext:async input=>{
   const n=senders.indexOf(input.actorId);
   if(n===-1)throw Error('Sender not eligible');
   try{return await contexts[n](input);}
   catch(error){console.error('G125_QA_CONTEXT_FAILED: '+String(error).slice(0,1200));throw error;}
  },
  quoteFare:async input=>{
   try{return quoteFare(input);}
   catch(error){console.error('G125_QA_SQL_QUOTE_FAILED: '+String(error).slice(0,1200));throw error;}
  },
  authorizePayment:async()=>{throw Error('NO PSP')},
  transitionPayment:async()=>{throw Error('NO PSP')},
  loadPayment:async()=>{throw Error('NO PSP')}
 });
 const server=createQoreRadarLoopbackTransport({
  riderHandler:noop,offerHandler:noop,tripCommandHandler:noop,
  deliveryHandler:noop,merchantHandler:noop,financeHandler:finance,
  safetyHandler:noop,merchantManagementHandler:noop,deliveryOfferHandler:noop
 });
 try{
  const origin=await listenQoreRadarLoopback(server);
  for(let i=0;i<2;i++){
   const body={requestKey:quoteKeys[i],fareMode:'DELIVERY',
    subjectKind:'DELIVERY',subjectId:saved[i]};
   const denied=await http(origin,tokens[1-i],body);
   assert.equal(denied.status,409);
   const first=await http(origin,tokens[i],body);
   assert.equal(first.status,201,JSON.stringify(first));
   assert.equal(first.data.serverPriced,true);
   assert.equal(first.data.routingVerified,true);
   assert.equal(first.data.quote.subjectId,saved[i]);
   assert.equal(first.data.quote.mode,'DELIVERY');
   assert.equal(first.data.quote.totalPyg>0,true);
   const quoteId=first.data.quote.id;
   // Read-after-lost-ack returns SAME quote and original immutable amount.
   const replay=await http(origin,tokens[i],body);
   assert.equal(replay.status,201);assert.equal(replay.data.quote.id,quoteId);
   const stored=json("SELECT jsonb_build_object('count',count(*),"+
    "'source',min(provider_status)) FROM "+
    "public.mobility_stage_g125_cargo_road_attestations "+
    "WHERE delivery_id="+safeUUID(saved[i]));
   assert.deepEqual(stored,{count:1,source:'INDEPENDENT_ROAD_ATTESTED_QA'});
   const accepted=json("SET ROLE service_role; SELECT "+
    "public.mobility_stage_g122_accept_delivery_quote_qa("+
    safeUUID(senders[i])+","+safeUUID(saved[i])+","+
    safeUUID(quoteId)+","+safeUUID(decisionKeys[i])+","+
    first.data.quote.totalPyg+",'"+first.data.quote.ruleVersion+"')::text");
   assert.equal(accepted.deliveryId,saved[i]);
   assert.equal(sql("SELECT public.mobility_stage_g123_delivery_priced_qa("+
    safeUUID(saved[i])+")::text"),'true');
   assert.throws(()=>sql("SET ROLE service_role; SELECT "+
    "public.mobility_stage_fare_quote("+safeUUID(senders[i])+","+
    safeUUID('12500000-0000-4125-8125-00000000006'+(i+1))+","+
    "'DELIVERY'::public.mobility_stage_fare_mode,"+
    "'DELIVERY'::public.mobility_stage_fare_subject,"+
    safeUUID(saved[i])+",'"+kinds[i]+"_ASUNCION',5001,700,0)::text"),
    /Command failed/,'Direct forged road distance must fail even server-role quote');
   console.log('G125 '+kinds[i]+' PASS: saved original PG16 cargo, bound independent QA road, G124 Owner tariff, authenticated HTTP G7 quote, G122 consent and G123 eligibility on same deliveryId; forged route and other sender denied; no payment');
  }
  console.log('G125 PASS: synthetic provider proof only; no real Routes key, paid API, dispatch or LIVE');
 }finally{
  if(server.listening)await new Promise((done,err)=>
   server.close(e=>e?err(e):done()));
 }
}
await main();

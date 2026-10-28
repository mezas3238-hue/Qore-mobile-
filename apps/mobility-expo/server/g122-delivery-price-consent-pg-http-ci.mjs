/**
 * G122 positive synthetic SQL/HTTP: each vehicle uses its OWN approved fare.
 * This is not a trusted external routing provider, user pricing, or PSP.
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createQoreRadarLoopbackTransport,listenQoreRadarLoopback}
 from './g4-loopback-http-transport.mjs';
import {createQoreDeliveryCommandGateway}
 from './g5-delivery-command-gateway.mjs';
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
if(process.env.CI!=='true'||process.env.PGHOST!=='localhost'||
 process.env.PGPORT!=='5432'||process.env.PGDATABASE!=='qore_disposable_chain'||
 process.env.PGAPPNAME!=='qore_ci_disposable_chain')
 throw Error('G122 only disposable CI PostgreSQL16');
const admin='12200000-0000-4122-8122-000000000001';
const senders=['12200000-0000-4122-8122-000000000011',
 '12200000-0000-4122-8122-000000000012'];
const requestKeys=['12200000-0000-4122-8122-000000000021',
 '12200000-0000-4122-8122-000000000022'];
const quoteKeys=['12200000-0000-4122-8122-000000000031',
 '12200000-0000-4122-8122-000000000032'];
const keys=['12200000-0000-4122-8122-000000000041',
 '12200000-0000-4122-8122-000000000042'];
const rules=['12200000-0000-4122-8122-000000000051',
 '12200000-0000-4122-8122-000000000052'];
const auth=['g122-private-moto-fixture-auth-00000000000001',
 'g122-private-auto-fixture-auth-00000000000002',
 'g122-private-admin-fixture-auth-00000000000003'];
const noop=async()=>({status:404,body:{error:'Not found'}});
function psql(s){
 const out=execFileSync('psql',['-X','-q','-A','-t','-v','ON_ERROR_STOP=1',
  '-c',s],{encoding:'utf8',timeout:12000,maxBuffer:1000000,
  stdio:['ignore','pipe','pipe']});
 return out.trim().split('\n').at(-1)?.trim()??'';
}
const json=s=>JSON.parse(psql(s));
const verified=async token=>{
 const index=auth.indexOf(token);
 if(index<0)throw Error('Unverified synthetic token');
 return {id:index<2?senders[index]:admin,is_anonymous:false,
  email_confirmed_at:'2026-10-26T00:00:00Z'};
};
const role=async id=>{
 if(!uuid.test(id))return null;
 return psql("SET ROLE service_role; SELECT CASE WHEN count(*)=1 "+
  "THEN min(role::text) ELSE 'none' END FROM public.user_roles "+
  "WHERE user_id='"+id+"'");
};
const requestDelivery=async d=>{
 if(!uuid.test(d.actorId)||!uuid.test(d.requestKey)||d.category!=='PARCEL'||
  !['AUTO','MOTO'].includes(d.vehicleKind)||d.restrictedItemDeclared!==false||
  ![d.grams,d.lengthCm,d.widthCm,d.heightCm].every(Number.isSafeInteger)||
  d.pickupTag!=='PICKUP_EAST'||d.deliveryTag!=='DELIVERY_WEST')
  throw Error('G122 SQL arguments refused');
 return {ok:true,liveEnabled:false,deliveryId:psql(
  "SET ROLE service_role; SELECT public.mobility_stage_delivery_request('"+
  d.actorId+"','"+d.requestKey+"','"+d.vehicleKind+
  "'::public.mobility_vehicle_kind,'PARCEL'::public.mobility_stage_delivery_category,"+
  d.grams+","+d.lengthCm+","+d.widthCm+","+d.heightCm+
  ",'PICKUP_EAST','DELIVERY_WEST',false)::text")};
};
const confirmQuote=async d=>{
 if(![d.actorId,d.deliveryId,d.quoteId,d.confirmationKey].every(x=>uuid.test(x))||
  !Number.isSafeInteger(d.acceptedTotalGs)||d.acceptedTotalGs<1||
  !/^[a-zA-Z0-9._-]{1,48}$/.test(d.acceptedFareVersion))throw Error('SQL input');
 const res=json("SET ROLE service_role; SELECT "+
  "public.mobility_stage_g122_accept_delivery_quote_qa('"+d.actorId+"','"+
  d.deliveryId+"','"+d.quoteId+"','"+d.confirmationKey+"',"+
  d.acceptedTotalGs+",'"+d.acceptedFareVersion+"')::text");
 return {ok:true,...res};
};
async function http(origin,path,token,body){
 const res=await fetch(origin+path,{
  method:'POST',redirect:'error',
  headers:{authorization:'Bearer '+token,'content-type':'application/json'},
  body:JSON.stringify(body)});
 return {status:res.status,data:await res.json()};
}
async function main(){
 assert.equal(psql("SELECT (current_database()='qore_disposable_chain' AND "+
  "to_regclass('public.mobility_stage_g122_delivery_price_consents') IS NOT NULL)::text"),'true');
 psql("INSERT INTO auth.users(id) VALUES ('"+admin+"'),('"+
  senders[0]+"'),('"+senders[1]+"')");
 psql("DELETE FROM public.user_roles WHERE user_id='"+admin+"'; "+
  "INSERT INTO public.user_roles(user_id,role) VALUES('"+admin+"','admin')");
 assert.equal(await role(admin),'admin');
 const kinds=['MOTO','AUTO'];
 const zones=['CARGA_MOTO_QA','CARGA_AUTO_QA'];
 const versions=['delivery-moto-synthetic-v1','delivery-auto-synthetic-v1'];
 for(let i=0;i<2;i++){
  // Numeric tariff parameters are made-up disposable test fixtures only.
  psql("INSERT INTO public.mobility_stage_fare_rules"+
   "(id,rule_key,mode,zone_tag,base_pyg,per_km_pyg,per_minute_pyg,"+
   "minimum_pyg,commission_bps,valid_from,valid_until,active,approved_by,approved_at) "+
   "VALUES('"+rules[i]+"','"+versions[i]+"','DELIVERY','"+zones[i]+"',"+
   (i===0?1800:3200)+",900,80,"+(i===0?3000:5000)+",900,"+
   "now()-interval '1 hour',now()+interval '1 day',true,'"+admin+
   "',now()-interval '2 hours')");
 }
 const gateway=createQoreDeliveryCommandGateway({
  projectRef:'staging1234567890abcd',verifyAccessToken:verified,
  resolveRole:role,allowRequest:()=>true,requestDelivery,confirmQuote,
  acceptDelivery:async()=>{throw Error('No courier operations')},
  transitionDelivery:async()=>{throw Error('No custody operations')},
  loadDelivery:async()=>{throw Error('No untrusted read operations')}
 });
 const server=createQoreRadarLoopbackTransport({
  riderHandler:noop,offerHandler:noop,tripCommandHandler:noop,
  deliveryHandler:gateway,merchantHandler:noop,financeHandler:noop,
  safetyHandler:noop,merchantManagementHandler:noop,deliveryOfferHandler:noop
 });
 try{
  const origin=await listenQoreRadarLoopback(server);
  for(let i=0;i<2;i++){
   const kind=kinds[i],sender=senders[i],token=auth[i];
   const req=await http(origin,'/v1/staging/sender/deliveries/request',token,{
    requestKey:requestKeys[i],vehicleKind:kind,category:'PARCEL',
    grams:i===0?2000:16000,lengthCm:30,widthCm:20,heightCm:10,
    pickupTag:'PICKUP_EAST',deliveryTag:'DELIVERY_WEST',
    restrictedItemDeclared:false});
   assert.equal(req.status,201);
   const deliveryId=req.data.deliveryId;
   assert(uuid.test(deliveryId));
   const ruleBefore=psql("SELECT count(*) FROM public.mobility_stage_g122_delivery_rate_vehicle_qa");
   assert.equal(Number(ruleBefore),i);
   // Existing G7 calculates the immutable amount from a trusted route fixture
   // in this isolated CI, not from an untrusted HTTP customer payload.
   const quoteId=psql("SET ROLE service_role; SELECT "+
    "public.mobility_stage_fare_quote('"+sender+"','"+quoteKeys[i]+"',"+
    "'DELIVERY'::public.mobility_stage_fare_mode,"+
    "'DELIVERY'::public.mobility_stage_fare_subject,'"+deliveryId+"','"+
    zones[i]+"',4800,750,0)::text");
   assert(uuid.test(quoteId));
   const priced=json("SELECT jsonb_build_object('total',total_pyg,"+
    "'version',r.rule_key) FROM public.mobility_stage_fare_quotes q "+
    "JOIN public.mobility_stage_fare_rules r ON r.id=q.rule_id "+
    "WHERE q.id='"+quoteId+"'");
   const payload={deliveryId,quoteId,confirmationKey:keys[i],
    acceptedTotalGs:priced.total,acceptedFareVersion:priced.version};
   const url='/v1/staging/sender/deliveries/quotes/confirm';
   assert.equal((await http(origin,url,token,payload)).status,409,
    'Must refuse a G7 quote without the correct approved vehicle binding');
   // Trusted Admin explicitly binds each synthetic rule to one cargo vehicle.
   psql("SELECT public.mobility_stage_g122_bind_delivery_tariff_qa('"+
    admin+"','"+rules[i]+"','"+kind+"'::public.mobility_vehicle_kind)");
   assert.equal((await http(origin,url,auth[2],payload)).status,403);
   assert.equal((await http(origin,url,auth[1-i],payload)).status,409);
   assert.equal((await http(origin,url,token,{...payload,
    acceptedTotalGs:priced.total+1})).status,409);
   const consent=await http(origin,url,token,payload);
   assert.equal(consent.status,200);
   assert.equal(consent.data.deliveryId,deliveryId);
   assert.equal(consent.data.vehicleKind,kind);
   assert.equal(consent.data.paymentAuthorized,false);
   assert.equal(consent.data.dispatchEnabled,false);
   const replay=await http(origin,url,token,payload);
   assert.equal(replay.status,200);
   assert.equal(replay.data.consentId,consent.data.consentId);
   assert.equal((await http(origin,url,token,{...payload,
    acceptedTotalGs:priced.total+1})).status,409);
   const check=json("SELECT jsonb_build_object('count',count(*),"+
    "'amount',min(accepted_total_gs),'kind',min(vehicle_kind::text)) "+
    "FROM public.mobility_stage_g122_delivery_price_consents "+
    "WHERE delivery_id='"+deliveryId+"'");
   assert.deepEqual(check,{count:1,amount:priced.total,kind});
   assert.equal(psql("SELECT status::text FROM public.mobility_stage_deliveries "+
    "WHERE id='"+deliveryId+"'"),'requested');
   console.log('G122 '+kind+' PASS: one G7 server fare + Owner-bound vehicle tariff + HTTP authenticated exact price acceptance, immutable PG16 receipt, zero dispatch or PSP');
  }
  console.log('G122 PASS: QA synthetic routes/prices only, neither commercial nor deployable');
 }finally{
  if(server.listening)await new Promise((resolve,reject)=>
   server.close(error=>error?reject(error):resolve()));
 }
}
await main();

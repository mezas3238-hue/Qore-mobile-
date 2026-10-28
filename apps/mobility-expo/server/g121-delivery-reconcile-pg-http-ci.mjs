/** G121: actual HTTP/PG16 lost-ACK reconciliation for both delivery vehicles.
 * No price, courier allocation, LIVE, or legal authorization is fabricated. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createQoreRadarLoopbackTransport,listenQoreRadarLoopback}
 from './g4-loopback-http-transport.mjs';
import {createQoreDeliveryCommandGateway}
 from './g5-delivery-command-gateway.mjs';
if(process.env.CI!=='true'||process.env.PGHOST!=='localhost'||
 process.env.PGPORT!=='5432'||process.env.PGDATABASE!=='qore_disposable_chain'||
 process.env.PGAPPNAME!=='qore_ci_disposable_chain')
 throw Error('G121 CI only on disposable PostgreSQL16');
const ids=['12100000-0000-4121-8121-000000000021',
 '12100000-0000-4121-8121-000000000022',
 '12100000-0000-4121-8121-000000000023'];
const keys=['12100000-0000-4121-8121-000000000031',
 '12100000-0000-4121-8121-000000000032'];
const tokens=['g121-sender-moto-qa-token-00000000000000000001',
 'g121-sender-auto-qa-token-00000000000000000002',
 'g121-other-person-qa-token-00000000000000000003'];
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const nope=async()=>({status:404,body:{error:'Not found'}});
function psql(s){
 const out=execFileSync('psql',['-X','-q','-A','-t',
  '-v','ON_ERROR_STOP=1','-c',s],{encoding:'utf8',timeout:15000,
   maxBuffer:1000000,stdio:['ignore','pipe','pipe']});
 return out.trim().split('\n').at(-1)?.trim()??'';
}
const json=s=>JSON.parse(psql(s));
const verified=async token=>{
 const index=tokens.indexOf(token);
 if(index===-1)throw Error('Unverified QA actor');
 return {id:ids[index],is_anonymous:false,
  email_confirmed_at:'2026-10-26T12:00:00Z'};
};
const role=async id=>{
 if(!UUID.test(id))return null;
 return psql("SET ROLE service_role; SELECT CASE WHEN COUNT(*)=1 "+
  "THEN MIN(role::text) ELSE 'none' END FROM public.user_roles "+
  "WHERE user_id='"+id+"'");
};
const requestDelivery=async p=>{
 if(![p.actorId,p.requestKey].every(x=>UUID.test(x))||
  !['AUTO','MOTO'].includes(p.vehicleKind)||
  p.category!=='PARCEL'||
  ![p.grams,p.lengthCm,p.widthCm,p.heightCm].every(Number.isSafeInteger)||
  p.pickupTag!=='PICKUP_EAST'||p.deliveryTag!=='DELIVERY_WEST'||
  p.restrictedItemDeclared!==false)throw Error('QA SQL allowlist');
 const id=psql("SET ROLE service_role; SELECT "+
  "public.mobility_stage_delivery_request('"+p.actorId+"','"+p.requestKey+
  "','"+p.vehicleKind+"'::public.mobility_vehicle_kind,"+
  "'PARCEL'::public.mobility_stage_delivery_category,"+
  p.grams+","+p.lengthCm+","+p.widthCm+","+p.heightCm+
  ",'PICKUP_EAST','DELIVERY_WEST',false)::text");
 return {ok:true,liveEnabled:false,deliveryId:id};
};
const reconcileDelivery=async p=>{
 if(!UUID.test(p.actorId)||!UUID.test(p.requestKey))throw Error('QA scope');
 const data=json("SET ROLE service_role; SELECT COALESCE((SELECT "+
  "jsonb_build_object('deliveryId',id,'requestKey',request_key,"+
  "'vehicleKind',requested_vehicle_kind,'status',status,'revision',revision) "+
  "FROM public.mobility_stage_deliveries "+
  "WHERE request_key='"+p.requestKey+"' AND sender_id='"+p.actorId+"'),"+
  "'null'::jsonb)::text");
 return data===null?null:{ok:true,liveEnabled:false,...data};
};
async function http(origin,path,token,{method='GET',body}={}){
 const headers={authorization:'Bearer '+token};
 if(body!==undefined)headers['content-type']='application/json';
 const response=await fetch(origin+path,{method,headers,redirect:'error',
  ...(body===undefined?{}:{body:JSON.stringify(body)})});
 assert.equal(response.headers.get('cache-control'),'private, no-store, max-age=0');
 return {status:response.status,data:await response.json()};
}
async function main(){
 assert.equal(psql("SELECT (current_database()='qore_disposable_chain' AND "+
  "to_regprocedure('public.mobility_stage_g38_acceptance_fence()') "+
  "IS NOT NULL)::text"),'true');
 psql("INSERT INTO auth.users(id) VALUES ('"+ids[0]+"'),('"+
  ids[1]+"'),('"+ids[2]+"')");
 for(const id of ids)assert.equal(await role(id),'passenger');
 const delivery=createQoreDeliveryCommandGateway({
  projectRef:'staging1234567890abcd',verifyAccessToken:verified,
  resolveRole:role,allowRequest:()=>true,
  requestDelivery,reconcileDelivery,
  acceptDelivery:async()=>{throw Error('No courier in G121')},
  transitionDelivery:async()=>{throw Error('No custody in G121')},
  loadDelivery:async()=>{throw Error('No unverified GET in G121')}
 });
 const server=createQoreRadarLoopbackTransport({
  riderHandler:nope,offerHandler:nope,tripCommandHandler:nope,
  deliveryHandler:delivery,merchantHandler:nope,financeHandler:nope,
  safetyHandler:nope,merchantManagementHandler:nope,deliveryOfferHandler:nope
 });
 try{
  const origin=await listenQoreRadarLoopback(server);
  // G132: load ACTUAL B and C module code from the same G131 four-app
  // checkout, not synthetic snapshots or a second local fork.
  const bDomain=new URL('../../movete-cliente/src/domain/',import.meta.url);
  const cDomain=new URL('../../movete-driver/src/domain/',import.meta.url);
  const [{createG121DeliveryRegistrationGateway},
   {createG5G121VerifiedDeliveryBookingGateway},
   {readPrivateCourierCustody}]=await Promise.all([
    import(new URL('g121-delivery-registration-gateway.mjs',bDomain)),
    import(new URL('g5-g121-verified-delivery-booking-gateway.mjs',bDomain)),
    import(new URL('driver-custody-http.mjs',cDomain))
   ]);
  // The pinned hostname is only a parser fixture; proxy always sends HTTP to localhost.
  const bPin='https://qore-g132-ci.onrender.com';
  let bPosts=0,bGets=0;
  const proxy=(url,opts)=>{
   const u=new URL(url);
   assert.equal(u.origin,bPin,'No outside HTTP provider in GitHub chain');
   assert.equal(u.search,'');assert.equal(u.hash,'');
   assert(u.pathname.startsWith('/v1/staging/sender/deliveries/requests/')||
    u.pathname==='/v1/staging/sender/deliveries/request');
   if(opts.method==='POST')bPosts++;
   else if(opts.method==='GET')bGets++;
   else throw Error('G132 only original G5 POST and private G121 GET');
   return fetch(origin+u.pathname,{...opts,redirect:'error'});
  };
  const bExp=Date.now()+600000;
  const bActor=i=>({role:'passenger',subject:ids[i],token:tokens[i],
   authRevision:1,sessionRevision:1,expiresAt:bExp});
  for(const [i,kind,grams,dims] of [[0,'MOTO',2000,[30,20,10]],
    [1,'AUTO',16000,[65,40,30]]]){
   const body={requestKey:keys[i],vehicleKind:kind,category:'PARCEL',
    grams,lengthCm:dims[0],widthCm:dims[1],heightCm:dims[2],
    pickupTag:'PICKUP_EAST',deliveryTag:'DELIVERY_WEST',
    restrictedItemDeclared:false};
   const path='/v1/staging/sender/deliveries/request';
   const created=await http(origin,path,tokens[i],{method:'POST',body});
   assert.equal(created.status,201);
   assert(UUID.test(created.data.deliveryId));
   const get='/v1/staging/sender/deliveries/requests/'+keys[i];
   const recovered=await http(origin,get,tokens[i]);
   assert.deepEqual(recovered.data,{
    mode:'STAGING_DEMO_ONLY',liveDeliveriesEnabled:false,
    serverPersisted:true,ownerId:ids[i],requestKey:keys[i],
    deliveryId:created.data.deliveryId,vehicleKind:kind,
    status:'requested',revision:1
   });
   assert.equal(recovered.status,200);
   const retry=await http(origin,path,tokens[i],{method:'POST',body});
   assert.equal(retry.status,201);assert.equal(retry.data.deliveryId,created.data.deliveryId);
   const count=psql("SELECT COUNT(*) FROM public.mobility_stage_deliveries "+
    "WHERE request_key='"+keys[i]+"'");
   assert.equal(count,'1');
   assert.equal((await http(origin,get,tokens[1-i])).status,404);
   assert.equal((await http(origin,get,tokens[2])).status,404);
   const altered=await http(origin,path,tokens[i],
    {method:'POST',body:{...body,grams:grams+1}});
   assert.equal(altered.status,409);
   assert.equal((await http(origin,get,tokens[i])).data.deliveryId,
    created.data.deliveryId);
   // B's real owner-scoped G121 HTTP implementation must read the exact
   // original G5 row from PostgreSQL, with immutable identity + revision.
   const getSession=async()=>bActor(i);
   const bRead=createG121DeliveryRegistrationGateway({
    enabled:true,contractCertified:true,externalRuntimeVerified:true,
    passengerRlsVerified:true,ownerApproved:true,
    origin:bPin,pinnedOrigin:bPin,getSession,fetchImpl:proxy
   });
   const proof=await bRead.read({requestKey:keys[i],
    expectedSubject:ids[i],expectedSessionRevision:1});
   assert.equal(proof.ok,true,JSON.stringify(proof));
   assert.equal(proof.deliveryId,created.data.deliveryId);
   assert.equal(proof.vehicleKind,kind);
   assert.equal(proof.deliveryState,'requested');
   assert.equal(proof.registrationOnly,true);
   const bG5=createG5G121VerifiedDeliveryBookingGateway({
    enabled:true,ownerApproved:true,g5ContractVerified:true,
    g121ContractVerified:true,externalRuntimeVerified:true,
    senderRlsVerified:true,ownerTariffGateVerified:true,
    origin:bPin,pinnedOrigin:bPin,getSession,
    readG121:scope=>bRead.read(scope),fetchImpl:proxy
   });
   assert.equal(bG5.isConfigured(),true);
   const bSubmitted=await bG5.send('deliveryRequest',{
    body,expectedSubject:ids[i],expectedSessionRevision:1
   });
   assert.equal(bSubmitted.ok,true,JSON.stringify(bSubmitted));
   assert.equal(bSubmitted.status,201);
   assert.equal(bSubmitted.data.serviceId,created.data.deliveryId);
   assert.equal(bSubmitted.data.operation,'deliveryRequest');
   assert.equal(bSubmitted.bookingConfirmedForProduction,false);
   assert.equal(bSubmitted.commercialEnabled,false);
   const bRecovery=await bG5.reconcile('deliveryRequest',{
    requestKey:keys[i],expectedSubject:ids[i],
    expectedSessionRevision:1,vehicleKind:kind
   });
   assert.equal(bRecovery.ok,true,JSON.stringify(bRecovery));
   assert.equal(bRecovery.data.serviceId,created.data.deliveryId);
   assert.equal(psql("SELECT COUNT(*) FROM public.mobility_stage_deliveries "+
    "WHERE request_key='"+keys[i]+"'"),'1');
   // C's real G66 cannot open custody merely because the sender's G5 row
   // exists; backend has not assigned any courier. One GET, NEVER a POST.
   let cReads=0;
   await assert.rejects(()=>readPrivateCourierCustody({
    apiOrigin:origin,
    accessToken:'g132-unassigned-qa-courier-token-000000001',
    deliveryId:created.data.deliveryId,
    request:(url,opts)=>{
     cReads++;assert.equal(opts.method,'GET');
     return fetch(url,opts);
    }
   }),/not verified/);
   assert.equal(cReads,1);
   assert.equal(psql("SELECT COUNT(*) FROM public.mobility_stage_deliveries "+
    "WHERE id='"+created.data.deliveryId+"' AND courier_id IS NOT NULL"),'0');
   console.log('G132 '+kind+' cross-app: B real G5 POST/G121 GET -> A original PostgreSQL deliveryId -> C real G66 refuses unassigned custody, exactly one durable row, no fake proof or delivery');
   console.log('G121 '+kind+' PASS: PostgreSQL delivery with owner-private lost-ACK GET, one ID, replay safe, foreign denied');
  }
  assert.equal(bPosts,2,'One B original registration replay per vehicle');
  assert.equal(bGets,6,'One B private read, one after POST, one recovery per vehicle');
  console.log('G132 B+C+Backend delivery both AUTO/MOTO across real PostgreSQL16, original immutable ID, zero Driver fake assignment');
  console.log('G121 PASS: both delivery types, NO LIVE, no forged offer/price/GPS');
 }finally{
  if(server.listening)await new Promise((resolve,reject)=>
   server.close(error=>error?reject(error):resolve()));
 }
}
await main();

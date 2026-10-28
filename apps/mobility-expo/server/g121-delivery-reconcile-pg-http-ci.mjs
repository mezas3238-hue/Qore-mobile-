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
   console.log('G121 '+kind+' PASS: PostgreSQL delivery with owner-private lost-ACK GET, one ID, replay safe, foreign denied');
  }
  console.log('G121 PASS: both delivery types, NO LIVE, no forged offer/price/GPS');
 }finally{
  if(server.listening)await new Promise((resolve,reject)=>
   server.close(error=>error?reject(error):resolve()));
 }
}
await main();

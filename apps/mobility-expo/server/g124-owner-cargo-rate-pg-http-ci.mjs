/** G124 genuine localhost Owner JWT/AAL2 HTTP→SQL on disposable PG16.
 * Server only: all prices/routes and actors are synthetic. No LIVE, PSP,
 * mobile route source, real tariff approval or internet call.
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createQoreRadarLoopbackTransport,listenQoreRadarLoopback}
 from './g4-loopback-http-transport.mjs';
import {createG124OwnerCargoRateGateway}
 from './g124-owner-cargo-rate-gateway.mjs';
if(process.env.CI!=='true'||process.env.PGHOST!=='localhost'||
 process.env.PGPORT!=='5432'||process.env.PGDATABASE!=='qore_disposable_chain'||
 process.env.PGAPPNAME!=='qore_ci_disposable_chain')
 throw Error('G124 runs ONLY disposable GitHub PG16');
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const owner='12400000-0000-4124-8124-000000000001';
const operator='12400000-0000-4124-8124-000000000002';
const passenger=['12400000-0000-4124-8124-000000000011',
 '12400000-0000-4124-8124-000000000012'];
const keys=['12400000-0000-4124-8124-000000000021',
 '12400000-0000-4124-8124-000000000022'];
const ownerToken='g124-owner-verified-private-aal2-qa-token';
const adminToken='g124-admin-verified-private-aal2-qa-token';
const ownerSession='12400000-0000-4124-8124-000000000031';
const adminSession='12400000-0000-4124-8124-000000000032';
const noop=async()=>({status:404,body:{error:'Not found'}});
function sql(q){
 const r=execFileSync('psql',['-X','-q','-A','-t','-v','ON_ERROR_STOP=1',
  '-c',q],{encoding:'utf8',timeout:15000,maxBuffer:1000000,
   stdio:['ignore','pipe','pipe']});
 return r.trim().split('\n').at(-1)?.trim()??'';
}
function data(q){const x=sql(q);return x?JSON.parse(x):null;}
function safeText(v){
 if(typeof v==='string'&&(UUID.test(v)||/^[A-Z_]{3,25}$/.test(v)))
  return "'"+v+"'";
 if(Number.isSafeInteger(v)&&v>=0&&v<=1000000)return String(v);
 throw Error('G124 refused untrusted SQL parameter');
}
function rpc(name,args){
 const signatures={
  mobility_stage_g124_owner_rate_read_qa:['actorId','vehicleKind','cargoZone'],
  mobility_stage_g124_owner_rate_set_qa:[
   'actorId','requestKey','vehicleKind','cargoZone','basePyg','perKmPyg',
   'perMinutePyg','minimumPyg','commissionBps','durationDays']
 };
 const names=signatures[name];
 if(!names||Object.keys(args).length!==names.length||
  names.some(x=>!Object.hasOwn(args,x)))throw Error('G124 rejected RPC argument shape');
 return data('SET ROLE service_role; SELECT public.'+name+'('+
  names.map(x=>safeText(args[x])).join(',')+')::text');
}
const setRate=async p=>rpc('mobility_stage_g124_owner_rate_set_qa',p);
const getRate=async p=>rpc('mobility_stage_g124_owner_rate_read_qa',p);
async function http(origin,path,token,{method='GET',body}={}){
 const headers={authorization:'Bearer '+token};
 if(body!==undefined)headers['content-type']='application/json';
 const response=await fetch(origin+path,{method,redirect:'error',headers,
  ...(body===undefined?{}:{body:JSON.stringify(body)})});
 assert.equal(response.headers.get('cache-control'),'private, no-store, max-age=0');
 return {status:response.status,data:await response.json()};
}
function savedDelivery(sender,kind,key){
 if(!UUID.test(sender)||!UUID.test(key)||!['AUTO','MOTO'].includes(kind))
  throw Error('Invalid synthetic delivery');
 const id=sql("SET ROLE service_role; SELECT "+
  "public.mobility_stage_delivery_request('"+sender+"','"+key+"','"+
  kind+"'::public.mobility_vehicle_kind,"+
  "'PARCEL'::public.mobility_stage_delivery_category,"+
  "2400,30,20,10,'PICKUP_EAST','DELIVERY_WEST',false)::text");
 assert(UUID.test(id));return id;
}
function quote(sender,delivery,ruleZone,quoteKey){
 for(const v of [sender,delivery,quoteKey])assert(UUID.test(v));
 assert(/^[A-Z_]{3,25}$/.test(ruleZone));
 const id=sql("SET ROLE service_role; SELECT "+
  "public.mobility_stage_fare_quote('"+sender+"','"+quoteKey+"',"+
  "'DELIVERY'::public.mobility_stage_fare_mode,"+
  "'DELIVERY'::public.mobility_stage_fare_subject,'"+delivery+"','"+
  ruleZone+"',4800,720,0)::text");
 assert(UUID.test(id));
 return data("SELECT jsonb_build_object('id',q.id,'totalGs',q.total_pyg,"+
  "'commissionBps',q.commission_bps,'ruleId',q.rule_id,"+
  "'version',r.rule_key) FROM public.mobility_stage_fare_quotes q "+
  "JOIN public.mobility_stage_fare_rules r ON r.id=q.rule_id "+
  "WHERE q.id='"+id+"'");
}
function consent(sender,delivery,quote,confirmationKey){
 assert([sender,delivery,quote.id,confirmationKey].every(x=>UUID.test(x)));
 const rec=data("SET ROLE service_role; SELECT "+
  "public.mobility_stage_g122_accept_delivery_quote_qa('"+
  sender+"','"+delivery+"','"+quote.id+"','"+confirmationKey+"',"+
  quote.totalGs+",'"+quote.version+"')::text");
 assert.equal(rec.deliveryId,delivery);
 assert.equal(rec.acceptedTotalGs,quote.totalGs);
 return rec;
}
async function main(){
 assert.equal(sql("SELECT (current_database()='qore_disposable_chain' AND "+
  "to_regclass('public.mobility_stage_g124_delivery_tariff_policy') IS NOT NULL)::text"),'true');
 sql("INSERT INTO auth.users(id) VALUES ('"+owner+"'),('"+operator+"'),('"+
  passenger[0]+"'),('"+passenger[1]+"');"+
  "DELETE FROM public.user_roles WHERE user_id IN ('"+owner+"','"+operator+"');"+
  "INSERT INTO public.mobility_stage_backoffice_roles(user_id,role,status,approved_by)"+
  " VALUES('"+owner+"','owner','active','"+owner+"'),"+
  "('"+operator+"','admin','active','"+owner+"')");
 const role=id=>{
  assert(UUID.test(id));return sql("SET ROLE service_role; SELECT "+
   "public.mobility_stage_g27_backoffice_role_of('"+id+"')");
 };
 assert.equal(role(owner),'owner');assert.equal(role(operator),'admin');
 let revoked=false,lowMfa=false;
 const at=Date.now();
 const gateway=createG124OwnerCargoRateGateway({
  projectRef:'staging1234567890abcd',environment:'isolated_staging',
  qaOnly:true,liveEnabled:false,
  verifyAccessToken:async token=>{
   if(token===ownerToken)return {id:owner,sessionId:ownerSession,
    is_anonymous:false,expiresAtMs:at+600000};
   if(token===adminToken)return {id:operator,sessionId:adminSession,
    is_anonymous:false,expiresAtMs:at+600000};
   throw Error('Invalid synthetic Auth provider JWT');
  },
  verifySessionNotRevoked:async({userId})=>!revoked&&userId===owner||
   !revoked&&userId===operator,
  loadExclusiveBackofficeRole:async userId=>role(userId),
  verifyBackofficeMfa:async({userId,sessionId})=>({
   verifiedByProvider:true,userId,sessionId,
   assuranceLevel:lowMfa?'aal1':'aal2',
   verifiedAtMs:at-1000,expiresAtMs:at+300000
  }),
  allowRequest:()=>true,readPolicy:getRate,changePolicy:setRate,now:()=>at
 });
 const server=createQoreRadarLoopbackTransport({
  riderHandler:noop,offerHandler:noop,tripCommandHandler:noop,
  deliveryHandler:noop,merchantHandler:noop,financeHandler:noop,
  safetyHandler:noop,merchantManagementHandler:noop,deliveryOfferHandler:noop,
  ownerCargoRateHandler:gateway
 });
 try{
  const origin=await listenQoreRadarLoopback(server);
  assert.equal(new URL(origin).hostname,'127.0.0.1');
  for(const [i,kind] of ['MOTO','AUTO'].entries()){
   const path='/v1/staging/owner/delivery-rates/'+kind+'/ASUNCION';
   const body={
    requestKey:keys[i],basePyg:i===0?2100:4700,
    perKmPyg:i===0?800:1500,
    perMinutePyg:100,minimumPyg:i===0?4000:6500,
    commissionBps:i===0?800:1300,durationDays:30
   };
   assert.equal((await http(origin,path,ownerToken)).status,404);
   assert.equal((await http(origin,path,adminToken,
    {method:'POST',body})).status,403);
   lowMfa=true;
   assert.equal((await http(origin,path,ownerToken,
    {method:'POST',body})).status,403);
   lowMfa=false;
   const first=await http(origin,path,ownerToken,{method:'POST',body});
   assert.equal(first.status,200,JSON.stringify(first));
   assert.equal(first.data.version,1);
   assert.equal(first.data.vehicleKind,kind);
   assert.equal(first.data.passengerSubsidyPolicyApplicable,false);
   assert.equal((await http(origin,path,ownerToken)).data.ruleId,first.data.ruleId);
   assert.equal((await http(origin,path,ownerToken,
    {method:'POST',body})).data.ruleId,first.data.ruleId);
   assert.equal((await http(origin,path,ownerToken,
    {method:'POST',body:{...body,basePyg:body.basePyg+1}})).status,409);
   const sender=passenger[i],vehicleZone=kind+'_ASUNCION';
   const delivery=savedDelivery(sender,kind,
    '12400000-0000-4124-8124-00000000004'+(i+1));
   const q1=quote(sender,delivery,vehicleZone,
    '12400000-0000-4124-8124-00000000005'+(i+1));
   assert.equal(q1.ruleId,first.data.ruleId);
   consent(sender,delivery,q1,'12400000-0000-4124-8124-00000000006'+(i+1));
   assert.equal(sql("SELECT public.mobility_stage_g123_delivery_priced_qa('"+
    delivery+"')::text"),'true');
   const secondBody={...body,requestKey:
    '12400000-0000-4124-8124-00000000007'+(i+1),
    basePyg:body.basePyg+1200,commissionBps:body.commissionBps+100};
   const second=await http(origin,path,ownerToken,
    {method:'POST',body:secondBody});
   assert.equal(second.status,200,JSON.stringify(second));
   assert.equal(second.data.version,2);
   assert.notEqual(second.data.ruleId,first.data.ruleId);
   assert.equal(sql("SELECT active::text FROM public.mobility_stage_fare_rules "+
    "WHERE id='"+first.data.ruleId+"'"),'false');
   const unchanged=data("SELECT jsonb_build_object('totalGs',total_pyg,"+
    "'commissionBps',commission_bps,'ruleId',rule_id) "+
    "FROM public.mobility_stage_fare_quotes WHERE id='"+q1.id+"'");
   assert.deepEqual(unchanged,{totalGs:q1.totalGs,
    commissionBps:q1.commissionBps,ruleId:q1.ruleId});
   assert.equal(sql("SELECT public.mobility_stage_g123_delivery_priced_qa('"+
    delivery+"')::text"),'true',
    'G123 must preserve accepted original price until quote naturally expires');
   const again=savedDelivery(sender,kind,
    '12400000-0000-4124-8124-00000000008'+(i+1));
   const q2=quote(sender,again,vehicleZone,
    '12400000-0000-4124-8124-00000000009'+(i+1));
   assert.equal(q2.ruleId,second.data.ruleId);
   assert.notEqual(q1.totalGs,q2.totalGs);
   consent(sender,again,q2,'12400000-0000-4124-8124-00000000010'+(i+1));
   assert.equal(sql("SELECT public.mobility_stage_g123_delivery_priced_qa('"+
    again+"')::text"),'true');
   const oldReceipt=await http(origin,path,ownerToken,
    {method:'POST',body});
   assert.equal(oldReceipt.data.version,1);
   assert.equal(oldReceipt.data.ruleId,first.data.ruleId);
   assert.equal(sql("SELECT count(*) FROM public.mobility_stage_g124_delivery_tariff_audit "+
    "WHERE vehicle_kind='"+kind+"'"),'2');
   console.log('G124 '+kind+' PASS: Owner private AAL2 HTTP→PG16 independent cargo rate v1→v2; immutable older accepted quote; fresh quote updated, 2 audit events; Admin/AAL1 denied');
  }
  revoked=true;
  assert.equal((await http(origin,
   '/v1/staging/owner/delivery-rates/AUTO/ASUNCION',ownerToken)).status,401);
  const count=sql("SELECT count(*) FROM public.mobility_stage_g124_delivery_tariff_policy");
  assert.equal(count,'2');
  console.log('G124 PASS: no LIVE, no PSP, no verified real road data; no passenger policy changed');
 }finally{
  if(server.listening)await new Promise((resolve,reject)=>
   server.close(error=>error?reject(error):resolve()));
 }
}
await main();

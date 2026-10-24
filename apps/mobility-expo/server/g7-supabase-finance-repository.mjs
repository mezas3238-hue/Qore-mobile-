/** Server-only G7 fare and SIMULATED payment persistence adapter. */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MODES=new Set(['AUTO','MOTO','DELIVERY','MERCHANT_DELIVERY']);
const SUBJECTS=new Set(['RIDE','DELIVERY','MERCHANT_ORDER']);
const METHODS=new Set(['SIMULATED_CASH','SIMULATED_CARD']);
const ACTIONS=new Set(['capture','refund','cancel']);
const STATUSES=new Set(['authorized','captured','refunded','cancelled']);
const SUBJECT_MODE=new Map([
 ['RIDE',new Set(['AUTO','MOTO'])],['DELIVERY',new Set(['DELIVERY'])],
 ['MERCHANT_ORDER',new Set(['MERCHANT_DELIVERY'])],
]);
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const validId=value=>typeof value==='string'&&UUID.test(value);
const integer=(value,min,max)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
const ok=extra=>Object.freeze({ok:true,liveEnabled:false,...extra});
function assertClient(client){
 if(!client||typeof client.rpc!=='function'||typeof client.from!=='function')
  throw Error('Server-only finance persistence client required');
}
function assertBase(params){
 if(!plain(params)||params.modeGuard!=='SYNTHETIC_STAGING'||params.liveEnabled!==false||
   !validId(params.actorId))throw Error('Invalid staging finance input');
}
async function rpc(client,name,params){
 const {data,error}=await client.rpc(name,params);
 if(error||!validId(data))throw Error('Staging finance RPC rejected');
 return data;
}
function safeQuote(row,id,actorId){
 if(!plain(row)||row.id!==id||row.customer_id!==actorId||!MODES.has(row.mode)||
   !SUBJECTS.has(row.subject_kind)||!validId(row.subject_id)||
   typeof row.rule_key!=='string'||!/^[a-zA-Z0-9._-]{1,48}$/.test(row.rule_key)||
   !integer(row.total_pyg,0,100000000)||!integer(row.subtotal_pyg,0,100000000)||
   !integer(row.tolls_pyg,0,1000000)||!integer(row.commission_bps,0,3000)||
   !integer(row.commission_pyg,0,100000000)||!integer(row.provider_pyg,0,100000000)||
   typeof row.expires_at!=='string'||!Number.isFinite(Date.parse(row.expires_at))||
   row.total_pyg!==row.subtotal_pyg+row.tolls_pyg||
   row.provider_pyg+row.commission_pyg!==row.total_pyg)
  throw Error('Malformed fare quote');
 return Object.freeze({id:row.id,mode:row.mode,subjectKind:row.subject_kind,
  subjectId:row.subject_id,ruleVersion:row.rule_key,subtotalPyg:row.subtotal_pyg,
  tollsPyg:row.tolls_pyg,totalPyg:row.total_pyg,commissionBps:row.commission_bps,
  commissionPyg:row.commission_pyg,providerPyg:row.provider_pyg,
  expiresAt:row.expires_at});
}
function safePayment(row,id,actorId){
 if(!plain(row)||row.id!==id||row.customer_id!==actorId||!validId(row.quote_id)||
   !METHODS.has(row.method)||!STATUSES.has(row.status)||
   !integer(row.amount_pyg,0,100000000)||!integer(row.revision,1,Number.MAX_SAFE_INTEGER))
  throw Error('Malformed simulated payment');
 return Object.freeze({id:row.id,quoteId:row.quote_id,method:row.method,
  amountPyg:row.amount_pyg,status:row.status,revision:row.revision});
}

export const SUPABASE_FINANCE_LIVE_ENABLED=false;
export function createSupabaseStagingFinanceRepository(client){
 assertClient(client);
 const loadQuote=async(actorId,quoteId)=>{
  const {data,error}=await client.from('mobility_stage_fare_quotes')
   .select('id,customer_id,mode,subject_kind,subject_id,subtotal_pyg,tolls_pyg,total_pyg,commission_bps,commission_pyg,provider_pyg,expires_at,mobility_stage_fare_rules!inner(rule_key)')
   .eq('id',quoteId).eq('customer_id',actorId).maybeSingle();
  if(error||!data)throw Error('Fare quote unavailable');
  const rule=Array.isArray(data.mobility_stage_fare_rules)?
   data.mobility_stage_fare_rules[0]:data.mobility_stage_fare_rules;
  return safeQuote({...data,rule_key:rule?.rule_key},quoteId,actorId);
 };
 return Object.freeze({
  async quote(params){
   assertBase(params);
   if(!validId(params.requestKey)||!MODES.has(params.fareMode)||
     !SUBJECTS.has(params.subjectKind)||!validId(params.subjectId)||
     SUBJECT_MODE.get(params.subjectKind)?.has(params.fareMode)!==true||
     typeof params.zoneTag!=='string'||!/^[A-Z_]{3,40}$/.test(params.zoneTag)||
     !integer(params.distanceMeters,0,500000)||!integer(params.durationSeconds,0,86400)||
     !integer(params.tollsPyg,0,1000000))throw Error('Invalid fare quote');
   const quoteId=await rpc(client,'mobility_stage_fare_quote',{
    _customer_id:params.actorId,_request_key:params.requestKey,_mode:params.fareMode,
    _subject_kind:params.subjectKind,_subject_id:params.subjectId,
    _zone_tag:params.zoneTag,_distance_meters:params.distanceMeters,
    _duration_seconds:params.durationSeconds,_tolls_pyg:params.tollsPyg,
   });
   return ok({quote:await loadQuote(params.actorId,quoteId)});
  },
  async authorize(params){
   assertBase(params);
   if(!validId(params.quoteId)||!METHODS.has(params.method)||!validId(params.requestKey))
    throw Error('Invalid simulated payment authorization');
   const paymentId=await rpc(client,'mobility_stage_payment_authorize',{
    _customer_id:params.actorId,_quote_id:params.quoteId,_method:params.method,
    _request_key:params.requestKey,
   });
   return ok({paymentId});
  },
  async transition(params){
   assertBase(params);
   if(!validId(params.paymentId)||!ACTIONS.has(params.event)||!validId(params.eventKey))
    throw Error('Invalid simulated payment transition');
   const eventId=await rpc(client,'mobility_stage_payment_transition',{
    _payment_id:params.paymentId,_actor_id:params.actorId,
    _action:params.event,_request_key:params.eventKey,
   });
   return ok({eventId});
  },
  async paymentSnapshot(params){
   assertBase(params);
   if(!validId(params.paymentId))throw Error('Invalid simulated payment snapshot');
   const {data,error}=await client.from('mobility_stage_payment_intents')
    .select('id,quote_id,customer_id,method,amount_pyg,status,revision')
    .eq('id',params.paymentId).eq('customer_id',params.actorId).maybeSingle();
   if(error||!data)throw Error('Simulated payment unavailable');
   return ok({payment:safePayment(data,params.paymentId,params.actorId)});
  },
 });
}

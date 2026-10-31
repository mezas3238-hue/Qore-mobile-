/**
 * G248 — isolated STAGING-only KYC automatic monitor coordinator.
 *
 * The server calls PostgreSQL's owner-only atomic G248 RPC for each due tick.
 * PostgreSQL owns durable scan cursors and the SKIP LOCKED replica fence.
 * No Admin action, Driver app foreground event, push provider, secret loading,
 * network binding or production enablement happens here.
 */
export const G248_DOCUMENT_MONITOR_LIVE_ENABLED=false;
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const integer=v=>Number.isSafeInteger(v)&&v>=0;
const exact=(v,keys)=>v!==null&&typeof v==='object'&&
 !Array.isArray(v)&&Object.keys(v).length===keys.length&&
 keys.every(k=>Object.hasOwn(v,k));
const busyKeys=['mode','status','qaOnly','productionEnabled',
 'driverDispatchAuthorized'];
const processedKeys=['mode','status','processed','inserted','duplicate',
 'cycleCompleted','resumeCursor','checkpointRevision','qaOnly',
 'productionEnabled','driverDispatchAuthorized'];
function verifyReceipt(v,limit){
 if(!v||v.mode!=='STAGING_DEMO_ONLY'||v.qaOnly!==true||
  v.productionEnabled!==false||v.driverDispatchAuthorized!==false)
  throw Error('G248_UNTRUSTED_SQL_RECEIPT');
 if(v.status==='BUSY'){
  if(!exact(v,busyKeys))throw Error('G248_UNTRUSTED_SQL_RECEIPT');
  return Object.freeze({status:'BUSY',qaOnly:true,productionEnabled:false});
 }
 if(!exact(v,processedKeys)||v.status!=='PROCESSED'||
  ![v.processed,v.inserted,v.duplicate,v.checkpointRevision].every(integer)||
  v.checkpointRevision<1||v.processed>limit||
  v.inserted+v.duplicate!==v.processed||
  typeof v.cycleCompleted!=='boolean'||
  !(v.resumeCursor===null||typeof v.resumeCursor==='string'&&
    UUID.test(v.resumeCursor))||
  v.cycleCompleted!==(v.resumeCursor===null))
  throw Error('G248_UNTRUSTED_SQL_RECEIPT');
 return Object.freeze({
  status:'PROCESSED',processed:v.processed,inserted:v.inserted,
  duplicate:v.duplicate,cycleCompleted:v.cycleCompleted,
  checkpointRevision:v.checkpointRevision,
  qaOnly:true,productionEnabled:false
 });
}
export function createG248PrivateKycPgRepository({
 client,environment,qaOnly,liveEnabled
}={}){
 if(!client||typeof client.rpc!=='function'||
  environment!=='isolated_staging'||qaOnly!==true||
  liveEnabled!==false)
  throw Error('G248_PRIVATE_OWNER_PG_REQUIRED');
 return Object.freeze({
  async runBatch({limit}={}){
   if(!Number.isSafeInteger(limit)||limit<1||limit>50)
    throw Error('G248_INVALID_BATCH');
   let response;
   try{
    response=await client.rpc('mobility_stage_g248_run_due_kyc_batch_owner_qa',
     {_limit:limit});
   }catch{throw Error('G248_DATABASE_UNAVAILABLE');}
   if(!response||response.error||!Object.hasOwn(response,'data'))
    throw Error('G248_DATABASE_UNAVAILABLE');
   return verifyReceipt(response.data,limit);
  }
 });
}
/**
 * The infrastructure runtime must explicitly start this opt-in worker only
 * after an independently authorized isolated STAGING deployment.
 * Each tick runs ONE bounded SQL transaction and never loops unboundedly.
 * A period defaults to one hour, independent of handset state.
 */
export function createG248PrivateKycScheduledWorker({
 repository,environment,qaOnly,liveEnabled,
 intervalMs=3600000,maxDocuments=50,
 schedule=(fn,ms)=>setInterval(fn,ms),
 cancel=handle=>clearInterval(handle)
}={}){
 if(environment!=='isolated_staging'||qaOnly!==true||
  liveEnabled!==false||!repository||typeof repository.runBatch!=='function'||
  typeof schedule!=='function'||typeof cancel!=='function'||
  !Number.isSafeInteger(intervalMs)||intervalMs<60000||
  intervalMs>86400000||!Number.isSafeInteger(maxDocuments)||
  maxDocuments<1||maxDocuments>50)
  throw Error('G248_STAGING_SCHEDULER_REQUIRED');
 let active=false,inFlight=false,timer=null,epoch=0;
 async function tick(){
  if(!active)return Object.freeze({ok:false,reason:'NOT_RUNNING'});
  if(inFlight)return Object.freeze({ok:false,reason:'OVERLAPPING'});
  inFlight=true;
  const ticket=epoch;
  try{
   const result=await repository.runBatch({limit:maxDocuments});
   if(!active||ticket!==epoch)
    return Object.freeze({ok:false,reason:'STOPPED'});
   if(result?.status==='BUSY')
    return Object.freeze({ok:false,reason:'ANOTHER_INSTANCE_RUNNING'});
   if(!result||result.status!=='PROCESSED'||result.qaOnly!==true||
    result.productionEnabled!==false||!integer(result.processed)||
    result.processed>maxDocuments||!integer(result.inserted)||
    !integer(result.duplicate)||
    result.inserted+result.duplicate!==result.processed||
    typeof result.cycleCompleted!=='boolean'||
    !integer(result.checkpointRevision)||result.checkpointRevision<1)
    throw Error('unverified repository result');
   return Object.freeze({ok:true,processed:result.processed,
    inserted:result.inserted,duplicate:result.duplicate,
    cycleCompleted:result.cycleCompleted,
    checkpointRevision:result.checkpointRevision,
    qaOnly:true,productionEnabled:false});
  }catch{
   return Object.freeze({ok:false,reason:'PRIVATE_SQL_UNAVAILABLE'});
  }finally{inFlight=false;}
 }
 function start(){
  if(active)return false;
  active=true;epoch++;
  try{
   timer=schedule(()=>{void tick();},intervalMs);
   if(timer===null||timer===undefined||timer===false)
    throw Error('timer unavailable');
   if(typeof timer.unref==='function')timer.unref();
   void tick(); // recover persisted cursor on restart
   return true;
  }catch{
   epoch++;active=false;
   if(timer!==null)try{cancel(timer);}catch{}
   timer=null;return false;
  }
 }
 function stop(){
  epoch++;active=false;
  if(timer!==null)try{cancel(timer);}catch{}
  timer=null;
 }
 return Object.freeze({start,stop,tick,
  snapshot:()=>Object.freeze({running:active,inFlight,
   intervalMs,maxDocuments,qaOnly:true,productionEnabled:false})});
}

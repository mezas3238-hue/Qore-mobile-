/**
 * G113 STAGING-only server-side periodic, bounded AUTO retry coordinator.
 * A live deployment requires a separate Owner-governed infrastructure gate;
 * this module intentionally never auto-starts or creates external resources.
 * It delegates all selection/concurrency/KYC/legal decisions to PostgreSQL.
 */
export const G113_DISPATCH_LIVE_ENABLED=false;
const KEYS=['mode','commercialEnabled','processed','waiting',
 'offered','closed','exhausted'];
const integer=n=>Number.isSafeInteger(n)&&n>=0&&n<=10;
const valid=(data,max)=>{
 const enriched=data?.qaOnly===true&&data?.productionEnabled===false;
 if(!data||typeof data!=='object'||Array.isArray(data)||
  Object.keys(data).length!==KEYS.length+(enriched?2:0)||
  !KEYS.every(k=>Object.hasOwn(data,k))||
  data.mode!=='STAGING_DEMO_ONLY'||data.commercialEnabled!==false||
  !['processed','waiting','offered','closed','exhausted']
   .every(k=>integer(data[k]))||data.processed>max||
  data.processed!==data.waiting+data.offered+data.closed+data.exhausted)
  throw Error('G113 untrusted private PostgreSQL worker receipt');
 return Object.freeze({...data,qaOnly:true,productionEnabled:false});
};
export function createG113AutoDispatchRetryWorker({
 environment,qaOnly,liveEnabled,runDueBatch,
 intervalMs=30000,maxJobs=5,
 schedule=(run,ms)=>setInterval(run,ms),
 cancel=handle=>clearInterval(handle)
}={}){
 if(environment!=='isolated_staging'||qaOnly!==true||
  liveEnabled!==false||typeof runDueBatch!=='function'||
  typeof schedule!=='function'||typeof cancel!=='function'||
  !Number.isSafeInteger(intervalMs)||intervalMs<15000||intervalMs>120000||
  !Number.isSafeInteger(maxJobs)||maxJobs<1||maxJobs>10)
  throw Error('G113 requires bounded STAGING-only server worker');
 let active=false,busy=false,timer=null,generation=0;
 async function tick(){
  if(!active)return Object.freeze({ok:false,reason:'NOT_RUNNING'});
  if(busy)return Object.freeze({ok:false,reason:'BUSY'});
  busy=true;const version=generation;
  try{
   const result=valid(await runDueBatch({limit:maxJobs}),maxJobs);
   if(version!==generation||!active)
    return Object.freeze({ok:false,reason:'STOPPED'});
   return Object.freeze({ok:true,result});
  }catch{
   return Object.freeze({ok:false,reason:'SQL_UNAVAILABLE'});
  }finally{busy=false;}
 }
 function start(){
  if(active)return false;
  active=true;generation++;
  try{
   timer=schedule(()=>{void tick();},intervalMs);
   if(!timer)throw Error('G113 timer unavailable');
   if(typeof timer.unref==='function')timer.unref();
   // An initial tick is intentional: restart resumes due persisted jobs
   // instead of waiting 30 seconds. No Passenger/mobile POST is involved.
   void tick();
   return true;
  }catch{
   generation++;active=false;
   if(timer!==null)try{cancel(timer);}catch{}
   timer=null;return false;
  }
 }
 function stop(){
  generation++;active=false;
  if(timer!==null){try{cancel(timer);}catch{}timer=null;}
 }
 return Object.freeze({start,stop,tick,
  snapshot:()=>Object.freeze({running:active,busy,qaOnly:true,
   productionEnabled:false,maxJobs,intervalMs})});
}
export function createG113AutoDispatchBatchRepository(client){
 if(!client||typeof client.rpc!=='function')
  throw Error('G113 requires server-only PostgreSQL RPC client');
 return Object.freeze({
  async runDueBatch({limit}={}){
   if(!Number.isSafeInteger(limit)||limit<1||limit>10)
    throw Error('G113 invalid due-job budget');
   const {data,error}=await client.rpc(
    'mobility_stage_g113_run_due_auto_batch_qa',{_limit:limit});
   if(error)throw Error('G113 private SQL batch failed');
   return valid(data,limit);
  }
 });
}

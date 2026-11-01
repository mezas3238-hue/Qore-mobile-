/**
 * G282: Railway STAGING-only optional G113 automatic due-booking coordinator.
 * Not a public API. It never creates identities, documents, route proofs,
 * trips, offers, tariffs or KYC approval. The PostgreSQL G112/G113 worker
 * retains all original trip and Driver-eligibility decisions.
 *
 * Operator attestations are deployment gates, NOT proof of legal eligibility.
 * G269/G112 PostgreSQL separately validates actual consent, road proof,
 * vehicle/Driver compliance and RIDE pickup radius before each offer.
 */
const REF='mrjzxftsdxzepzbcuids';
const flags=[
 'QORE_G113_AUTO_RETRY_QA_APPROVED',
 'QORE_G269_ROAD_EVIDENCE_READY',
 'QORE_DRIVER_COMPLIANCE_READY',
 'QORE_OWNER_AUTO_FARE_PUBLISHED'
];
const fail=()=>new Error('G282 Railway STAGING private AUTO retry blocked');

export function readG282RailwayAutoRetryOptIn(env={}){
 if(env==null||typeof env!=='object'||Array.isArray(env))throw fail();
 for(const key of flags){
  if(![undefined,'false','true'].includes(env[key]))throw fail();
 }
 if(env.QORE_G113_AUTO_RETRY_QA_APPROVED!== 'true')return false;
 if(env.QORE_STAGING_PROJECT_REF!==REF||
    env.QORE_MOBILITY_ENV!=='staging'||
    env.RAILWAY_ENVIRONMENT_NAME!=='staging'||
    env.QORE_RAILWAY_STAGING_APPROVED!=='true'||
    env.QORE_RAILWAY_NO_COMMERCIAL_TRIPS!=='true'||
    env.LIVE_TRIPS_ENABLED!=='false'||
    flags.slice(1).some(key=>env[key]!=='true'))
  throw fail();
 return true;
}

/**
 * Probe G113 by asking for an intentionally forbidden limit=0.
 * Expected P2694 is produced before reading/locking any job. This tests
 * that the migration is installed AND the backend's service_role can reach
 * the protected RPC, without dispatching or incrementing an attempt.
 */
export async function assertG282PrivateBatchInstalled(rpc){
 if(typeof rpc!=='function')throw fail();
 try{
  const result=await rpc('mobility_stage_g113_run_due_auto_batch_qa',{_limit:0});
  if(result?.data!==null||result?.error?.code!=='P2694')throw fail();
  return true;
 }catch{throw fail();}
}

export function startG282RailwayRetryWorker({worker,enabled}={}){
 if(enabled===false)return Object.freeze({started:false,stop:()=>false});
 if(enabled!==true||typeof worker?.start!=='function'||
   typeof worker.stop!=='function'||typeof worker.snapshot!=='function')
  throw fail();
 let started=false;
 try{
  started=worker.start()===true;
  if(!started||worker.snapshot()?.running!==true)throw fail();
 }catch{
  if(started)try{worker.stop();}catch{}
  throw fail();
 }
 let stopped=false;
 return Object.freeze({
  started:true,
  stop:()=>{
   if(stopped)return false;
   stopped=true;
   worker.stop();
   return true;
  }
 });
}

/** G86: explicit, bounded QA-only dispatch drain. No background timer, job
 * scheduler, network listener, public route, or deployment side effect.
 *
 * The G85 SQL function owns transactional selection/locking. An uncertain
 * result is a HARD error; never retry it blindly in this process. A later
 * manual invocation can safely reconcile the persisted G85 job.
 */
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const STATUSES=new Set(['IDLE','WAITING','OFFERED','CLOSED','EXHAUSTED']);
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 Object.getPrototypeOf(x)===Object.prototype;
function parseReceipt(response){
 if(!plain(response)||response.error!==null||!plain(response.data))
  throw Error('G86 uncertain PostgreSQL worker outcome');
 const x=response.data;
 if(x.mode!=='STAGING_DEMO_ONLY'||x.commercialEnabled!==false||
    !STATUSES.has(x.status))throw Error('G86 SQL receipt not isolated QA');
 const allowed=x.status==='IDLE'?['mode','commercialEnabled','status']:
  ['mode','commercialEnabled','status','tripId',
   ...(x.status==='WAITING'||x.status==='OFFERED'?['offerId']:[])];
 if(Object.keys(x).length!==allowed.length||
    !allowed.every(k=>Object.hasOwn(x,k)))
  throw Error('G86 malformed SQL receipt');
 if(x.status!=='IDLE'&&!UUID.test(x.tripId))
  throw Error('G86 invalid PostgreSQL trip reference');
 if(x.status==='OFFERED'&&!UUID.test(x.offerId))
  throw Error('G86 invalid PostgreSQL offer reference');
 if(x.status==='WAITING'&&x.offerId!==null)
  throw Error('G86 phantom Driver offer');
 return x.status;
}
export function createG86ManualDispatchRunner({
 database,environment,liveEnabled,manualQaApproved,maxClaims=3
}={}){
 if(!database||typeof database.rpc!=='function'||
    environment!=='isolated_qa_disposable'||
    liveEnabled!==false||manualQaApproved!==true||
    !Number.isSafeInteger(maxClaims)||maxClaims<1||maxClaims>5)
  throw Error('G86 manual disposable QA authorization required');
 return Object.freeze({
  async drainOnce(){
   const counts={WAITING:0,OFFERED:0,CLOSED:0,EXHAUSTED:0};
   let checked=0;
   for(let i=0;i<maxClaims;i++){
    let response;
    try{response=await database.rpc('mobility_stage_g85_run_one_dispatch_qa',{});}
    catch{throw Error('G86 uncertain PostgreSQL worker outcome');}
    const status=parseReceipt(response);
    if(status==='IDLE')break;
    counts[status]++;checked++;
   }
   return Object.freeze({mode:'ISOLATED_DISPOSABLE_QA_ONLY',
    commercialRidesEnabled:false,pushDelivered:false,
    claimedJobs:checked,...counts});
  }
 });
}

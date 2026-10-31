/**
 * G247: server-owner PostgreSQL adapter for the CI-only durable KYC outbox.
 * The database function recomputes current attestation and writes idempotently.
 * No browser/Driver/Admin route, direct SQL privileges, push sender or LIVE.
 * A future external STAGING migration must first implement this private contract.
 */
export const G247_OUTBOX_LIVE_ENABLED=false;
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const required=['mode','processed','inserted','duplicate','nextCursor',
 'qaOnly','productionEnabled','driverDispatchAuthorized'];
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
function receipt(data,limit,prior){
 if(!plain(data)||Object.keys(data).length!==required.length||
  !required.every(x=>Object.hasOwn(data,x))||
  data.mode!=='STAGING_DEMO_ONLY'||data.qaOnly!==true||
  data.productionEnabled!==false||data.driverDispatchAuthorized!==false||
  ![data.processed,data.inserted,data.duplicate].every(x=>
   Number.isSafeInteger(x)&&x>=0&&x<=limit)||
  data.processed!==data.inserted+data.duplicate||
  !(data.nextCursor===null||
   typeof data.nextCursor==='string'&&UUID.test(data.nextCursor))||
  (data.nextCursor!==null&&(data.processed!==limit||
   data.nextCursor===prior)))
  throw Error('G247_UNTRUSTED_SQL_RECEIPT');
 return Object.freeze({...data});
}
export function createG247PrivatePgOutboxAdapter({
 client,environment,qaOnly,liveEnabled
}={}){
 if(!client||typeof client.rpc!=='function'||
  environment!=='isolated_staging'||qaOnly!==true||
  liveEnabled!==false)
  throw Error('G247_PRIVATE_OWNER_SQL_REQUIRED');
 return Object.freeze({
  async sweepPage({afterDocument=null,limit=50}={}){
   if(!(afterDocument===null||typeof afterDocument==='string'&&
      UUID.test(afterDocument))||!Number.isSafeInteger(limit)||
      limit<1||limit>50)
     throw Error('G247_INVALID_PAGE');
   let response;
   try{
    response=await client.rpc('mobility_stage_g247_scan_expiry_owner_qa',{
     _after_document:afterDocument,_limit:limit
    });
   }catch{throw Error('G247_SQL_UNAVAILABLE');}
   if(response?.error||!response||!Object.hasOwn(response,'data'))
    throw Error('G247_SQL_UNAVAILABLE');
   return receipt(response.data,limit,afterDocument);
  }
 });
}
/**
 * Bounded progress only: if more pages remain, caller must DURABLY checkpoint
 * resumeCursor and run another job; NEVER claim entire fleet is certified.
 */
export async function sweepG247Bounded({
 adapter,afterDocument=null,limit=50,maxPages=8
}={}){
 if(!adapter||typeof adapter.sweepPage!=='function'||
  !Number.isSafeInteger(limit)||limit<1||limit>50||
  !Number.isSafeInteger(maxPages)||maxPages<1||maxPages>100||
  !(afterDocument===null||typeof afterDocument==='string'&&
   UUID.test(afterDocument)))
  throw Error('G247_BOUNDED_SWEEP_REQUIRED');
 let cursor=afterDocument,processed=0,inserted=0,duplicate=0;
 const observed=new Set();
 for(let i=0;i<maxPages;i++){
  const result=await adapter.sweepPage({afterDocument:cursor,limit});
  if(result.nextCursor!==null&&observed.has(result.nextCursor))
   throw Error('G247_PAGINATION_LOOP');
  processed+=result.processed;inserted+=result.inserted;
  duplicate+=result.duplicate;
  if(result.nextCursor===null)
   return Object.freeze({complete:true,resumeCursor:null,processed,
    inserted,duplicate,qaOnly:true,productionEnabled:false});
  observed.add(result.nextCursor);cursor=result.nextCursor;
 }
 return Object.freeze({complete:false,resumeCursor:cursor,processed,
  inserted,duplicate,qaOnly:true,productionEnabled:false});
}

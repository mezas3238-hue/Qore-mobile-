/**
 * G247 — independent server-side Driver document expiry watch (STAGING ONLY).
 *
 * Admin does NOT dispatch trips or orders. This monitor only prepares
 * non-PII reminder/audit events; the authoritative SQL eligibility gate
 * must recheck current KYC before every offer and acceptance.
 *
 * The injected repository MUST:
 * - read only independently verified, newest evidence using a consistent
 *   private snapshot (never client-set dates);
 * - atomically deduplicate by eventKey, recheck current revision/document
 *   before inserting, and persist to a private outbox for Driver notifications
 *   and aggregated Admin compliance reports;
 * - NEVER treat an alert or expired status as a human KYC approval.
 *
 * No DB connection, timer or network listener is created at import.
 * start() is opt-in and forbidden outside isolated STAGING.
 */
export const G247_LIVE_ENABLED=false;
export const DOCUMENT_EXPIRY_KINDS=Object.freeze([
 'licencia','identidad_frente','identidad_dorso','cedula_verde',
 'habilitacion','seguro','inspeccion','rostro_selfie'
]);
const KINDS=new Set(DOCUMENT_EXPIRY_KINDS);
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const DAY_MS=86400000;
const exact=(v,keys)=>v!==null&&typeof v==='object'&&
 !Array.isArray(v)&&Object.keys(v).length===keys.length&&
 keys.every(k=>Object.hasOwn(v,k));
const docKeys=['driverId','vehicleId','documentId','kind','revision',
 'status','verifiedAtMs','validUntilMs'];
const pageKeys=['snapshotRevision','items','nextCursor'];
const receiptKeys=['inserted','duplicate','stale'];
const whole=v=>Number.isSafeInteger(v)&&v>=0;
const cursor=v=>v===null||(typeof v==='string'&&v.length>0&&
 v.length<=256&&/^[A-Za-z0-9._~-]+$/.test(v));
function verifyDocument(v,now){
 const vehicle=['cedula_verde','habilitacion','seguro','inspeccion'].includes(v?.kind);
 return exact(v,docKeys)&&UUID.test(v.driverId??'')&&
  UUID.test(v.documentId??'')&&KINDS.has(v.kind)&&
  (vehicle?UUID.test(v.vehicleId??''):v.vehicleId===null)&&
  v.status==='VERIFIED'&&whole(v.revision)&&v.revision>0&&
  whole(v.verifiedAtMs)&&v.verifiedAtMs<=now&&
  whole(v.validUntilMs)&&v.validUntilMs>v.verifiedAtMs;
}
/** Pure, deterministic threshold selection: at most one alert per version+band. */
export function projectDocumentExpiryAlert(record,nowMs){
 if(!whole(nowMs)||!verifyDocument(record,nowMs))
  throw Error('G247_UNTRUSTED_VERIFIED_DOCUMENT');
 const remaining=record.validUntilMs-nowMs;
 const band=remaining<=0?'EXPIRED':remaining<=DAY_MS?'D01':
  remaining<=7*DAY_MS?'D07':remaining<=15*DAY_MS?'D15':
  remaining<=30*DAY_MS?'D30':null;
 if(band===null)return null;
 const eventKey=['G247',record.documentId,record.revision,
  record.validUntilMs,band].join(':');
 return Object.freeze({
  eventKey,driverId:record.driverId,vehicleId:record.vehicleId,
  documentId:record.documentId,kind:record.kind,band,
  validUntilMs:record.validUntilMs,documentRevision:record.revision,
  requiresHumanReview:false,notifyDriver:true,adminAuditOnly:true,
  eligibilityMustBeRechecked:true,qaOnly:true,productionEnabled:false
 });
}
export function createG247DocumentExpiryMonitor({
 environment,qaOnly,liveEnabled,listVerifiedDocuments,persistAlerts,
 now=Date.now,intervalMs=3600000,pageSize=50,maxPages=8,
 schedule=(run,ms)=>setInterval(run,ms),
 cancel=timer=>clearInterval(timer)
}={}){
 if(environment!=='isolated_staging'||qaOnly!==true||liveEnabled!==false||
  [listVerifiedDocuments,persistAlerts,now,schedule,cancel]
   .some(v=>typeof v!=='function')||
  !Number.isSafeInteger(intervalMs)||intervalMs<60000||
  intervalMs>86400000||!Number.isSafeInteger(pageSize)||
  pageSize<1||pageSize>50||!Number.isSafeInteger(maxPages)||
  maxPages<1||maxPages>20)
  throw Error('G247_STAGING_PRIVATE_MONITOR_REQUIRED');
 let running=false,busy=false,timer=null,generation=0;
 async function runOnce(){
  if(busy)return Object.freeze({ok:false,reason:'BUSY'});
  busy=true;
  const version=generation;
  try{
   const at=now();
   if(!whole(at))throw Error('clock');
   let nextCursor=null,revision=null,scanned=0,alerts=[];
   const seenDocs=new Set(),seenCursors=new Set();
   let completed=false;
   for(let pageNumber=0;pageNumber<maxPages;pageNumber++){
    const page=await listVerifiedDocuments({
     cursor:nextCursor,limit:pageSize,atMs:at
    });
    if(!exact(page,pageKeys)||!whole(page.snapshotRevision)||
     !Array.isArray(page.items)||page.items.length>pageSize||
     !cursor(page.nextCursor)||
     (revision!==null&&page.snapshotRevision!==revision))
     throw Error('invalid snapshot');
    revision=page.snapshotRevision;
    for(const item of page.items){
     if(!verifyDocument(item,at)||seenDocs.has(item.documentId))
      throw Error('invalid document');
     seenDocs.add(item.documentId);scanned++;
     const projected=projectDocumentExpiryAlert(item,at);
     if(projected)alerts.push(projected);
    }
    if(page.nextCursor===null){completed=true;break;}
    if(seenCursors.has(page.nextCursor))
     throw Error('pagination cycle');
    seenCursors.add(page.nextCursor);
    nextCursor=page.nextCursor;
   }
   if(!completed)throw Error('incomplete snapshot');
   if(version!==generation)
    return Object.freeze({ok:false,reason:'CANCELLED'});
   let inserted=0,duplicate=0,stale=0;
   if(alerts.length){
    const saved=await persistAlerts({
     snapshotRevision:revision,events:Object.freeze(alerts)
    });
    if(!exact(saved,receiptKeys)||
     ![saved.inserted,saved.duplicate,saved.stale].every(whole)||
     saved.inserted+saved.duplicate+saved.stale!==alerts.length)
     throw Error('unverified persistence receipt');
    ({inserted,duplicate,stale}=saved);
   }
   return Object.freeze({ok:true,scanned,proposed:alerts.length,
    inserted,duplicate,stale,qaOnly:true,productionEnabled:false});
  }catch{
   return Object.freeze({ok:false,reason:'UNVERIFIED_READ_OR_WRITE'});
  }finally{busy=false;}
 }
 function start(){
  if(running)return false;
  running=true;generation++;
  try{
   timer=schedule(()=>{void runOnce();},intervalMs);
   if(!timer)throw Error('no schedule');
   if(typeof timer.unref==='function')timer.unref();
   void runOnce();
   return true;
  }catch{
   running=false;generation++;
   if(timer!==null)try{cancel(timer);}catch{}
   timer=null;return false;
  }
 }
 function stop(){
  running=false;generation++;
  if(timer!==null)try{cancel(timer);}catch{}
  timer=null;
 }
 return Object.freeze({runOnce,start,stop,
  snapshot:()=>Object.freeze({running,busy,intervalMs,pageSize,maxPages,
   qaOnly:true,productionEnabled:false})});
}

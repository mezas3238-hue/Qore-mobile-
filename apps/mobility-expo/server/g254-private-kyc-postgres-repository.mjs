/**
 * G254 direct PostgreSQL OWNER connection adapter (server-only, STAGING).
 * SQL EXECUTE is revoked from Supabase anon/authenticated/service_role:
 * client.query MUST be an independently provisioned owner-permission database
 * connection on trusted backend, never an SDK or mobile/browser token.
 * This module contains no credentials and starts no network/timers.
 */
export const G254_PG_ADAPTER_LIVE_ENABLED=false;
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const TICKET=/^[A-Za-z0-9_-]{8,120}$/;
const KEY=/^G25[14]:[0-9a-f-]{36}:[0-9]+:[0-9]+:(?:D30|D15|D07|D01|EXPIRED)$/i;
const KINDS=new Set(['licencia','identidad_frente','identidad_dorso',
 'cedula_verde','habilitacion','seguro','inspeccion','rostro_selfie']);
const BANDS=new Set(['D30','D15','D07','D01','EXPIRED']);
const exact=(x,keys)=>x!==null&&typeof x==='object'&&!Array.isArray(x)
 &&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const disabled=Object.freeze({state:'WORKER_DISABLED',qaOnly:true,productionEnabled:false});
const checkFields=['mode','status','qaOnly','productionEnabled'];
const claimedFields=['mode','status','qaOnly','productionEnabled','alert'];
const alertFields=['alertId','eventKey','driverId','kind','band',
 'documentRevision','validUntilMs'];
const whole=x=>Number.isSafeInteger(x)&&x>=0;
function verifyScope(x){
 return exact(x,alertFields)&&whole(x.alertId)&&x.alertId>0
  &&KEY.test(x.eventKey)&&UUID.test(x.driverId)&&KINDS.has(x.kind)
  &&BANDS.has(x.band)&&whole(x.documentRevision)&&x.documentRevision>0
  &&whole(x.validUntilMs)&&x.validUntilMs>0
  &&x.eventKey.endsWith(':'+x.band);
}
export function createG254PrivateKycPgClaimRepository({
 client,workerId,environment,qaOnly,liveEnabled
}={}){
 if(environment!=='isolated_staging'||qaOnly!==true||liveEnabled!==false||
  !UUID.test(workerId??'')||!client||typeof client.query!=='function'||
  typeof client.rpc==='function')
  throw Error('G254_TRUSTED_POSTGRES_OWNER_ONLY');
 async function sql(query,values){
  let res;
  try{res=await client.query(query,values);}
  catch{throw Error('G254_DATABASE_UNAVAILABLE');}
  if(!res||!Array.isArray(res.rows)||res.rows.length!==1||
   !exact(res.rows[0],['result']))
   throw Error('G254_UNTRUSTED_DATABASE_RESULT');
  return res.rows[0].result;
 }
 return Object.freeze({
  async claimNextAlert(){
   const claim=await sql(
    'SELECT public.mobility_stage_g254_claim_reminder_owner($1::uuid) AS result',
    [workerId]);
   if(!claim||claim.mode!=='STAGING_DEMO_ONLY'||
    claim.qaOnly!==true||claim.productionEnabled!==false)
    throw Error('G254_UNTRUSTED_CLAIM');
   if(claim.status==='DISABLED'){
    if(!exact(claim,checkFields))throw Error('G254_UNTRUSTED_CLAIM');
    return disabled;
   }
   if(claim.status==='IDLE'){
    if(!exact(claim,checkFields))throw Error('G254_UNTRUSTED_CLAIM');
    return null;
   }
   if(!exact(claim,claimedFields)||claim.status!=='CLAIMED'||
    !verifyScope(claim.alert))throw Error('G254_UNTRUSTED_CLAIM');
   return Object.freeze({...claim.alert});
  },
  async verifyCurrentAttestation(scope){
   if(!verifyScope(scope))throw Error('G254_UNVERIFIED_CLAIM_SCOPE');
   const value=await sql(
    'SELECT public.mobility_stage_g254_claim_still_valid_owner($1::uuid,$2::bigint,$3::text) AS result',
    [workerId,scope.alertId,scope.eventKey]);
   if(typeof value!=='boolean')throw Error('G254_UNTRUSTED_RECHECK');
   return value;
  },
  async ackProcessingTicket({alertId,eventKey,providerTicketId}={}){
   if(!whole(alertId)||alertId<=0||!KEY.test(eventKey??'')||
    !TICKET.test(providerTicketId??''))
    throw Error('G254_INVALID_ACK');
   const value=await sql(
    'SELECT public.mobility_stage_g254_ack_ticket_owner($1::uuid,$2::bigint,$3::text,$4::text) AS result',
    [workerId,alertId,eventKey,providerTicketId]);
   if(typeof value!=='boolean')throw Error('G254_UNTRUSTED_ACK');
   return value;
  },
  status:()=>Object.freeze({qaOnly:true,productionEnabled:false,
   privateOwnerConnectionRequired:true})
 });
}

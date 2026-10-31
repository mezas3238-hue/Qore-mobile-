/**
 * G253: private server-side Postgres owner RPC repository.
 * Only use after G252 verifies real IdP AAL2/role/revocation on the same actor.
 * The database independently confirms active exclusive Admin membership.
 * Supabase service_role is explicitly denied SQL EXECUTE; no frontend access.
 */
export const G253_LIVE_ENABLED=false;
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const KINDS=new Set(['licencia','identidad_frente','identidad_dorso',
 'cedula_verde','habilitacion','seguro','inspeccion','rostro_selfie']);
const BANDS=new Set(['D30','D15','D07','D01','EXPIRED']);
const exact=(v,k)=>v!==null&&typeof v==='object'&&!Array.isArray(v)
 &&Object.keys(v).length===k.length&&k.every(s=>Object.hasOwn(v,s));
export function createG253PrivateAdminAlertsRepository({
 client,environment,qaOnly,liveEnabled
}={}){
 if(!client||typeof client.rpc!=='function'||
  environment!=='isolated_staging'||qaOnly!==true||
  liveEnabled!==false)throw Error('G253_OWNER_SQL_ONLY');
 return Object.freeze({
  async readDocumentAlerts({actorId,limit}={}){
   if(!UUID.test(actorId??'')||limit!==50)
    throw Error('G253_ADMIN_SCOPE_REQUIRED');
   let response;
   try{
    response=await client.rpc(
     'mobility_stage_g253_admin_document_alert_page_owner',{_admin:actorId});
   }catch{throw Error('G253_PRIVATE_SQL_UNAVAILABLE');}
   if(response?.error||!response||!Object.hasOwn(response,'data'))
    throw Error('G253_PRIVATE_SQL_UNAVAILABLE');
   const data=response.data;
   if(!exact(data,['items','hasMore','persistedAtMs'])||
    !Array.isArray(data.items)||data.items.length>50||
    typeof data.hasMore!=='boolean'||
    data.hasMore&&data.items.length!==50||
    !Number.isSafeInteger(data.persistedAtMs)||data.persistedAtMs<1)
    throw Error('G253_PRIVATE_SQL_UNTRUSTED');
   const seen=new Set();
   for(const item of data.items){
    if(!exact(item,['driverId','kind','band','validUntilMs'])||
     !UUID.test(item.driverId)||!KINDS.has(item.kind)||
     !BANDS.has(item.band)||!Number.isSafeInteger(item.validUntilMs)||
     item.validUntilMs<1)throw Error('G253_PRIVATE_SQL_UNTRUSTED');
    const key=item.driverId+':'+item.kind+':'+item.band;
    if(seen.has(key))throw Error('G253_PRIVATE_SQL_UNTRUSTED');
    seen.add(key);
   }
   return Object.freeze({
    items:Object.freeze(data.items.map(x=>Object.freeze({...x}))),
    hasMore:data.hasMore,persistedAtMs:data.persistedAtMs
   });
  }
 });
}

/**
 * G28 A05.3 — real private SQL repository adapter for Admin incidents.
 * The three other Admin collections and Owner finance remain DISABLED:
 * no invented rows, zones, KYC provenance or fake "RECONCILED" revenue.
 * A trusted backend must still verify JWT and provider-attested MFA in G27.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const POSITION=/^[0-9]{13}[0-9a-f]{32}$/;
const columns=['revision','items','hasMore'];
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>plain(x)&&Object.keys(x).length===keys.length&&
 keys.every(key=>Object.hasOwn(x,key));
export function createQoreBackofficeSqlReadRepository({rpc}){
 if(typeof rpc!=='function')throw Error('Private server-side backoffice RPC required');
 return async function loadPage({scope,actorId,anchorMs,after,limit}){
  if(scope!=='admin.incidents.read')
   throw Error('Backoffice data source not yet independently certified');
  if(typeof actorId!=='string'||!UUID.test(actorId)||
   !Number.isSafeInteger(anchorMs)||anchorMs<0||
   !(after===null||typeof after==='string'&&POSITION.test(after))||
   limit!==50)
   throw Error('Malformed private Admin read request');
  const response=await rpc('mobility_stage_g28_admin_incident_page',{
   _actor:actorId,_anchor_ms:anchorMs,_after:after,_limit:50
  });
  if(!plain(response)||response.error||
   !exact(response.data,columns)||
   !Number.isSafeInteger(response.data.revision)||
   response.data.revision<0||
   !Array.isArray(response.data.items)||response.data.items.length>50||
   typeof response.data.hasMore!=='boolean'||
   response.data.hasMore&&response.data.items.length!==50)
   throw Error('Private Admin incident SQL unavailable');
  // Gateway G27 independently checks item DTO, UUID, status, descending
  // keyset and no PII; never silently change malformed SQL into empty rows.
  return response.data;
 };
}

import {projectCatalog} from './commerce-draft.mjs';

/**
 * Diagnóstico preparatorio de GET Buyer Catalog para STAGING.
 *
 * Sin URL fija, token, red ni endpoint imaginario. Por defecto OFF.
 * La lectura solo se inyectará cuando A demuestre una API montada,
 * Auth/RLS, contrato/cursor y respuesta firmada por el servidor.
 * PASS sintético aquí NO es certificación de STAGING ni habilita pedidos.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CURSOR=/^[A-Za-z0-9_.-]{44,384}$/;
const fail=code=>Object.freeze({ok:false,code});
const errors=Object.freeze({
 401:'AUTH_REQUIRED',403:'FORBIDDEN',404:'BRANCH_NOT_FOUND',
 409:'CATALOG_CONFLICT',429:'RATE_LIMITED',503:'SERVICE_UNAVAILABLE'
});
const actorOk=x=>x&&x.role==='passenger'
 &&typeof x.subject==='string'&&UUID.test(x.subject)
 &&Number.isSafeInteger(x.sessionRevision)&&x.sessionRevision>=0;
const sameActor=(a,b)=>actorOk(b)&&a.subject===b.subject
 &&a.sessionRevision===b.sessionRevision;
const exact=(x,k)=>x!==null&&typeof x==='object'&&!Array.isArray(x)
 &&Object.keys(x).length===k.length&&k.every(y=>Object.hasOwn(x,y));
export function createBuyerCatalogStagingSmoke({
 enabled=false,contractCertified=false,stagingRuntimeVerified=false,
 readPage=null,getActor=null,now=()=>Date.now()
}={}){
 let epoch=0,busy=false;
 const ready=()=>enabled===true&&contractCertified===true
  &&stagingRuntimeVerified===true&&typeof readPage==='function'
  &&typeof getActor==='function';
 const clear=()=>{epoch++;busy=false;};
 const snapshot=()=>Object.freeze({configured:ready(),loading:busy,
  liveOrdersEnabled:false,pricingAuthority:'SERVER_ONLY',
  globalTotalKnown:false,qaProbeOnly:true});
 async function probe(branchId){
  if(!ready())return fail('BUYER_CATALOG_RUNTIME_NOT_VERIFIED');
  if(typeof branchId!=='string'||!UUID.test(branchId))
   return fail('INVALID_BRANCH');
  if(busy)return fail('CATALOG_PROBE_IN_FLIGHT');
  const started=++epoch;busy=true;
  try{
   let before;try{before=await getActor();}catch{before=null;}
   if(started!==epoch)return fail('STALE_RESPONSE_IGNORED');
   if(!actorOk(before))return fail('AUTH_REQUIRED');
   let response;try{response=await readPage(branchId,{
    cursor:null,subject:before.subject,sessionRevision:before.sessionRevision
   });}catch{response=fail('NETWORK_OR_TIMEOUT');}
   if(started!==epoch)return fail('STALE_RESPONSE_IGNORED');
   let after;try{after=await getActor();}catch{after=null;}
   if(started!==epoch)return fail('STALE_RESPONSE_IGNORED');
   if(!sameActor(before,after))return fail('STALE_SESSION_RESPONSE');
   if(response?.ok!==true)
    return fail(errors[response?.status]??response?.code??'CATALOG_UNAVAILABLE');
   if(response.status!==200)return fail('UNEXPECTED_HTTP_STATUS');
   const raw=response.data;
   if(!exact(raw,['branchId','version','expiresAt','items','nextCursor'])
    ||!(raw.nextCursor===null||(typeof raw.nextCursor==='string'
      &&CURSOR.test(raw.nextCursor))))
    return fail('INVALID_CATALOG_PAGE');
   const clean=projectCatalog(raw,{branchId,now:now()});
   if(!clean)return fail('INVALID_CATALOG_PAGE');
   // Solo metadatos: sin productos/precios/datos personales en el log smoke.
   return Object.freeze({ok:true,branchId,version:clean.version,
    expiresAt:clean.expiresAt,itemsOnPage:clean.items.length,
    hasNext:raw.nextCursor!==null,globalTotalKnown:false,
    liveOrdersEnabled:false,paymentsEnabled:false});
  }finally{if(started===epoch)busy=false;}
 }
 return Object.freeze({isConfigured:ready,snapshot,probe,clear});
}

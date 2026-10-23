/**
 * Catálogo para el comprador: flujo sintético, sin ruta HTTP inventada.
 * Ningún lector se habilita hasta que A certifique catálogo STAGING real.
 */
import {createCommerceDraftCart} from './commerce-draft.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail=code=>Object.freeze({ok:false,code});
const validActor=s=>s?.role==='passenger'&&typeof s.subject==='string'
 &&UUID.test(s.subject)&&Number.isSafeInteger(s.sessionRevision);
export function createCommerceCatalogFlow({
 gateway=null,getActor=null,now=()=>Date.now()
}={}){
 const cart=createCommerceDraftCart({now});
 let generation=0,loading=false,error=null;
 const configured=()=>gateway?.enabled===true
  &&gateway?.stagingRuntimeVerified===true
  &&gateway?.contractCertified===true
  &&gateway?.isConfigured?.()===true
  &&typeof gateway.readCatalog==='function';
 const clear=()=>{generation++;loading=false;error=null;cart.clear();};
 const snapshot=()=>{
  const current=cart.snapshot();
  // No exponer precios ni carrito previo durante Auth/refresh pendientes.
  const view=loading?{...current,branchId:null,catalogVersion:null,
   catalogExpiresAt:null,items:Object.freeze([]),estimatedSubtotalPyg:null,
   stock:'UNVERIFIED',stage:'CATALOG_LOADING'}:current;
  return Object.freeze({...view,
   catalogItems:Object.freeze(loading?[]:cart.currentCatalog?.()??[]),
   catalogReadReady:configured(),catalogLoading:loading,catalogError:error,
   checkoutEnabled:false,paymentEnabled:false,serverOrderReceipt:null});
 };
 async function loadCatalog(branchId){
  if(!configured())return fail('CATALOG_READ_NOT_CERTIFIED');
  if(typeof branchId!=='string'||!UUID.test(branchId))return fail('INVALID_BRANCH');
  if(loading)return fail('CATALOG_READ_IN_FLIGHT');
  if(typeof getActor!=='function'){
   clear();error='AUTH_REQUIRED';return fail('AUTH_REQUIRED');
  }
  // Bloquear ANTES de await: evita doble tap/sucursal competidora durante Auth.
  const id=++generation;loading=true;error=null;
  try{
   let before;try{before=await getActor();}catch{before=null;}
   if(generation!==id)return fail('STALE_RESPONSE_IGNORED');
   if(!validActor(before)){
    clear();error='AUTH_REQUIRED';return fail('AUTH_REQUIRED');
   }
   cart.selectBranch(branchId);
   let result;
   try{result=await gateway.readCatalog(branchId,{
    subject:before.subject,sessionRevision:before.sessionRevision
   });}catch{result=fail('NETWORK_OR_TIMEOUT');}
   if(generation!==id)return fail('STALE_RESPONSE_IGNORED');
   let after;try{after=await getActor();}catch{after=null;}
   if(generation!==id)return fail('STALE_RESPONSE_IGNORED');
   if(!validActor(after)||after.subject!==before.subject
    ||after.sessionRevision!==before.sessionRevision){
    clear();return fail('STALE_SESSION_RESPONSE');
   }
   if(result?.ok!==true){
    const code=result?.code??'CATALOG_UNAVAILABLE';
    clear();error=code;return fail(code);
   }
   const accepted=cart.acceptCatalog(result.data);
   if(!accepted.ok){
    error=accepted.code;
    if(accepted.code==='INVALID_CATALOG')cart.clear();
    return fail(accepted.code);
   }
   return Object.freeze({ok:true,version:accepted.version,checkoutEnabled:false});
  }finally{if(generation===id)loading=false;}
 }
 function changeQuantity(itemId,quantity){
  if(!configured())return fail('CATALOG_READ_NOT_CERTIFIED');
  if(loading)return fail('CATALOG_READ_IN_FLIGHT');
  return cart.setQuantity(itemId,quantity);
 }
 function changeVehicle(vehicle){
  if(!configured())return fail('CATALOG_READ_NOT_CERTIFIED');
  if(loading)return fail('CATALOG_READ_IN_FLIGHT');
  return cart.selectVehicle(vehicle);
 }
 function preview(requestKey){
  if(!configured())return fail('CATALOG_READ_NOT_CERTIFIED');
  if(loading)return fail('CATALOG_READ_IN_FLIGHT');
  return cart.previewRequest(requestKey);
 }
 return Object.freeze({isConfigured:configured,clear,snapshot,loadCatalog,
  changeQuantity,changeVehicle,preview});
}

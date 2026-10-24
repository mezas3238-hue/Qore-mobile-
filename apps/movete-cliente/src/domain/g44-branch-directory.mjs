import {projectG44BuyerBranches} from './g44-buyer-contract.mjs';

/**
 * Directorio Buyer G44: consulta privada por municipio y modo de entrega.
 * Sin endpoint HTTP, sin precios de pedido y sin permisos operativos.
 * Requiere transporte y sesión certificados por A; default OFF.
 */
const CURSOR=/^[A-Za-z0-9_.-]{44,384}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const kinds=new Set(['AUTO_DELIVERY','MOTO_DELIVERY']);
const fail=code=>Object.freeze({ok:false,code});
const actorOk=a=>a?.role==='passenger'&&typeof a.subject==='string'
 &&UUID.test(a.subject)&&Number.isSafeInteger(a.sessionRevision)
 &&a.sessionRevision>=0;
const same=(a,b)=>actorOk(b)&&a.subject===b.subject
 &&a.sessionRevision===b.sessionRevision;
const municipalityOk=s=>typeof s==='string'&&s.length>=2&&s.length<=80
 &&s.trim()===s&&!/[<>\u0000-\u001f\u007f]/u.test(s);
const empty=()=>({municipality:null,serviceKind:null,items:[],
 pageNumber:0,nextCursor:null,anchors:[null],seen:new Set(),
 receivedAt:null,error:null});
export function createG44BranchDirectory({
 enabled=false,contractCertified=false,stagingRuntimeVerified=false,
 readBuyerBranches=null,getActor=null,now=()=>Date.now()
}={}){
 let revision=0,loading=false,state=empty();
 const configured=()=>enabled===true&&contractCertified===true
  &&stagingRuntimeVerified===true&&typeof readBuyerBranches==='function'
  &&typeof getActor==='function';
 const clear=()=>{revision++;loading=false;state=empty();};
 function snapshot(){
  // Fecha estrictamente local de caducidad G44; jamás prueba disponibilidad
  // de un repartidor ni renueva sesión o permiso del servidor.
  const current=now();
  const expiry=state.receivedAt===null?null:state.receivedAt+30000;
  const fresh=!loading&&Number.isSafeInteger(current)
   &&Number.isSafeInteger(expiry)&&current>=state.receivedAt&&current<expiry;
  return Object.freeze({
   readReady:configured(),loading,error:state.error,
   expiresAt:fresh?expiry:null,
   municipality:fresh?state.municipality:null,
   serviceKind:fresh?state.serviceKind:null,
   pageNumber:fresh?state.pageNumber:0,
   items:Object.freeze(fresh?[...state.items]:[]),
   hasPrevious:Boolean(fresh&&state.pageNumber>1),
   hasNext:Boolean(fresh&&state.nextCursor),
   globalTotalKnown:false,ordersEnabled:false,paymentsEnabled:false,
   availabilityVerified:false,serverSnapshotConsistent:false
  });
 }
 async function load({municipality,serviceKind,next=false,previous=false}={}){
  if(!configured())return fail('BRANCH_DIRECTORY_RUNTIME_NOT_CERTIFIED');
  if(!municipalityOk(municipality)||!kinds.has(serviceKind)||next&&previous)
   return fail('INVALID_BRANCH_QUERY');
  if(loading)return fail('BRANCH_DIRECTORY_IN_FLIGHT');
  const prev=snapshot();
  const matching=prev.municipality===municipality&&prev.serviceKind===serviceKind;
  if(next&&(!matching||!prev.hasNext))return fail('NO_NEXT_PAGE');
  if(previous&&(!matching||!prev.hasPrevious))return fail('NO_PREVIOUS_PAGE');
  const cursor=next?state.nextCursor:
   previous?state.anchors[state.pageNumber-2]:null;
  if(next&&(cursor===null||state.seen.has(cursor))){
   clear();return fail('CURSOR_REPEATED');
  }
  const started=++revision;loading=true;state.error=null;
  try{
   let before;try{before=await getActor();}catch{before=null;}
   if(started!==revision)return fail('STALE_RESPONSE_IGNORED');
   if(!actorOk(before)){clear();state.error='AUTH_REQUIRED';return fail('AUTH_REQUIRED');}
   if(!next&&!previous)state=empty();
   let result;
   try{result=await readBuyerBranches({
    municipality,serviceKind,cursor,subject:before.subject,
    sessionRevision:before.sessionRevision
   });}catch{result=fail('NETWORK_OR_TIMEOUT');}
   if(started!==revision)return fail('STALE_RESPONSE_IGNORED');
   let after;try{after=await getActor();}catch{after=null;}
   if(started!==revision)return fail('STALE_RESPONSE_IGNORED');
   if(!same(before,after)){clear();return fail('STALE_SESSION_RESPONSE');}
   if(result?.ok!==true){
    const code=result?.code??'BRANCH_DIRECTORY_UNAVAILABLE';
    clear();state.error=code;return fail(code);
   }
   if(result.status!==200){clear();state.error='BAD_HTTP_STATUS';return fail('BAD_HTTP_STATUS');}
   const page=projectG44BuyerBranches(result.data,{municipality,serviceKind});
   if(!page){clear();state.error='INVALID_G44_BRANCH_PAGE';return fail('INVALID_G44_BRANCH_PAGE');}
   if(page.nextCursor!==null&&(page.nextCursor===cursor
    ||(next&&state.seen.has(page.nextCursor)))){
    clear();state.error='CURSOR_REPEATED';return fail('CURSOR_REPEATED');
   }
   if(next){
    state.anchors.push(cursor);state.seen.add(cursor);state.pageNumber++;
   }else if(previous){
    state.pageNumber--;state.anchors=state.anchors.slice(0,state.pageNumber);
    state.seen=new Set(state.anchors.filter(Boolean));
   }else state.pageNumber=1;
   state.items=page.items;state.municipality=municipality;state.serviceKind=serviceKind;
   state.nextCursor=page.nextCursor;state.receivedAt=now();state.error=null;
   return Object.freeze({ok:true,pageNumber:state.pageNumber,
    itemsOnPage:page.items.length,globalTotalKnown:false});
  }finally{if(started===revision)loading=false;}
 }
 return Object.freeze({load,snapshot,clear,isConfigured:configured});
}

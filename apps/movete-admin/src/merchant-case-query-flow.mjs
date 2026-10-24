/**
 * R44 — Merchant case QA read coordinator. No backend URL or transport is wired.
 * A verified MerchantOrder-only source must be injected explicitly by an
 * authorized future integration. This module never sends or modifies a case.
 */
import {projectMerchantCasePage} from './merchant-case-page.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail=code=>Object.freeze({ok:false,code});
function actorKey(actor){
 if(!actor||actor.role!=='admin'||actor.mfaVerified!==true
  ||typeof actor.subject!=='string'||!UUID.test(actor.subject)
  ||!Number.isSafeInteger(actor.authRevision)||actor.authRevision<0)return null;
 return actor.subject+':'+actor.authRevision;
}

/**
 * One in-flight request at a time; a clear or changed session invalidates
 * the request generation. "next" consumes only a cursor of a certified page.
 * Counts are always page-local, with no global case estimate.
 *
 * readPage must be a trusted, separately certified adapter owned by the
 * future A/B integration. Constructor defaults are deliberately unusable.
 */
export function createMerchantCaseQueryFlow({
 readPage=null,getActor=()=>null,isCertified=()=>false,now=()=>Date.now()
}={}){
 let generation=0,loading=false,sessionKey=null,page=null;
 let pageIndex=0,cursors=[null],highestRevision=0;
 function clear(){
  generation++;loading=false;sessionKey=null;page=null;
  pageIndex=0;cursors=[null];highestRevision=0;
 }
 function access(){
  let actor=null,certified=false;
  try{actor=getActor();certified=isCertified()===true;}catch{/* fail closed */}
  const key=actorKey(actor);
  if(!key){clear();return {ok:false,code:'ADMIN_AUTH_REQUIRED'};}
  if(!certified||typeof readPage!=='function'){
   clear();return {ok:false,code:'MERCHANT_CASE_API_NOT_CERTIFIED'};
  }
  if(sessionKey!==null&&sessionKey!==key){
   clear();return {ok:false,code:'STALE_ADMIN_SESSION'};
  }
  return {ok:true,actor,key};
 }
 function snapshot(){
  if(!access().ok)return null;
  if(!page)return null;
  let currentTime;
  try{currentTime=now();}catch{clear();return null;}
  if(!Number.isSafeInteger(currentTime)||page.expiresAt<=currentTime){
   clear();return null;
  }
  return Object.freeze({
   page,pageNumber:pageIndex+1,hasPrevious:pageIndex>0,
   hasNext:page.nextCursor!==null,totalKnown:false,loading:false
  });
 }
 async function load(direction='refresh'){
  if(!['refresh','next','previous'].includes(direction)){
   clear();return fail('INVALID_CASE_DIRECTION');
  }
  const start=access();
  if(!start.ok)return fail(start.code);
  if(loading)return fail('MERCHANT_CASE_READ_IN_FLIGHT');
  let index=0,cursor=null;
  if(direction!=='refresh'){
   const current=snapshot();
   if(!current)return fail('NO_VALID_MERCHANT_CASE_PAGE');
   if(direction==='next'){
    if(!current.hasNext)return fail('NO_ADDITIONAL_PAGE');
    cursor=page.nextCursor;index=pageIndex+1;
    const knownPosition=cursors.indexOf(cursor);
    if(knownPosition!==-1&&knownPosition!==index){
     clear();return fail('REPEATED_MERCHANT_CASE_CURSOR');
    }
   }else{
    if(!current.hasPrevious)return fail('NO_PREVIOUS_PAGE');
    index=pageIndex-1;cursor=cursors[index];
   }
  }
  // Hide the old page while awaiting an authorized replacement.
  page=null;sessionKey=start.key;loading=true;
  const ticket=++generation;
  let raw;
  try{
   raw=await readPage(Object.freeze({cursor,direction}));
  }catch{
   const current=ticket===generation;
   if(current)clear();
   return fail(current?'MERCHANT_CASE_READ_FAILED':'STALE_QUERY_RESPONSE');
  }
  if(ticket!==generation)return fail('STALE_QUERY_RESPONSE');
  const after=access();
  if(!after.ok||after.key!==start.key){
   clear();return fail('STALE_ADMIN_SESSION');
  }
  let currentTime;
  try{currentTime=now();}catch{clear();return fail('INVALID_QA_CLOCK');}
  const projected=projectMerchantCasePage(raw,{
   actor:after.actor,certified:true,now:currentTime
  });
  if(!projected.ok){clear();return fail(projected.code);}
  if(highestRevision>0&&projected.revision<highestRevision){
   clear();return fail('REGRESSIVE_CASE_REVISION');
  }
  const nextCursors=direction==='refresh'?[null]:
   direction==='next'?[...cursors.slice(0,pageIndex+1),cursor]:cursors;
  // A previously visited future cursor is legal on "previous"; a
  // cursor pointing back to this or any earlier page is a loop.
  if(projected.nextCursor!==null
   &&nextCursors.slice(0,index+1).includes(projected.nextCursor)){
   clear();return fail('REPEATED_MERCHANT_CASE_CURSOR');
  }
  cursors=nextCursors;pageIndex=index;page=projected;
  highestRevision=Math.max(highestRevision,projected.revision);
  loading=false;
  return Object.freeze({ok:true,pageNumber:index+1});
 }
 return Object.freeze({load,snapshot,clear});
}

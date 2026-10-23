/**
 * G41: páginas privadas filtradas EN EL SERVIDOR, nunca conteo global.
 * El contrato sigue apagado hasta certificación real de STAGING.
 */
const severities=new Set(['CRITICAL','HIGH','MEDIUM','LOW']);
const statuses=new Set(['OPEN','TRIAGED','INVESTIGATING','RESOLVED','CLOSED']);
const fail=code=>Object.freeze({ok:false,code});
const valid=(v,options)=>v===null||options.has(v);
const same=(a,b)=>Boolean(a&&b&&a.subject===b.subject&&a.role==='admin'
 &&b.role==='admin'&&a.mfaVerified===true&&b.mfaVerified===true
 &&a.authRevision===b.authRevision);
export function createGlobalTriageFlow({gateway,getActor,now=()=>Date.now()}={}){
 let epoch=0,busy=false;
 let state={page:null,pageNumber:0,severityFilter:null,statusFilter:null,
  anchors:[null],seen:new Set(),error:null};
 const clear=()=>{
  epoch++;
  state={page:null,pageNumber:0,severityFilter:null,statusFilter:null,
   anchors:[null],seen:new Set(),error:null};
 };
 const snapshot=()=>Object.freeze({
  contractReady:Boolean(gateway?.isConfigured?.()),loading:busy,
  page:state.page&&state.page.expiresAt>now()?state.page:null,
  pageNumber:state.page&&state.page.expiresAt>now()?state.pageNumber:0,
  hasNext:Boolean(state.page&&state.page.expiresAt>now()&&state.page.nextCursor),
  hasPrevious:Boolean(state.page&&state.page.expiresAt>now()&&state.pageNumber>1),
  severityFilter:state.severityFilter,statusFilter:state.statusFilter,
  error:state.error,globalTotalKnown:false,emergencyDispatchEnabled:false
 });
 async function load({severityFilter=null,statusFilter=null,next=false,previous=false}={}){
  if(!gateway?.isConfigured?.())return fail('G41_RUNTIME_NOT_CERTIFIED');
  if(!valid(severityFilter,severities)||!valid(statusFilter,statuses)
    ||(next&&previous))return fail('INVALID_FILTER');
  if(busy)return fail('TRIAGE_READ_IN_FLIGHT');
  const sameFilters=state.severityFilter===severityFilter&&state.statusFilter===statusFilter;
  if(next&&(!sameFilters||!state.page||state.page.expiresAt<=now()
    ||state.page.nextCursor===null))return fail('NO_NEXT_PAGE_FOR_FILTER');
  if(previous&&(!sameFilters||!state.page||state.page.expiresAt<=now()
    ||state.pageNumber<=1))return fail('NO_PREVIOUS_PAGE_FOR_FILTER');
  // Anclas opacas en memoria; un regreso siempre reconsulta al servidor.
  const cursor=next?state.page.nextCursor
    :previous?state.anchors[state.pageNumber-2]:null;
  if(next&&cursor!==null&&state.seen.has(cursor)){
   clear();return fail('CURSOR_REPEATED');
  }
  const started=++epoch;
  if(!next&&!previous)state={page:null,pageNumber:0,severityFilter,statusFilter,
    anchors:[null],seen:new Set(),error:null};
  busy=true;
  try{
   let before;
   try{before=await getActor();}catch{before=null;}
   if(started!==epoch)return fail('STALE_RESPONSE_IGNORED');
   if(!before||before.role!=='admin'||before.mfaVerified!==true)
    return fail('FORBIDDEN');
   let response;
   try{response=await gateway.fetchPage({severityFilter,statusFilter,cursor});}
   catch{response=fail('NETWORK_OR_TIMEOUT');}
   if(started!==epoch)return fail('STALE_RESPONSE_IGNORED');
   let after;
   try{after=await getActor();}catch{after=null;}
   if(started!==epoch)return fail('STALE_RESPONSE_IGNORED');
   if(!same(before,after)){clear();return fail('STALE_SESSION_RESPONSE');}
   if(!response?.ok){
    const code=response?.code||'TRIAGE_READ_FAILED';
    clear();state.error=code;return fail(code);
   }
   const page=response.page;
   if(!page||page.scope!=='SERVER_FILTERED_PAGE_ONLY'
    ||page.severityFilter!==severityFilter||page.statusFilter!==statusFilter
    ||page.hasGlobalTotal!==false||page.emergencyDispatchEnabled!==false
    ||page.snapshotConsistent!==false||!Array.isArray(page.items)
    ||page.items.length>50||!Number.isSafeInteger(page.expiresAt)
    ||page.expiresAt<=now()
    ||!(page.nextCursor===null||(typeof page.nextCursor==='string'
      &&/^[A-Za-z0-9_.-]{44,384}$/.test(page.nextCursor)))
    ||(page.nextCursor!==null&&(page.nextCursor===cursor
      ||(next&&state.seen.has(page.nextCursor))))) {
    clear();state.error='INVALID_G41_PAGE';return fail('INVALID_G41_PAGE');
   }
   if(next){
    state.anchors.push(cursor);
    if(cursor!==null)state.seen.add(cursor);
    state.pageNumber++;
   }else if(previous){
    state.pageNumber--;
    state.anchors=state.anchors.slice(0,state.pageNumber);
    state.seen=new Set(state.anchors.filter(Boolean));
   }else state.pageNumber=1;
   state.page=page;
   state.severityFilter=severityFilter;state.statusFilter=statusFilter;
   state.error=null;
   return Object.freeze({ok:true,pageNumber:state.pageNumber,
    hasNext:page.nextCursor!==null,hasPrevious:state.pageNumber>1});
  }finally{busy=false;}
 }
 return Object.freeze({load,snapshot,clear});
}

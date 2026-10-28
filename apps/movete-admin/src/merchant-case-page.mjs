/**
 * R43 — Bandeja específica de incidencias de PEDIDOS COMERCIALES, QA.
 * Solo puede proyectar una página previamente autorizada por un backend
 * certificado. Nunca infiere "MERCHANT_ORDER" de una cola de seguridad genérica.
 * Sin HTTP, sin persistencia, sin operador asignado y sin acciones de escritura.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CURSOR=/^[A-Za-z0-9_.-]{44,384}$/;
const REASONS=new Set(['MISSING_ITEM','WRONG_ITEM','DAMAGED_ITEM',
 'LATE_DELIVERY','PRICE_DISPUTE','SAFETY_CONCERN']);
const SEVERITIES=new Set(['LOW','MEDIUM','HIGH']);
const STATES=new Set(['RECEIVED_QA','CLASSIFIED_QA','REVIEW_QA','CLOSED_QA']);
const KEYS=['scope','qaOnly','generatedAt','expiresAt','revision',
 'hasGlobalTotal','notificationsEnabled','operationsEnabled','nextCursor','items'];
const ITEM_KEYS=['caseId','subjectKind','reason','severity','state',
 'createdAt','updatedAt','revision'];
const priority=Object.freeze({HIGH:0,MEDIUM:1,LOW:2});
const exact=(v,keys)=>v!==null&&typeof v==='object'
 &&!Array.isArray(v)&&Object.keys(v).length===keys.length
 &&keys.every(k=>Object.hasOwn(v,k));
const deny=code=>Object.freeze({ok:false,code,items:Object.freeze([]),
 totalKnown:false,operationsEnabled:false,notificationsEnabled:false,
 operatorAssigned:false,emergencyDispatchEnabled:false});
const cleanActor=a=>a?.role==='admin'&&a.mfaVerified===true
 &&typeof a.subject==='string'&&UUID.test(a.subject)
 &&Number.isSafeInteger(a.authRevision)&&a.authRevision>=0;

/**
 * max 50 FILAS POR PÁGINA, NO límite de personas, comercios o casos globales.
 * Page DTO es de solo lectura, de la API futura, no una respuesta cliente.
 */
export function projectMerchantCasePage(raw,{actor=null,
 certified=false,now=Date.now()}={}){
 if(!cleanActor(actor))return deny('ADMIN_AUTH_REQUIRED');
 if(certified!==true)return deny('MERCHANT_CASE_API_NOT_CERTIFIED');
 if(!Number.isSafeInteger(now)||now<0||!exact(raw,KEYS)
  ||raw.scope!=='ADMIN_MERCHANT_CASES_QA_PAGE'||raw.qaOnly!==true
  ||raw.hasGlobalTotal!==false||raw.notificationsEnabled!==false
  ||raw.operationsEnabled!==false
  ||!Number.isSafeInteger(raw.revision)||raw.revision<1
  ||!Number.isSafeInteger(raw.generatedAt)||raw.generatedAt>now
  ||raw.generatedAt<now-300000
  ||!Number.isSafeInteger(raw.expiresAt)||raw.expiresAt<=now
  ||raw.expiresAt>now+300000
  ||raw.expiresAt<=raw.generatedAt
  ||!(raw.nextCursor===null||typeof raw.nextCursor==='string'
   &&CURSOR.test(raw.nextCursor))
  ||!Array.isArray(raw.items)||raw.items.length>50)
  return deny('INVALID_MERCHANT_CASE_PAGE');
 const seen=new Set(),items=[];
 for(const row of raw.items){
  if(!exact(row,ITEM_KEYS)
   ||typeof row.caseId!=='string'||!UUID.test(row.caseId)
   ||seen.has(row.caseId)
   ||row.subjectKind!=='MERCHANT_ORDER'
   ||!REASONS.has(row.reason)||!SEVERITIES.has(row.severity)
   ||!STATES.has(row.state)
   ||!Number.isSafeInteger(row.createdAt)||row.createdAt<0
   ||!Number.isSafeInteger(row.updatedAt)||row.updatedAt<row.createdAt
   ||row.updatedAt>raw.generatedAt
   ||!Number.isSafeInteger(row.revision)||row.revision<1
   ||row.revision>raw.revision)return deny('INVALID_MERCHANT_CASE_ROW');
  seen.add(row.caseId);
  items.push(Object.freeze({
   caseId:row.caseId,reason:row.reason,severity:row.severity,
   state:row.state,createdAt:row.createdAt,
   updatedAt:row.updatedAt,revision:row.revision
  }));
 }
 // Local: casos activos y severidad primero. No implica atención real.
 items.sort((a,b)=>{
  const activeA=a.state==='CLOSED_QA'?1:0;
  const activeB=b.state==='CLOSED_QA'?1:0;
  return activeA-activeB||priority[a.severity]-priority[b.severity]
   ||b.updatedAt-a.updatedAt||a.caseId.localeCompare(b.caseId);
 });
 const counts=Object.freeze({
  visible:items.length,
  open:items.filter(x=>x.state!=='CLOSED_QA').length,
  closedQa:items.filter(x=>x.state==='CLOSED_QA').length,
  highOpen:items.filter(x=>x.severity==='HIGH'&&x.state!=='CLOSED_QA').length
 });
 return Object.freeze({ok:true,
  scope:'VISIBLE_CERTIFIED_QA_PAGE_ONLY',revision:raw.revision,
  expiresAt:raw.expiresAt,nextCursor:raw.nextCursor,
  items:Object.freeze(items),counts,totalKnown:false,
  operationsEnabled:false,notificationsEnabled:false,
  operatorAssigned:false,emergencyDispatchEnabled:false,
  contactConfirmed:false,caseResolvedInProduction:false});
}
/**
 * El store obliga a identificar sesión Admin+MFA en cada lectura.
 * Una nueva revisión Auth o invalidez elimina el snapshot anterior.
 */
export function createMerchantCasePageStore({now=()=>Date.now()}={}){
 let identity=null,page=null;
 const clear=()=>{identity=null;page=null;};
 function update(dto,{actor,certified=false}={}){
  if(!cleanActor(actor)){clear();return deny('ADMIN_AUTH_REQUIRED');}
  const key=actor.subject+':'+actor.authRevision;
  if(identity!==null&&identity!==key)clear();
  const result=projectMerchantCasePage(dto,{actor,certified,now:now()});
  if(!result.ok){clear();return result;}
  if(page&&result.revision<page.revision){clear();return deny('REGRESSIVE_CASE_PAGE');}
  identity=key;page=result;
  return result;
 }
 function snapshot({actor,certified=false}={}){
  if(!cleanActor(actor)||certified!==true){clear();return null;}
  if(identity!==actor.subject+':'+actor.authRevision
   ||!page||page.expiresAt<=now()){clear();return null;}
  return page;
 }
 return Object.freeze({update,snapshot,clear});
}

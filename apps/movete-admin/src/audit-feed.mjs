/**
 * Registro operativo mínimo de lectura, pendiente de contrato de A.
 * La UI NO firma eventos, NO crea auditoría oficial ni afirma inmutabilidad;
 * esos controles corresponden al ledger/audit backend y a sus permisos.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id=x=>typeof x==='string'&&UUID.test(x);
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(v,fields)=>obj(v)&&fields.every(f=>Object.hasOwn(v,f))&&Object.keys(v).every(f=>fields.includes(f));
const operations=new Set(['KYC_REVIEW','ZONE_POLICY_CHANGE','INCIDENT_TRIAGE','ACCOUNT_SUSPEND','ACCOUNT_RESTORE','TARIFF_PROPOSAL','COMMISSION_PROPOSAL']);
const targets=new Set(['VEHICLE','ZONE','INCIDENT','ACCOUNT','TARIFF','COMMISSION']);
const outcomes=new Set(['REQUESTED','DENIED','CONFIRMED','ROLLED_BACK']);
const actorRoles=new Set(['admin','owner','security_operator']);
const fields=['eventId','actorRole','operation','targetKind','outcome','occurredAt','revision'];
const header=['scope','revision','generatedAt','expiresAt','items'];
export function projectAuditFeed(raw,{role,now=Date.now()}={}){
 if(role!=='admin'||!exact(raw,header)||raw.scope!=='admin.audit.read'
  ||!Number.isSafeInteger(raw.revision)||raw.revision<0
  ||!Number.isSafeInteger(raw.generatedAt)||raw.generatedAt>now
  ||raw.generatedAt<now-300000||!Number.isSafeInteger(raw.expiresAt)
  ||raw.expiresAt<=now||raw.expiresAt>now+300000
  ||!Array.isArray(raw.items)||raw.items.length>100)return null;
 const ids=new Set(),items=[];
 for(const event of raw.items){
  if(!exact(event,fields)||!id(event.eventId)||ids.has(event.eventId)
   ||!actorRoles.has(event.actorRole)||!operations.has(event.operation)
   ||!targets.has(event.targetKind)||!outcomes.has(event.outcome)
   ||!Number.isSafeInteger(event.occurredAt)||event.occurredAt<0||event.occurredAt>now
   ||!Number.isSafeInteger(event.revision)||event.revision<0)return null;
  ids.add(event.eventId);
  items.push(Object.freeze({...event}));
 }
 return Object.freeze({
  revision:raw.revision,expiresAt:raw.expiresAt,items:Object.freeze(items)
 });
}
export function createAuditFeedStore({now=()=>Date.now()}={}){
 let state=null;
 function clear(){state=null;}
 function replace(payload,role){
  const next=projectAuditFeed(payload,{role,now:now()});
  if(!next){clear();return false;}
  if(state&&next.revision<state.revision){clear();return false;}
  state=next;return true;
 }
 function current(role){
  if(role!=='admin'||!state||state.expiresAt<=now()){clear();return null;}
  return state;
 }
 return Object.freeze({replace,current,clear});
}

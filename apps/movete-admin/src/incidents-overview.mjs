/**
 * Bandeja mínima de incidentes para operador Admin.
 * El backend debe verificar permisos, propiedad y PII antes de responder.
 * Sin PII, sin geolocalización, sin acciones SOS o suspensiones en frontend.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validId=x=>typeof x==='string'&&UUID.test(x);
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,k)=>object(x)&&Object.keys(x).every(key=>k.includes(key))&&k.every(key=>Object.hasOwn(x,key));
const categories=new Set(['SAFETY','RIDE','DELIVERY','PAYMENT_SIMULATED','OTHER']);
const severities=new Set(['LOW','MEDIUM','HIGH','CRITICAL']);
const states=new Set(['OPEN','TRIAGED','INVESTIGATING','RESOLVED','CLOSED']);
const top=['scope','revision','generatedAt','expiresAt','items'];
const cols=['incidentId','category','severity','status','createdAt','revision'];
export function projectIncidentQueue(raw,{role,now=Date.now()}={}){
 if(role!=='admin'||!exact(raw,top)||raw.scope!=='admin.incidents.read'
  ||!Number.isSafeInteger(raw.revision)||raw.revision<0
  ||!Number.isSafeInteger(raw.generatedAt)||raw.generatedAt>now||raw.generatedAt<now-300000
  ||!Number.isSafeInteger(raw.expiresAt)||raw.expiresAt<=now
  ||raw.expiresAt>now+300000||!Array.isArray(raw.items)||raw.items.length>100)return null;
 const records=[],seen=new Set();
 for(const row of raw.items){
  if(!exact(row,cols)||!validId(row.incidentId)||seen.has(row.incidentId)
   ||!categories.has(row.category)||!severities.has(row.severity)
   ||!states.has(row.status)||!Number.isSafeInteger(row.createdAt)
   ||row.createdAt<0||row.createdAt>now
   ||!Number.isSafeInteger(row.revision)||row.revision<0)return null;
  seen.add(row.incidentId);
  records.push(Object.freeze({...row}));
 }
 return Object.freeze({revision:raw.revision,expiresAt:raw.expiresAt,
  items:Object.freeze(records)});
}
export function createIncidentQueueStore({now=()=>Date.now()}={}){
 let queue=null;
 function clear(){queue=null;}
 function replace(raw,role){
  const next=projectIncidentQueue(raw,{role,now:now()});
  if(!next){clear();return false;}
  if(queue&&next.revision<queue.revision){clear();return false;}
  queue=next;return true;
 }
 function current(role){
  if(role!=='admin'||!queue||queue.expiresAt<=now()){clear();return null;}
  return queue;
 }
 return Object.freeze({replace,current,clear});
}

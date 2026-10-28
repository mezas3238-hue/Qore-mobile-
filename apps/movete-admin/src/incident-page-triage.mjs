/**
 * Presentación y ordenación local de UNA página de incidentes ya autorizada.
 * No consulta al servidor y nunca infiere resultados de otras páginas.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const allowedFields=['incidentId','category','severity','status','createdAt','revision'];
const categories=new Set(['SAFETY','RIDE','DELIVERY','PAYMENT_SIMULATED','OTHER']);
const severities=new Set(['LOW','MEDIUM','HIGH','CRITICAL']);
const states=new Set(['OPEN','TRIAGED','INVESTIGATING','RESOLVED','CLOSED']);
const activeStates=new Set(['OPEN','TRIAGED','INVESTIGATING']);
const priority=Object.freeze({CRITICAL:0,HIGH:1,MEDIUM:2,LOW:3});
const filters=new Set(['ALL','ACTIVE','CRITICAL_ACTIVE']);
const orders=new Set(['PRIORITY','RECENT']);
const obj=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);

export function projectIncidentPageTriage(snapshot,{filter='ALL',order='PRIORITY',now=Date.now()}={}){
 if(!filters.has(filter)||!orders.has(order)||!obj(snapshot)
   ||!Number.isSafeInteger(snapshot.expiresAt)||snapshot.expiresAt<=now
   ||!Array.isArray(snapshot.items)||snapshot.items.length>50)return null;
 const seen=new Set(),all=[];
 for(const raw of snapshot.items){
  if(!obj(raw)||Object.keys(raw).length!==allowedFields.length
    ||!allowedFields.every(field=>Object.hasOwn(raw,field))
    ||typeof raw.incidentId!=='string'||!UUID.test(raw.incidentId)
    ||seen.has(raw.incidentId)||!categories.has(raw.category)
    ||!severities.has(raw.severity)||!states.has(raw.status)
    ||!Number.isSafeInteger(raw.createdAt)||raw.createdAt<0||raw.createdAt>now
    ||!Number.isSafeInteger(raw.revision)||raw.revision<0)return null;
  seen.add(raw.incidentId);
  all.push(Object.freeze({
   incidentId:raw.incidentId,category:raw.category,severity:raw.severity,
   status:raw.status,createdAt:raw.createdAt,revision:raw.revision
  }));
 }
 const active=row=>activeStates.has(row.status);
 const counts=Object.freeze({
  all:all.length,
  active:all.filter(active).length,
  criticalActive:all.filter(row=>active(row)&&row.severity==='CRITICAL').length
 });
 const selected=all.filter(row=>filter==='ALL'||(active(row)&&
   (filter==='ACTIVE'||row.severity==='CRITICAL')));
 selected.sort((a,b)=>{
  if(order==='RECENT')return b.createdAt-a.createdAt||a.incidentId.localeCompare(b.incidentId);
  const activeDiff=Number(active(b))-Number(active(a));
  if(activeDiff)return activeDiff;
  const severityDiff=priority[a.severity]-priority[b.severity];
  return severityDiff||a.createdAt-b.createdAt||a.incidentId.localeCompare(b.incidentId);
 });
 return Object.freeze({
  scope:'VISIBLE_PAGE_ONLY',
  counts,filter,order,items:Object.freeze(selected),
  noGlobalTotal:true,operationsAllowed:false,sosEnabled:false
 });
}

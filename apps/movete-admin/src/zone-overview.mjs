/**
 * Admin: lectura geográfica mínima, sin abrir/cerrar municipios ni despachar.
 * La cobertura geográfica NO es disponibilidad de conductores.
 * Contrato de respuesta propuesto a A; endpoint NO certificado.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validId=x=>typeof x==='string'&&UUID.test(x);
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(value,keys)=>obj(value)&&Object.keys(value).every(k=>keys.includes(k))
 &&keys.every(k=>Object.hasOwn(value,k));
const kinds=new Set(['AUTO_RIDE','AUTO_DELIVERY','MOTO_DELIVERY']);
const coverage=new Set(['ACTIVE','PLANNED','PAUSED','CLOSED']);
const top=['scope','revision','generatedAt','expiresAt','items'];
const keys=['zoneId','municipality','serviceKind','coverageStatus','eligibleByPolicy','onDutyVehicles','availabilityObservedAt'];
export function projectZoneOverview(payload,{role,now=Date.now()}={}){
 if(role!=='admin'||!exact(payload,top)||payload.scope!=='admin.zones.read'
  ||!Number.isSafeInteger(payload.revision)||payload.revision<0
  ||!Number.isSafeInteger(payload.generatedAt)||payload.generatedAt>now
  ||payload.generatedAt<now-300000||!Number.isSafeInteger(payload.expiresAt)
  ||payload.expiresAt<=now||payload.expiresAt>now+300000
  ||!Array.isArray(payload.items)||payload.items.length>200)return null;
 const ids=new Set(),items=[];
 for(const row of payload.items){
  if(!exact(row,keys)||!validId(row.zoneId)||ids.has(row.zoneId)
   ||typeof row.municipality!=='string'||row.municipality.trim().length<2
   ||row.municipality.trim().length>80||!kinds.has(row.serviceKind)
   ||!coverage.has(row.coverageStatus)||typeof row.eligibleByPolicy!=='boolean'
   ||!Number.isSafeInteger(row.onDutyVehicles)||row.onDutyVehicles<0||row.onDutyVehicles>100000
   ||!Number.isSafeInteger(row.availabilityObservedAt)
   ||row.availabilityObservedAt>now)return null;
  ids.add(row.zoneId);
  const recent=now-row.availabilityObservedAt<=60000;
  items.push(Object.freeze({
   zoneId:row.zoneId,municipality:row.municipality.trim(),
   serviceKind:row.serviceKind,coverageStatus:row.coverageStatus,
   eligibleByPolicy:row.eligibleByPolicy,
   onDutyVehicles:recent?row.onDutyVehicles:null,
   availabilityFresh:recent,
   // No se infiere que un vehículo en línea acepte una oferta.
   availabilityConfirmed:false
  }));
 }
 return Object.freeze({revision:payload.revision,expiresAt:payload.expiresAt,items:Object.freeze(items)});
}
export function createZoneOverviewStore({now=()=>Date.now()}={}){
 let data=null;
 function clear(){data=null;}
 function replace(raw,role){
  const candidate=projectZoneOverview(raw,{role,now:now()});
  if(!candidate){clear();return false;}
  if(data&&candidate.revision<data.revision){clear();return false;}
  data=candidate;return true;
 }
 function current(role){
  if(role!=='admin'||!data||data.expiresAt<=now()){clear();return null;}
  return data;
 }
 return Object.freeze({replace,current,clear});
}

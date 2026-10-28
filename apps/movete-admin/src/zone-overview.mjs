import {readContinuation} from './page-cursor.mjs';
/**
 * Admin: lectura geográfica mínima, sin abrir/cerrar municipios ni despachar.
 * La cobertura geográfica NO es disponibilidad de conductores.
 * Contrato de respuesta propuesto a A; endpoint NO certificado.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validId=x=>typeof x==='string'&&UUID.test(x);
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(value,keys)=>obj(value)&&Object.keys(value).every(k=>keys.includes(k))
 &&keys.every(k=>k==='nextCursor'||Object.hasOwn(value,k));
const kinds=new Set(['AUTO_RIDE','MOTO_RIDE','AUTO_DELIVERY','MOTO_DELIVERY','COMMERCE']);
const motoLegalGates=new Set(['CLEARED','G38_BLOCKED','G71_BLOCKED','UNVERIFIED']);
const coverage=new Set(['ACTIVE','PLANNED','PAUSED','CLOSED']);
const top=['scope','revision','generatedAt','expiresAt','items','nextCursor'];
const keys=['zoneId','municipality','serviceKind','coverageStatus','eligibleByPolicy','onDutyVehicles','availabilityObservedAt'];
export function projectZoneOverview(payload,{role,now=Date.now()}={}){
 if(role!=='admin'||!exact(payload,top)||payload.scope!=='admin.zones.read'
  ||!Number.isSafeInteger(payload.revision)||payload.revision<0
  ||!Number.isSafeInteger(payload.generatedAt)||payload.generatedAt>now
  ||payload.generatedAt<now-300000||!Number.isSafeInteger(payload.expiresAt)
  ||payload.expiresAt<=now||payload.expiresAt>now+300000
  ||!Array.isArray(payload.items)||payload.items.length>50||!readContinuation(payload).ok)return null;
 const ids=new Set(),items=[];
 for(const row of payload.items){
  // MOTO_RIDE is passenger mobility, never motorcycle parcel delivery.
  // Commerce requires its own merchant eligibility, not courier availability.
  const shape=row?.serviceKind==='MOTO_RIDE'
   ?[...keys,'legalGate']:row?.serviceKind==='COMMERCE'
   ?[...keys,'merchantEligibilityVerified']:keys;
  if(!exact(row,shape)||!validId(row.zoneId)||ids.has(row.zoneId+'|'+row.serviceKind)
   ||typeof row.municipality!=='string'||row.municipality.trim().length<2
   ||row.municipality.trim().length>80||!kinds.has(row.serviceKind)
   ||!coverage.has(row.coverageStatus)||typeof row.eligibleByPolicy!=='boolean'
   ||!Number.isSafeInteger(row.onDutyVehicles)||row.onDutyVehicles<0||row.onDutyVehicles>100000
   ||!Number.isSafeInteger(row.availabilityObservedAt)
   ||row.availabilityObservedAt>now
   ||(row.serviceKind==='MOTO_RIDE'&&(
     !motoLegalGates.has(row.legalGate)
     ||(row.eligibleByPolicy===true&&
       (row.legalGate!=='CLEARED'||row.coverageStatus!=='ACTIVE'))))
   ||(row.serviceKind==='COMMERCE'&&(
     typeof row.merchantEligibilityVerified!=='boolean'
     ||(row.eligibleByPolicy===true&&
       (row.merchantEligibilityVerified!==true||row.coverageStatus!=='ACTIVE'))))
   )return null;
  ids.add(row.zoneId+'|'+row.serviceKind);
  const recent=now-row.availabilityObservedAt<=60000;
  // Never render merchant stock or blocked passenger MOTO as on-duty fleet.
  const mayShowVehicleCount=recent&&row.serviceKind!=='COMMERCE'
   &&(row.serviceKind!=='MOTO_RIDE'||row.legalGate==='CLEARED');
  items.push(Object.freeze({
   zoneId:row.zoneId,municipality:row.municipality.trim(),
   serviceKind:row.serviceKind,coverageStatus:row.coverageStatus,
   eligibleByPolicy:row.eligibleByPolicy,
   ...(row.serviceKind==='MOTO_RIDE'?{legalGate:row.legalGate}:{}),
   ...(row.serviceKind==='COMMERCE'?{
    merchantEligibilityVerified:row.merchantEligibilityVerified
   }:{}),
   onDutyVehicles:mayShowVehicleCount?row.onDutyVehicles:null,
   availabilityFresh:mayShowVehicleCount,
   // No se infiere que un vehículo en línea acepte una oferta.
   availabilityConfirmed:false
  }));
 }
 return Object.freeze({revision:payload.revision,expiresAt:payload.expiresAt,items:Object.freeze(items),
  nextCursor:readContinuation(payload).nextCursor});
}
export function createZoneOverviewStore({now=()=>Date.now()}={}){
 let data=null,raw=null;
 function clear(){data=null;raw=null;}
 function replace(payload,role){
  const candidate=projectZoneOverview(payload,{role,now:now()});
  if(!candidate){clear();return false;}
  if(data&&candidate.revision<data.revision){clear();return false;}
  data=candidate;raw=payload;return true;
 }
 function current(role){
  if(role!=='admin'||!data||data.expiresAt<=now()){clear();return null;}
  // Recalcular frescura de la capacidad incluso sin nuevo evento de red.
  const projected=projectZoneOverview(raw,{role,now:now()});
  if(!projected){clear();return null;}
  data=projected;return data;
 }
 return Object.freeze({replace,current,clear});
}

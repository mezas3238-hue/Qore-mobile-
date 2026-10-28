/**
 * R35: editor EFÍMERO de rutas para la app Cliente.
 * Soporta reordenar origen/destino y paradas en RAM, sin GPS, geocoding,
 * cotización, despacho, HTTP ni almacenamiento persistente.
 * El contrato vigente de rideRequest solo acepta origen + destino.
 */
export const MAX_LOCAL_STOPS=8;
const failure=(code,reason)=>Object.freeze({ok:false,code,reason});
const clean=x=>typeof x==='string'&&x.length<=120
 &&x.trim().length>=3&&!/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(x);
const key=x=>x.trim().normalize('NFKC').replace(/\s+/gu,' ').toLocaleLowerCase('es');
const freeze=(origin,destination,stops,revision)=>Object.freeze({
 origin,destination,stops:Object.freeze([...stops]),revision
});
const validDraft=d=>d!==null&&typeof d==='object'&&!Array.isArray(d)
 &&typeof d.origin==='string'&&typeof d.destination==='string'
 &&Array.isArray(d.stops)&&d.stops.length<=MAX_LOCAL_STOPS
 &&d.stops.every(s=>typeof s==='string')&&Number.isSafeInteger(d.revision)
 &&d.revision>=0;
export const emptyLocalRouteDraft=()=>freeze('','',[],0);
export function editLocalRouteDraft(current,change){
 if(!validDraft(current)||!change||typeof change!=='object'
  ||Array.isArray(change)||current.revision>=Number.MAX_SAFE_INTEGER)
  return failure('INVALID_ROUTE_CHANGE','No se puede editar esta ruta');
 let {origin,destination}=current;
 const stops=[...current.stops],value=change.value;
 const index=change.index;
 const positionValid=Number.isInteger(index)&&index>=0&&index<stops.length;
 switch(change.type){
  case 'origin':
   if(typeof value!=='string'||value.length>120)return failure('INVALID_ROUTE_POINT','Dirección demasiado extensa');
   origin=value;break;
  case 'destination':
   if(typeof value!=='string'||value.length>120)return failure('INVALID_ROUTE_POINT','Dirección demasiado extensa');
   destination=value;break;
  case 'swap':
   [origin,destination]=[destination,origin];break;
  case 'add-stop':
   if(stops.length>=MAX_LOCAL_STOPS)
    return failure('LOCAL_STOPS_LIMIT','Ya alcanzaste el límite de paradas de este borrador local');
   stops.push('');break;
  case 'stop':
   if(!positionValid||typeof value!=='string'||value.length>120)
    return failure('INVALID_ROUTE_POINT','Parada inválida');
   stops[index]=value;break;
  case 'remove-stop':
   if(!positionValid)return failure('INVALID_ROUTE_POINT','Parada inválida');
   stops.splice(index,1);break;
  case 'move-stop':
   if(!positionValid||![1,-1].includes(change.direction)
    ||index+change.direction<0||index+change.direction>=stops.length)
    return failure('INVALID_ROUTE_MOVE','No se puede reordenar esa parada');
   [stops[index],stops[index+change.direction]]=
    [stops[index+change.direction],stops[index]];break;
  default:return failure('INVALID_ROUTE_CHANGE','Acción desconocida');
 }
 return Object.freeze({ok:true,route:freeze(origin,destination,stops,current.revision+1)});
}
export function reviewLocalRouteDraft(draft){
 if(!validDraft(draft))return failure('INVALID_ROUTE','Ruta inválida');
 const points=[draft.origin,...draft.stops,draft.destination];
 if(points.some(p=>!clean(p)))
  return failure('INVALID_ROUTE_POINT','Indicá origen, destino y paradas válidos (3 a 120 caracteres)');
 const normalized=points.map(key);
 if(new Set(normalized).size!==normalized.length)
  return failure('REPEATED_ROUTE_POINT','No repitas origen, destino ni paradas en una misma ruta');
 return Object.freeze({ok:true,route:Object.freeze({
  origin:draft.origin.trim(),destination:draft.destination.trim(),
  stops:Object.freeze(draft.stops.map(x=>x.trim())),revision:draft.revision
 }),serverPrepared:false,quoted:false,geocoded:false});
}
export function canPrepareCurrentRideContract(draft){
 const review=reviewLocalRouteDraft(draft);
 if(!review.ok)return review;
 if(review.route.stops.length>0)
  return failure('WAYPOINTS_NOT_SUPPORTED_BY_SERVER',
   'Las paradas adicionales son solo un borrador local. El servidor todavía no admite contratarlas.');
 return Object.freeze({ok:true,route:review.route});
}

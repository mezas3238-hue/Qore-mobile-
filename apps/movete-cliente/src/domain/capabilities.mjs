/** Client app: no driver document uploads, offer acceptance, or admin roles. */
export const AUDIENCE='CLIENT';
export const LIVE_OPERATIONS_ENABLED=false;
export const CAPABILITIES=Object.freeze([
 'client.rides.draft','client.deliveries.draft','client.prices.preview',
 'client.tracking.preview','client.history.preview','client.support.preview'
]);
export function canUseClientCapability(action){
 return typeof action==='string'&&CAPABILITIES.includes(action);
}
const validTag=x=>typeof x==='string'&&x.trim().length>=3&&x.trim().length<=120;
export function validateRideDraft(value){
 if(value===null||typeof value!=='object'||Array.isArray(value))return {ok:false,reason:'Solicitud inválida'};
 const {pickup,destination,vehicleKind}=value;
 if(!validTag(pickup)||!validTag(destination)||pickup.trim().toUpperCase()===destination.trim().toUpperCase())
  return {ok:false,reason:'Ingresá dos puntos diferentes'};
 if(vehicleKind!=='AUTO')
  return {ok:false,reason:'Ese servicio aún no está autorizado para pasajeros'};
 return {ok:true,pickup:pickup.trim(),destination:destination.trim(),vehicleKind};
}
export function validateDeliveryDraft(value){
 if(value===null||typeof value!=='object'||Array.isArray(value))return {ok:false,reason:'Envío inválido'};
 const {pickup,destination,vehicleKind,grams}=value;
 if(!validTag(pickup)||!validTag(destination)||pickup.trim().toUpperCase()===destination.trim().toUpperCase())
  return {ok:false,reason:'Ingresá origen y destino diferentes'};
 if(!['AUTO','MOTO'].includes(vehicleKind)||!Number.isSafeInteger(grams)||grams<1||grams>100000)
  return {ok:false,reason:'Verificá vehículo y peso'};
 if(vehicleKind==='MOTO'&&grams>10000)return {ok:false,reason:'El envío supera 10 kg para moto'};
 return {ok:true,pickup:pickup.trim(),destination:destination.trim(),vehicleKind,grams};
}

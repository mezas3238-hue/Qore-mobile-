/** Driver application: no passenger bookings, passenger identity, or payment capture. */
export const AUDIENCE='DRIVER';
export const LIVE_OPERATIONS_ENABLED=false;
export const CAPABILITIES=Object.freeze([
 'driver.registration.draft','driver.documents.status','driver.availability.preview',
 'driver.offers.preview','driver.offers.accept.preview','driver.navigation.preview',
 'driver.earnings.preview'
]);
export function canUseDriverCapability(action){
 return typeof action==='string'&&CAPABILITIES.includes(action);
}
export function validateDriverDraft(value){
 if(value===null||typeof value!=='object'||Array.isArray(value))return {ok:false,reason:'Formulario inválido'};
 const {fullName,plate,vehicleKind}=value;
 if(typeof fullName!=='string'||fullName.trim().length<3||fullName.trim().length>90)
  return {ok:false,reason:'Ingresá tu nombre completo'};
 if(typeof plate!=='string'||!/^[A-Z0-9-]{4,12}$/.test(plate.trim().toUpperCase()))
  return {ok:false,reason:'Ingresá una chapa válida'};
 if(!['AUTO','MOTO'].includes(vehicleKind))
  return {ok:false,reason:'Seleccioná automóvil o motocicleta'};
 return {ok:true,fullName:fullName.trim(),plate:plate.trim().toUpperCase(),vehicleKind};
}

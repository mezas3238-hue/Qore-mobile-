/** Separate MOTO_RIDE passenger intent. No request path, payment, or local fare. */
export const MOTO_PASSENGER_SERVICE='MOTO_RIDE';
const validText=x=>typeof x==='string'&&x===x.trim()&&x.length>=3
 &&x.length<=120&&!/[\\u0000-\\u001f\\u007f]/.test(x);
const fail=reason=>Object.freeze({ok:false,reason,canBook:false});
export function reviewMotoRideDraft({origin,destination,safetyAcknowledged}={}){
 if(!validText(origin)||!validText(destination))
  return fail('Indicá origen y destino válidos (3 a 120 caracteres).');
 if(origin.toLocaleLowerCase('es')===destination.toLocaleLowerCase('es'))
  return fail('El origen y el destino deben ser distintos.');
 if(safetyAcknowledged!==true)
  return fail('Leé y reconocé los requisitos de seguridad para continuar.');
 return Object.freeze({
  ok:true,serviceKind:MOTO_PASSENGER_SERVICE,
  origin,destination,canBook:false,qaOnly:true,productionEnabled:false
 });
}

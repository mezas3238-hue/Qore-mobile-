/**
 * Preparación local y efímera de solicitudes Cliente. NO ejecuta red ni reservas.
 * El contrato A G11 controla rutas, precio y elegibilidad en servidor.
 */
import {validateRideDraft} from './capabilities.mjs';
import {validateDeliveryForm} from './delivery-form.mjs';
import {validateClientOperation} from './client-gateway.mjs';
import {createSecureCancellationKey} from './secure-cancel-key.mjs';

const fail=reason=>Object.freeze({ok:false,reason});
const serviceOptions=new Set(['economico','confort','xl']);
const integerFromInput=(raw,min,max)=>{
 if(typeof raw!=='string'||!/^[0-9]{1,6}$/.test(raw.trim()))return null;
 const value=Number(raw.trim());
 return Number.isSafeInteger(value)&&value>=min&&value<=max?value:null;
};
export function prepareLocalRideRequest({pickup,destination,service}={},secureUUID){
 const checked=validateRideDraft({pickup,destination,vehicleKind:'AUTO'});
 if(!checked.ok)return fail(checked.reason);
 if(!serviceOptions.has(service))return fail('Seleccioná un servicio de automóvil válido');
 const request={originTag:checked.pickup,destinationTag:checked.destination,service};
 // Nunca generar clave ni simular costo antes de verificar entradas.
 const key=createSecureCancellationKey(secureUUID);
 if(!key.ok)return fail('No disponible el generador criptográfico del dispositivo');
 const body={requestKey:key.requestKey,...request};
 if(!validateClientOperation('rideRequest',body))return fail('Datos de viaje fuera del contrato');
 return Object.freeze({ok:true,body:Object.freeze(body),
  review:Object.freeze({pickup:checked.pickup,destination:checked.destination,service}),
  sent:false,driverAssigned:false,serverPriced:false});
}
export function prepareLocalDeliveryRequest({pickup,destination,vehicleKind,
 category,weight,length,width,height,restricted}={},secureUUID){
 // Evitar Number('') === 0 y conversiones como '1e3', '2.5' o espacios.
 const grams=integerFromInput(weight,1,100000);
 const lengthCm=integerFromInput(length,1,200);
 const widthCm=integerFromInput(width,1,200);
 const heightCm=integerFromInput(height,1,200);
 if([grams,lengthCm,widthCm,heightCm].some(x=>x===null))
  return fail('Ingresá peso y dimensiones usando números enteros positivos');
 const checked=validateDeliveryForm({pickup,destination,vehicleKind,category,
  grams,lengthCm,widthCm,heightCm,restrictedItemDeclared:restricted});
 if(!checked.ok)return fail(checked.reason);
 const key=createSecureCancellationKey(secureUUID);
 if(!key.ok)return fail('No disponible el generador criptográfico del dispositivo');
 const body={requestKey:key.requestKey,vehicleKind:checked.vehicleKind,
  category:checked.category,grams:checked.grams,lengthCm:checked.lengthCm,
  widthCm:checked.widthCm,heightCm:checked.heightCm,
  pickupTag:checked.pickup,deliveryTag:checked.destination,
  restrictedItemDeclared:false};
 if(!validateClientOperation('deliveryRequest',body))
  return fail('Datos del envío fuera del contrato');
 return Object.freeze({ok:true,body:Object.freeze(body),
  review:Object.freeze({pickup:checked.pickup,destination:checked.destination,
   vehicleKind:checked.vehicleKind,category:checked.category,grams,
   lengthCm,widthCm,heightCm}),
  sent:false,courierAssigned:false,serverPriced:false});
}

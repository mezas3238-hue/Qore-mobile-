import {validateDeliveryDraft} from './capabilities.mjs';
export const DELIVERY_CATEGORIES=Object.freeze([
 {code:'DOCUMENTS',label:'Documentos'},
 {code:'PARCEL',label:'Paquetes'},
 {code:'GROCERIES',label:'Supermercado'},
 {code:'RESTAURANT',label:'Restaurante'},
 {code:'PHARMACY_OTC',label:'Farmacia sin receta'}
]);
export function validateDeliveryForm(value){
 const base=validateDeliveryDraft(value);
 if(!base.ok)return base;
 if(!DELIVERY_CATEGORIES.some(x=>x.code===value.category))
  return {ok:false,reason:'Seleccioná un tipo de envío permitido'};
 const dimensions=['lengthCm','widthCm','heightCm'];
 if(!dimensions.every(key=>Number.isSafeInteger(value[key])&&value[key]>=1&&value[key]<=200))
  return {ok:false,reason:'Ingresá dimensiones válidas en centímetros'};
 if(value.restrictedItemDeclared!==false)
  return {ok:false,reason:'No se admiten artículos restringidos en esta versión'};
 return {ok:true,...base,category:value.category,
  lengthCm:value.lengthCm,widthCm:value.widthCm,heightCm:value.heightCm,
  restrictedItemDeclared:false};
}

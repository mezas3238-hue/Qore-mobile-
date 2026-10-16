import {SERVICE_KIND, type MobilityService, type VehicleKind} from './vehicle-eligibility.ts';

/**
 * Preproduction client-side form validation only.
 * Document flags mean SELECTED by applicant, not checked/approved by a reviewer.
 * No RPC is wired to this form. Never set a verified/approved field from here.
 */
export interface VehicleApplicationDraft {
 driverName:string;
 contactPhone:string;
 driverLicenseNumber:string;
 driverLicensePhotoSelected:boolean;
 kind:VehicleKind;
 service:MobilityService;
 countryCode:string;
 municipalityCode:string;
 plate:string;
 brand:string;
 model:string;
 year:string;
 passengerCapacity:number;
 vehicleRegistrationSelected:boolean;
 commercialPassengerInsuranceSelected:boolean;
 inspectionEvidenceSelected:boolean;
 municipalPermitSelected:boolean;
 motorcycleHelmetEvidenceSelected:boolean;
 motorcycleHelmetCount:number;
 personalDataConsent:boolean;
}
export interface ApplicationDraftForReview {
 readonly reviewStatus:'pending';
 readonly driverName:string;
 readonly contactPhone:string;
 readonly driverLicenseNumber:string;
 readonly vehicleKind:VehicleKind;
 readonly service:MobilityService;
 readonly countryCode:string;
 readonly municipalityCode:string;
 readonly plateNormalized:string;
 readonly brand:string;
 readonly model:string;
 readonly manufactureYear:number;
 readonly passengerCapacity:number;
 readonly evidencePendingHumanReview:true;
}
export type DraftValidation={ok:false;reason:string}|{ok:true;draft:Readonly<ApplicationDraftForReview>};

export function prepareVehicleApplication(input:VehicleApplicationDraft):DraftValidation {
 if(!input.personalDataConsent)return{ok:false,reason:'Se requiere consentimiento informado'};
 if(input.driverName.trim().length<3||input.driverName.trim().length>120)
  return{ok:false,reason:'Nombre de conductor inválido'};
 if(!/^\+?[0-9\s()-]{7,20}$/.test(input.contactPhone.trim()))
  return{ok:false,reason:'Teléfono inválido'};
 if(input.driverLicenseNumber.trim().length<4||input.driverLicenseNumber.trim().length>40)
  return{ok:false,reason:'Licencia inválida'};
 if(!input.driverLicensePhotoSelected)return{ok:false,reason:'Falta foto de licencia'};
 if(!Object.prototype.hasOwnProperty.call(SERVICE_KIND,input.service)||
    SERVICE_KIND[input.service]!==input.kind)
  return{ok:false,reason:'Categoría incompatible con vehículo'};
 if(!/^[A-Z]{2}$/.test(input.countryCode))return{ok:false,reason:'Código de país inválido'};
 if(!/^[A-Z0-9_-]{2,60}$/.test(input.municipalityCode))
  return{ok:false,reason:'Municipio no identificado'};
 const plate=input.plate.trim().toUpperCase().replace(/\s+/g,'');
 if(!/^[A-Z0-9-]{4,12}$/.test(plate))return{ok:false,reason:'Chapa/patente inválida'};
 if(input.brand.trim().length<2||input.brand.trim().length>80||
    input.model.trim().length<1||input.model.trim().length>80)
  return{ok:false,reason:'Datos de marca/modelo inválidos'};
 const yr=Number(input.year);
 if(!/^\d{4}$/.test(input.year)||!Number.isSafeInteger(yr)||yr<1995||yr>new Date().getFullYear()+1)
  return{ok:false,reason:'Año fuera de rango provisional'};
 const capacity=input.passengerCapacity;
 if(!Number.isSafeInteger(capacity)||capacity<1||capacity>8)
  return{ok:false,reason:'Capacidad de pasajeros inválida'};
 if(input.kind==='MOTO'){
  if(input.service!=='moto_pasajero'||capacity!==1)
   return{ok:false,reason:'Moto: un solo pasajero'};
  if(!input.motorcycleHelmetEvidenceSelected||input.motorcycleHelmetCount!==2)
   return{ok:false,reason:'Moto: dos cascos y evidencia pendientes'};
 } else {
  if(input.service==='xl'&&capacity<6)return{ok:false,reason:'XL requiere capacidad declarada de al menos 6'};
  if(capacity<3)return{ok:false,reason:'Auto requiere capacidad mínima declarada'};
 }
 if(!input.vehicleRegistrationSelected||!input.commercialPassengerInsuranceSelected||
    !input.inspectionEvidenceSelected||!input.municipalPermitSelected)
  return{ok:false,reason:'Documentos de vehículo, seguro comercial, inspección y permiso faltantes'};
 const draft:ApplicationDraftForReview={
  reviewStatus:'pending',
  driverName:input.driverName.trim(),contactPhone:input.contactPhone.trim(),
  driverLicenseNumber:input.driverLicenseNumber.trim(),vehicleKind:input.kind,
  service:input.service,countryCode:input.countryCode,
  municipalityCode:input.municipalityCode,plateNormalized:plate,
  brand:input.brand.trim(),model:input.model.trim(),manufactureYear:yr,
  passengerCapacity:capacity,evidencePendingHumanReview:true,
 };
 return {ok:true,draft:Object.freeze(draft)};
}

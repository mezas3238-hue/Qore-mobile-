/**
 * Pure PRE-PRODUCTION guard for AUTO/MOTO offer viability.
 * NOT server authorization, not an insurer/license verifier; all booleans must
 * ultimately come from auditable server-verified evidence, never client fields.
 * Does not enable rides or dispatch.
 */
export type VehicleKind = 'AUTO' | 'MOTO';
export type MobilityService = 'economico' | 'confort' | 'xl' | 'moto_pasajero';
export const SERVICE_KIND: Readonly<Record<MobilityService,VehicleKind>> = {
 economico:'AUTO', confort:'AUTO', xl:'AUTO', moto_pasajero:'MOTO',
};
export interface OfferCandidate {
 driverStatus: 'pending'|'approved'|'rejected'|'suspended';
 vehicleStatus: 'pending'|'approved'|'rejected'|'suspended';
 vehicleKind: VehicleKind;
 service: MobilityService;
 driverLicenseVerified: boolean;
 vehicleRegistrationVerified: boolean;
 insuranceVerified: boolean;
 insuranceCoversPaidPassengers: boolean;
 insuranceExpiryDate: string;
 inspectionVerified: boolean;
 inspectionExpiryDate: string;
 municipalAuthorizationVerified: boolean;
 motoHelmetsVerified: number;
 motoRouteSafetyAllowed: boolean;
 locationOptIn: boolean;
 locationUpdatedAtMs: number|null;
}
export type Eligibility = {eligible:true}|{eligible:false;reason:string};
const invalid=(reason:string):Eligibility=>({eligible:false,reason});
function validThrough(date:string,nowMs:number):boolean {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return false;
 const ms=Date.parse(date+'T23:59:59.999Z');
 return Number.isFinite(ms)&&new Date(ms).toISOString().slice(0,10)===date&&ms>=nowMs;
}
/** Stale after 120s; reject timestamps >15s in future (spoof/clock skew). */
export function checkOfferCandidate(candidate:OfferCandidate,nowMs:number):Eligibility {
 if(!Number.isFinite(nowMs)||nowMs<0)return invalid('Tiempo de servidor inválido');
 if(candidate.driverStatus!=='approved')return invalid('Conductor no aprobado');
 if(candidate.vehicleStatus!=='approved')return invalid('Vehículo no aprobado');
 if(!(candidate.service in SERVICE_KIND)||SERVICE_KIND[candidate.service]!==candidate.vehicleKind)
  return invalid('Servicio incompatible con tipo de vehículo');
 if(!candidate.driverLicenseVerified)return invalid('Licencia no verificada');
 if(!candidate.vehicleRegistrationVerified)return invalid('Habilitación del vehículo no verificada');
 if(!candidate.municipalAuthorizationVerified)return invalid('Permiso local no verificado');
 if(!candidate.insuranceVerified||!candidate.insuranceCoversPaidPassengers||
    !validThrough(candidate.insuranceExpiryDate,nowMs))return invalid('Seguro de pasajeros remunerados inválido o vencido');
 if(!candidate.inspectionVerified||!validThrough(candidate.inspectionExpiryDate,nowMs))
  return invalid('Inspección inválida o vencida');
 if(candidate.vehicleKind==='MOTO'&&(candidate.motoHelmetsVerified<2||
    !Number.isInteger(candidate.motoHelmetsVerified)||!candidate.motoRouteSafetyAllowed))
  return invalid('Seguridad de moto no verificada');
 if(!candidate.locationOptIn)return invalid('GPS sin consentimiento');
 const ts=candidate.locationUpdatedAtMs;
 if(ts===null||!Number.isFinite(ts)||ts>nowMs+15000||nowMs-ts>120000)
  return invalid('Posición de conductor obsoleta/no confiable');
 return {eligible:true};
}

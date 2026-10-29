import type {DriverMotoJourney} from './driver-moto-journey-http.mjs';
import type {DriverMotoSnapshot} from './driver-moto-journey.mjs';
export type DriverMotoRecoveryResult=Readonly<{
 ok:boolean;reason?:string;bookingKey?:string;tripId?:string;
 qaOnly?:true;productionEnabled?:false;
}>;
export declare function recoverOriginalDriverMoto(options:{
 getSession:()=>Promise<{role:string;userId:string;accessToken:string}|null>;
 readCurrent:(p:{accessToken:string})=>Promise<DriverMotoJourney|null>;
 openOriginal:(bookingKey:string)=>Promise<DriverMotoSnapshot>;
}):Promise<DriverMotoRecoveryResult>;

import type {DriverOfferDecisionStatus} from './driver-offer-actions.mjs';
import type {DriverCurrentTrip} from './driver-current-trip-http.mjs';
export declare const DRIVER_ACCEPTED_RIDE_RESUME_LIVE_ENABLED:false;
export declare function verifyAcceptedDriverAutoResume(args:{
 decision:DriverOfferDecisionStatus|null;
 recoverCurrent:()=>Promise<DriverCurrentTrip|null>;
}):Promise<Readonly<{ok:true;tripId:string}|{
 ok:false;reason:'NOT_CONFIRMED'|'UNVERIFIED_ASSIGNMENT'}>>;

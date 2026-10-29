import type {DriverOfferDecisionStatus} from './driver-offer-actions.mjs';
import type {DriverCurrentTrip} from './driver-current-trip-http.mjs';
export declare const DRIVER_ACCEPTED_RIDE_RESUME_LIVE_ENABLED:false;
export declare function verifyAcceptedDriverAutoResume(args:{
 decision:DriverOfferDecisionStatus|null;
 recoverCurrent:()=>Promise<DriverCurrentTrip|null>;
}):Promise<Readonly<{ok:true;tripId:string}|{
 ok:false;reason:'NOT_CONFIRMED'|'UNVERIFIED_ASSIGNMENT'}>>;

/** Re-check the same Driver-owned AUTO assignment after restart or tap. */
export declare function verifyResumableDriverAutoTrip(args:{
 expectedTripId:string;
 minimumRevision?:number;
 recoverCurrent:()=>Promise<DriverCurrentTrip|null>;
}):Promise<Readonly<{ok:true;tripId:string}|{
 ok:false;reason:'UNVERIFIED_ASSIGNMENT'}>>;

/** Resume after app restart without trusting a remembered offer/trip ID. */
export declare function verifyFreshDriverAutoResume(args:{
 recoverCurrent:()=>Promise<DriverCurrentTrip|null>;
}):Promise<Readonly<{ok:true;tripId:string}|{
 ok:false;reason:'UNVERIFIED_ASSIGNMENT'}>>;

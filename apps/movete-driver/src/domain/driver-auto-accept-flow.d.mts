import type {DriverOfferDecisionStatus} from './driver-offer-actions.mjs';
import type {DriverCurrentTrip} from './driver-current-trip-http.mjs';
export declare function acceptAndRecoverDriverAuto(params:{
 offerId:string;
 decide:(offerId:string,action:'accept')=>Promise<DriverOfferDecisionStatus|null>;
 recoverCurrent:()=>Promise<DriverCurrentTrip|null>;
}):Promise<{ok:true;tripId:string}|{ok:false;reason:string}>;

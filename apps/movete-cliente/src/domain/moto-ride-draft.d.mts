export declare const MOTO_PASSENGER_SERVICE:'MOTO_RIDE';
export type MotoRideDraftResult=
 |Readonly<{ok:false;reason:string;canBook:false}>
 |Readonly<{ok:true;serviceKind:'MOTO_RIDE';origin:string;destination:string;
   canBook:false;qaOnly:true;productionEnabled:false}>;
export declare function reviewMotoRideDraft(args?:{
 origin?:unknown;destination?:unknown;safetyAcknowledged?:unknown
}):MotoRideDraftResult;

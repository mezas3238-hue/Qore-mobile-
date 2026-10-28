export type G155RatingKind='AUTO_RIDE'|'MOTO_RIDE'|'DELIVERY_AUTO'|'DELIVERY_MOTO'|'COMMERCE';
export type G155TargetKind='DRIVER'|'COURIER'|'MERCHANT';
export type G155IncidentCode='SUSPECTED_FRAUD'|'SAFETY'|'NO_SHOW'|'INCORRECT_ITEM'|'OTHER';
export type G155RatingBody={requestKey:string;serviceKind:G155RatingKind;
 serviceId:string;ratedKind:G155TargetKind;stars:number;
 incidentCode:G155IncidentCode|null};
export type G155RatingResult={ok:false;code:string}|{ok:true;ratingId:string;
 qaOnly:true;dispatchPriorityChanged:false;productionEnabled:false};
export declare function validateG155RatingBody(body:unknown):boolean;
export declare function createG155VerifiedRatingClient(options?:{
 enabled?:boolean;ownerApproved?:boolean;contractVerified?:boolean;
 originalCompletionVerified?:boolean;externalRuntimeVerified?:boolean;
 providerRevocationVerified?:boolean;origin?:string;pinnedOrigin?:string;
 getSession?:()=>Promise<unknown>|unknown;
 fetchImpl?:(url:string,request:unknown)=>Promise<unknown>|unknown;
 now?:()=>number;
}):Readonly<{isConfigured:()=>boolean;submit:(body:G155RatingBody)=>Promise<G155RatingResult>}>;

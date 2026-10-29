export declare const DRIVER_VERIFIED_RATING_LIVE_ENABLED:false;
export type DriverRatingBody=Readonly<{
 requestKey:string;serviceKind:'AUTO_RIDE'|'MOTO_RIDE'|'DELIVERY_AUTO'|'DELIVERY_MOTO';
 serviceId:string;ratedKind:'CLIENT';stars:number;
 incidentCode:null|'SUSPECTED_FRAUD'|'SAFETY'|'NO_SHOW'|'INCORRECT_ITEM'|'OTHER';
}>;
export type DriverRatingResult=Readonly<
 {ok:true;ratingId:string;qaOnly:true;productionEnabled:false;dispatchPriorityChanged:false}|
 {ok:false;code:string}
>;
export declare function validDriverClientRating(body:unknown):boolean;
export declare function createDriverVerifiedRating(options?:{
 enabled?:boolean;ownerApproved?:boolean;contractVerified?:boolean;
 originalCompletionVerified?:boolean;externalRuntimeVerified?:boolean;
 providerRevocationVerified?:boolean;apiOrigin?:string;pinnedOrigin?:string;
 getSession?:()=>Promise<unknown>;request?:typeof fetch;now?:()=>number;
}):Readonly<{
 isConfigured:()=>boolean;
 submit:(body:DriverRatingBody)=>Promise<DriverRatingResult>
}>;

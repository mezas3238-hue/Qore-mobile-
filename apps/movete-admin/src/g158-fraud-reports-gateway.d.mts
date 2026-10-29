export type G158FraudItem=Readonly<{ratedKind:'DRIVER'|'COURIER'|'MERCHANT'|'CLIENT';
 ratedId:string;recentReports:number;independentReporters:number;
 distinctServices:number;reviewTier:'SINGLE_SOURCE_REVIEW'|'MULTI_SOURCE_REVIEW';
 allegationOnly:true}>;
export type G158FraudPage=Readonly<{items:readonly G158FraudItem[];
 hasMore:boolean;observedAt:number;expiresAt:number;
 allegationOnly:true;automaticSuspension:false;dispatchPenaltyApplied:false}>;
export type G158FraudResult={ok:false;code:string}|{ok:true;page:G158FraudPage};
export declare function projectG158FraudReports(raw:unknown,options?:{
 subject?:string;at?:number
}):G158FraudPage|null;
export declare function createG158FraudReportsClient(options?:{
 enabled?:boolean;ownerApproved?:boolean;contractVerified?:boolean;
 externalRuntimeVerified?:boolean;serverMfaVerified?:boolean;
 serverRbacVerified?:boolean;serverRevocationVerified?:boolean;
 origin?:string;pinnedOrigin?:string;
 getSession?:()=>Promise<unknown>|unknown;
 fetchImpl?:(url:string,request:unknown)=>Promise<unknown>|unknown;
 now?:()=>number;
}):Readonly<{isConfigured:()=>boolean;fetchReports:()=>Promise<G158FraudResult>}>;

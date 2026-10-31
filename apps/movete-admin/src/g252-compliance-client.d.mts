export type G252DocumentAlert=Readonly<{
 driverId:string;kind:string;band:'D30'|'D15'|'D07'|'D01'|'EXPIRED';
 validUntilMs:number
}>;
export type G252AlertsPage=Readonly<{
 items:readonly G252DocumentAlert[];hasMore:boolean;observedAt:number;expiresAt:number
}>;
export type G252AlertsResult={ok:false;code:string}|{ok:true;page:G252AlertsPage};
export declare function projectG252ComplianceAlerts(raw:unknown,options?:{
 subject?:string;at?:number
}):G252AlertsPage|null;
export declare function createG252ComplianceClient(options?:{
 enabled?:boolean;ownerApproved?:boolean;contractVerified?:boolean;
 externalRuntimeVerified?:boolean;serverMfaVerified?:boolean;
 serverRbacVerified?:boolean;serverRevocationVerified?:boolean;
 origin?:string;pinnedOrigin?:string;
 getSession?:()=>Promise<unknown>|unknown;
 fetchImpl?:(url:string,request:unknown)=>Promise<unknown>|unknown;
 now?:()=>number;
}):Readonly<{isConfigured:()=>boolean;fetchAlerts:()=>Promise<G252AlertsResult>}>;

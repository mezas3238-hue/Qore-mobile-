export type OwnerAutoFareDraft={requestKey:string;basePyg:number;perKmPyg:number;
 perMinutePyg:number;minimumPyg:number;commissionBps:number};
export type OwnerAutoFareReceipt={mode:'STAGING_DEMO_ONLY';commercialEnabled:false;
 ruleKey:string;zoneTag:string;commissionBps:number;commissionPercent:number;
 active:true;idempotent:boolean};
export type OwnerAutoFareOutcome={ok:boolean;code?:string;data?:OwnerAutoFareReceipt;
 independentlyReadBack?:false;externalJourneysCertified?:0};
export declare function createOwnerAutoFareGateway(args?:{
 enabled?:boolean;contractCertified?:boolean;origin?:string;pinnedOrigin?:string;
 getSession?:()=>unknown|Promise<unknown>;
 fetchImpl?:(url:string,options:unknown)=>unknown|Promise<unknown>;
 now?:()=>number;timeoutMs?:number;maxBytes?:number;
}):Readonly<{isConfigured:()=>boolean;
 publish:(zone:string,draft:OwnerAutoFareDraft)=>Promise<OwnerAutoFareOutcome>}>;

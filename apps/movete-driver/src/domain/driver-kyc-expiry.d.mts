export declare const DRIVER_KYC_EXPIRY_LIVE_ENABLED:false;
export type DriverKycExpiryState='BLOCKED_EXPIRED'|'BLOCKED_REVIEW'|'SUSPENDED'|'READY_QA';
export type DriverKycExpirySnapshot=Readonly<{
 mode:'STAGING_DEMO_ONLY';state:DriverKycExpiryState;
 expiredKinds:ReadonlyArray<string>;renewalRequiredKinds:ReadonlyArray<string>;
 expiringSoonKinds:ReadonlyArray<string>;nearestExpiryAtMs:number|null;
 accountBlocked:boolean;qaOnboardingActive:boolean;
 commercialDispatchAuthorized:false;qaOnly:true;productionEnabled:false;
}>;
export declare const KYC_DOCUMENT_LABELS:Readonly<Record<string,string>>;
export declare function assertDriverKycExpirySnapshot(data:unknown,now?:number):DriverKycExpirySnapshot;
export declare function readDriverKycExpiry(opts:{
 apiOrigin:string;accessToken:string;approvedStagingHost:string;
 allowedByOwner:true;request?:typeof fetch;now?:()=>number;
}):Promise<DriverKycExpirySnapshot>;
export declare function driverKycScreenNotice(
 data:DriverKycExpirySnapshot|null
):Readonly<{severity:'warning'|'info';text:string}>;

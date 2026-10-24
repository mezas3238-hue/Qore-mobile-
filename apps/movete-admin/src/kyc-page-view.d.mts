export type KycEvidence='EXPIRED'|'REJECTED'|'MISSING'|'PENDING'|'REPORTED_VALID';
export type KycFilter=KycEvidence|'ALL';
export type KycPageView={
 scope:'VISIBLE_PAGE_ONLY';
 counts:Readonly<Record<KycFilter,number>>;
 visibleCount:number;
 items:readonly Readonly<{
 vehicleId:string;vehicleKind:'AUTO'|'MOTO_DELIVERY';applicationStatus:string;
 licenseStatus:string;insuranceStatus:string;inspectionStatus:string;
 reviewRevision:number;evidence:KycEvidence;
 }>[];
 operationalEligibilityConfirmed:false;
};
export declare const KYC_FILTERS:readonly KycFilter[];
export declare function classifyKycEvidence(row:unknown):KycEvidence|null;
export declare function projectKycPageView(items:readonly unknown[],
 opts?:{filter?:KycFilter}):KycPageView|null;

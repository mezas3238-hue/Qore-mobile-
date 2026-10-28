export type KycRecord={
 vehicleId:string;
 vehicleKind:'AUTO'|'MOTO_DELIVERY';
 applicationStatus:'pending'|'under_review'|'rejected'|'approved'|'expired';
 licenseStatus:'missing'|'pending'|'valid'|'expired'|'rejected';
 insuranceStatus:'missing'|'pending'|'valid'|'expired'|'rejected';
 inspectionStatus:'missing'|'pending'|'valid'|'expired'|'rejected';
 reviewRevision:number;
};
export type KycQueueSnapshot={
 revision:number;generatedAt:number;expiresAt:number;
 items:readonly Readonly<KycRecord>[];
};
export declare function projectKycQueue(data:unknown,options?:{
 role?:string;now?:number;
}):Readonly<KycQueueSnapshot>|null;
export declare function createKycQueueStore(options?:{now?:()=>number}):{
 replace:(payload:unknown,role:string)=>boolean;
 current:()=>Readonly<KycQueueSnapshot>|null;
 clear:()=>void;
};

export declare const DRIVER_DOCUMENT_UPLOAD_LIVE_ENABLED:false;
export declare const DRIVER_KYC_UPLOAD_KINDS:ReadonlyArray<
 'licencia'|'identidad_frente'|'identidad_dorso'|'cedula_verde'|
 'habilitacion'|'seguro'|'inspeccion'|'rostro_selfie'>;
export type DriverKycUploadKind=typeof DRIVER_KYC_UPLOAD_KINDS[number];
export type DriverDocumentUploadAdapters=Readonly<{
 upload:(args:{kind:DriverKycUploadKind;faceConsent:boolean})=>Promise<Readonly<{
  kind:DriverKycUploadKind;phase:'pending-review'|'cancelled';
  accountApproved:false;driverEligible:false;qaOnly:true;productionEnabled:false;
 }>>;
}>;
export declare function submitPrivateDriverEvidence(opts:{
 kind:DriverKycUploadKind;faceConsent?:boolean;
 authAdapter:{getSession:()=>Promise<unknown>};
 apiOrigin:string;approvedStagingHost:string;allowedByOwner:true;
 captureEvidence:(x:{kind:DriverKycUploadKind;source:'camera'|'camera_or_library';maxBytes:number})=>Promise<null|{bytes:Uint8Array;mimeType:string;source:'camera'|'library'}>;
 uploadPrivateObject:(x:{bucket:string;objectKey:string;mimeType:string;bytes:Uint8Array;upsert:false;accessToken:string})=>Promise<{storedPrivately:boolean}>;
 makeRequestKey:()=>string|Promise<string>;
 request?:typeof fetch;
}):Promise<Readonly<{
 kind:DriverKycUploadKind;phase:'pending-review'|'cancelled';
 accountApproved:false;driverEligible:false;qaOnly:true;productionEnabled:false;
}>>;

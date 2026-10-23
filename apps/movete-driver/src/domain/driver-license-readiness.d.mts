export declare const DRIVER_LICENSE_READINESS_LIVE_ENABLED:false;
export type DriverLicenseReviewSnapshot=Readonly<{
 currentLicenseApproved:boolean;
 driverEligible:false;
 liveEnabled:false;
 scope:'CURRENT_LICENSE_REVIEW_ONLY';
}>;
export declare function readDriverLicenseReadiness(options:{
 apiOrigin:string;
 accessToken:string;
 request?:(url:string,options:RequestInit)=>Promise<{
  status:number;json():Promise<unknown>;
 }>;
}):Promise<DriverLicenseReviewSnapshot>;

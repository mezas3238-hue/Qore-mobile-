export declare const DRIVER_ENROLLMENT_LIVE_ENABLED:false;
export type DriverEnrollmentResult=Readonly<{
 enrollmentId:string;
 status:'pending_compliance';
 driverEligible:false;
 liveEnabled:false;
}>;
export type DriverEnrollmentOptions={
 apiOrigin:string;
 accessToken:string;
 /** Stable UUID: reuse across uncertain POST retries. */
 requestKey:string;
 /** Explicit Driver-app consent, NEVER automatic. */
 driverConsent:true;
 request?:(url:string,options:RequestInit)=>Promise<{
  status:number;json():Promise<unknown>;
 }>;
};
export declare function enrollDriverIdentity(
 options:DriverEnrollmentOptions
):Promise<DriverEnrollmentResult>;

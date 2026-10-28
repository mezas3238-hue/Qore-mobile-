export declare const DRIVER_HTTPS_AUTH_LIVE_ENABLED:false;
export type DriverVerifiedSession=Readonly<{
 role:'driver';userId:string;accessToken:string;
}>;
export type DriverHttpsStagingAuthSdk=Readonly<{
 getSession:()=>Promise<{
  data?:{session:unknown|null};
  error?:unknown;
 }>;
 getUser:(bearer:string)=>Promise<{
  data?:{user:unknown};
  error?:unknown;
 }>;
 onAuthStateChange:(callback:()=>void)=>{
  data:{subscription:{unsubscribe:()=>void}};
 };
}>;
export type DriverHttpsStagingAuthOptions={
 auth:DriverHttpsStagingAuthSdk;
 apiOrigin:string;
 approvedStagingHost:string;
 allowedByOwner:true;
 liveEnabled?:false;
 verifyExclusiveDriverRole:(ctx:Readonly<{
  apiOrigin:string;userId:string;accessToken:string;
 }>)=>Promise<boolean>;
 now?:()=>number;
};
export type DriverHttpsStagingAuthAdapter=Readonly<{
 getSession:()=>Promise<DriverVerifiedSession|null>;
 subscribe:(notify:()=>void)=>()=>void;
}>;
export declare function createDriverHttpsStagingAuthAdapter(
 options:DriverHttpsStagingAuthOptions
):DriverHttpsStagingAuthAdapter;

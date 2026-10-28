import type {DriverAuthSessionAdapter} from './driver-workspace.mjs';
export declare const DRIVER_STAGING_AUTH_LIVE_ENABLED:false;
export interface DriverPublicAuthSdk {
 getSession():Promise<{
  data:{session:null|{
   user:{id:string};
   access_token:string;
   /** JWT expiry in Unix seconds, not milliseconds. */
   expires_at:number;
  }};error?:unknown;
 }>;
 getUser(jwt:string):Promise<{
  data:{user:null|{
   id:string;
   email_confirmed_at?:string|null;
   phone_confirmed_at?:string|null;
   is_anonymous?:boolean;
  }};error?:unknown;
 }>;
 onAuthStateChange(listener:(event:string,session:unknown)=>void):{
  data:{subscription:{unsubscribe():void}};
 };
}
/** Requires explicit STAGING authorization; never includes keys or users. */
export declare function createDriverStagingAuthAdapter(options:{
 auth:DriverPublicAuthSdk;
 apiOrigin:string;
 request?:typeof fetch;
 now?:()=>number;
}):DriverAuthSessionAdapter;

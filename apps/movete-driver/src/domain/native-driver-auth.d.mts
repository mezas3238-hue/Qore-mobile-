import type {DriverAuthSessionAdapter} from './driver-workspace.mjs';
export type NativeDriverAuth=DriverAuthSessionAdapter & {
 signIn:(email:string,password:string)=>Promise<{ok:boolean;code?:string}>;
 signOut:()=>Promise<void>;
};
export declare function createNativeDriverAuth(options:{
 supabase:unknown;
 now?:()=>number;
}):NativeDriverAuth;

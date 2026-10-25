import type {DriverAuthSessionAdapter} from './driver-workspace.mjs';
export type NativeDriverAuth=DriverAuthSessionAdapter & {
 subscribe:(notify:()=>void)=>()=>void;
 signIn:(email:string,password:string)=>Promise<{ok:boolean;code?:string}>;
 signOut:()=>Promise<void>;
};
export declare function createNativeDriverAuth(options:{
 supabase:unknown;
 now?:()=>number;
}):NativeDriverAuth;

export type NativePassengerSession={
 role:'passenger';subject:string;token:string;expiresAt:number;
};
export type NativePassengerAuth={
 readSession:()=>Promise<NativePassengerSession|null>;
 signIn:(email:string,password:string)=>Promise<{ok:boolean;code?:string;subject?:string}>;
 signOut:()=>Promise<void>;
};
/**
 * Supabase PostgrestFilterBuilder is PromiseLike (not Promise). SDK
 * object generics are deliberately opaque at this boundary. The runtime
 * checks all Auth/RLS methods before issuing a Passenger session.
 */
export declare function createNativePassengerAuth(options:{
 supabase:unknown;
 now?:()=>number;
}):NativePassengerAuth;

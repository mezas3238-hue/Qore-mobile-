export type NativePassengerSession={role:'passenger';subject:string;token:string;expiresAt:number};
export type NativePassengerAuth={
 readSession:()=>Promise<NativePassengerSession|null>;
 signIn:(email:string,password:string)=>Promise<{ok:boolean;code?:string;subject?:string}>;
 signOut:()=>Promise<void>;
};
export declare function createNativePassengerAuth(options:{
 supabase:{
  auth:{
   getSession:()=>Promise<{data?:{session?:{access_token?:string;expires_at?:number;user?:{id?:string}}|null};error?:unknown}>;
   getUser:(token:string)=>Promise<{data?:{user?:{id?:string;is_anonymous?:boolean;
    email_confirmed_at?:string|null;phone_confirmed_at?:string|null}|null};error?:unknown}>;
   signInWithPassword:(input:{email:string;password:string})=>Promise<{error?:unknown}>;
   signOut:()=>Promise<{error?:unknown}>;
  };
  from:(table:string)=>{select:(fields:string)=>{eq:(column:string,value:string)=>{limit:(num:number)=>Promise<{data?:{role:string}[]|null;error?:unknown}>}}};
 };
 now?:()=>number;
}):NativePassengerAuth;

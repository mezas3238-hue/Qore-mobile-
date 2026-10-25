export type WebAdminSession={role:'admin'|'owner';subject:string;token:string;mfaVerified:true;expiresAt:number};
export type WebAdminAuth={
 readSession:()=>Promise<WebAdminSession|null>;
 signIn:(email:string,password:string)=>Promise<{ok:boolean;code?:string;role?:'admin'|'owner'}>;
 verifyTotp:(code:string)=>Promise<{ok:boolean;code?:string;role?:'admin'|'owner'}>;
 signOut:()=>Promise<void>;
};
export declare function createWebAdminAuth(options:{
 supabase:unknown;now?:()=>number;
}):WebAdminAuth;

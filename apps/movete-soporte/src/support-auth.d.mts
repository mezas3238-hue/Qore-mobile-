export type SupportClientSession=Readonly<{userId:string;expiresAt:number}>;
export declare function verifySupportAccess(supabase:any,now?:()=>number):Promise<SupportClientSession|null>;
export declare function supportPasswordLogin(supabase:any,email:string,password:string):Promise<{ok:boolean;code?:string;factorId?:string}>;
export declare function supportTotpVerify(supabase:any,factorId:string,code:string):Promise<{ok:boolean;code?:string}>;

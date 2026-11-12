import type {SupportActionIntent,SupportActionReceipt} from './support-action-contract.mjs';
export type SupportVerifiedIdentity=Readonly<{
 userId:string;sessionId:string;aal:string;role:string;isAnonymous:boolean;
}>;
export declare function createSupportActionHandler(args?:{
 enabled?:boolean;
 allowedOrigin?:string;
 resolveIdentity?:(token:string)=>Promise<SupportVerifiedIdentity|null>;
 enqueue?:(identity:SupportVerifiedIdentity,intent:SupportActionIntent)=>Promise<SupportActionReceipt|null>;
}):(request:Request)=>Promise<Response>;

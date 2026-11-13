import type {SupportClaimIntent,SupportClaimReceipt} from './support-claim-contract.mjs';
export type SupportClaimVerifiedIdentity=Readonly<{
 userId:string;sessionId:string;aal:string;role:string;isAnonymous:boolean
}>;
export declare function createSupportClaimHandler(args?:{
 enabled?:boolean;allowedOrigin?:string;
 resolveIdentity?:(token:string)=>Promise<SupportClaimVerifiedIdentity|null>;
 claim?:(identity:SupportClaimVerifiedIdentity,intent:SupportClaimIntent)=>Promise<SupportClaimReceipt|null>;
}):(request:Request)=>Promise<Response>;

export type AdminReadOperation='kyc'|'zones'|'incidents'|'audit'|'finance';
export type AdminReadQaOptions=Readonly<{
 enabled:true;origin:string;pinnedOrigin:string;
 certifiedContracts:readonly AdminReadOperation[];fetchImpl:typeof fetch;
}>;
export declare function createAdminReadQaOptions(config?:{
 origin?:string;pinnedOrigin?:string;ownerApproved?:boolean;
 externalHttpsVerified?:boolean;contractVerified?:boolean;
 postgresVerified?:boolean;serverMfaVerified?:boolean;
 serverRbacVerified?:boolean;serverRevocationVerified?:boolean;
 verifiedOperations?:string;fetchImpl?:typeof fetch;
}):AdminReadQaOptions|null;

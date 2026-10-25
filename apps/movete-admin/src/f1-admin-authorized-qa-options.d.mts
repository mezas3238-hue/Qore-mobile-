/** R77: browser QA bootstrap flags; NEVER a replacement for server MFA/RBAC. */
export type F1AdminAuthorizedQaOptions=Readonly<{
 enabled:true;contractCertified:true;stagingRuntimeVerified:true;
 origin:string;pinnedOrigin:string;
 fetchImpl:(url:string,request:unknown)=>unknown|Promise<unknown>;
 productionEnabled:false;
}>;
export declare function createF1AdminAuthorizedQaOptions(options?:{
 origin?:string;pinnedOrigin?:string;
 ownerApproved?:boolean;externalHttpsVerified?:boolean;
 g75ContractVerified?:boolean;persistedPostgresVerified?:boolean;
 serverMfaVerified?:boolean;serverRbacVerified?:boolean;
 serverRevocationVerified?:boolean;
 fetchImpl?:(url:string,request:unknown)=>unknown|Promise<unknown>;
}):F1AdminAuthorizedQaOptions|null;

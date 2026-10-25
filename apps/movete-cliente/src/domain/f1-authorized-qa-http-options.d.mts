export type F1AuthorizedQaHttpOptions=Readonly<{
 enabled:true;contractCertified:true;stagingRuntimeVerified:true;
 routeProviderCertified:true;subsidyContractCertified:true;
 financialContractCertified:boolean;
 origin:string;pinnedOrigin:string;
 fetchImpl:(url:string,request:unknown)=>Promise<unknown>;
}>;
export declare function createF1AuthorizedQaHttpOptions(options?:{
 origin?:string;pinnedOrigin?:string;
 ownerApproved?:boolean;backendContractVerified?:boolean;
 persistedRuntimeVerified?:boolean;routeProviderVerified?:boolean;
 subsidyContractVerified?:boolean;financialContractVerified?:boolean;
 fetchImpl?:(url:string,request:unknown)=>Promise<unknown>;
}):F1AuthorizedQaHttpOptions|null;

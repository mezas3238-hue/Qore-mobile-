export type RecoveryGatewayOptions=Readonly<{
 enabled:true;contractCertified:true;origin:string;pinnedOrigin:string;
 fetchImpl:(url:string,options:unknown)=>unknown|Promise<unknown>;
}>;
export declare function createF1AuthorizedHistoryRecoveryOptions(options?:{
 origin?:string;pinnedOrigin?:string;ownerApproved?:boolean;
 persistedRuntimeVerified?:boolean;historyContractVerified?:boolean;
 statusContractVerified?:boolean;passengerRlsVerified?:boolean;
 fetchImpl?:(url:string,options:unknown)=>unknown|Promise<unknown>;
}):Readonly<{
 historyGatewayOptions:RecoveryGatewayOptions;
 statusGatewayOptions:RecoveryGatewayOptions;
 readOnly:true;qaOnly:true;productionEnabled:false;
}>|null;

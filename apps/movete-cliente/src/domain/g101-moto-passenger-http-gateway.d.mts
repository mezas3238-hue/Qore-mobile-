export type G101MotoPrivateScope={ownerId:string;sessionRevision:number;
 [key:string]:unknown};
export type G101Session={subject:string;role:'passenger';token:string;
 authRevision:number;sessionRevision:number;expiresAt:number};
export type G101MotoHttpResult={ok:boolean;status?:number;code?:string;data?:unknown};
export type G101MotoFlowOptions=Readonly<{
 enabled:true;contractCertified:true;externalRuntimeVerified:true;
 motoLegalVerified:true;motoRouteVerified:true;
 quoteGateway:(s:G101MotoPrivateScope)=>Promise<G101MotoHttpResult>;
 bookGateway:(s:G101MotoPrivateScope)=>Promise<G101MotoHttpResult>;
 bookingReadGateway:(s:G101MotoPrivateScope)=>Promise<G101MotoHttpResult>;
 cancelGateway:(s:G101MotoPrivateScope)=>Promise<G101MotoHttpResult>;
 cancelReadGateway:(s:G101MotoPrivateScope)=>Promise<G101MotoHttpResult>;
}>;
export declare function createG101MotoPassengerHttpGateway(options?:{
 enabled?:boolean;contractCertified?:boolean;externalRuntimeVerified?:boolean;
 motoLegalVerified?:boolean;motoRouteVerified?:boolean;
 passengerRlsVerified?:boolean;idempotencyVerified?:boolean;
 origin?:string;pinnedOrigin?:string;
 getSession?:()=>G101Session|null;
 fetchImpl?:(url:string,request:unknown)=>Promise<unknown>;
 onSessionInvalid?:()=>void;now?:()=>number;
 timeoutMs?:number;maxBytes?:number
}):Readonly<{isConfigured:()=>boolean;flowOptions:()=>G101MotoFlowOptions|null;
 cancelPending:()=>void;productionEnabled:false}>;

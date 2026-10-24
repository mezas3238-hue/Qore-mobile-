export type G68SenderScope=Readonly<{
 deliveryId:string;ownerId:string;sessionRevision:number;bearer:string
}>;
export type G68PassengerSession=Readonly<{
 subject:string;role:'passenger';token:string;expiresAt:number;
 authRevision:number;sessionRevision:number
}>;
export declare function createSenderCustodyHttpGateway(options?:{
 enabled?:boolean;contractCertified?:boolean;stagingRuntimeVerified?:boolean;
 g68SenderContractCertified?:boolean;
 origin?:string;pinnedOrigin?:string;
 getSession?:()=>unknown|Promise<unknown>;
 fetchImpl?:(url:string,request:unknown)=>unknown|Promise<unknown>;
 onSessionInvalid?:()=>void;now?:()=>number;timeoutMs?:number;maxBytes?:number;
}):Readonly<{
 isConfigured:()=>boolean;
 readOwnDelivery:(scope:G68SenderScope)=>Promise<Readonly<{
  ok:boolean;status?:number;code?:string;data?:unknown;qaOnly?:true;
  productionEnabled?:false
 }>>;
 productionEnabled:false;endpointKind:'SENDER_ONLY';
}>;

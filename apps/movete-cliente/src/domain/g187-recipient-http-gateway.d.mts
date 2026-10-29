export type G187NativeScope=Readonly<{
 deliveryId:string;expectedSubject:string;expectedPrivateViewRevision:number;
 requestKey?:string;recipientId?:string;
}>;
export type G187NativeSession=Readonly<{
 role:'passenger';subject:string;token:string;expiresAt:number;
 privateViewRevision:number;
}>;
export type G187NativeResult=Readonly<{
 ok:boolean;code?:string;retrySafe?:false;status:number;
 data?:Readonly<Record<string,any>>;qaOnly?:true;productionEnabled?:false;
}>;
export declare function createG187ClientHttpGateway(options?:{
 enabled?:boolean;ownerApproved?:boolean;contractVerified?:boolean;
 externalRuntimeVerified?:boolean;independentIdpVerified?:boolean;
 originalSqlVerified?:boolean;origin?:string;pinnedOrigin?:string;
 getSession?:()=>G187NativeSession|null|Promise<G187NativeSession|null>;
 fetchImpl?:(url:string,init:unknown)=>Promise<unknown>;
 now?:()=>number;timeoutMs?:number;maxBytes?:number;
}):Readonly<{
 isConfigured:()=>boolean;
 bindRecipient:(scope:G187NativeScope)=>Promise<G187NativeResult>;
 confirmReceived:(scope:G187NativeScope)=>Promise<G187NativeResult>;
 readSenderStatus:(scope:G187NativeScope)=>Promise<G187NativeResult>;
 cancelPending:()=>void;
 productionEnabled:false;commercialEnabled:false;
}>;

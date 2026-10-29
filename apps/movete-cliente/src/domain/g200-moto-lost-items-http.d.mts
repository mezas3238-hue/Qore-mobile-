export type G200Response={ok:boolean;code?:string;retrySafe?:false;
 data?:{caseId:string;tripId:string;state:string;canSend?:boolean;
 expiresAtMs:number;messages?:Array<{messageId:string;senderRole:'passenger'|'driver';body:string;createdAtMs:number}>};
 qaOnly?:true;productionEnabled?:false};
export type G200Scope={tripId:string;expectedSubject:string;
 expectedPrivateViewRevision:number;caseId?:string;requestKey?:string;body?:string};
export declare function createG200PassengerMotoLostItemsHttp(options?:{
 enabled?:boolean;ownerApproved?:boolean;providerVerified?:boolean;
 g200PostgresVerified?:boolean;origin?:string;pinnedOrigin?:string;
 getSession?:()=>unknown|Promise<unknown>;
 request?:(url:string,options:unknown)=>Promise<unknown>;
 now?:()=>number;timeoutMs?:number;
}):Readonly<{
 isConfigured:()=>boolean;
 open:(scope:G200Scope)=>Promise<G200Response>;
 read:(scope:G200Scope)=>Promise<G200Response>;
 send:(scope:G200Scope)=>Promise<G200Response>;
 productionEnabled:false;
}>;

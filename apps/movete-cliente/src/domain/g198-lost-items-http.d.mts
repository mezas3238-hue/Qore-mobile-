export type G198Response={ok:boolean;code?:string;retrySafe?:false;
 data?:{caseId:string;tripId:string;state:string;canSend?:boolean;
 expiresAtMs:number;messages?:Array<{messageId:string;senderRole:'passenger'|'driver';body:string;createdAtMs:number}>};
 qaOnly?:true;productionEnabled?:false};
export type G198Scope={tripId:string;expectedSubject:string;
 expectedPrivateViewRevision:number;caseId?:string;requestKey?:string;body?:string};
export declare function createG198PassengerLostItemsHttp(options?:{
 enabled?:boolean;ownerApproved?:boolean;providerVerified?:boolean;
 g198PostgresVerified?:boolean;origin?:string;pinnedOrigin?:string;
 getSession?:()=>unknown|Promise<unknown>;
 request?:(url:string,options:unknown)=>Promise<unknown>;
 now?:()=>number;timeoutMs?:number;
}):Readonly<{
 isConfigured:()=>boolean;
 open:(scope:G198Scope)=>Promise<G198Response>;
 read:(scope:G198Scope)=>Promise<G198Response>;
 send:(scope:G198Scope)=>Promise<G198Response>;
 productionEnabled:false;
}>;

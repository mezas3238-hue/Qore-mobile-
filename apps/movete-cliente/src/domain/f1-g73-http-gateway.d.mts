export type F1G73Session={
 role:'passenger';subject:string;token:string;expiresAt:number;
 authRevision:number;sessionRevision:number};
export type F1G73Scope={
 ownerId:string;sessionRevision:number;service?:'economico'|'confort'|'xl';
 routeId?:string;quoteId?:string;quoteRequestKey?:string;
 origin?:string;destination?:string;fareVersion?:string;requestKey?:string;tripId?:string};
export type F1G73Response={ok:boolean;code?:string;status:number;
 data?:unknown;qaOnly?:true;productionEnabled?:false};
export type F1G73Gateway={
 isConfigured():boolean;cancelPending():void;
 resolveRoute(scope:F1G73Scope):Promise<F1G73Response>;
 readQuote(scope:F1G73Scope):Promise<F1G73Response>;
 bookQuote(scope:F1G73Scope):Promise<F1G73Response>;
 reconcile(scope:F1G73Scope):Promise<F1G73Response>;
 readDispatch(scope:F1G73Scope):Promise<F1G73Response>;
 productionEnabled:false};
export declare function createF1G73HttpGateway(options?:{
 enabled?:boolean;contractCertified?:boolean;stagingRuntimeVerified?:boolean;
 routeProviderCertified?:boolean;
 origin?:string;pinnedOrigin?:string;
 getSession?:()=>Promise<F1G73Session|null>|F1G73Session|null;
 fetchImpl?:(url:string,init:unknown)=>Promise<unknown>|unknown;
 onSessionInvalid?:()=>void;now?:()=>number;timeoutMs?:number;maxBytes?:number
}):F1G73Gateway;

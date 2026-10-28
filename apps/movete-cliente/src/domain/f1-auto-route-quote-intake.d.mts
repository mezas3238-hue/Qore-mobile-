export type F1RouteIntent={origin:string;destination:string;
 service:'economico'|'confort'|'xl';ownerId:string;quoteRequestKey:string;
 sessionRevision:number};
export type F1VerifiedRouteReceipt={routeId:string;ownerId:string;
 quoteRequestKey:string;origin:string;destination:string;
 service:'economico'|'confort'|'xl';routingVerified:true;
 coverageVerified:true;expiresAt:number;source:'SERVER_VERIFIED_ROUTE';
 status:'ROUTE_VERIFIED_QA'};
export type F1RouteIntakeResult={ok:boolean;code?:string;
 qaOnly?:true;productionEnabled?:false;routeId?:string;
 quote?:{quoteId:string;amountGs:number;currency:'PYG';
 fareVersion:string;expiresAt:number}};
export type F1PrequoteCoordinator={
 isQuoteConfigured():boolean;prepare(args:{
  routeId:string;service:'economico'|'confort'|'xl';
  quoteRequestKey:string;ownerId:string;sessionRevision:number
 }):{ok:boolean};load():Promise<F1RouteIntakeResult>;
 snapshot():{phase:string};clear():void};
export type F1RouteIntake={
 isConfigured():boolean;
 snapshot():{available:boolean;busy:boolean;productionEnabled:false};
 request(scope:F1RouteIntent):Promise<F1RouteIntakeResult>;
 clear():void;productionEnabled:false};
export declare function createF1AutoRouteQuoteIntake(options?:{
 enabled?:boolean;routeContractCertified?:boolean;stagingRuntimeVerified?:boolean;
 routeGateway?:(scope:F1RouteIntent)=>Promise<unknown>|unknown;
 quoteFlow?:F1PrequoteCoordinator|null;
 getActor?:()=>Promise<unknown>|unknown;now?:()=>number
}):F1RouteIntake;

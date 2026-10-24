export type PassengerBookingQaReply=Readonly<{
 ok:true;status:201;qaOnly:true;commercialEnabled:false;
 bookingConfirmedForProduction:false;
 data:Readonly<{mode:'STAGING_DEMO_ONLY';commercialEnabled:false;
  ownerId:string;requestKey:string;operation:'rideRequest'|'deliveryRequest';
  serviceId:string;revision:number;serverPersisted:true;
  status:'ACCEPTED_QA'}>;
}>|Readonly<{ok:false;code:string;status?:number}>;
export declare function createPassengerBookingStagingGateway(options?:{
 enabled?:boolean;contractCertified?:boolean;stagingRuntimeVerified?:boolean;
 qaReceiptContractCertified?:boolean;
 origin?:string;pinnedOrigin?:string;
 getSession?:()=>unknown|Promise<unknown>;
 fetchImpl?:(url:string,request:unknown)=>unknown|Promise<unknown>;
 onSessionInvalid?:()=>void;now?:()=>number;timeoutMs?:number;maxBytes?:number;
}):Readonly<{isConfigured:()=>boolean;productionEnabled:false;
 send:(operation:string,args?:{body?:unknown;expectedSessionRevision?:number|null})=>
  Promise<PassengerBookingQaReply>}>;

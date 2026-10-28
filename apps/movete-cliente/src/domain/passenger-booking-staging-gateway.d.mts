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
 reconciliationContractCertified?:boolean;
 reconciliationRead?:(scope:Readonly<{operation:string;requestKey:string;
  expectedSubject:string;expectedSessionRevision:number;bearer:string}>)=>unknown|Promise<unknown>;
 origin?:string;pinnedOrigin?:string;
 getSession?:()=>unknown|Promise<unknown>;
 fetchImpl?:(url:string,request:unknown)=>unknown|Promise<unknown>;
 onSessionInvalid?:()=>void;now?:()=>number;timeoutMs?:number;maxBytes?:number;
}):Readonly<{isConfigured:()=>boolean;reconciliationConfigured:()=>boolean;
 productionEnabled:false;bookingReconciliationRequired:true;
 send:(operation:string,args?:{body?:unknown;expectedSessionRevision?:number|null;
  expectedSubject?:string|null})=>
  Promise<PassengerBookingQaReply>;
 reconcile:(operation:string,args?:{requestKey?:string;
  expectedSessionRevision?:number|null;expectedSubject?:string|null})=>Promise<Readonly<{
  ok:true;status:200;qaOnly:true;commercialEnabled:false;
  bookingConfirmedForProduction:false;recoveredWithoutPost:true;
  data:unknown}>|Readonly<{ok:false;code:string}>>}>;

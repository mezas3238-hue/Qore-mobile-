export type SenderCustodySnapshot=Readonly<{
 readReady:boolean;loading:boolean;deliveryId:string|null;
 revision:number;state:string|null;vehicleKind:string|null;
 proofVerified:boolean;error:string|null;qaOnly:true;
 productionEnabled:false;
}>;
export declare function createSenderCustodyFlow(options?:{
 enabled?:boolean;contractCertified?:boolean;
 stagingRuntimeVerified?:boolean;
 readOwnDelivery?:(scope:Readonly<{deliveryId:string;ownerId:string;
  sessionRevision:number;bearer:string}>)=>Promise<unknown>|unknown;
 getSession?:()=>unknown|Promise<unknown>;
 now?:()=>number;
}):Readonly<{
 isConfigured:()=>boolean;snapshot:()=>SenderCustodySnapshot;
 refresh:(deliveryId:string,expectedSubject:string,
  expectedSessionRevision:number)=>Promise<Readonly<{ok:boolean;
   code?:string;qaOnly?:true;productionEnabled?:false}>>;
 clear:()=>void;
}>;

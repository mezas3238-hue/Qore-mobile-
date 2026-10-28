export type PrivateCustodyNavOutcome=Readonly<{ok:boolean;code?:string;
 deliveryId?:string;status?:string;revision?:number;qaOnly?:true;
 productionEnabled?:false}>;
export declare function verifyAcceptedPrivateDeliveryCustody(args?:{
 deliveryId?:string;
 readCustody?:(id:string)=>unknown|Promise<unknown>;
}):Promise<PrivateCustodyNavOutcome>;

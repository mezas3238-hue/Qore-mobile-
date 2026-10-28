export type DriverPrivateDeliveryDetail=Readonly<{
 offerId:string;deliveryId:string;vehicleKind:'MOTO'|'AUTO';
 category:string;grams:number;
 dimensionsCm:Readonly<{length:number;width:number;height:number}>;
 expiresAtMs:number;qaOnly:true;productionEnabled:false;
}>;
export declare function readDriverPrivateDeliveryDetail(args:{
 apiOrigin:string;approvedStagingHost?:string|null;allowedByOwner?:boolean;
 accessToken:string;offerId:string;
 request?:(url:string,opts:RequestInit)=>Promise<unknown>;now?:()=>number;
}):Promise<DriverPrivateDeliveryDetail>;

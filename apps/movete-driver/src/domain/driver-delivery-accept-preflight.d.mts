import type {DriverPrivateDeliveryDetail} from './driver-private-delivery-detail.mjs';
export type DeliveryAcceptOffer=Readonly<{kind:'AUTO_RIDE'|'DELIVERY';offerId:string;
 serviceId:string;expiresAtMs:number}>;
export declare function verifyFreshDeliveryAccept(args?:{
 offer?:DeliveryAcceptOffer|null;preview?:DriverPrivateDeliveryDetail|null;
 getSession?:()=>unknown|Promise<unknown>;
 readDetail?:(args:{accessToken:string;offerId:string})=>
  DriverPrivateDeliveryDetail|Promise<DriverPrivateDeliveryDetail>;
 getWorkspace?:()=>unknown;now?:()=>number;
}):Promise<Readonly<{ok:boolean;code:string}>>;

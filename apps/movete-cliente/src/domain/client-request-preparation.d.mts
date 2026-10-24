export type RidePreparation={ok:true;body:Readonly<{
 requestKey:string;originTag:string;destinationTag:string;service:string}>;
 review:Readonly<{pickup:string;destination:string;service:string}>;
 sent:false;driverAssigned:false;serverPriced:false}|
 {ok:false;reason:string};
export type DeliveryPreparation={ok:true;body:Readonly<{
 requestKey:string;vehicleKind:string;category:string;grams:number;
 lengthCm:number;widthCm:number;heightCm:number;pickupTag:string;deliveryTag:string;
 restrictedItemDeclared:false}>;
 review:Readonly<{pickup:string;destination:string;vehicleKind:string;category:string;
 grams:number;lengthCm:number;widthCm:number;heightCm:number}>;
 sent:false;courierAssigned:false;serverPriced:false}|
 {ok:false;reason:string};
export declare function prepareLocalRideRequest(
 values?:{pickup:string;destination:string;service:string},
 secureUUID?:()=>string):RidePreparation;
export declare function prepareLocalDeliveryRequest(
 values?:{pickup:string;destination:string;vehicleKind:string;category:string;
 weight:string;length:string;width:string;height:string;restricted:boolean},
 secureUUID?:()=>string):DeliveryPreparation;

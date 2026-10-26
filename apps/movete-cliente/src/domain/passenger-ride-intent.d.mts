export type PassengerVehicleKind='AUTO'|'MOTO';
export type PassengerRideRoute=Readonly<{
 ownerRevision:number;kind:PassengerVehicleKind;
 origin:string;destination:string;createdAt:number;
}>;
export type PassengerRideIntent=Readonly<{
 save(input:{ownerRevision:number;kind:PassengerVehicleKind;
   origin:string;destination:string}):
   Readonly<{ok:true}>|Readonly<{ok:false;reason:string}>;
 read(ownerRevision:number,kind:PassengerVehicleKind):PassengerRideRoute|null;
 clear():void;
}>;
export function createPassengerRideIntent(options?:{now?:()=>number}):PassengerRideIntent;

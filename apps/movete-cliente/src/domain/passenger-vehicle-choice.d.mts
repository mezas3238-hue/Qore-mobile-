export type PassengerVehicleKind='AUTO'|'MOTO';
export const PASSENGER_VEHICLE_KINDS:readonly PassengerVehicleKind[];
export type PassengerChoice=
 |Readonly<{ok:false;reason:'VEHICLE_SELECTION_REQUIRED'}>
 |Readonly<{ok:true;kind:PassengerVehicleKind;route:'/viaje'|'/moto';
    label:string;commissionBps:1500|1200;customerSubsidyBps:1000;
    platformRetainsBps:500|200;serviceKind:'AUTO_RIDE'|'MOTO_RIDE'}>;
export function selectPassengerVehicle(kind:unknown):PassengerChoice;

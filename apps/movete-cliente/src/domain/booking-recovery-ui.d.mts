export type BookingRecoveryUiResult=Readonly<{ok:false;code:string;
 visible:false;canRead:false}>|Readonly<{
 ok:true;visible:true;canRead:boolean;
 phase:'failed'|'in_flight'|'acknowledged';
 message:string;actionLabel:string;productionEnabled:false;
 postReplayAllowed:false
}>;
export declare function projectBookingRecoveryUi(displayed:unknown,
 current:unknown,options?:{operation?:'rideRequest'|'deliveryRequest'|string}):
 BookingRecoveryUiResult;

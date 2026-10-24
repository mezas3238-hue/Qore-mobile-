export type TrackingCancelUiResult=Readonly<{ok:true;
 scope:'CURRENT_AUTHORIZED_RIDE_UI_ONLY';tripId:string;
 cancellationSent:false;refundConfirmed:false;driverAssignedByUi:false}>|
 Readonly<{ok:false;code:string}>;
export declare function guardTrackingCancellationUiAction(
 displayed:unknown,current:unknown,options?:{
  action?:'prepare'|'submit'|'retry'|string
}):TrackingCancelUiResult;

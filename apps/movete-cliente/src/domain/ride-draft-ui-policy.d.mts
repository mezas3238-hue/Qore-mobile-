export type RideDraftUiResult=Readonly<{ok:false;code:string}>|
 Readonly<{ok:true;editable:boolean;canReview:boolean;canPrepare:boolean;
  canDiscard:boolean;status:string;draftOnly:true;requestSent:false;
  driverAssigned:false;fareVerified:false;paymentCaptured:false}>;
export declare function projectRideDraftUi(options?:{
 phase?:string;operation?:string|null;authenticated?:boolean;
 validated?:boolean;stopsCount?:number;service?:string;
}):RideDraftUiResult;

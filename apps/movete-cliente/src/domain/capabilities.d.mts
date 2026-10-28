export declare const AUDIENCE:'CLIENT';
export declare const LIVE_OPERATIONS_ENABLED:false;
export declare const CAPABILITIES:readonly string[];
export declare function canUseClientCapability(action:unknown):boolean;
export declare function validateRideDraft(value:unknown):
 |{ok:false;reason:string}
 |{ok:true;pickup:string;destination:string;vehicleKind:'AUTO'};
export declare function validateDeliveryDraft(value:unknown):
 |{ok:false;reason:string}
 |{ok:true;pickup:string;destination:string;vehicleKind:'AUTO'|'MOTO';grams:number};

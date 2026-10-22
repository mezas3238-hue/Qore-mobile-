export declare const AUDIENCE:'DRIVER';
export declare const LIVE_OPERATIONS_ENABLED:false;
export declare const CAPABILITIES:readonly string[];
export declare function canUseDriverCapability(action:unknown):boolean;
export declare function validateDriverDraft(value:unknown):
 |{ok:false;reason:string}
 |{ok:true;fullName:string;plate:string;vehicleKind:'AUTO'|'MOTO'};

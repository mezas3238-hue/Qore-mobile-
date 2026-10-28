export declare const SUPPORT_TYPES:readonly {readonly code:'SAFETY'|'RIDE'|'DELIVERY'|'PAYMENT'|'OTHER';readonly label:string;}[];
export declare function validateSupportDraft(value:unknown):
 |{ok:false;reason:string}
 |{ok:true;localOnly:true;submitted:false;category:string;serviceId:string;description:string};

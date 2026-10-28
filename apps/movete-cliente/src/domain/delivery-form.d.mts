export declare const DELIVERY_CATEGORIES: readonly {
 readonly code:'DOCUMENTS'|'PARCEL'|'GROCERIES'|'RESTAURANT'|'PHARMACY_OTC';
 readonly label:string;
}[];
export declare function validateDeliveryForm(value:unknown):
 |{ok:false;reason:string}
 |{ok:true;pickup:string;destination:string;vehicleKind:'AUTO'|'MOTO';grams:number;
 category:string;lengthCm:number;widthCm:number;heightCm:number;restrictedItemDeclared:false};

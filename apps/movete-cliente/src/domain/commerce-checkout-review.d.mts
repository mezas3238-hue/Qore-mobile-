export interface CommerceBasketItem {
 readonly itemId:string;readonly itemTag:string|null;readonly quantity:number;
 readonly unitPricePyg:number|null;readonly lineSubtotalPyg:number|null;
}
export interface CommerceCatalogItem {
 readonly itemId:string;readonly itemTag:string;
 readonly itemClass:'GENERAL'|'PHARMACY_OTC';readonly active:boolean;
 readonly unitPricePyg:number;readonly stockUnits:number;
}
export interface CommerceReviewInput {
 readonly catalogReadReady:boolean;readonly checkoutEnabled:false;
 readonly paymentEnabled:false;readonly serverOrderReceipt:null;
 readonly stage:string;readonly stock:string;
 readonly catalogExpiresAt:number|null;readonly branchId:string|null;
 readonly catalogVersion:string|null;readonly vehicleKind:'AUTO'|'MOTO';
 readonly items:readonly CommerceBasketItem[];
 readonly catalogItems:readonly CommerceCatalogItem[];
 readonly estimatedSubtotalPyg:number|null;readonly finalTotalPyg:null;
}
export interface CommerceReviewLine {
 readonly itemId:string;readonly itemTag:string;
 readonly itemClass:'GENERAL'|'PHARMACY_OTC';readonly quantity:number;
 readonly unitPricePyg:number;readonly lineSubtotalPyg:number;
}
export type CommerceReviewResult=
 |Readonly<{ok:false;code:string;checkoutEnabled:false;
   paymentEnabled:false;orderConfirmed:false}>
 |Readonly<{ok:true;scope:'CURRENT_AUTHORIZED_CATALOG_ONLY';
   branchId:string;catalogVersion:string;expiresAt:number;
   vehicleKind:'AUTO'|'MOTO';lines:readonly CommerceReviewLine[];
   estimatedSubtotalPyg:number;deliveryFeePyg:null;discountPyg:null;
   finalTotalPyg:null;checkoutEnabled:false;paymentEnabled:false;
   orderConfirmed:false;stockReserved:false;deliveryAvailable:false}>;
export declare function reviewCommerceBasket(input:CommerceReviewInput,
 options?:{authenticated?:boolean;now?:number}):CommerceReviewResult;

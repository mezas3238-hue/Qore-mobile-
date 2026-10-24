export type CommerceVertical='SUPERMARKET'|'PHARMACY'|'RESTAURANT'|'RETAIL'|'OTHER';
export type CommerceVerticalOption=Readonly<{code:CommerceVertical;label:string;description:string}>;
export interface CatalogItemForStorefront {itemTag:string;active:boolean;stockUnits:number;unitPricePyg:number}
export interface BranchForStorefront {merchantKind:string;branchId:string;branchTag:string;eligibleByPolicy:false;orderEnabled:false}
export type StorefrontFailure=Readonly<{ok:false;code:string;items:readonly never[]}>;
export type StorefrontResult<T>=Readonly<{ok:true;items:readonly T[];scope:'CURRENT_VERIFIED_PAGE_ONLY';globalTotalKnown:false;checkoutEnabled?:false;ordersEnabled?:false}>|StorefrontFailure;
export declare const COMMERCE_VERTICALS:readonly CommerceVerticalOption[];
export declare function validateCommerceSearch(raw:string):Readonly<{ok:true;query:string;normalized:string}>|Readonly<{ok:false;code:string}>;
export declare function selectCommerceVertical(code:string):CommerceVerticalOption|null;
export declare function filterVerifiedCatalogPage<T extends CatalogItemForStorefront>(items:readonly T[],options?:{query?:string;verified?:boolean}):StorefrontResult<T>;
export declare function filterVerifiedBranchPage<T extends BranchForStorefront>(items:readonly T[],options:{vertical:CommerceVertical;verified?:boolean}):StorefrontResult<T>;

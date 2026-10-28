export type CommerceAccessibleResult=Readonly<{ok:false;code:string}>|
 Readonly<{ok:true;description:string;addHint:string;removeHint:string;
  noOrderConfirmed:true;stockReserved:false}>;
export type CommercePageAccessibleResult=Readonly<{ok:false;code:string}>|
 Readonly<{ok:true;summary:string;scope:'CURRENT_VERIFIED_PAGE_ONLY';
  globalTotalKnown:false;availabilityVerified:false;orderConfirmed:false}>;
export declare function projectCommerceItemAccessible(item:unknown,options?:{
 verified?:boolean;quantity?:number}):CommerceAccessibleResult;
export declare function projectCommercePageAccessible(options?:{
 verified?:boolean;loading?:boolean;pageNumber?:number;
 visibleCount?:number;kind?:'CATALOG'|'BRANCHES';
}):CommercePageAccessibleResult;

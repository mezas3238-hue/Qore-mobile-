export type CommerceUiActionResult=Readonly<{
 ok:true;scope:'CURRENT_LOCAL_DRAFT_ONLY';checkoutEnabled:false;
 paymentEnabled:false;orderConfirmed:false
}>|Readonly<{ok:false;code:string}>;
export declare function guardCommerceUiAction(
 displayed:unknown,current:unknown,options?:{
  itemId?:string|null;requestedQuantity?:number|null;
  requireInBasket?:boolean;now?:number;
 }
):CommerceUiActionResult;

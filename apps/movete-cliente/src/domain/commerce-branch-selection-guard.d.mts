export type CommerceBranchSelectResult=
 |Readonly<{ok:true;branchId:string;scope:'CURRENT_VERIFIED_BRANCH_PAGE_ONLY';
   availabilityVerified:false;ordersEnabled:false;paymentsEnabled:false}>
 |Readonly<{ok:false;code:string}>;
export declare function guardCommerceBranchSelection(displayed:unknown,current:unknown,
 options?:{branchId?:string|null;vertical?:string|null;
  municipality?:string|null;serviceKind?:string|null;now?:number}
):CommerceBranchSelectResult;

export type AutoCompletedHistoryClaim=Readonly<
 {ok:true;key:string}|{ok:false;reason:string}>;
export declare function claimCompletedHistoryAutoVerification(
 view:unknown,lastKey?:string|null
):AutoCompletedHistoryClaim;

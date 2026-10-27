export type CommissionReadbackProof=Readonly<{ok:boolean;code:string}>;
export declare function certifyOwnerCommissionReadback(args?:{
 written?:unknown;readback?:unknown;previousVersion?:number;service?:string;
}):CommissionReadbackProof;

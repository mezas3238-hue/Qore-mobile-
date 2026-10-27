export type OwnerPolicyScopeFence=Readonly<{
 select:(...parts:(string|boolean|object)[])=>number;
 current:(ticket:number)=>boolean;
 invalidate:()=>void;
}>;
export declare function createOwnerPolicyScopeFence():OwnerPolicyScopeFence;

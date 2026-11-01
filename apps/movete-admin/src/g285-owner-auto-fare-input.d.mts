export type OwnerFareInputs={basePyg:string;perKmPyg:string;
 perMinutePyg:string;minimumPyg:string;commissionPercent:string};
export declare function parseG285OwnerAutoFareInput(inputs:OwnerFareInputs):
 Readonly<{basePyg:number;perKmPyg:number;perMinutePyg:number;
 minimumPyg:number;commissionBps:number}>|null;

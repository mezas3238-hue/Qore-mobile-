export type AutocompletePlan=Readonly<{query:string;delayMs:number}>;
export declare function createClientDestinationAutocompleteGate(options?:{
 now?:()=>number;debounceMs?:number;minimumGapMs?:number
}):Readonly<{
 plan:(query:unknown,opts?:{enabled?:boolean})=>AutocompletePlan|null;
 markStarted:(query:unknown)=>boolean;
 clear:()=>void;
}>;

export type PassengerCoordinate=Readonly<{latitude:number;longitude:number}>;
export type PassengerSuggestion=Readonly<PassengerCoordinate&{label:string}>;
export declare function inspectPassengerGpsFix(fix:{
 latitude:number;longitude:number;accuracyMeters:number|null;mocked?:boolean
}):{ok:true;point:PassengerCoordinate&{accuracyMeters:number};commercialVerified:false}|{ok:false;code:string};
export declare function makePassengerAddressLabel(address:unknown,fallback:string):string|null;
export declare function inspectDestinationCandidates(candidates:unknown):readonly PassengerSuggestion[];
export declare function isCurrentPassengerLocationResult(input:{
 requestEpoch:number;currentEpoch:number;privateRevision:number;activeRevision:number;appActive:boolean;
}):boolean;

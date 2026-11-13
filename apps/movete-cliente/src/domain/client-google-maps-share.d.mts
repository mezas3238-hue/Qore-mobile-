export type MapsShareResult=Readonly<{ok:true;query:string;requiresVerification:true}>|Readonly<{ok:false;code:string}>;
export declare function readGoogleMapsShare(payloads:unknown,resolvedPayloads?:unknown):MapsShareResult;
export declare function stageGoogleMapsShare(query:string,now?:number):boolean;
export type GoogleMapsGeocodedCandidate=Readonly<{
 label:string;latitude:number;longitude:number
}>;
export declare function stageGoogleMapsGeocodedCandidate(
 query:string,place:GoogleMapsGeocodedCandidate,now?:number
):boolean;
export declare function consumeGoogleMapsShare(now?:number):Readonly<{
 query:string;requiresVerification:true;place?:GoogleMapsGeocodedCandidate
}>|null;
export declare function clearGoogleMapsShare():void;

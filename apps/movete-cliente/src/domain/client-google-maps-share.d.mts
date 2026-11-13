export type MapsShareResult=Readonly<{ok:true;query:string;requiresVerification:true}>|Readonly<{ok:false;code:string}>;
export declare function readGoogleMapsShare(payloads:unknown,resolvedPayloads?:unknown):MapsShareResult;
export declare function stageGoogleMapsShare(query:string,now?:number):boolean;
export declare function consumeGoogleMapsShare(now?:number):Readonly<{query:string;requiresVerification:true}>|null;
export declare function clearGoogleMapsShare():void;

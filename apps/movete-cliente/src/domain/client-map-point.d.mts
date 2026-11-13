export type ClientMapCoordinate=Readonly<{latitude:number;longitude:number}>;
export declare function isParaguayMapCoordinate(value:unknown):value is ClientMapCoordinate;
export declare function parseMapPointMessage(value:unknown):ClientMapCoordinate|null;
export declare function sameMapCoordinate(a:unknown,b:unknown):boolean;

export type PassengerMapPreviewLinks=Readonly<{primary:string;fallback:string}>;
export declare function createPassengerMapPreviewLinks(
 point:Readonly<{latitude:number;longitude:number}>|null,
 platform?:string
):PassengerMapPreviewLinks|null;

export type GoogleMapsPoint=Readonly<{latitude:number;longitude:number}>;
export declare function createGoogleMapsLaunchUrl(
 kind:'pickup'|'destination',point?:GoogleMapsPoint|null
):string|null;

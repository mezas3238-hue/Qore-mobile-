export type GoogleMapsPoint=Readonly<{latitude:number;longitude:number}>;
export declare function createGoogleMapsLaunchUrl(
 kind:'pickup'|'destination',point?:GoogleMapsPoint|null
):string|null;
/** Google Maps road directions only; does not return route metrics to this app. */
export declare function createGoogleMapsDirectionsUrl(
 pickup:GoogleMapsPoint|null,destination:GoogleMapsPoint|null
):string|null;

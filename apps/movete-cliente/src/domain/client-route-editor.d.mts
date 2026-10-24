export interface LocalRouteDraft {
 readonly origin:string;
 readonly destination:string;
 readonly stops:readonly string[];
 readonly revision:number;
}
export interface ReviewedLocalRoute extends LocalRouteDraft {}
export type LocalRouteEdit =
 |{type:'origin'|'destination';value:string}
 |{type:'swap'|'add-stop'}
 |{type:'stop';index:number;value:string}
 |{type:'remove-stop';index:number}
 |{type:'move-stop';index:number;direction:1|-1};
export type RouteFailure={readonly ok:false;readonly code:string;readonly reason:string};
export type RouteEditResult={readonly ok:true;readonly route:LocalRouteDraft}|RouteFailure;
export type RouteReviewResult=({readonly ok:true;readonly route:ReviewedLocalRoute;readonly serverPrepared:false;readonly quoted:false;readonly geocoded:false})|RouteFailure;
export type RoutePrepareResult=({readonly ok:true;readonly route:ReviewedLocalRoute})|RouteFailure;
export declare const MAX_LOCAL_STOPS:number;
export declare function emptyLocalRouteDraft():LocalRouteDraft;
export declare function editLocalRouteDraft(current:LocalRouteDraft,change:LocalRouteEdit):RouteEditResult;
export declare function reviewLocalRouteDraft(draft:LocalRouteDraft):RouteReviewResult;
export declare function canPrepareCurrentRideContract(draft:LocalRouteDraft):RoutePrepareResult;

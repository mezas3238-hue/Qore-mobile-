export type IncidentPageFilter='ALL'|'ACTIVE'|'CRITICAL_ACTIVE';
export type IncidentPageOrder='PRIORITY'|'RECENT';
export type IncidentPageResult=Readonly<{
 scope:'VISIBLE_PAGE_ONLY';
 counts:Readonly<{all:number;active:number;criticalActive:number}>;
 filter:IncidentPageFilter;
 order:IncidentPageOrder;
 items:ReadonlyArray<Readonly<{
 incidentId:string;category:string;severity:string;status:string;createdAt:number;revision:number;
 }>>;
 noGlobalTotal:true;
 operationsAllowed:false;
 sosEnabled:false;
}>;
export declare function projectIncidentPageTriage(
 snapshot:unknown, options?:{
 filter?:IncidentPageFilter;order?:IncidentPageOrder;now?:number;
 }
):IncidentPageResult|null;

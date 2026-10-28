import type {MerchantCaseActor,MerchantCasePageDto,MerchantCasePageSuccess} from './merchant-case-page.mjs';
export type MerchantCaseQueryState=Readonly<{
 page:MerchantCasePageSuccess;pageNumber:number;hasPrevious:boolean;
 hasNext:boolean;totalKnown:false;loading:false
}>;
export type MerchantCaseQueryResult=Readonly<{ok:true;pageNumber:number}>|
 Readonly<{ok:false;code:string}>;
export declare function createMerchantCaseQueryFlow(options?:{
 readPage?:((args:Readonly<{cursor:string|null;direction:'refresh'|'next'|'previous'}>)=>
  MerchantCasePageDto|Promise<MerchantCasePageDto>)|null;
 getActor?:()=>MerchantCaseActor|null;
 isCertified?:()=>boolean;
 now?:()=>number;
}):Readonly<{
 load:(direction?:'refresh'|'next'|'previous')=>Promise<MerchantCaseQueryResult>;
 snapshot:()=>MerchantCaseQueryState|null;
 clear:()=>void;
}>;

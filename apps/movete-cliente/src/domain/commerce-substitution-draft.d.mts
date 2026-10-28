import type {CommerceReviewInput} from './commerce-checkout-review.mjs';
export type SubstitutionChoice='OMIT_IF_UNAVAILABLE'|'ASK_BEFORE_SUBSTITUTING';
export type SubstitutionActor={authenticated:boolean;subject:string|null;sessionRevision:number};
export type SubstitutionLine=Readonly<{itemId:string;itemTag:string;choice:SubstitutionChoice|null}>;
export type SubstitutionResult=Readonly<{
 ok:boolean;code?:string;choices:readonly SubstitutionLine[];
 submitted:false;orderConfirmed:false;contactSent:false;
 stockReserved?:false;preferencesSavedOnServer?:false;
}>;
export interface CommerceSubstitutionDraft {
 snapshot(commerce:CommerceReviewInput,actor:SubstitutionActor):SubstitutionResult;
 choose(commerce:CommerceReviewInput,actor:SubstitutionActor,
  update:{itemId:string;choice:SubstitutionChoice|null}):SubstitutionResult;
 clear():void;
}
export declare function createCommerceSubstitutionDraft(options?:{
 now?:()=>number
}):CommerceSubstitutionDraft;

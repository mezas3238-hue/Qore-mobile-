export declare function createSupportRequestFence():Readonly<{
 current:()=>number;
 begin:()=>number;
 invalidate:()=>number;
 isCurrent:(value:unknown)=>boolean;
}>;

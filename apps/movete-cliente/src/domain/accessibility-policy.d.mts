export declare const ACTION_MIN_HEIGHT:48;
export declare const MIN_BODY_FONT_SIZE:14;
export declare const A11Y_COLORS:Readonly<{
 primary:string;white:string;secondary:string;disabled:string;disabledInk:string;
}>;
export declare function relativeLuminance(hex:string):number|null;
export declare function contrastRatio(first:string,second:string):number|null;
export declare function meetsTextContrast(foreground:string,background:string):boolean;

/** Reglas medibles compartidas por la UI Cliente. */
export const ACTION_MIN_HEIGHT=48;
export const MIN_BODY_FONT_SIZE=14;
export const A11Y_COLORS=Object.freeze({
 primary:'#1470A6',white:'#FFFFFF',secondary:'#E5F2F9',
 disabled:'#DCE5EC',disabledInk:'#334A5E'
});
function channel(hex,index){
 const raw=Number.parseInt(hex.slice(index,index+2),16)/255;
 return raw<=0.03928?raw/12.92:((raw+0.055)/1.055)**2.4;
}
export function relativeLuminance(hex){
 if(typeof hex!=='string'||!/^#[0-9A-F]{6}$/i.test(hex))return null;
 return 0.2126*channel(hex,1)+0.7152*channel(hex,3)+0.0722*channel(hex,5);
}
export function contrastRatio(first,second){
 const a=relativeLuminance(first),b=relativeLuminance(second);
 if(a===null||b===null)return null;
 return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
}
export function meetsTextContrast(foreground,background){
 const ratio=contrastRatio(foreground,background);
 return ratio!==null&&ratio>=4.5;
}

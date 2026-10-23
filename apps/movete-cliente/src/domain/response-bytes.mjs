/**
 * Conteo UTF-8 sin globals DOM/Node: válido en Hermes (React Native),
 * navegadores y Node. No transforma ni registra el cuerpo HTTP.
 */
export function utf8ByteLength(value){
 if(typeof value!=='string')return null;
 let total=0;
 for(let i=0;i<value.length;i++){
  const c=value.charCodeAt(i);
  if(c<=0x7f)total++;
  else if(c<=0x7ff)total+=2;
  else if(c>=0xd800&&c<=0xdbff){
   const next=i+1<value.length?value.charCodeAt(i+1):0;
   if(next>=0xdc00&&next<=0xdfff){total+=4;i++;}
   else total+=3;
  }else total+=3;
 }
 return total;
}

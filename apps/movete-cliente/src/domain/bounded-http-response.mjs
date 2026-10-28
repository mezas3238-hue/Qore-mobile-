/** Lee cuerpos HTTP sin acumular más bytes que el presupuesto.
 * Usa ReadableStream donde exista; los mocks/implementaciones sin stream
 * recurren a text() y comprueban tamaño una vez recibido el texto.
 * No guarda contenido, credenciales ni PII en errores.
 */
const error=code=>Object.freeze({ok:false,code});
import {utf8ByteLength} from './response-bytes.mjs';
function decodeUtf8(bytes){
 const out=[];
 for(let i=0;i<bytes.length;){
  const a=bytes[i++];let point,length;
  if(a<0x80){point=a;length=0;}
  else if(a>=0xc2&&a<=0xdf){point=a&31;length=1;}
  else if(a>=0xe0&&a<=0xef){point=a&15;length=2;}
  else if(a>=0xf0&&a<=0xf4){point=a&7;length=3;}
  else return null;
  if(i+length>bytes.length)return null;
  for(let j=0;j<length;j++){
   const b=bytes[i++];if((b&0xc0)!==0x80)return null;
   point=(point<<6)|(b&0x3f);
  }
  if((length===1&&point<0x80)||(length===2&&(point<0x800
    ||(point>=0xd800&&point<=0xdfff)))||
   (length===3&&(point<0x10000||point>0x10ffff)))return null;
  out.push(String.fromCodePoint(point));
 }
 return out.join('');
}
async function abortableRead(reader,signal){
 if(signal?.aborted)throw Error('aborted');
 if(!signal||typeof signal.addEventListener!=='function')return reader.read();
 let onAbort;
 const cancelled=new Promise((_,reject)=>{
  onAbort=()=>reject(Error('aborted'));
  signal.addEventListener('abort',onAbort,{once:true});
 });
 try{return await Promise.race([reader.read(),cancelled]);}
 finally{signal.removeEventListener('abort',onAbort);}
}
export async function readBoundedResponseText(response,{
 limit=262144,signal=null,timedOut=()=>false
}={}){
 if(!Number.isSafeInteger(limit)||limit<1)return error('BAD_SERVER_RESPONSE');
 if(signal?.aborted||timedOut())return error('NETWORK_OR_TIMEOUT');
 const stream=response?.body;
 if(stream&&typeof stream.getReader==='function'){
  let reader,complete=false;
  try{
   reader=stream.getReader();
   const parts=[];let total=0;
   for(;;){
    const {done,value}=await abortableRead(reader,signal);
    if(signal?.aborted||timedOut())return error('NETWORK_OR_TIMEOUT');
    if(done){complete=true;break;}
    if(!(value instanceof Uint8Array))return error('BAD_SERVER_RESPONSE');
    if(value.byteLength>limit-total)return error('RESPONSE_TOO_LARGE');
    total+=value.byteLength;
    parts.push(value);
   }
   const bytes=new Uint8Array(total);
   let offset=0;
   for(const part of parts){bytes.set(part,offset);offset+=part.byteLength;}
   const text=decodeUtf8(bytes);
   return text===null?error('BAD_SERVER_RESPONSE'):
    Object.freeze({ok:true,text});
  }catch{return error(signal?.aborted||timedOut()?'NETWORK_OR_TIMEOUT':'NETWORK_OR_TIMEOUT');}
  finally{
   if(reader){
    if(!complete)try{Promise.resolve(reader.cancel()).catch(()=>{});}catch{}
    try{reader.releaseLock?.();}catch{}
   }
  }
 }
 if(typeof response?.text!=='function')return error('BAD_SERVER_RESPONSE');
 try{
  const text=await response.text();
  if(signal?.aborted||timedOut())return error('NETWORK_OR_TIMEOUT');
  if(typeof text!=='string')return error('BAD_SERVER_RESPONSE');
  return utf8ByteLength(text)>limit?error('RESPONSE_TOO_LARGE'):
   Object.freeze({ok:true,text});
 }catch{return error('NETWORK_OR_TIMEOUT');}
}

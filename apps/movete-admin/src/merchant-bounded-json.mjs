/** Bounded merchant HTTP body read: QA inbox/fulfillment/reputation.
 * The original caller's AbortSignal is the hard end-to-end deadline.
 * Content-Length is advisory; actual bytes are checked before JSON.parse.
 */
export async function boundedMerchantJson(response,maxBytes,signal){
 if(!response||!Number.isSafeInteger(maxBytes)||maxBytes<1||
  !signal||typeof signal.addEventListener!=='function')
  throw Error('Invalid bounded merchant network authority');
 const declared=response.headers?.get?.('content-length');
 if(declared!=null&&(!/^[0-9]+$/.test(declared)||Number(declared)>maxBytes))
  throw Error('Respuesta demasiado extensa');
 async function readOrAbort(operation){
  if(signal.aborted)throw Error('Tiempo de lectura agotado');
  let listener=()=>{};
  const aborted=new Promise((_,reject)=>{
   listener=()=>reject(Error('Tiempo de lectura agotado'));
   signal.addEventListener('abort',listener,{once:true});
  });
  try{return await Promise.race([operation,aborted]);}
  finally{signal.removeEventListener('abort',listener);}
 }
 const reader=response.body?.getReader?.();
 if(!reader){
  const text=await readOrAbort(response.text());
  if(new TextEncoder().encode(text).byteLength>maxBytes)
   throw Error('Respuesta demasiado extensa');
  return JSON.parse(text);
 }
 const decoder=new TextDecoder();let result='',bytes=0,finished=false;
 try{
  while(true){
   const chunk=await readOrAbort(reader.read());
   if(chunk.done){finished=true;break;}
   if(!chunk.value||!Number.isSafeInteger(chunk.value.byteLength))
    throw Error('Respuesta mal formada');
   bytes+=chunk.value.byteLength;
   if(bytes>maxBytes)throw Error('Respuesta demasiado extensa');
   result+=decoder.decode(chunk.value,{stream:true});
  }
  result+=decoder.decode();
  return JSON.parse(result);
 }finally{
  if(!finished){
   // Unreliable cancel promises must never hang the UI.
   try{Promise.resolve(reader.cancel()).catch(()=>{});}catch{}
  }
 }
}

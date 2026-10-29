/**
 * G178 Driver AUTO lifecycle response guard. React Native and fetch bridges
 * may continue waiting in response.json() after AbortController fires.
 * Bound both network and body read, including streamed bytes BEFORE JSON.parse.
 * Never retry a command whose database COMMIT may have occurred.
 */
export async function readG178BoundedDriverLifecycleJson({
 request,url,options,timeoutMs=8000,maxBytes=4096
}={}){
 if(typeof request!=='function'||typeof url!=='string'||
 !options||typeof options!=='object')
  throw Error('G178 verified Driver HTTP authority required');
 const ms=Number.isSafeInteger(timeoutMs)&&timeoutMs>=100&&timeoutMs<=30000?
  timeoutMs:8000;
 const cap=Number.isSafeInteger(maxBytes)&&maxBytes>=512&&maxBytes<=32768?
  maxBytes:4096;
 const ctl=new AbortController();
 let timer;
 const deadline=new Promise((_,reject)=>{
  const t=setTimeout(()=>{
   ctl.abort();reject(Error('G178 Driver response deadline exceeded'));
  },ms);
  // The timer is cleared on exit via the mutable reference below.
  timer=t;
 });
 const within=p=>Promise.race([Promise.resolve(p),deadline]);
 try{
  const response=await within(request(url,{...options,signal:ctl.signal}));
  if(response?.status!==200||response.redirected===true)
   throw Error('G178 original Driver lifecycle response not confirmed');
  const media=response.headers?.get?.('content-type');
  if(media!=null&&!/^application\/json(?:\s*;|$)/i.test(media))
   throw Error('G178 invalid content-type');
  const declared=response.headers?.get?.('content-length');
  if(declared!=null&&(!/^[0-9]+$/.test(declared)||Number(declared)>cap))
   throw Error('G178 declared payload too large');
  const reader=response.body?.getReader?.();
  let data;
  if(reader){
   const decoder=new TextDecoder('utf-8',{fatal:true});
   let bytes=0,text='',ended=false;
   try{
    while(true){
     const chunk=await within(reader.read());
     if(chunk.done){ended=true;break;}
     if(!chunk.value||!Number.isSafeInteger(chunk.value.byteLength))
      throw Error('G178 untrusted body chunk');
     bytes+=chunk.value.byteLength;
     if(bytes>cap)throw Error('G178 body exceeds maximum bytes');
     text+=decoder.decode(chunk.value,{stream:true});
    }
    text+=decoder.decode();
    data=JSON.parse(text);
   }finally{
    if(!ended){
     // Some native bridges never settle reader.cancel(); never await it.
     try{Promise.resolve(reader.cancel()).catch(()=>{});}catch{}
    }
   }
  }else{
   // Old mock/native fetch bridges without ReadableStream retain deadline.
   data=await within(response.json());
  }
  const raw=JSON.stringify(data);
  if(typeof raw!=='string'||new TextEncoder().encode(raw).byteLength>cap)
   throw Error('G178 response exceeds maximum bytes');
  return data;
 }finally{
  clearTimeout(timer);
 }
}

/**
 * G168: bound BOTH Driver KYC panel GETs. The private inbox was already
 * timeboxed, but documents/license previously had unlimited fetch/json awaits
 * that could freeze Promise.all(workspace refresh) on unstable Android networks.
 * A rejecting deadline works even if a custom transport ignores AbortSignal.
 * Never retries POST, stores JWT, interprets incomplete KYC as approved,
 * connects to production or uses cross-account cached responses.
 */
export async function readBoundedDriverQaGet({
 origin,path,accessToken,request,timeoutMs=8000,maxBytes=8192
}={}){
 if(typeof origin!=='string'||typeof path!=='string'||
  !['/v1/staging/driver/documents',
    '/v1/staging/driver/license-readiness'].includes(path)||
  typeof accessToken!=='string'||typeof request!=='function')
  throw Error('Driver QA bounded GET requires private fixed endpoint');
 const ms=Number.isSafeInteger(timeoutMs)&&timeoutMs>=100&&timeoutMs<=30000
  ?timeoutMs:8000;
 const limit=Number.isSafeInteger(maxBytes)&&maxBytes>=512&&maxBytes<=32768
  ?maxBytes:8192;
 const abort=new AbortController();
 let timer;
 const deadline=new Promise((_,reject)=>{
  timer=setTimeout(()=>{
   abort.abort();reject(Error('Driver private QA GET unavailable'));
  },ms);
 });
 const within=p=>Promise.race([p,deadline]);
 try{
  const response=await within(request(origin+path,{
   method:'GET',cache:'no-store',credentials:'omit',redirect:'error',
   referrerPolicy:'no-referrer',signal:abort.signal,
   headers:{authorization:'Bearer '+accessToken,accept:'application/json'}
  }));
  if(!response||response.redirected===true)
   throw Error('Driver private QA GET unavailable');
  const status=response.status;
  if(status!==200)return Object.freeze({status,data:null});
  const type=response.headers?.get?.('content-type');
  if(type!=null&&!/^application\/json(?:\s*;|$)/i.test(type))
   throw Error('Driver private QA invalid content type');
  const length=response.headers?.get?.('content-length');
  if(length!=null&&(!/^[0-9]+$/.test(length)||Number(length)>limit))
   throw Error('Driver private QA response too large');
  const data=await within(response.json());
  const json=JSON.stringify(data);
  if(typeof json!=='string'||new TextEncoder().encode(json).byteLength>limit)
   throw Error('Driver private QA invalid or oversized JSON');
  return Object.freeze({status,data});
 }finally{clearTimeout(timer);}
}

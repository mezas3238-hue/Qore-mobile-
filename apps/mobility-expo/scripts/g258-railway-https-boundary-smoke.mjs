/**
 * G258: first external Railway HTTPS smoke. Read-only, no JWT, no accounts,
 * no commercial requests and no mutation. Process liveness != healthy G4/PG
 * != five journeys closed. Requires actual approved STAGING deployment.
 */
const HOST='qore-mobile-backend-staging-staging.up.railway.app';
const ORIGIN='https://'+HOST;
const GATEWAY='/v1/staging/driver/inbox';
const fatal=(code,more={})=>Object.freeze({
 ok:false,code,scope:'EXTERNAL_HTTPS_STAGING_ONLY',
 externallyCompletedJourneys:0,productionReady:false,...more});
const check=(response,status)=>{
 if(response?.status!==status||response.redirected===true)
  throw Error('unexpected_response');
 if(!/^application\/json(?:\s*;|$)/i.test(
  response.headers?.get?.('content-type')??''))
  throw Error('invalid_content_type');
};
async function boundedJson(response){
 const stream=response?.body;
 if(!stream||typeof stream.getReader!=='function')
  throw Error('response_stream_missing');
 const reader=stream.getReader();let bytes=0,done=false;
 const chunks=[];
 try{
  for(;;){
   const part=await reader.read();
   if(part.done){done=true;break;}
   if(!(part.value instanceof Uint8Array))
    throw Error('invalid_response_chunk');
   bytes+=part.value.byteLength;
   if(bytes>1024)throw Error('response_too_large');
   chunks.push(part.value);
  }
 }finally{if(!done)await reader.cancel().catch(()=>{});}
 const decoded=new TextDecoder('utf-8',{fatal:true}).decode(
  Buffer.concat(chunks,bytes));
 return JSON.parse(decoded);
}
export async function checkG258RailwayPublicBoundary({
 origin=ORIGIN,request=fetch,timeoutMs=7000
}={}){
 if(origin!==ORIGIN||typeof request!=='function'||
  !Number.isSafeInteger(timeoutMs)||timeoutMs<1000||timeoutMs>10000)
  return fatal('UNAUTHORIZED_STAGING_ORIGIN');
 const args={method:'GET',redirect:'error',cache:'no-store',
  credentials:'omit',signal:AbortSignal.timeout(timeoutMs),
  headers:{accept:'application/json'}};
 try{
  const live=await request(origin+'/_qore/liveness',args);
  check(live,200);
  const body=await boundedJson(live);
  if(!body||typeof body!=='object'||Array.isArray(body)||
   Object.keys(body).length!==2||
   body.state!=='PROCESS_UP_ONLY'||
   body.commercialRidesEnabled!==false)
   return fatal('LIVENESS_UNTRUSTED');
  const blocked=await request(origin+GATEWAY,args);
  check(blocked,401);
  const parsed=await boundedJson(blocked);
  if(parsed?.error!=='Verified bearer required')
   return fatal('UNAUTHENTICATED_ACCESS_NOT_DENIED');
  return Object.freeze({ok:true,code:'HTTPS_PROCESS_AND_AUTH_BOUNDARY_PASS',
   scope:'EXTERNAL_HTTPS_STAGING_ONLY',processReachable:true,
   unauthenticatedAccessDenied:true,authProviderChecked:false,
   postgresTransactionChecked:false,externallyCompletedJourneys:0,
   productionReady:false});
 }catch{return fatal('RAILWAY_UNREACHABLE_OR_UNTRUSTED');}
}
const main=process.argv[1]&&import.meta.url==='file://'+process.argv[1];
if(main){
 const result=await checkG258RailwayPublicBoundary();
 if(result.ok)console.log('G258 process reachable and unauthenticated API denied: NOT E2E');
 else{console.error('G258 BLOCKED: '+result.code);process.exitCode=1;}
}

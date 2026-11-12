import {parseSupportClaimIntent,parseSupportClaimReceipt} from './support-claim-contract.mjs';
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const ORIGIN=/^https:\/\/[a-z0-9.-]+(?::443)?$/i;
/**
 * Independent route: the only allowed response is CLAIMED. This edge
 * function never accepts a user ID, session ID, mutable status or amount
 * in its request. Server verifies Auth JWT and SQL checks assignment.
 * All routes fail closed unless explicitly configured by the integrator.
 */
export function createSupportClaimHandler({enabled=false,allowedOrigin='',
 resolveIdentity,claim}={}){
 const ready=enabled===true&&typeof allowedOrigin==='string'&&
  ORIGIN.test(allowedOrigin)&&typeof resolveIdentity==='function'&&typeof claim==='function';
 return async function handle(request){
  const origin=request?.headers?.get?.('origin')??'';
  const sameOrigin=ready&&origin===allowedOrigin;
  const headers=new Headers({
   'content-type':'application/json; charset=utf-8','cache-control':'no-store',
   'vary':'Origin','x-content-type-options':'nosniff'
  });
  if(sameOrigin){
   headers.set('access-control-allow-origin',allowedOrigin);
   headers.set('access-control-allow-methods','POST, OPTIONS');
   headers.set('access-control-allow-headers','authorization, content-type, apikey, x-client-info');
  }
  const reject=(status,code)=>new Response(JSON.stringify({ok:false,code}),{status,headers});
  if(!ready)return reject(503,'CLAIM_BACKEND_DISABLED');
  if(!sameOrigin)return reject(403,'NOT_AUTHORIZED');
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return reject(405,'METHOD_NOT_ALLOWED');
  if(!/^application\/json\s*(?:;|$)/i.test(request.headers.get('content-type')??''))
   return reject(415,'INVALID_CONTENT_TYPE');
  const bearer=/^Bearer ([^\s]{20,8192})$/.exec(request.headers.get('authorization')??'');
  if(!bearer)return reject(401,'NOT_AUTHORIZED');
  const len=request.headers.get('content-length');
  if(len!==null&&(!/^\d{1,5}$/.test(len)||Number(len)>512))
   return reject(413,'REQUEST_TOO_LARGE');
  let value;
  try{
   const text=await request.text();
   if(text.length>512)return reject(413,'REQUEST_TOO_LARGE');
   value=JSON.parse(text);
  }catch{return reject(400,'INVALID_CLAIM');}
  const intent=parseSupportClaimIntent(value);
  if(!intent)return reject(400,'INVALID_CLAIM');
  let identity;
  try{identity=await resolveIdentity(bearer[1]);}catch{return reject(401,'NOT_AUTHORIZED');}
  if(!identity||!UUID.test(identity.userId??'')||!UUID.test(identity.sessionId??'')||
   identity.aal!=='aal2'||identity.role!=='authenticated'||identity.isAnonymous===true)
   return reject(401,'NOT_AUTHORIZED');
  try{
   const result=await claim(identity,intent);
   const receipt=parseSupportClaimReceipt(result,intent);
   if(!receipt)return reject(503,'UNTRUSTED_RECEIPT');
   return new Response(JSON.stringify(receipt),{status:202,headers});
  }catch{return reject(403,'CLAIM_NOT_AUTHORIZED');}
 };
}

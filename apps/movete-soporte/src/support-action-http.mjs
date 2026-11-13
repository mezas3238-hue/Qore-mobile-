import {parseSupportActionIntent,parseSupportActionReceipt}
 from './support-action-contract.mjs';
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const ORIGIN=/^https:\/\/[a-z0-9.-]+(?::443)?$/i;

/**
 * G314: isolated fetch handler. ALL operations fail closed by default.
 * A deployable edge adapter must bind resolveIdentity to Supabase Auth
 * getUser(accessToken), and enqueue to the backend service-role-only RPC.
 * No access tokens, privileged keys or raw errors are ever returned.
 */
export function createSupportActionHandler({
 enabled=false,allowedOrigin='',resolveIdentity,enqueue
}={}){
 const configured=enabled===true&&typeof allowedOrigin==='string'&&
  ORIGIN.test(allowedOrigin)&&typeof resolveIdentity==='function'&&
  typeof enqueue==='function';
 return async function handle(request){
  const origin=request?.headers?.get?.('origin')??'';
  const safeOrigin=configured&&origin===allowedOrigin;
  const headers=new Headers({
   'content-type':'application/json; charset=utf-8',
   'cache-control':'no-store','vary':'Origin',
   'x-content-type-options':'nosniff'
  });
  if(safeOrigin){
   headers.set('access-control-allow-origin',allowedOrigin);
   headers.set('access-control-allow-methods','POST, OPTIONS');
   headers.set('access-control-allow-headers','authorization, content-type, apikey, x-client-info');
  }
  const respond=(status,code)=>new Response(JSON.stringify({ok:false,code}),
   {status,headers});
  if(!configured)return respond(503,'SUPPORT_BACKEND_DISABLED');
  if(!safeOrigin)return respond(403,'NOT_AUTHORIZED');
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return respond(405,'METHOD_NOT_ALLOWED');
  const type=request.headers.get('content-type')??'';
  if(!/^application\/json\s*(?:;|$)/i.test(type))
   return respond(415,'INVALID_CONTENT_TYPE');
  const auth=request.headers.get('authorization')??'';
  const match=/^Bearer ([^\s]{20,8192})$/.exec(auth);
  if(!match)return respond(401,'NOT_AUTHORIZED');
  const size=request.headers.get('content-length');
  if(size!==null&&(!/^\d{1,6}$/.test(size)||Number(size)>1024))
   return respond(413,'REQUEST_TOO_LARGE');
  let raw;
  try{
   const body=await request.text();
   if(body.length>1024)return respond(413,'REQUEST_TOO_LARGE');
   raw=JSON.parse(body);
  }catch{return respond(400,'INVALID_ACTION');}
  const intent=parseSupportActionIntent(raw);
  if(!intent)return respond(400,'INVALID_ACTION');

  let identity;
  try{identity=await resolveIdentity(match[1]);}
  catch{return respond(401,'NOT_AUTHORIZED');}
  if(!identity||!UUID.test(identity.userId??'')||
    !UUID.test(identity.sessionId??'')||
    identity.aal!=='aal2'||identity.role!=='authenticated'||
    identity.isAnonymous===true)
   return respond(401,'NOT_AUTHORIZED');

  try{
   const receipt=await enqueue(identity,intent);
   const parsed=parseSupportActionReceipt(receipt,intent);
   if(!parsed)return respond(503,'SERVER_NOT_READY');
   return new Response(JSON.stringify(parsed),{status:202,headers});
  }catch{
   // This error includes authorization, missing records and stale status.
   // Never disclose whether another employee's ticket exists.
   return respond(403,'ACTION_NOT_AUTHORIZED');
  }
 };
}

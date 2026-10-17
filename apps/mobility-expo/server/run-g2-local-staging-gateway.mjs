/**
 * Local-only G2 STAGING gateway prototype. Not deployed, not connected to Expo.
 * Start ONLY with isolated Supabase STAGING, never Lovable production.
 * All credentials are process.env (not EXPO_PUBLIC) and never logged.
 * http://127.0.0.1 by design: cannot be reached by customers or phones.
 */
import {createServer} from 'node:http';
import {createClient} from '@supabase/supabase-js';
import {createStagingVehicleGateway,createStagingRateLimiter,assertStagingRef} from './g2-staging-vehicle-gateway.mjs';

if(process.env.QORE_MOBILITY_ENV!=='staging')
 throw new Error('QORE_MOBILITY_ENV=staging mandatory');
const ref=assertStagingRef(process.env.QORE_STAGING_PROJECT_REF);
const publishable=process.env.QORE_STAGING_PUBLISHABLE_KEY;
const serverSecret=process.env.QORE_STAGING_SERVICE_ROLE_KEY;
function declaredRole(key) {
 if(typeof key!=='string')return null;
 if(key.startsWith('sb_publishable_'))return 'anon';
 if(key.startsWith('sb_secret_'))return 'service_role';
 const chunks=key.split('.');
 if(chunks.length!==3)return null;
 try{return JSON.parse(Buffer.from(chunks[1],'base64url').toString()).role??null}
 catch{return null}
}
if(declaredRole(publishable)!=='anon'||declaredRole(serverSecret)!=='service_role'||
   publishable===serverSecret)
 throw new Error('Separate publishable/anon and server-only service key required');
const envPort=process.env.QORE_STAGING_LOCAL_GATEWAY_PORT??'4141';
const port=Number(envPort);
if(!Number.isInteger(port)||port<1024||port>65535)
 throw new Error('Invalid local gateway port');

const url='https://'+ref+'.supabase.co';
const options={auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}};
const auth=createClient(url,publishable,options);
const admin=createClient(url,serverSecret,options);
const invoke=async(name,params)=>{
 const {data,error}=await admin.rpc(name,params);
 if(error)throw new Error('Staging RPC rejected');
 return data;
};
const handler=createStagingVehicleGateway({
 projectRef:ref,
 verifyAccessToken:async token=>{
  // DO NOT decode unsigned JWT to grant role: ask Supabase Auth each request.
  const {data,error}=await auth.auth.getUser(token);
  if(error||!data?.user)throw new Error('Invalid session');
  return data.user;
 },
 submitDraft:params=>invoke('mobility_submit_vehicle_draft',params),
 reviewVehicle:params=>invoke('mobility_review_vehicle',params),
 stagePending:params=>invoke('mobility_stage_vehicle_pending',params),
 // Extra authorization before the privileged RPC runs; SQL repeats this gate.
 authorizeAdmin:async userId=>{
  const {data,error}=await admin.from('user_roles')
   .select('role').eq('user_id',userId).eq('role','admin').limit(1);
  if(error)throw new Error('Staging admin role could not be verified');
  return Array.isArray(data)&&data.length===1&&data[0]?.role==='admin';
 },
 // Local in-memory backstop, not sufficient for horizontal deployment.
 allowRequest:createStagingRateLimiter({
  windowMs:60_000,maxEntries:1024,draftLimit:4,adminLimit:6
 }),
});
const send=(res,status,body)=>{
 res.writeHead(status,{
  'content-type':'application/json; charset=utf-8',
  'cache-control':'no-store',
  'x-content-type-options':'nosniff',
  'content-security-policy':"default-src 'none'",
  'referrer-policy':'no-referrer'
 });
 res.end(JSON.stringify(body));
};
const server=createServer(async(req,res)=>{
 // Explicitly no cookies or CORS credentials. Not an internet server.
 if(req.method!=='POST'){
  send(res,405,{error:'Method not allowed'});return;
 }
 if(req.url!=='/v1/staging/vehicle-applications'&&
    req.url!=='/v1/staging/admin/vehicle-reviews'&&
    req.url!=='/v1/staging/admin/materialize-pending'){
  send(res,404,{error:'Not found'});return;
 }
 if(!/^application\/json(?:\s*;.*)?$/i.test(req.headers['content-type']??'')){
  send(res,415,{error:'JSON required'});return;
 }
 let chunks=[],len=0;
 try {
  for await(const chunk of req){
   len+=chunk.length;
   if(len>4096)throw new Error('Too large');
   chunks.push(chunk);
  }
  const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  const result=await handler({
   method:req.method,path:req.url,headers:req.headers,body
  });
  send(res,result.status,result.body);
 }catch {
  send(res,400,{error:'Invalid or oversized JSON'});
 }
});
// Avoid slow-body connections monopolizing the loopback prototype.
server.requestTimeout=15_000;
server.headersTimeout=10_000;
server.maxRequestsPerSocket=100;
server.listen(port,'127.0.0.1',()=>{
 console.log('QORE Mobility local STAGING gateway listening on loopback port '+port+'; NO LIVE operations');
});

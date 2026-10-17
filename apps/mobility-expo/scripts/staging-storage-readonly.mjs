/**
 * READ-ONLY Supabase Storage REST isolation smoke.
 * Requires two *already provisioned* verified STAGING Auth test identities and
 * two pre-existing NONPERSONAL synthetic license test objects. Never uploads,
 * creates accounts, deletes files, or logs credentials / response bodies.
 *
 * Deliberately fails when own object is absent: a 404 for everyone would be a
 * vacuous / falsely-green isolation test.
 */
import assert from 'node:assert/strict';
import {assertPublishableKey,safeStageRef} from './staging-auth-policy-gate.mjs';

const BUCKET='mobility-staging-driver-evidence';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OBJECT=/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/licencia-[A-Za-z0-9_-]{12,80}\.(jpg|jpeg|png)$/i;
const denyStatuses=new Set([400,401,403,404]);

export function assertFixturePath(path,identity){
 if(typeof identity!=='string'||!UUID.test(identity)||
  typeof path!=='string'||!OBJECT.test(path)||
  OBJECT.exec(path)[1].toLowerCase()!==identity.toLowerCase())
  throw new Error('Se requieren rutas de evidencia sintética con carpeta propia, sin PII');
 return path;
}
export function assertDistinctFixtures(a,b){
 if(!a?.id||!b?.id||a.id===b.id||!UUID.test(a.id)||!UUID.test(b.id))
  throw new Error('Fixture IDs distintos y válidos obligatorios');
 return true;
}
export async function authLogin(base,key,email,password,request=fetch){
 if(typeof email!=='string'||!email.endsWith('.invalid')||typeof password!=='string'||password.length<8)
  throw new Error('Solo usar cuentas ficticias con emails .invalid y contraseña de test');
 const res=await request(base+'/auth/v1/token?grant_type=password',{
  method:'POST',headers:{apikey:key,'content-type':'application/json'},
  body:JSON.stringify({email,password}),redirect:'error',signal:AbortSignal.timeout(10000)
 });
 if(!res.ok)throw new Error('Fixture Auth login falló HTTP '+res.status);
 const response=await res.json();
 const token=response?.access_token;
 if(typeof token!=='string'||token.length<20)throw new Error('Token de prueba ausente');
 // Revalidate at Auth server, not claims parsed by the caller.
 const user=await request(base+'/auth/v1/user',{
  method:'GET',headers:{apikey:key,authorization:'Bearer '+token},
  redirect:'error',signal:AbortSignal.timeout(10000)
 });
 if(!user.ok)throw new Error('Auth no pudo verificar identidad de prueba');
 const account=await user.json();
 if(!UUID.test(account?.id??'')||account?.is_anonymous===true||
  typeof account?.email_confirmed_at!=='string'||
  account?.email?.toLowerCase()!==email.toLowerCase())
  throw new Error('Cuenta de prueba sin confirmación segura');
 return {id:account.id,token};
}
async function probeDownload(base,key,token,path,request){
 const url=base+'/storage/v1/object/authenticated/'+BUCKET+'/'+path;
 const res=await request(url,{method:'GET',
  headers:{apikey:key,...(token?{authorization:'Bearer '+token}:{})},
  redirect:'error',signal:AbortSignal.timeout(10000)});
 // Explicitly do not consume or print document bytes.
 await res.body?.cancel?.();
 return res.status;
}
export async function verifyStorageIsolation({ref,key,fixtureA,fixtureB,pathA,pathB,request=fetch}){
 safeStageRef(ref);assertPublishableKey(key,ref);
 assertDistinctFixtures(fixtureA,fixtureB);
 assertFixturePath(pathA,fixtureA.id);
 assertFixturePath(pathB,fixtureB.id);
 const base='https://'+ref+'.supabase.co';
 const aOwn=await probeDownload(base,key,fixtureA.token,pathA,request);
 const bOwn=await probeDownload(base,key,fixtureB.token,pathB,request);
 // Both own-file reads MUST be 200, not merely the same 404.
 if(aOwn!==200||bOwn!==200)
  throw new Error('No se comprobó descarga propia de ambos objetos ficticios (deben existir)');
 const cases=[
  ['A foreign B',fixtureA.token,pathB],
  ['B foreign A',fixtureB.token,pathA],
  ['anonymous A',null,pathA],
  ['anonymous B',null,pathB]
 ];
 for(const [name,token,path] of cases){
  const status=await probeDownload(base,key,token,path,request);
  if(!denyStatuses.has(status))
   throw new Error('Fuga Storage: '+name+' recibió HTTP '+status);
 }
 return {certified:true,ownReads:2,deniedCrossAndAnonymous:4,usedSyntheticFixturesOnly:true,
  liveTripsEnabled:false,hasWrites:false};
}
async function main(){
 if(process.env.QORE_MOBILITY_ENV!=='staging')throw Error('Solo staging, sin producción');
 const ref=safeStageRef(process.env.QORE_STAGING_PROJECT_REF);
 const key=process.env.QORE_STAGING_ANON_KEY;
 assertPublishableKey(key,ref);
 const base='https://'+ref+'.supabase.co';
 const a=await authLogin(base,key,
  process.env.QORE_STAGING_PASSENGER_A_EMAIL,
  process.env.QORE_STAGING_PASSENGER_A_PASSWORD);
 const b=await authLogin(base,key,
  process.env.QORE_STAGING_PASSENGER_B_EMAIL,
  process.env.QORE_STAGING_PASSENGER_B_PASSWORD);
 const result=await verifyStorageIsolation({
  ref,key,fixtureA:a,fixtureB:b,
  pathA:process.env.QORE_STAGING_TEST_OBJECT_A_PATH,
  pathB:process.env.QORE_STAGING_TEST_OBJECT_B_PATH
 });
 assert.equal(result.certified,true);
 console.log('PASS: dos objetos sintéticos propios accesibles y lectura ajena/anon denegada; 0 escrituras');
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 main().catch(err=>{
  // Never echo fetch URLs, credentials or response bodies.
  const msg=err instanceof Error?err.message:'fallo sin detalles';
  console.error('BLOCKED: '+msg);
  process.exitCode=1;
 });
}

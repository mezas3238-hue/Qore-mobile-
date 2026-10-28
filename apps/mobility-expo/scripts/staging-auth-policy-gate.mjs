/**
 * Read-only gate for isolated QORE STAGING Supabase Auth settings.
 * No signups, login, test accounts or writes. All credentials are environment-only.
 * A missing/unrecognizable setting blocks certification rather than guessing.
 */
const PROD_REF='qdqrlgzlotnfdxzpacxs';
const REF=/^[a-z0-9]{12,30}$/;
function isPlainObject(x){return x!==null&&typeof x==='object'&&!Array.isArray(x);}
export function safeStageRef(ref){
 if(typeof ref!=='string'||!REF.test(ref)||ref===PROD_REF)
  throw new Error('Supabase STAGING ref distinta y válida obligatoria');
 return ref;
}
export function assertPublishableKey(key,ref){
 if(typeof key!=='string'||key.length<20||/\s/.test(key))
  throw new Error('Se requiere clave pública anon/publishable');
 if(/^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(key))return;
 const parts=key.split('.');
 if(parts.length!==3)throw new Error('Credencial pública inválida');
 try{
  const claims=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));
  if(!isPlainObject(claims)||claims.role!=='anon'||
    (typeof claims.ref==='string'&&claims.ref!==ref))
   throw new Error('Claves de otro entorno o rol no público');
 }catch{throw new Error('No se pudo validar formato público de la clave');}
}
export function evaluateSignupPolicy(settings){
 if(!isPlainObject(settings)||typeof settings.disable_signup!=='boolean')
  return {certified:false,reason:'Configuración de Auth ausente o incompleta'};
 if(settings.disable_signup!==true)
  return {certified:false,reason:'Auth admite registro público (disable_signup=false)'};
 return {certified:true,reason:'Auth prohíbe registro público (disable_signup=true)'};
}
export async function inspectStageSignup({ref,key,request=fetch}){
 safeStageRef(ref);
 assertPublishableKey(key,ref);
 const url='https://'+ref+'.supabase.co/auth/v1/settings';
 const response=await request(url,{
  method:'GET',
  headers:{apikey:key,Accept:'application/json'},
  redirect:'error',
  signal:AbortSignal.timeout(10000),
 });
 if(!response.ok)throw new Error('Endpoint Auth STAGING HTTP '+response.status);
 const data=await response.json();
 return evaluateSignupPolicy(data);
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 try{
  if(process.env.QORE_MOBILITY_ENV!=='staging')
   throw new Error('QORE_MOBILITY_ENV=staging obligatorio');
  const policy=await inspectStageSignup({
   ref:process.env.QORE_STAGING_PROJECT_REF,
   key:process.env.QORE_STAGING_ANON_KEY
  });
  if(!policy.certified){
   console.error('BLOCKED: '+policy.reason);
   process.exitCode=1;
  }else console.log('PASS: '+policy.reason+'; sin crear usuarios ni ejecutar escrituras');
 }catch(e){
  console.error('BLOCKED: '+(e instanceof Error?e.message:'fallo no identificado'));
  process.exitCode=1;
 }
}

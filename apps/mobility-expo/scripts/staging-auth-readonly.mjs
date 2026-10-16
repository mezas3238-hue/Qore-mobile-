/**
 * Read-only staging RLS smoke test; no creating users, trips, payments or records.
 * Uses TWO pre-provisioned disposable test passengers on a separate Supabase
 * STAGING PROJECT. Never use this against production. No secrets are logged.
 */
import assert from 'node:assert/strict';
const required=[
 'QORE_STAGING_PROJECT_REF','QORE_STAGING_ANON_KEY',
 'QORE_STAGING_PASSENGER_A_EMAIL','QORE_STAGING_PASSENGER_A_PASSWORD',
 'QORE_STAGING_PASSENGER_B_EMAIL','QORE_STAGING_PASSENGER_B_PASSWORD'
];
if(process.env.QORE_MOBILITY_ENV!=='staging')throw Error('Solo se permite QORE_MOBILITY_ENV=staging');
for(const key of required)if(!process.env[key])throw Error('Falta variable staging: '+key);
const ref=process.env.QORE_STAGING_PROJECT_REF;
if(!/^[a-z0-9]{12,30}$/.test(ref))throw Error('Proyecto staging inválido');
const endpoint='https://'+ref+'.supabase.co';
const anon=process.env.QORE_STAGING_ANON_KEY;
if(!anon.startsWith('sb_publishable_')){
 const segments=anon.split('.');
 if(segments.length!==3)throw Error('Se requiere clave publishable/anon, jamás service_role');
 try {
  const claims=JSON.parse(Buffer.from(segments[1],'base64url').toString('utf8'));
  if(claims.role!=='anon')throw Error('Clave de backend no es anon');
 }catch(err){throw Error('No se pudo validar la clave anon: '+(err instanceof Error?err.message:''));}
}
async function login(email,password) {
 const response=await fetch(endpoint+'/auth/v1/token?grant_type=password',{
  method:'POST',headers:{apikey:anon,'Content-Type':'application/json'},
  body:JSON.stringify({email,password})
 });
 if(!response.ok)throw Error('Login de fixture staging falló, HTTP '+response.status);
 const data=await response.json();
 assert.match(data.user?.id??'',/^[a-f0-9-]{36}$/);
 assert.ok(data.access_token);
 return {id:data.user.id,token:data.access_token};
}
async function getRows(table,field,id,token){
 const url=new URL(endpoint+'/rest/v1/'+table);
 url.searchParams.set('select',table==='user_roles'?'user_id,role':'id');
 url.searchParams.set(field,'eq.'+id);url.searchParams.set('limit','3');
 const r=await fetch(url,{headers:{apikey:anon,Authorization:'Bearer '+token}});
 // Some RLS policies reject instead of returning empty. Both are acceptable for
 // FOREIGN rows; OWN profile reads MUST succeed separately.
 if(r.status===401||r.status===403)return {denied:true,rows:[]};
 if(!r.ok)throw Error(table+' HTTP '+r.status);
 const rows=await r.json();
 if(!Array.isArray(rows))throw Error('Formato inesperado');
 return {denied:false,rows};
}
const a=await login(process.env.QORE_STAGING_PASSENGER_A_EMAIL,process.env.QORE_STAGING_PASSENGER_A_PASSWORD);
const b=await login(process.env.QORE_STAGING_PASSENGER_B_EMAIL,process.env.QORE_STAGING_PASSENGER_B_PASSWORD);
assert.notEqual(a.id,b.id,'Fixtures deben ser identidades diferentes');
for(const [actor,other] of [[a,b],[b,a]]){
 const own=await getRows('profiles','id',actor.id,actor.token);
 assert.equal(own.denied,false,'El titular no puede leer su perfil');
 assert.equal(own.rows.length,1,'Trigger de perfil pendiente o RLS incorrecta');
 const stranger=await getRows('profiles','id',other.id,actor.token);
 assert.equal(stranger.rows.length,0,'FUGA: lectura de perfil de otro pasajero');
 const roles=await getRows('user_roles','user_id',other.id,actor.token);
 assert.equal(roles.rows.length,0,'FUGA: roles de otra cuenta');
}
for(const actor of [a,b]){
 const anonymous=await getRows('profiles','id',actor.id,anon);
 assert.equal(anonymous.rows.length,0,'FUGA: perfil accesible sin sesión');
}
console.log('PASS: staging RLS smoke lectura propia/cuenta ajena/anon. NO valida escrituras ni documentos.');

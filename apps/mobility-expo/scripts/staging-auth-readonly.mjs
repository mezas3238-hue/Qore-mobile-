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
// Hard stop: existing Lovable database must NEVER be used as a staging fixture.
if(ref==='qdqrlgzlotnfdxzpacxs')throw Error('Se prohíbe ejecutar staging contra el backend Lovable existente');
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
 const headers={apikey:anon};
 if(token)headers.Authorization='Bearer '+token;
 const r=await fetch(url,{headers});
 // Some RLS policies reject instead of returning empty. Both are acceptable for
 // FOREIGN rows; OWN profile reads MUST succeed separately.
 if(r.status===401||r.status===403)return {denied:true,rows:[]};
 if(!r.ok)throw Error(table+' HTTP '+r.status);
 const rows=await r.json();
 if(!Array.isArray(rows))throw Error('Formato inesperado');
 return {denied:false,rows};
}
async function probeRole(uid,role,token){
 const headers={apikey:anon,'Content-Type':'application/json'};
 if(token)headers.Authorization='Bearer '+token;
 const response=await fetch(endpoint+'/rest/v1/rpc/has_role',{
  method:'POST',headers,body:JSON.stringify({_uid:uid,_role:role})
 });
 if(response.status===401||response.status===403)return {denied:true,value:false};
 if(!response.ok)throw Error('Role RPC rejected unexpectedly HTTP '+response.status);
 const value=await response.json();
 if(typeof value!=='boolean')throw Error('Invalid role RPC response type');
 return {denied:false,value};
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
 const ownPassengerRole=await probeRole(actor.id,'passenger',actor.token);
 assert.equal(ownPassengerRole.denied,false,'RPC has_role no accesible al titular');
 assert.equal(ownPassengerRole.value,true,'Rol pasajero esperado, fixtures no están configurados');
 const foreignAdminRole=await probeRole(other.id,'admin',actor.token);
 assert.equal(foreignAdminRole.value,false,'FUGA: lectura del rol de otro pasajero');
 const foreignPassengerRole=await probeRole(other.id,'passenger',actor.token);
 assert.equal(foreignPassengerRole.value,false,'FUGA: lectura incluso de rol ajeno de pasajero');
 const promotedRole=await probeRole(actor.id,'admin',actor.token);
 assert.equal(promotedRole.value,false,'ESCALADA: cuenta de pasajero con rol admin');
}
for(const actor of [a,b]){
 const anonymous=await getRows('profiles','id',actor.id,undefined);
 assert.equal(anonymous.rows.length,0,'FUGA: perfil accesible sin sesión');
}
console.log('PASS: staging RLS profile and role isolation, deny foreign role queries and admin promotion. NO validates uploads/writes.');

/** CI fail-closed guard: two INDEPENDENT mobile binary projects.
 * No importing sibling screens, legacy mixed application, or private backend.
 */
import {readFileSync,readdirSync,statSync,existsSync} from 'node:fs';
import {resolve,dirname,join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const apps=[
 {dir:'movete-driver',audience:'DRIVER',id:'com.movetefacil.driver',scheme:'movetefacildriver',
  ownRoutes:['documentos.tsx','ofertas.tsx','ganancias.tsx'],
  prohibitedRoutes:['envios.tsx','historial.tsx','seguimiento.tsx']},
 {dir:'movete-cliente',audience:'CLIENT',id:'com.movetefacil.cliente',scheme:'movetefacilcliente',
  ownRoutes:['envios.tsx','historial.tsx','seguimiento.tsx'],
  prohibitedRoutes:['documentos.tsx','ofertas.tsx','ganancias.tsx']}
];
const names=new Set(),ids=new Set(),schemes=new Set();
function walk(dir){
 return readdirSync(dir).flatMap(name=>{
  if(name==='node_modules'||name==='.expo'||name==='dist')return [];
  const full=join(dir,name);
  return statSync(full).isDirectory()?walk(full):[full];
 });
}
for(const item of apps){
 const base=join(root,'apps',item.dir);
 const manifest=JSON.parse(readFileSync(join(base,'app.json'),'utf8')).expo;
 const pkg=JSON.parse(readFileSync(join(base,'package.json'),'utf8'));
 assert.equal(manifest.name,item.dir==='movete-driver'?'Movete Fácil Driver':'Movete Fácil Cliente');
 assert.equal(manifest.extra.qoreAudience,item.audience);
 assert.equal(manifest.extra.liveOperationsEnabled,false);
 assert.equal(manifest.android.package,item.id);
 assert.equal(manifest.ios.bundleIdentifier,item.id);
 assert.equal(manifest.scheme,item.scheme);
 assert.equal(pkg.main,'expo-router/entry');
 assert.equal(pkg.private,true);
 assert.ok(!names.has(pkg.name)&&!ids.has(item.id)&&!schemes.has(item.scheme));
 names.add(pkg.name);ids.add(item.id);schemes.add(item.scheme);
 for(const route of ['_layout.tsx','index.tsx',...item.ownRoutes])
  assert.ok(existsSync(join(base,'app',route)),item.dir+': missing own '+route);
 for(const route of item.prohibitedRoutes)
  assert.equal(existsSync(join(base,'app',route)),false,item.dir+': forbidden '+route);
 const other=item.dir==='movete-driver'?'movete-cliente':'movete-driver';
 for(const file of walk(base)){
  if(!/\.(?:ts|tsx|mjs|js|json)$/.test(file)||file.endsWith('package-lock.json'))continue;
  const body=readFileSync(file,'utf8');
  if(/\.(?:ts|tsx|mjs|js)$/.test(file)){
   // Refuse cross-mobile imports, any legacy mixed-app imports, or server-only modules.
   const imports=[...body.matchAll(/\b(?:from\s*|import\s*\(|require\s*\()\s*['"]([^'"]+)['"]/g)];
   for(const match of imports){
    const spec=match[1];
    assert.ok(!spec.includes(other)&&!spec.includes('mobility-expo')&&
       !spec.includes('server/')&&!spec.includes('backend/'),
       relative(root,file)+': forbidden import '+spec);
   }
   assert.doesNotMatch(body,/\b(?:sb_secret_|service_role_key|LIVE_TRIPS_ENABLED\s*=\s*true)\b/,
    relative(root,file)+': server secret or live bypass');
  }
 }
}
const driver=readFileSync(join(root,'apps/movete-driver/src/domain/capabilities.mjs'),'utf8');
const client=readFileSync(join(root,'apps/movete-cliente/src/domain/capabilities.mjs'),'utf8');
assert.doesNotMatch(driver,/['"]client\./);
assert.doesNotMatch(client,/['"]driver\./);
assert.equal(existsSync(join(root,'apps/movete-driver/app/_layout.tsx')),true);
assert.equal(existsSync(join(root,'apps/movete-cliente/app/_layout.tsx')),true);
console.log('PASS: 2 independent mobile binaries, roles, routes, imports and no LIVE');

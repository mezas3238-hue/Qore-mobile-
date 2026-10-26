/**
 * Non-network store candidate gate. Does not call EAS, create a build,
 * upload a binary, provision resources or enable LIVE.
 * No APK; two isolated signed-store targets are declarations only.
 */
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,join} from 'node:path';
import assert from 'node:assert/strict';
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const APP=[
 {dir:'movete-cliente',kind:'CLIENT',id:'com.movetefacil.cliente',slug:'movete-facil-cliente',
  required:['EXPO_PUBLIC_F1_OWNER_APPROVED','EXPO_PUBLIC_F1_G73_CONTRACT_VERIFIED',
   'EXPO_PUBLIC_F1_PG_RUNTIME_VERIFIED','EXPO_PUBLIC_F1_ROUTE_PROVIDER_VERIFIED',
   'EXPO_PUBLIC_F1_G93_SUBSIDY_CONTRACT_VERIFIED',
   'EXPO_PUBLIC_F1_G94_FINANCIAL_STATUS_VERIFIED',
   'EXPO_PUBLIC_F1_G95_CANCEL_CONTRACT_VERIFIED',
   'EXPO_PUBLIC_F1_HISTORY_CONTRACT_VERIFIED','EXPO_PUBLIC_F1_STATUS_CONTRACT_VERIFIED',
   'EXPO_PUBLIC_F1_PASSENGER_RLS_VERIFIED',
   'EXPO_PUBLIC_MOTO_OWNER_APPROVED','EXPO_PUBLIC_MOTO_LEGAL_VERIFIED']},
 {dir:'movete-driver',kind:'DRIVER',id:'com.movetefacil.driver',slug:'movete-facil-driver',
  required:['EXPO_PUBLIC_QORE_STAGING_RUNTIME_APPROVED']}
];
function assertStoreCandidate({manifest,eas,item}){
 const m=manifest?.expo;
 assert.ok(m&&typeof m==='object',item.dir+': app manifest required');
 assert.equal(m.slug,item.slug);
 assert.equal(m.android?.package,item.id);
 assert.equal(m.ios?.bundleIdentifier,item.id);
 assert.equal(m.extra?.qoreAudience,item.kind);
 assert.equal(m.extra?.liveOperationsEnabled,false);
 assert.equal(m.extra?.eas?.projectId,undefined,
  'EAS provisioning requires separate explicit Owner authorization');
 assert.equal(eas?.cli?.appVersionSource,'local');
 assert.equal(eas?.cli?.requireCommit,true);
 assert.deepEqual(Object.keys(eas?.build??{}),['store-candidate'],
  'No default production or internal APK build profile');
 assert.equal(eas.submit,undefined,'No implicit app-store submissions');
 const p=eas.build['store-candidate'];
 assert.equal(p?.distribution,'store');
 assert.equal(p?.developmentClient,false);
 assert.equal(p?.android?.buildType,'app-bundle');
 assert.equal(p?.android?.gradleCommand,undefined);
 assert.equal(p?.ios?.simulator,false);
 assert.equal(p?.autoSubmit,undefined);
 assert.equal(p?.environment,undefined,
  'A remote EAS environment cannot override fail-closed candidate flags');
 assert.equal(p?.android?.withoutCredentials,undefined);
 assert.equal(p?.ios?.withoutCredentials,undefined);
 assert.equal(p?.android?.credentialsSource,undefined);
 assert.equal(p?.ios?.credentialsSource,undefined);
 assert.equal(p?.android?.env,undefined);
 assert.equal(p?.ios?.env,undefined);
 assert.equal(p?.ios?.enterpriseProvisioning,undefined);
 assert.equal(p?.android?.autoIncrement,undefined);
 assert.equal(p?.ios?.autoIncrement,undefined);
 assert.equal(p?.autoIncrement,undefined);
 assert.ok(p.env&&typeof p.env==='object'&&!Array.isArray(p.env));
 assert.deepEqual(Object.keys(p.env).sort(),item.required.slice().sort(),
  'QA build gates must have the full exact fail-closed set');
 for(const key of item.required)assert.equal(p.env[key],'false',
  'Never authorize LIVE/STAGING billing or dispatch with store candidate');
 const text=JSON.stringify(eas);
 assert.doesNotMatch(text,/\b(?:sb_secret_|service_role_key|--auto-submit|\.apk|assembleRelease)\b/i);
 return true;
}
const configs=APP.map(item=>{
 const dir=join(repo,'apps',item.dir);
 return {item,manifest:JSON.parse(readFileSync(join(dir,'app.json'),'utf8')),
  eas:JSON.parse(readFileSync(join(dir,'eas.json'),'utf8'))};
});
for(const x of configs)assertStoreCandidate(x);
assert.notEqual(configs[0].manifest.expo.android.package,configs[1].manifest.expo.android.package);
assert.notEqual(configs[0].manifest.expo.ios.bundleIdentifier,configs[1].manifest.expo.ios.bundleIdentifier);
if(process.argv.includes('--self-test')){
 function mustFail(input){
  assert.throws(()=>assertStoreCandidate(input),
   'Release gate must reject tampered/store-unsafe manifest or profile');
 }
 for(const x of configs){
  const clone=()=>JSON.parse(JSON.stringify(x));
  const apk=clone();apk.eas.build['store-candidate'].android.buildType='apk';mustFail(apk);
  const live=clone();live.manifest.expo.extra.liveOperationsEnabled=true;mustFail(live);
  const auto=clone();auto.eas.submit={production:{}};mustFail(auto);
  const flag=clone();flag.eas.build['store-candidate'].env[x.item.required[0]]='true';mustFail(flag);
  const loose=clone();loose.eas.build.production={};mustFail(loose);
  const id=clone();id.manifest.expo.android.package='com.other.app';mustFail(id);
  const remote=clone();remote.eas.build['store-candidate'].environment='production';mustFail(remote);
 }
 console.log('PASS: store gate adversarial variants rejected for both isolated apps');
}
console.log('PASS: Android AAB and iOS store-only candidate profiles; CLIENT/DRIVER separate; no APK, submit, live flags, credentials or paid resources');

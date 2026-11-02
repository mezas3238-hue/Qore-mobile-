/**
 * G300/G301: Android APK internal QA first, then AAB/IPA store releases.
 * No Apple/Google/Expo credentials, no builds, no uploads, no LIVE.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=path=>JSON.parse(readFileSync(resolve(root,path),'utf8'));
const nativeApps=[
 {dir:'movete-cliente',id:'com.movetefacil.cliente',audience:'CLIENT'},
 {dir:'movete-driver',id:'com.movetefacil.driver',audience:'DRIVER'}
];
for(const {dir,id,audience} of nativeApps){
 test('G300 '+dir+' distinct App Store identities and LIVE remains OFF',()=>{
  const config=read('apps/'+dir+'/app.json').expo;
  assert.equal(config.android.package,id);
  assert.equal(config.ios.bundleIdentifier,id);
  assert.equal(config.extra.qoreAudience,audience);
  assert.equal(config.extra.liveOperationsEnabled,false);
  assert.ok(/^Movete Fácil /.test(config.name));
 });
 test('G301 '+dir+' EAS profiles build internal QA APK plus separate AAB and iOS store archives',()=>{
  const eas=read('apps/'+dir+'/eas.json');
  assert.equal(eas.cli.appVersionSource,'local');
  assert.equal(eas.submit,undefined,'Never submit or publish automatically');
  assert.equal(eas.build.development,undefined,'No production-adjacent developer tooling');
  const qa=eas.build['qa-apk'];
  assert.equal(qa.distribution,'internal','APK must never be presented as store release');
  assert.equal(qa.android.buildType,'apk','QA only needs an Android installable APK');
  assert.equal(qa.env.EXPO_PUBLIC_QORE_LIVE_OPERATIONS,'false');
  assert.equal(qa.env.QORE_QA_BUILD,'true');
  assert.equal(qa.autoSubmit,undefined,'No automatic QA publication');
  assert.equal(qa.developmentClient,undefined,'Use standalone test app without dev tooling');
  assert.equal(qa.ios,undefined,'iOS tests must use TestFlight or separately signed builds');
  for(const profile of ['store-review','production']){
   const p=eas.build[profile];
   assert.equal(p.distribution,'store');
   assert.equal(p.android.buildType,'app-bundle');
   assert.equal(p.ios.simulator,false);
   assert.equal(p.env.EXPO_PUBLIC_QORE_LIVE_OPERATIONS,'false');
   assert.equal(p.env.QORE_QA_BUILD,'false');
   assert.equal(p.autoSubmit,undefined);
   assert.equal(p.channel,undefined);
  }
  assert.notEqual(eas.build['qa-apk'].distribution,eas.build.production.distribution);
  assert.notEqual(eas.build['qa-apk'].android.buildType,eas.build.production.android.buildType);
  const text=JSON.stringify(eas);
  assert.doesNotMatch(text,/service_role|sb_secret_|private_key|api[_-]?token|password/i);
 });
}
for(const {dir,id} of nativeApps){
 test('G302 '+dir+' APK builds use .qa app ID with visible QA label and LIVE OFF',async()=>{
  const moduleUrl=pathToFileURL(resolve(root,'apps',dir,'app.config.js')).href;
  const config=(await import(moduleUrl)).default;
  const staticConfig=read('apps/'+dir+'/app.json').expo;
  const before=process.env.QORE_QA_BUILD;
  try{
   process.env.QORE_QA_BUILD='true';
   const qa=config({config:staticConfig});
   assert.equal(qa.android.package,id+'.qa');
   assert.match(qa.name,/ QA$/);
   assert.equal(qa.extra.qaBuild,true);
   assert.equal(qa.extra.liveOperationsEnabled,false);
   process.env.QORE_QA_BUILD='false';
   const store=config({config:staticConfig});
   assert.equal(store.android.package,id);
   assert.equal(store.name,staticConfig.name);
   assert.equal(store.extra.qaBuild,undefined);
  }finally{
   if(before===undefined)delete process.env.QORE_QA_BUILD;
   else process.env.QORE_QA_BUILD=before;
  }
 });
}
test('G300 Cliente and Driver package IDs and Expo names remain distinct',()=>{
 const ids=nativeApps.map(x=>read('apps/'+x.dir+'/app.json').expo.android.package);
 assert.equal(new Set(ids).size,2);
});

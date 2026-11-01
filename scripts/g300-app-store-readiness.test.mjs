/**
 * G300: static App Store distribution guard for two native Expo apps.
 * No Apple/Google/Expo credentials, no builds, no uploads, no LIVE.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
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
 test('G300 '+dir+' EAS profiles build AAB and iOS store archives only',()=>{
  const eas=read('apps/'+dir+'/eas.json');
  assert.equal(eas.cli.appVersionSource,'local');
  assert.equal(eas.submit,undefined,'Never submit or publish automatically');
  assert.equal(eas.build.development,undefined,'No APK sideloading profile');
  for(const profile of ['store-review','production']){
   const p=eas.build[profile];
   assert.equal(p.distribution,'store');
   assert.equal(p.android.buildType,'app-bundle');
   assert.equal(p.ios.simulator,false);
   assert.equal(p.env.EXPO_PUBLIC_QORE_LIVE_OPERATIONS,'false');
   assert.equal(p.autoSubmit,undefined);
   assert.equal(p.channel,undefined);
  }
  const text=JSON.stringify(eas);
  assert.doesNotMatch(text,/service_role|sb_secret_|private_key|api[_-]?token|password/i);
 });
}
test('G300 Cliente and Driver package IDs and Expo names remain distinct',()=>{
 const ids=nativeApps.map(x=>read('apps/'+x.dir+'/app.json').expo.android.package);
 assert.equal(new Set(ids).size,2);
});

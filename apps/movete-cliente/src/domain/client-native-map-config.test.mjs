import test from 'node:test';
import assert from 'node:assert/strict';
import configure from '../../app.config.js';
const base={
 name:'Cliente',android:{package:'com.movetefacil.cliente'},
 extra:{liveOperationsEnabled:false},plugins:['expo-router']
};
function inEnv(values,run){
 const keys=['QORE_QA_BUILD','QORE_NATIVE_MAPS_APPROVED','QORE_ANDROID_MAPS_API_KEY'];
 const before=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 try{
  for(const key of keys){
   if(Object.hasOwn(values,key))process.env[key]=values[key];
   else delete process.env[key];
  }
  return run();
 }finally{
  for(const key of keys){
   if(before[key]===undefined)delete process.env[key];
   else process.env[key]=before[key];
  }
 }
}
test('Native map is disabled by default; no native Google credential in config',()=>{
 inEnv({},()=>{
  const result=configure({config:base});
  assert.equal(result.extra.qoreAndroidMapsReady,false);
  assert.equal(result.plugins.length,1);
  assert.equal(result.android.package,base.android.package);
 });
});
test('Explicit approval alone cannot activate map without well-formed key',()=>{
 inEnv({QORE_NATIVE_MAPS_APPROVED:'true',QORE_ANDROID_MAPS_API_KEY:'invalid'},()=>{
  const result=configure({config:base});
  assert.equal(result.extra.qoreAndroidMapsReady,false);
  assert.deepEqual(result.plugins,['expo-router']);
 });
});
test('QA identity is preserved and a bound Android key opt-in only',()=>{
 inEnv({QORE_QA_BUILD:'true',QORE_NATIVE_MAPS_APPROVED:'true',
  QORE_ANDROID_MAPS_API_KEY:'AIza'+'a'.repeat(35)},()=>{
  const result=configure({config:base});
  assert.equal(result.android.package,'com.movetefacil.cliente.qa');
  assert.equal(result.extra.liveOperationsEnabled,false);
  assert.equal(result.extra.qoreAndroidMapsReady,true);
  assert.equal(result.plugins.length,2);
  assert.equal(result.plugins[1][0],'react-native-maps');
 });
});

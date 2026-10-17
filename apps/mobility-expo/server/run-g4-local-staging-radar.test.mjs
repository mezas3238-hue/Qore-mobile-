import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const runner=fileURLToPath(new URL('./run-g4-local-staging-radar.mjs',import.meta.url));
function attempt(extra={}){
 const env={
  PATH:process.env.PATH??'/usr/bin',
  NODE_ENV:'test',
  ...extra
 };
 return spawnSync(process.execPath,[runner],{
  env,encoding:'utf8',timeout:5000,
 });
}
test('G4 CLI refuses to listen unless manual QA flag explicitly true',()=>{
 const out=attempt({});
 assert.notEqual(out.status,0);
 assert.match(out.stderr,/QORE_G4_LOCAL_QA_ONLY/);
 assert.doesNotMatch(out.stdout,/listening|enabled|sb_secret/);
});
test('G4 CLI blocks missing staging env BEFORE any network request or TCP listener',()=>{
 const out=attempt({QORE_G4_LOCAL_QA_ONLY:'true'});
 assert.notEqual(out.status,0);
 assert.match(out.stderr,/isolated staging/);
 assert.doesNotMatch(out.stdout,/listening|enabled|sb_secret/);
});
test('G4 CLI blocks LIVE_TRIPS_ENABLED=true even if local QA was explicitly authorized',()=>{
 const out=attempt({
  QORE_G4_LOCAL_QA_ONLY:'true',
  QORE_MOBILITY_ENV:'staging',
  LIVE_TRIPS_ENABLED:'true'
 });
 assert.notEqual(out.status,0);
 assert.match(out.stderr,/isolated staging/);
 assert.doesNotMatch(out.stdout,/listening|enabled/);
});

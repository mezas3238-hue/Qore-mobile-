import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {evaluateLaunchManifest,REQUIRED}
 from './check-movete-launch-gates.mjs';
const path=new URL('../docs/architecture/MOVETE_FACIL_LAUNCH_GATES_2026-10-24.json',import.meta.url);
const manifest=JSON.parse(readFileSync(path,'utf8'));
test('G61 launch gate unambiguously NO_GO despite previous 4/4 green QA',()=>{
 const report=evaluateLaunchManifest(manifest);
 assert.equal(report.decision,'NO_GO');
 assert.equal(report.total,17);
 assert.equal(report.verified,0);
 assert.equal(report.blocked.includes('HTTPS_BACKEND'),true);
 assert.equal(report.blocked.includes('PAYMENT_SETTLEMENT'),true);
 assert.equal(report.blocked.includes('NATIVE_RELEASES'),true);
 assert.equal(report.blocked.includes('OWNER_GO_LIVE_AUTHORIZATION'),true);
 assert.deepEqual(report.errors,[]);
 assert.equal(new Set(REQUIRED).size,REQUIRED.length);
});
test('G61 CLI explicit --require-go exits with nonzero when not ready',()=>{
 let failure;
 try{
  execFileSync(process.execPath,[
   'scripts/check-movete-launch-gates.mjs','--require-go'
  ],{cwd:new URL('../',import.meta.url),encoding:'utf8'});
 }catch(e){failure=e;}
 assert.equal(failure?.status,2);
 assert.match(failure.stdout,/NO_GO/);
});
test('G61 false owner checkbox cannot override incomplete concrete release evidence',()=>{
 for(const altered of [
  {...manifest,decision:'GO',ownerGoLiveAuthorization:true},
  {...manifest,blockers:[]},
  {...manifest,blockers:manifest.blockers.filter(x=>x.id!=='HTTPS_BACKEND')},
  {...manifest,blockers:[...manifest.blockers,manifest.blockers[0]]},
  {...manifest,blockers:manifest.blockers.map(x=>({...x,status:'verified'}))}
 ]){
  const report=evaluateLaunchManifest(altered);
  assert.equal(report.decision,'NO_GO');
 }
});
test('G61 synthetic full-ready manifest requires all independent reviews and Owner approval reference',()=>{
 const all={...manifest,decision:'GO',ownerGoLiveAuthorization:true,
  ownerApprovalReference:'https://github.com/example/qore/issues/9#issuecomment-123',
  blockers:manifest.blockers.map(gate=>({...gate,
   status:'verified',reviewUrl:'https://review.movetefacil.example/release/'+gate.id}))};
 const report=evaluateLaunchManifest(all);
 assert.equal(report.decision,'GO');
 assert.equal(report.verified,REQUIRED.length);
 assert.deepEqual(report.errors,[]);
 assert.equal(report.blocked.length,0);
 const missing={...all,ownerApprovalReference:undefined};
 assert.equal(evaluateLaunchManifest(missing).decision,'NO_GO');
 const untrusted={...all,blockers:all.blockers.map(x=>
  x.id==='NATIVE_RELEASES'?{...x,reviewUrl:'https://github.com/x/y/actions/runs/123'}:x)};
 assert.equal(evaluateLaunchManifest(untrusted).decision,'NO_GO');
});

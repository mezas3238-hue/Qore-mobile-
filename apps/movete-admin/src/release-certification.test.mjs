import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assessMoveteReleaseRegistry,MANDATORY_GATES,MANDATORY_FLOWS,
 EVIDENCE_KINDS} from './release-certification.mjs';

const registry=()=>JSON.parse(readFileSync(new URL(
 '../../../docs/architect-b/CERTIFICACION_INTEGRAL_R60_MATRIZ_VERIFICABLE_2026-10-24.json',
 import.meta.url),'utf8'));
const verify=reg=>assessMoveteReleaseRegistry(reg);
const copy=x=>JSON.parse(JSON.stringify(x));
const SHA='a631eb8444370f1fafaf8773778ac40505c60f18';
const envFor=kind=>({
 DOMAIN_CI:'CI_QA',API_CONTRACT:'STAGING',
 NEGATIVE_SECURITY:'STAGING',STAGING_E2E:'STAGING',
 ANDROID_DEVICE:'ANDROID_PHYSICAL',IOS_DEVICE:'IOS_PHYSICAL',
 POSTGRES_DURABILITY:'STAGING',LEGAL_REVIEW:'PRODUCTION_READINESS_REVIEW',
 OPS_EXERCISE:'STAGING',PSP_RECONCILIATION:'STAGING',
 OWNER_SIGNOFF:'PRODUCTION_READINESS_REVIEW'
})[kind]??'CI_QA';
const proof=kind=>({kind,result:'PASS',commitSha:SHA,
 url:'https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40107176156',
 environment:envFor(kind),verifiedBy:'independent-auditor',
 executedAt:'2026-10-24T16:00:00Z'});

test('R60 official P0 inventory: 17 gates, 20 flows and unambiguous NO_GO',()=>{
 const x=registry(),r=verify(x);
 assert.equal(x.gates.length,MANDATORY_GATES.length);
 assert.equal(x.flows.length,MANDATORY_FLOWS.length);
 assert.equal(r.structurallyValid,true,JSON.stringify(r.problems));
 assert.equal(r.decision,'NO_GO');
 assert.equal(r.releaseAuthorized,false);
 assert.equal(r.readyForIndependentAudit,false);
 assert.deepEqual(r.gateCounts,{blocked:15,qaOnly:2,certified:0});
 assert.deepEqual(r.flowCounts,{blocked:20,qaOnly:0,certified:0});
 assert.equal(x.release.ownerGoLiveAuthorization,false);
});
test('R60 mirror exactly matches authoritative A gate IDs and source states',()=>{
 const x=registry();
 const master=JSON.parse(readFileSync(new URL(
  '../../../docs/architecture/MOVETE_FACIL_LAUNCH_GATES_2026-10-24.json',
  import.meta.url),'utf8'));
 assert.equal(master.decision,'NO_GO');
 assert.equal(master.ownerGoLiveAuthorization,false);
 assert.equal(master.blockers.length,MANDATORY_GATES.length);
 for(const gate of x.gates){
  const official=master.blockers.find(o=>o.id===gate.id);
  assert.ok(official,'Missing in authoritative A registry: '+gate.id);
  assert.equal(gate.sourceStatus,official.status);
  assert.equal(gate.owner,official.owner);
 }
});
test('R60 no CI proofs can override a sovereign blocked gate',()=>{
 const x=registry();
 x.gates[0].status='CERTIFIED';
 x.gates[0].evidence=x.gates[0].requiredEvidence.map(proof);
 const r=verify(x);
 assert.ok(r.problems.includes('SOURCE_GATE_NOT_CERTIFIED'));
 assert.equal(r.decision,'NO_GO');
});
test('R60 source inventory uses pinned GitHub commit, no placeholder or LIVE',()=>{
 const x=registry();
 assert.match(x.source.commitSha,/^[0-9a-f]{40}$/);
 assert.match(x.source.repository,/Qore-mobile-/);
 assert.equal(x.release.decision,'NO_GO');
 assert.equal(x.source.path,
  'docs/architecture/MOVETE_FACIL_LAUNCH_GATES_2026-10-24.json');
});
test('R60 removing a critical P0 gate denies structural certification',()=>{
 const x=registry();x.gates.shift();
 const r=verify(x);
 assert.equal(r.structurallyValid,false);
 assert.ok(r.problems.includes('MISSING_OR_DUPLICATED_CRITICAL_GATE'));
 assert.equal(r.decision,'NO_GO');
});
test('R60 duplicated gate cannot hide a missing one',()=>{
 const x=registry();x.gates[1]=copy(x.gates[0]);
 assert.equal(verify(x).structurallyValid,false);
});
test('R60 removing a functional circuit is not allowed',()=>{
 const x=registry();x.flows.splice(4,1);
 assert.ok(verify(x).problems.includes('MISSING_OR_DUPLICATED_FUNCTIONAL_FLOW'));
});
test('R60 Owner GO or boolean approval without evidence rejected',()=>{
 for(const change of [
  {ownerGoLiveAuthorization:true},
  {decision:'GO'},
  {ownerGoLiveAuthorization:true,decision:'GO'}
 ]){
  const x=registry();Object.assign(x.release,change);
  const r=verify(x);
  assert.equal(r.structurallyValid,false);
  assert.equal(r.decision,'NO_GO');
  assert.equal(r.releaseAuthorized,false);
 }
});
test('R60 calling a P0 CERTIFIED without required proofs is structurally invalid',()=>{
 const x=registry();
 x.gates[0].status='CERTIFIED';
 const r=verify(x);
 assert.ok(r.problems.includes('UNSUPPORTED_GATE_CERTIFICATION'));
 assert.equal(r.decision,'NO_GO');
});
test('R60 a verified unit test alone never counts as native E2E or legal proof',()=>{
 const x=registry();
 const f=x.flows.find(x=>x.id==='SIGNED_NATIVE_RELEASES');
 f.status='CERTIFIED';
 f.evidence=[proof('DOMAIN_CI')];
 const r=verify(x);
 assert.ok(r.problems.includes('UNSUPPORTED_FLOW_CERTIFICATION'));
 assert.ok(r.problems.includes('FLOW_DEPENDS_ON_UNCERTIFIED_GATE'));
});
test('R60 rejects forged Github links and malformed SHA in evidence',()=>{
 for(const patch of [
  {url:'http://github.com/mezas3238-hue/Qore-mobile-/actions/runs/1'},
  {url:'https://evil.example.com/verified'},
  {url:'https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/1?token=x'},
  {commitSha:'HEAD'},
  {verifiedBy:'Bearer private token'}
 ]){
  const x=registry();x.gates[1].evidence=[{...proof('DOMAIN_CI'),...patch}];
  assert.ok(verify(x).problems.includes('INVALID_GATE_EVIDENCE_OR_STATUS'));
 }
});
test('R60 web CI cannot masquerade as Android, iOS or real STAGING E2E',()=>{
 for(const kind of ['ANDROID_DEVICE','IOS_DEVICE','STAGING_E2E',
  'LEGAL_REVIEW','OWNER_SIGNOFF']){
  const x=registry();
  x.gates[0].evidence=[{...proof(kind),environment:'CI_QA'}];
  assert.equal(verify(x).structurallyValid,false);
 }
});
test('R60 evidence cannot use undefined categories or string success flags',()=>{
 const x=registry();
 x.flows[0].evidence=[{...proof('NOT_REAL'),result:'SUCCESS'}];
 assert.ok(verify(x).problems.includes('INVALID_FUNCTIONAL_FLOW'));
});
test('R60 cross-role safety and all product surfaces are mandatory cases',()=>{
 const x=registry();
 for(const id of ['AUTH_PASSENGER','AUTH_DRIVER_KYC','AUTO_BOOKING',
  'MOTO_CARGO_DELIVERY','SUPERMARKET_ORDER','PHARMACY_OTC_ORDER',
  'RESTAURANT_ORDER','CUSTOMER_DRIVER_CHAT','PAYMENTS_REFUNDS',
  'ADMIN_KYC_ZONES','EMERGENCY_RESPONSE','SIGNED_NATIVE_RELEASES']){
  assert.ok(x.flows.some(c=>c.id===id));
 }
 for(const f of x.flows){
  assert.ok(f.requiredGates.every(id=>MANDATORY_GATES.includes(id)));
  assert.ok(f.requiredEvidence.every(kind=>EVIDENCE_KINDS.includes(kind)));
  assert.ok(f.acceptance.length>35);
 }
});
test('R60 fake labels and unknown acceptance owners fail closed',()=>{
 const x=registry();x.flows[0].owner='external_unknown';
 assert.equal(verify(x).structurallyValid,false);
 const y=registry();y.gates[0].status='NEARLY_CERTIFIED';
 assert.equal(verify(y).structurallyValid,false);
});
test('R60 even all structured proofs do NOT authorize LIVE automatically',()=>{
 const x=registry();
 for(const g of x.gates){
  g.sourceStatus='certified';g.status='CERTIFIED';
  g.evidence=g.requiredEvidence.map(proof);
 }
 for(const f of x.flows){
  f.status='CERTIFIED';f.evidence=f.requiredEvidence.map(proof);
 }
 const r=verify(x);
 assert.equal(r.structurallyValid,true,JSON.stringify(r.problems));
 assert.equal(r.readyForIndependentAudit,true);
 assert.equal(r.decision,'NO_GO');
 assert.equal(r.releaseAuthorized,false);
});
test('R60 unknown, absent or malformed manifest never returns GO',()=>{
 for(const x of [null,undefined,false,{},[],
  {schemaVersion:'qore-mobile-r60-v1'}]){
  const r=verify(x);
  assert.equal(r.decision,'NO_GO');
  assert.equal(r.structurallyValid,false);
 }
});

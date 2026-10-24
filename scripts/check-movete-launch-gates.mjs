#!/usr/bin/env node
/**
 * Independent production GO/NO-GO gate.
 * CI passing QA never converts this to GO. Run:
 *   node scripts/check-movete-launch-gates.mjs
 *   node scripts/check-movete-launch-gates.mjs --require-go
 *   node scripts/check-movete-launch-gates.mjs --json
 * Only a reviewed manifest with every real-world gate VERIFIED and explicit
 * Owner consent can produce a GO. No runtime credentials or deployments.
 */
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
const here=dirname(fileURLToPath(import.meta.url));
const DEFAULT=resolve(here,'../docs/architecture/MOVETE_FACIL_LAUNCH_GATES_2026-10-24.json');
export const REQUIRED=Object.freeze([
 'IDP_BACKEND_AUTH','HTTPS_BACKEND','POSTGRES_PERSISTENCE',
 'DRIVER_ONBOARDING','DRIVER_LIVE_TRIPS','CLIENT_LIVE_BOOKINGS',
 'PAYMENT_SETTLEMENT','PRIVACY_KYC','EMERGENCY_SAFETY',
 'MAPS_GPS_DEVICE','DELIVERY_MERCHANTS','CHAT_PHYSICAL',
 'ADMIN_OPERATIONS','NATIVE_RELEASES','LEGAL_COMPLIANCE',
 'OPS_24_7_MONITORING','PROD_GO_NOGO'
]);
export function evaluateLaunchManifest(input){
 const errors=[];
 if(input===null||typeof input!=='object'||Array.isArray(input))
  return Object.freeze({decision:'NO_GO',verified:0,total:REQUIRED.length,
   blocked:REQUIRED,errors:['invalid manifest']});
 const rows=input.blockers;
 if(!Array.isArray(rows)||rows.length!==REQUIRED.length)
  errors.push('gate catalog missing/extra');
 const ids=new Set(),missing=new Set(REQUIRED),blocked=[];
 let verified=0;
 for(const item of Array.isArray(rows)?rows:[]){
  if(!item||typeof item!=='object'||Array.isArray(item)||
   typeof item.id!=='string'||ids.has(item.id)||!missing.has(item.id)){
   errors.push('unknown or duplicate gate identifier');
   continue;
  }
  ids.add(item.id);missing.delete(item.id);
  if(!['verified','blocked','qa-only'].includes(item.status)||
   typeof item.evidence!=='string'||item.evidence.length<20||
   !['A','B','A/B','Owner','Owner/A/B'].includes(item.owner))
   errors.push('invalid evidence/owner/status for '+item.id);
  if(item.status==='verified'){
   verified++;
   // A production verified claim needs a review URL, not just "QA PASS".
   if(typeof item.reviewUrl!=='string'||
    !/^https:\/\/[a-z0-9.-]+\/[A-Za-z0-9/_#?&=.%+-]+$/i.test(item.reviewUrl)||
    /localhost|127\.0\.0\.1|example\.|actions\/runs/.test(item.reviewUrl))
    errors.push('missing independent production review link: '+item.id);
  }else blocked.push(item.id);
 }
 for(const id of missing)errors.push('missing gate '+id);
 if(input.ownerGoLiveAuthorization!==true)
  blocked.push('OWNER_GO_LIVE_AUTHORIZATION');
 if(input.decision!=='GO')blocked.push('DECLARED_NO_GO');
 if(input.ownerGoLiveAuthorization===true&&
  (typeof input.ownerApprovalReference!=='string'||
   !/^https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/\d+#issuecomment-\d+$/.test(input.ownerApprovalReference)))
  errors.push('signed Owner approval evidence missing');
 const canGo=errors.length===0&&blocked.length===0&&
  verified===REQUIRED.length&&input.ownerGoLiveAuthorization===true;
 return Object.freeze({
  decision:canGo?'GO':'NO_GO',
  verified,total:REQUIRED.length,blocked:Object.freeze([...blocked]),
  errors:Object.freeze([...errors])
 });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=new Set(process.argv.slice(2));
 const allowed=new Set(['--json','--require-go']);
 if([...args].some(arg=>!allowed.has(arg))){
  process.stderr.write('Usage: node scripts/check-movete-launch-gates.mjs [--json] [--require-go]\n');
  process.exitCode=2;
 }else{
  let output;
  try{
   const parsed=JSON.parse(readFileSync(DEFAULT,'utf8'));
   output=evaluateLaunchManifest(parsed);
  }catch{
   output={decision:'NO_GO',verified:0,total:REQUIRED.length,
    blocked:REQUIRED,errors:['launch manifest unreadable']};
  }
  if(args.has('--json'))process.stdout.write(JSON.stringify(output,null,2)+'\n');
  else{
   process.stdout.write('MOVETE FÁCIL — '+output.decision+
    ' | launch gates '+output.verified+'/'+output.total+' verified\n');
   for(const id of output.blocked)process.stdout.write(' - PENDING '+id+'\n');
   for(const issue of output.errors)process.stdout.write(' ! INVALID '+issue+'\n');
   process.stdout.write('QA SUCCESS DOES NOT AUTHORIZE PRODUCTION.\n');
  }
  if(output.errors.length>0||(args.has('--require-go')&&output.decision!=='GO'))
   process.exitCode=2;
 }
}

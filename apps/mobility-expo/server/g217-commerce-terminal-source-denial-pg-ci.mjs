/** G217: *actual* original G45/G150 source must DENY terminal Admin
 * receipt until its G10/G67/G187 linked delivery really completes.
 * This deliberately tests a negative gate, never pretends 5/5 E2E.
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
if(process.env.CI!=='true'||process.env.PGHOST!=='localhost'||
 process.env.PGPORT!=='5432'||process.env.PGDATABASE!=='qore_disposable_chain'||
 process.env.PGAPPNAME!=='qore_ci_disposable_chain')
 throw Error('G217 requires disposable PG16 and published G202 original sources');
const psql=x=>execFileSync('psql',['-X','-q','-A','-t','-v',
 'ON_ERROR_STOP=1','-c',x],{encoding:'utf8',timeout:15000})
 .trim().split('\n').at(-1)?.trim()??'';
const manifest=JSON.parse(readFileSync('/tmp/qore-g202-five-original-journeys-qa.json','utf8'));
const commerce=manifest.services.find(s=>s.serviceKind==='COMMERCE');
assert(commerce?.originalServiceId&&commerce?.linkedCommerceDeliveryId);
const admin=psql("SELECT user_id::text FROM public.mobility_stage_backoffice_roles "+
 "WHERE role='admin' AND status='active' AND "+
 "public.mobility_stage_g27_backoffice_role_of(user_id)='admin' "+
 "ORDER BY user_id LIMIT 1");
const signature='public.mobility_stage_g217_commerce_terminal_admin_qa(uuid,uuid)';
assert.equal(psql("SELECT has_function_privilege('service_role','"+signature+"','EXECUTE')::text"),'true');
for(const role of ['anon','authenticated']){
 assert.equal(psql("SELECT has_function_privilege('"+role+"','"+signature+"','EXECUTE')::text"),'false');
}
const order=commerce.originalServiceId;
const before=psql("SELECT status::text||':'||revision::text||':'||delivery_id::text "+
 "FROM public.mobility_stage_merchant_orders WHERE id='"+order+"'");
const actual=psql("SET ROLE service_role; SELECT COALESCE(public."+
 "mobility_stage_g217_commerce_terminal_admin_qa('"+admin+"','"+order+
 "')::text,'null')");
assert.equal(actual,'null','never turn original ready merchant into delivered without recipient proof');
const foreign=psql("SET ROLE service_role; SELECT COALESCE(public."+
 "mobility_stage_g217_commerce_terminal_admin_qa('"+
 "21700000-0000-4217-8217-000000000999','"+order+"')::text,'null')");
assert.equal(foreign,'null','foreign Admin denied');
const after=psql("SELECT status::text||':'||revision::text||':'||delivery_id::text "+
 "FROM public.mobility_stage_merchant_orders WHERE id='"+order+"'");
assert.equal(after,before,'terminal verification is read-only');
console.log('G217 VERIFIED FAIL-CLOSED: original G45 order '+order+
 ' still has no terminal G10/G67/G187 recipient proof; QA closure remains OPEN');

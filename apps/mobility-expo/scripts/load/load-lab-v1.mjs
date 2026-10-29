/**
 * QORE LOAD LAB V1: current Render STAGING ingress -> real G4 Node HTTP router.
 * Downstream handlers are deliberately inert synthetic fixtures; NO DB/Auth,
 * driver, merchant, maps, payment or commercial operation is contacted.
 * Both servers listen ONLY on 127.0.0.1; no target URLs or secrets accepted.
 * A PASS is a local transport result, NEVER end-to-end production readiness.
 */
import {once} from 'node:events';
import {request,Agent} from 'node:http';
import {performance} from 'node:perf_hooks';
import {mkdir,writeFile,appendFile} from 'node:fs/promises';
import {createRenderStagingIngress} from '../../server/render-staging-ingress.mjs';
import {createQoreRadarLoopbackTransport,listenQoreRadarLoopback}
 from '../../server/g4-loopback-http-transport.mjs';

const HOST='qore-isolated-load-lab.onrender.com';
const PATH='/v1/staging/driver/inbox';
const OUTPUT='artifacts/qore-load-lab/results.json';
const mode=process.argv.length===2&&process.argv[1].endsWith('load-lab-v1.mjs')?
 'smoke':process.argv.length===3&&['--smoke','--stress'].includes(process.argv[2])?
 process.argv[2].slice(2):null;
if(!mode)throw Error('Only --smoke or --stress are accepted. No external URL support.');
const steps=mode==='stress'?
 [{requests:500,concurrency:25},{requests:2000,concurrency:80},
  {requests:3000,concurrency:120}]:
 [{requests:300,concurrency:20},{requests:1200,concurrency:60}];
const noop=async()=>({status:404,body:{error:'Not found'}});
const backend=createQoreRadarLoopbackTransport({
 riderHandler:noop,offerHandler:noop,tripCommandHandler:noop,
 deliveryHandler:noop,merchantHandler:noop,financeHandler:noop,
 safetyHandler:noop,merchantManagementHandler:noop,deliveryOfferHandler:noop,
 driverInboxHandler:async()=>({
  status:200,body:{scope:'INERT_SYNTHETIC_NO_DB',qaOnly:true,
   productionEnabled:false,offers:[]}
 })
});
const agent=new Agent({keepAlive:true,maxSockets:150,maxFreeSockets:50});
const percentile=(values,p)=>{
 if(!values.length)return null;
 const s=[...values].sort((a,b)=>a-b);
 return Math.round(s[Math.ceil(s.length*p)-1]*100)/100;
};
const seenStatuses=(items)=>{
 const counts={};for(const item of items){
  const k=String(item.status);counts[k]=(counts[k]??0)+1;
 }return counts;
};
function oneCall(port,identity){
 const start=performance.now();
 return new Promise(resolve=>{
  let settled=false;
  const done=(status,body='',error=null)=>{
   if(settled)return;settled=true;
   resolve({status,ms:performance.now()-start,
    valid:status===200&&body.includes('INERT_SYNTHETIC_NO_DB'),
    error});
  };
  const req=request({
   hostname:'127.0.0.1',port,path:PATH,method:'GET',agent,
   headers:{host:HOST,'x-forwarded-proto':'https',
    authorization:'Bearer lab_identity_only_'+identity}
  },res=>{
   let body='';
   res.setEncoding('utf8');
   res.on('data',part=>{if(body.length<4096)body+=part;});
   res.on('end',()=>done(res.statusCode??0,body));
   res.on('error',error=>done(0,'',error.message));
  });
  req.setTimeout(8000,()=>req.destroy(new Error('LOAD_LAB_TIMEOUT')));
  req.on('error',error=>done(0,'',error.message));
  req.end();
 });
}
async function batch(port,scenario,offset){
 const values=new Array(scenario.requests);
 const started=performance.now();
 let cursor=0;
 const workers=Array.from({length:scenario.concurrency},async()=>{
  while(true){
   const index=cursor++;
   if(index>=scenario.requests)return;
   values[index]=await oneCall(port,'s'+offset+'r'+index);
  }
 });
 await Promise.all(workers);
 const durationMs=performance.now()-started;
 const latencies=values.map(v=>v.ms);
 const counts=seenStatuses(values);
 const bad=values.filter(v=>v.status!==200||!v.valid);
 const throughput=Math.round(scenario.requests*1000/durationMs*100)/100;
 return {requests:scenario.requests,concurrency:scenario.concurrency,
  distinctSyntheticIdentities:scenario.requests,
  durationMs:Math.round(durationMs),requestsPerSecond:throughput,
  p50Ms:percentile(latencies,.5),p95Ms:percentile(latencies,.95),
  p99Ms:percentile(latencies,.99),
  statuses:counts,invalidResponses:bad.length,
  sampleErrors:bad.slice(0,3).map(v=>({status:v.status,error:v.error})),
  rssMiB:Math.round(process.memoryUsage().rss/1048576),
  passesTransportGate:bad.length===0&&percentile(latencies,.95)<=1500
 };
}
const report={
 lab:'QORE_ISOLATED_HTTP_LOAD_V1',mode,
 target:'127.0.0.1 ONLY',scope:'Render ingress -> real G4 HTTP router',
 downstream:'INERT_SYNTHETIC_NO_DB',
 auth:'SYNTHETIC, NOT VERIFIED',
 database:'NOT EXERCISED',mobileApps:'NOT EXERCISED',
 externalTraffic:false,commercialServicesEnabled:false,
 gitSha:process.env.GITHUB_SHA??'local',stages:[],verdict:'NOT_EXECUTED'
};
let ingress=null,base=null;
try{
 base=await listenQoreRadarLoopback(backend);
 ingress=createRenderStagingIngress({loopbackOrigin:base,expectedHost:HOST});
 ingress.listen(0,'127.0.0.1');
 await once(ingress,'listening');
 const address=ingress.address();
 if(!address||typeof address==='string'||address.address!=='127.0.0.1')
  throw Error('Refusing non-loopback load target');
 const port=address.port;
 // Verify the existing per-identity limiter with one synthetic identity.
 const probe=[];
 for(let i=0;i<92;i++)probe.push(await oneCall(port,'single-probe'));
 report.rateLimiterProbe=seenStatuses(probe);
 report.rateLimiterExpected=
  report.rateLimiterProbe['200']===90&&report.rateLimiterProbe['429']===2;
 let offset=0;
 for(const scenario of steps){
  const stage=await batch(port,scenario,offset);
  report.stages.push(stage);
  offset+=scenario.requests;
  console.log(JSON.stringify({stage:report.stages.length,...stage}));
 }
 report.totalRequests=offset;
 report.verdict=report.rateLimiterExpected&&
  report.stages.every(s=>s.passesTransportGate)?'LOCAL_TRANSPORT_PASS':
  'LOCAL_TRANSPORT_FAIL';
 report.productionReadiness='NOT_CERTIFIED';
} catch(error){
 report.verdict='LAB_EXECUTION_ERROR';
 report.executionError=String(error?.message??error);
} finally{
 agent.destroy();
 if(ingress?.listening)await new Promise(r=>ingress.close(()=>r()));
 if(backend?.listening)await new Promise(r=>backend.close(()=>r()));
 await mkdir('artifacts/qore-load-lab',{recursive:true});
 await writeFile(OUTPUT,JSON.stringify(report,null,2)+'\n','utf8');
 const summary=[
  '## QORE HTTP capacity lab V1 (synthetic downstream)',
  '**Verdict: '+report.verdict+'** — **Production certification: NOT CERTIFIED**',
  '',
  '| Requests | Concurrent workers | Requests/s | p95 (ms) | p99 (ms) | HTTP statuses | Gate |',
  '|---:|---:|---:|---:|---:|---|---|',
  ...report.stages.map(s=>'| '+s.requests+' | '+s.concurrency+' | '+
   s.requestsPerSecond+' | '+s.p95Ms+' | '+s.p99Ms+' | '+
   JSON.stringify(s.statuses)+' | '+(s.passesTransportGate?'PASS':'FAIL')+' |'),
  '',
  'Real Render ingress and G4 HTTP router, but **fake downstream handlers, no DB, no Auth, no app devices, no PSP, no GPS**.',
  'This job MUST NOT be interpreted as E2E commercial load certification.'
 ].join('\n')+'\n';
 if(process.env.GITHUB_STEP_SUMMARY)
  await appendFile(process.env.GITHUB_STEP_SUMMARY,summary,'utf8');
 console.log('QORE_LOAD_LAB_REPORT '+OUTPUT+' '+report.verdict);
}
if(report.verdict!=='LOCAL_TRANSPORT_PASS')process.exitCode=1;

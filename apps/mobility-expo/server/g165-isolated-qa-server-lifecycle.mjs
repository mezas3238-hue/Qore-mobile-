/** G165: bind QA-only localhost HTTP and the G113 due worker as one
 * lifecycle, avoiding orphaned retries after server shutdown. No public
 * listener, production timer, PSP, deployment or legal/KYC bypass.
 * The opt-in worker is created separately by the guarded G4 runtime.
 */
import {listenQoreRadarLoopback} from './g4-loopback-http-transport.mjs';
export const G165_LIVE_ENABLED=false;

export async function listenG165IsolatedQaRuntime({server,worker=null,port=0}={}){
 if(!server||typeof server.listen!=='function'||
  typeof server.close!=='function'||server.listening===true||
  !Number.isSafeInteger(port)||port<0||port>65535||
  (port!==0&&port<1024)||
  (worker!==null&&(typeof worker.start!=='function'||
   typeof worker.stop!=='function'||typeof worker.snapshot!=='function')))
  throw Error('G165 requires one unbound loopback QA server');
 if(worker!==null){
  const state=worker.snapshot();
  if(!state||state.qaOnly!==true||state.productionEnabled!==false||
    state.running!==false||state.maxJobs>10||state.intervalMs<15000)
   throw Error('G165 refuses unsafe AUTO dispatch worker');
 }
 const stop=()=>{try{worker?.stop();}catch{/* deny background work */}};
 // Installed BEFORE binding to handle unexpected close and process errors.
 server.once('close',stop);
 try{
  const base=await listenQoreRadarLoopback(server,port);
  if(worker!==null&&worker.start()!==true)
   throw Error('G165 retry worker did not start');
  return base;
 }catch(error){
  stop();
  server.removeListener('close',stop);
  if(server.listening)await new Promise(resolve=>{
   try{server.close(()=>resolve());}catch{resolve();}
  });
  throw error;
 }
}

/** Movete Fácil Driver — private KYC review status, LOCAL QA ONLY.
 * One-shot read with externally supplied verified session bearer. No document
 * images, paths, object hashes, reviewer identities, or secret storage.
 */
export const DRIVER_DOCUMENTS_LIVE_ENABLED=false;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BEARER=/^[A-Za-z0-9._~-]{20,7900}$/;
const KINDS=new Set(['licencia','identidad_frente','identidad_dorso',
 'cedula_verde','seguro','inspeccion','habilitacion']);
const STATES=new Set(['pending','approved','rejected']);
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
export async function readDriverDocumentStatuses({
 apiOrigin,accessToken,request=fetch
}={}){
 if(typeof apiOrigin!=='string'||typeof accessToken!=='string'||
    !BEARER.test(accessToken)||typeof request!=='function')
  throw Error('Driver document session missing');
 let origin;
 try{origin=new URL(apiOrigin);}catch{throw Error('Invalid Driver QA origin');}
 if(origin.protocol!=='http:'||origin.hostname!=='127.0.0.1'||!origin.port||
    origin.pathname!=='/'||origin.search||origin.hash||origin.username||origin.password)
  throw Error('Driver documents require isolated localhost QA');
 let response;
 try{
  response=await request(origin.origin+'/v1/staging/driver/documents',{
   method:'GET',cache:'no-store',credentials:'omit',
   headers:{authorization:'Bearer '+accessToken,accept:'application/json'}
  });
 }catch{throw Error('Driver document status unavailable');}
 if(response?.status===401)throw Error('Driver session expired');
 if(response?.status===403)throw Error('Driver role not authorized');
 if(response?.status!==200)throw Error('Driver document status unavailable');
 let body;
 try{body=await response.json();}catch{throw Error('Invalid private document response');}
 if(!plain(body)||Object.keys(body).length!==3||
    body.mode!=='STAGING_DEMO_ONLY'||body.liveOperationsEnabled!==false||
    !Array.isArray(body.documents)||body.documents.length>7)
  throw Error('Invalid private document response');
 const seen=new Set(),statuses=[];
 for(const item of body.documents){
  if(!plain(item)||Object.keys(item).length!==4||
     !KINDS.has(item.kind)||!STATES.has(item.status)||
     !Number.isSafeInteger(item.submittedAtMs)||
     !(item.reviewedAtMs===null||Number.isSafeInteger(item.reviewedAtMs))||
     (item.status==='pending')!==(item.reviewedAtMs===null)||
     seen.has(item.kind))
   throw Error('Invalid private document status');
  seen.add(item.kind);
  statuses.push(Object.freeze({kind:item.kind,status:item.status,
   submittedAtMs:item.submittedAtMs,reviewedAtMs:item.reviewedAtMs}));
 }
 return Object.freeze(statuses);
}

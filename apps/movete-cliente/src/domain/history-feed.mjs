/**
 * Historial de Cliente: lectura mínima por usuario verificado. No genera
 * comprobantes monetarios, no recurre a caché de otras cuentas y no persiste.
 * DTO pendiente de certificación servidor por Arquitecto A.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid=x=>typeof x==='string'&&UUID.test(x);
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const allow=(x,keys)=>object(x)&&Object.keys(x).every(k=>keys.includes(k));
const CURSOR=/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/;
const types=new Set(['RIDE','DELIVERY','MERCHANT_ORDER']);
const states=new Set(['searching','assigned','in_progress','completed','cancelled','failed']);
const attrs=['serviceId','kind','status','createdAt','revision'];
export function projectClientHistory(raw,{subject,now=Date.now()}={}){
 if(!allow(raw,['ownerId','generatedAt','expiresAt','items','nextCursor'])
   ||!uuid(subject)||raw.ownerId!==subject
   ||!Number.isSafeInteger(raw.generatedAt)||raw.generatedAt>now||raw.generatedAt<now-300000
   ||!Number.isSafeInteger(raw.expiresAt)||raw.expiresAt<=now||raw.expiresAt>now+300000
   ||!Array.isArray(raw.items)||raw.items.length>50
   ||!(raw.nextCursor===null||(typeof raw.nextCursor==='string'&&raw.nextCursor.length<=200&&CURSOR.test(raw.nextCursor))))return null;
 const out=[],seen=new Set();
 for(const item of raw.items){
  if(!allow(item,attrs)||!attrs.every(k=>Object.hasOwn(item,k))
    ||!uuid(item.serviceId)||seen.has(item.kind+':'+item.serviceId)
    ||!types.has(item.kind)||!states.has(item.status)
    ||!Number.isSafeInteger(item.createdAt)||item.createdAt<0||item.createdAt>now
    ||!Number.isSafeInteger(item.revision)||item.revision<1)return null;
  seen.add(item.kind+':'+item.serviceId);
  out.push(Object.freeze({...item}));
 }
 return Object.freeze({ownerId:subject,expiresAt:raw.expiresAt,
  nextCursor:raw.nextCursor,items:Object.freeze(out)});
}
export function createClientHistoryStore({now=()=>Date.now(),maxItems=500}={}){
 // El historial global vive en servidor. El móvil conserva solo una ventana
 // para evitar crecimiento lineal de memoria al recorrer años de servicios.
 const limit=Number.isSafeInteger(maxItems)&&maxItems>=50&&maxItems<=5000?maxItems:500;
 let owner=null,entries=new Map(),expiry=null,nextCursor=null,cachedItems=null;
 let evictedCount=0,rowsRead=0;
 function clear(){
  owner=null;entries.clear();expiry=null;nextCursor=null;cachedItems=null;
  evictedCount=0;rowsRead=0;
 }
 function trimToWindow(){
  if(entries.size<=limit)return;
  const sorted=[...entries.entries()].sort(([,a],[,b])=>
   b.createdAt-a.createdAt||a.serviceId.localeCompare(b.serviceId)||a.kind.localeCompare(b.kind));
  const overflow=sorted.length-limit;
  // Las páginas siguientes son más antiguas. Se desplazan los registros más
  // recientes ya vistos y se conserva la ventana que el usuario está recorriendo.
  for(const [key] of sorted.slice(0,overflow))entries.delete(key);
  evictedCount+=overflow;
 }
 function consume(raw,subject,{append=false}={}){
  const page=projectClientHistory(raw,{subject,now:now()});
  if(!page){clear();return false;}
  if(owner!==null&&owner!==subject){clear();return false;}
  if(!append){entries.clear();evictedCount=0;rowsRead=0;}
  rowsRead+=page.items.length;
  for(const item of page.items){
   const key=item.kind+':'+item.serviceId;
   const prior=entries.get(key);
   if(!prior||item.revision>prior.revision)entries.set(key,item);
  }
  trimToWindow();
  owner=subject;expiry=page.expiresAt;nextCursor=page.nextCursor;cachedItems=null;
  return true;
 }
 function current(subject){
  if(!uuid(subject)||owner!==subject||expiry===null||expiry<=now()){clear();return null;}
  if(cachedItems===null)cachedItems=Object.freeze([...entries.values()]
    .sort((a,b)=>b.createdAt-a.createdAt||a.serviceId.localeCompare(b.serviceId)||a.kind.localeCompare(b.kind)));
  return Object.freeze({ownerId:owner,items:cachedItems,nextCursor,
   window:Object.freeze({maxItems:limit,evictedCount,rowsRead,
    hasEvictedNewer:evictedCount>0})});
 }
 return Object.freeze({consume,current,clear});
}

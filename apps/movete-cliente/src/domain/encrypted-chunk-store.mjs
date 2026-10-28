/**
 * Encrypted native secure-session storage. Supabase Auth sessions often exceed
 * a single SecureStore value size; split ASCII percent-encoded payload across
 * independent Keychain/Keystore entries without AsyncStorage fallback.
 *
 * Two-phase atomic manifest: each write owns a fresh generation; old data
 * remains authoritative until every new part is safely committed.
 * All operations are serialized. No session/password/JWT ever enters logs.
 */
const ID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const KEY=/^[A-Za-z0-9_.-]{1,100}$/;
const CHUNK=1400,MAX_CHUNKS=32;
const valid=x=>x&&typeof x==='object'&&!Array.isArray(x)
 &&x.v===1&&typeof x.g==='string'&&ID.test(x.g)
 &&Number.isSafeInteger(x.n)&&x.n>=1&&x.n<=MAX_CHUNKS
 &&Number.isSafeInteger(x.len)&&x.len>=1&&x.len<=MAX_CHUNKS*CHUNK;
export function createEncryptedChunkStore({get,put,del,randomUUID,prefix}={}){
 if(typeof get!=='function'||typeof put!=='function'||
  typeof del!=='function'||typeof randomUUID!=='function'||
  typeof prefix!=='string'||!KEY.test(prefix))
  throw Error('Encrypted native storage dependencies missing');
 let pending=Promise.resolve();
 const atomic=work=>{
  const task=pending.then(work,work);
  pending=task.then(()=>{},()=>{});
  return task;
 };
 const base=key=>{
  if(typeof key!=='string'||!KEY.test(key))
   throw Error('Invalid auth storage key');
  return prefix+'_'+key;
 };
 const readManifest=async name=>{
  const raw=await get(name+'_manifest');
  if(raw===null||raw===undefined)return null;
  let m;try{m=JSON.parse(raw);}catch{throw Error('Corrupt auth manifest');}
  if(!valid(m))throw Error('Invalid auth manifest');
  return m;
 };
 const part=(name,g,i)=>name+'_'+g+'_'+i;
 const cleanup=async(name,m)=>{
  if(!m)return;
  for(let i=0;i<m.n;i++){
   try{await del(part(name,m.g,i));}catch{/* orphaned encrypted generation */ }
  }
 };
 return Object.freeze({
  getItem:key=>atomic(async()=>{
   const name=base(key),m=await readManifest(name);
   if(!m)return null;
   const pieces=[];
   for(let i=0;i<m.n;i++){
    const partValue=await get(part(name,m.g,i));
    if(typeof partValue!=='string'||partValue.length<1||partValue.length>CHUNK)
     throw Error('Incomplete secure auth session');
    pieces.push(partValue);
   }
   const encoded=pieces.join('');
   if(encoded.length!==m.len)throw Error('Mismatched auth session');
   try{return decodeURIComponent(encoded);}
   catch{throw Error('Invalid secure auth encoding');}
  }),
  setItem:(key,value)=>atomic(async()=>{
   const name=base(key);
   if(typeof value!=='string'||value.length===0)
    throw Error('Invalid auth session payload');
   const encoded=encodeURIComponent(value);
   if(encoded.length===0||encoded.length>CHUNK*MAX_CHUNKS)
    throw Error('Secure auth session exceeds storage budget');
   const n=Math.ceil(encoded.length/CHUNK),g=randomUUID();
   if(typeof g!=='string'||!ID.test(g))
    throw Error('Cryptographic generation unavailable');
   const old=await readManifest(name);
   if(old?.g===g)throw Error('Auth storage generation collision');
   const manifest=JSON.stringify({v:1,g,n,len:encoded.length});
   try{
    for(let i=0;i<n;i++)
     await put(part(name,g,i),encoded.slice(i*CHUNK,(i+1)*CHUNK));
    await put(name+'_manifest',manifest);
   }catch(error){
    await cleanup(name,{g,n});
    throw error;
   }
   await cleanup(name,old);
  }),
  removeItem:key=>atomic(async()=>{
   const name=base(key),old=await readManifest(name);
   // Removing the manifest FIRST immediately revokes the local session,
   // even if the platform fails to remove an orphaned encrypted part.
   await del(name+'_manifest');
   await cleanup(name,old);
  })
 });
}

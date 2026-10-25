import test from 'node:test';
import assert from 'node:assert/strict';
import {createEncryptedChunkStore} from './encrypted-chunk-store.mjs';
function fixture(){
 const saved=new Map(),operations=[];
 let counter=0,failWrite=null;
 const vault=createEncryptedChunkStore({
  prefix:'qa-auth-vault',
  randomUUID:()=> '77770000-0000-4777-8777-'+String(++counter).padStart(12,'0'),
  get:async k=>saved.get(k)??null,
  put:async(k,v)=>{
   operations.push(['put',k]);
   if(k===failWrite)throw Error('Native secure storage failed');
   saved.set(k,v);
  },
  del:async k=>{operations.push(['del',k]);saved.delete(k);}
 });
 return {vault,saved,operations,failAt:key=>{failWrite=key;}};
}
test('native Keychain stores full >1900 byte IdP session in bounded encrypted chunks',async()=>{
 const f=fixture(),session=JSON.stringify({access_token:'x'.repeat(7000),
  refresh_token:'r'.repeat(1200),user:{metadata:'ñ'.repeat(700)}});
 assert(session.length>1900);
 await f.vault.setItem('session',session);
 assert.equal(await f.vault.getItem('session'),session);
 assert.equal(f.saved.has('session'),false);
 assert.equal(f.saved.size>2,true);
 for(const v of f.saved.values())assert(Buffer.byteLength(v,'utf8')<=1400);
 assert([...f.saved.keys()].every(k=>k.startsWith('qa-auth-vault:session:')));
});
test('write manifest LAST, failed chunks preserve previous complete session',async()=>{
 const f=fixture();
 await f.vault.setItem('session','OLD_SESSION');
 f.failAt('qa-auth-vault:session:77770000-0000-4777-8777-000000000002:0');
 await assert.rejects(f.vault.setItem('session','NEW_SESSION'),/Native secure storage failed/);
 assert.equal(await f.vault.getItem('session'),'OLD_SESSION');
 assert.equal(f.saved.size,2,'Only old manifest and old encrypted generation remain');
});
test('failed manifest commit preserves old session and cleans new fragments',async()=>{
 const f=fixture();
 await f.vault.setItem('session','OLD');
 f.failAt('qa-auth-vault:session:manifest');
 await assert.rejects(f.vault.setItem('session','x'.repeat(7000)));
 assert.equal(await f.vault.getItem('session'),'OLD');
 assert.equal(f.saved.size,2);
});
test('relogin rotates encrypted generation; no plaintext or old session remains',async()=>{
 const f=fixture();
 await f.vault.setItem('session','FIRST_PRIVATE_SESSION');
 const previous=[...f.saved.keys()].find(k=>k.endsWith(':0'));
 await f.vault.setItem('session','SECOND_PRIVATE_SESSION');
 assert.equal(await f.vault.getItem('session'),'SECOND_PRIVATE_SESSION');
 assert.equal(f.saved.has(previous),false);
 await f.vault.removeItem('session');
 assert.equal(await f.vault.getItem('session'),null);
 assert.equal(f.saved.size,0);
});
test('corrupted and missing fragment fails closed without accepting half token',async()=>{
 const f=fixture();
 await f.vault.setItem('session','x'.repeat(5000));
 const k=[...f.saved.keys()].find(k=>k.endsWith(':1'));
 f.saved.delete(k);
 await assert.rejects(f.vault.getItem('session'),/Incomplete secure auth session/);
});
test('operations serialize securely and reject invalid/oversized data',async()=>{
 const f=fixture();
 const [a,b]=await Promise.all([
  f.vault.setItem('session','old'),
  f.vault.setItem('session','new')
 ]);
 assert.equal(await f.vault.getItem('session'),'new');
 await assert.rejects(f.vault.setItem('session','x'.repeat(60000)),/budget/);
 await assert.rejects(f.vault.getItem('../session'),/Invalid auth storage key/);
 await assert.rejects(f.vault.setItem('session',''),/Invalid auth session payload/);
});

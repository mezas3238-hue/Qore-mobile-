import {decode} from 'base64-arraybuffer';

/**
 * Expo EXPO_PUBLIC_* variables ship inside APK/web bundles.
 * Only Supabase public publishable (sb_publishable_) or JWT role=anon keys.
 * This is defense-in-depth, NEVER a substitute for backend RLS.
 */
export function safeSupabaseClientConfig(rawUrl:string|undefined,rawKey:string|undefined):boolean {
 if(!rawUrl || !rawKey) return false;
 const url=rawUrl.trim(),key=rawKey.trim();
 if(!url || !key || key!==rawKey || key.length>4096) return false;
 try {
  const parsed=new URL(url);
  if(parsed.protocol!=='https:' || parsed.username || parsed.password || parsed.port ||
     parsed.search || parsed.hash || (parsed.pathname!=='' && parsed.pathname!=='/'))return false;
  if(!/^[a-z0-9-]+\.supabase\.co$/i.test(parsed.hostname))return false;
 }catch{return false;}
 if(/^sb_publishable_[A-Za-z0-9_-]{12,}$/.test(key))return true;
 const parts=key.split('.');
 if(parts.length!==3 || parts.some(x=>!x) || parts[1].length>3072)return false;
 try {
  const base64=parts[1].replace(/-/g,'+').replace(/_/g,'/');
  const padded=base64.padEnd(Math.ceil(base64.length/4)*4,'=');
  const bytes=new Uint8Array(decode(padded));
  // Only role field matters; JSON byte sequence can contain UTF-8 in other keys,
  // but role must be ASCII. Malformed JSON will fail closed.
  let text='';
  for(const b of bytes)text+=String.fromCharCode(b);
  const payload=JSON.parse(text);
  return payload && payload.role==='anon';
 }catch{return false;}
}

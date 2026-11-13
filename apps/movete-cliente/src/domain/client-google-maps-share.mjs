/** G327: interpret an explicitly user-shared Google Maps location.
 * Never dereference short URLs, fetch third-party pages or trust shared coordinates.
 * Return only a human-readable search query, which requires native geocoding.
 */
const fail=code=>Object.freeze({ok:false,code});
const safeText=text=>typeof text==='string'&&text.length>=4&&text.length<=120&&
 !/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(text)&&
 !/^https?:\/\//iu.test(text)&&
 !/^-?\d{1,2}\.\d+\s*,\s*-?\d{1,3}\.\d+$/u.test(text);
const isMapsUrl=url=>{
 try{
  const u=new URL(url);
  if(u.protocol!=='https:')return false;
  const host=u.hostname.toLowerCase();
  return host==='maps.app.goo.gl'||host==='goo.gl'&&u.pathname.startsWith('/maps/')||
    (['google.com','www.google.com','google.com.py','www.google.com.py',
      'google.com.br','www.google.com.br','google.com.ar','www.google.com.ar',
      'google.co.uk','www.google.co.uk'].includes(host))&&
    u.pathname.startsWith('/maps');
 }catch{return false;}
};
export function readGoogleMapsShare(payloads){
 if(!Array.isArray(payloads)||payloads.length!==1)return fail('SINGLE_SHARE_REQUIRED');
 const p=payloads[0];
 if(!p||!['text','url'].includes(p.shareType??'text')||
  typeof p.value!=='string'||p.value.length>2048)return fail('UNSUPPORTED_PAYLOAD');
 const raw=p.value.trim();
 const urls=[...raw.matchAll(/https:\/\/[^\s<>]+/gu)];
 const maps=urls.find(match=>isMapsUrl(match[0].replace(/[).,;]+$/u,'')));
 if(!maps)return fail('NOT_GOOGLE_MAPS');
 const rawUrl=maps[0].replace(/[).,;]+$/u,'');
 const u=new URL(rawUrl);
 const host=u.hostname.toLowerCase();
 // Google Maps share text often contains a place title before its short link.
 const heading=raw.slice(0,maps.index).split(/[\n\r]/u).map(x=>x.trim())
  .find(x=>safeText(x)&&!/^google maps\b/iu.test(x)&&
   !/^(?:ver en|compartido|ubicación|ubicacion|dirección|direccion|share|maps)\b/iu.test(x));
 const param=(host.includes('google.')&&u.searchParams.has('query')?
  u.searchParams.get('query'):null);
 const query=heading??(param&&safeText(param)?param.trim():null);
 if(!query)return fail('PLACE_NAME_REQUIRED');
 return Object.freeze({ok:true,query:query.slice(0,120),requiresVerification:true});
}
let value=null;
export function stageGoogleMapsShare(query,now=Date.now()){
 if(!safeText(query)||!Number.isFinite(now)||now<0)return false;
 value={query:query.trim(),createdAt:now};
 return true;
}
export function consumeGoogleMapsShare(now=Date.now()){
 const item=value;value=null;
 if(!item||!Number.isFinite(now)||now<item.createdAt||
  now-item.createdAt>120000)return null;
 return Object.freeze({query:item.query,requiresVerification:true});
}
export function clearGoogleMapsShare(){value=null;}

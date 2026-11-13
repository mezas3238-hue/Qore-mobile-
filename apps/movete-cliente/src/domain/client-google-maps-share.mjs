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
/**
 * Strictly extract human-readable text from a real Google Maps URL.
 * A shared pin or coordinates are NOT proof of coverage, country or fare.
 */
function placeFromMapsUrl(url){
 if(typeof url!=='string'||url.length>2048||!isMapsUrl(url))return null;
 try{
  const u=new URL(url);
  const host=u.hostname.toLowerCase();
  if(host==='maps.app.goo.gl'||host==='goo.gl')return null;
  const query=u.searchParams.get('query')??u.searchParams.get('q');
  if(safeText(query))return query.trim();
  if(u.pathname.startsWith('/maps/place/')){
   const part=u.pathname.slice('/maps/place/'.length).split('/')[0];
   const label=decodeURIComponent(part.replace(/\+/gu,' ')).trim();
   if(safeText(label)&&!label.startsWith('@'))return label;
  }
  return null;
 }catch{return null;}
}
const success=query=>Object.freeze({
 ok:true,query:query.slice(0,120),requiresVerification:true
});
/**
 * A short link without a place name may resolve via Expo Sharing.
 * Trust the resolution only after the ORIGINAL shared URL and the resolved
 * destination BOTH pass the strict Google Maps allowlist. Never accept an
 * untrusted URL, coordinates or a link with no usable place label.
 */
export function readGoogleMapsShare(payloads,resolvedPayloads=[]){
 if(!Array.isArray(payloads)||payloads.length!==1)
  return fail('SINGLE_SHARE_REQUIRED');
 const p=payloads[0];
 if(!p||!['text','url'].includes(p.shareType??'text')||
  typeof p.value!=='string'||p.value.length>2048)
  return fail('UNSUPPORTED_PAYLOAD');
 const raw=p.value.trim();
 const urls=[...raw.matchAll(/https:\/\/[^\s<>]+/gu)];
 const maps=urls.find(match=>isMapsUrl(match[0].replace(/[).,;]+$/u,'')));
 if(!maps)return fail('NOT_GOOGLE_MAPS');
 const rawUrl=maps[0].replace(/[).,;]+$/u,'');
 const u=new URL(rawUrl);
 // Prefer the place description Google Maps included before its own link.
 const heading=raw.slice(0,maps.index).split(/[\n\r]/u).map(x=>x.trim())
  .find(x=>safeText(x)&&!/^google maps\b/iu.test(x)&&
   !/^(?:ver en|compartido|ubicación|ubicacion|dirección|direccion|share|maps)\b/iu.test(x));
 const direct=heading??placeFromMapsUrl(rawUrl);
 if(direct)return success(direct);
 const host=u.hostname.toLowerCase();
 const short=host==='maps.app.goo.gl'||
  host==='goo.gl'&&u.pathname.startsWith('/maps/');
 if(short&&Array.isArray(resolvedPayloads)&&resolvedPayloads.length===1){
  const resolved=resolvedPayloads[0];
  // The native resolver can return an HTTP redirect target as contentUri.
  const target=resolved&&typeof resolved.contentUri==='string'?
   resolved.contentUri:null;
  const label=placeFromMapsUrl(target);
  if(label)return success(label);
 }
 return fail('PLACE_NAME_REQUIRED');
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

/**
 * G42 A23 — verified, provider-bound Auth adapter (isolated QA, NOT deployed).
 * Trust pins: issuer, audience, known kid -> public JWK and exact algorithm.
 * No token-controlled JWKS URLs, implicit MFA, user role or real dispatch.
 */
import {createPublicKey,verify as cryptoVerify} from 'node:crypto';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KID=/^[A-Za-z0-9_-]{4,64}$/;
const B64=/^[A-Za-z0-9_-]+$/;
const ALGS=new Set(['ES256','RS256','EdDSA']);
const plain=o=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&
 (Object.getPrototypeOf(o)===Object.prototype||Object.getPrototypeOf(o)===null);
const exact=(o,fields)=>plain(o)&&Object.keys(o).length===fields.length&&
 fields.every(f=>Object.hasOwn(o,f));
const integer=n=>Number.isSafeInteger(n)&&n>=0;
const uuid=x=>typeof x==='string'&&UUID.test(x);
const fail=()=>{throw Error('G42_UNVERIFIED_IDENTITY');};
function part(text,maxBytes){
 if(typeof text!=='string'||text.length>maxBytes*2||!B64.test(text))fail();
 let b,data;
 try{
  b=Buffer.from(text,'base64url');
  if(b.length<2||b.length>maxBytes||b.toString('base64url')!==text)fail();
  const content=new TextDecoder('utf-8',{fatal:true}).decode(b);
  data=JSON.parse(content);
  // Deliberate restrictive QA profile: reject noncanonical, duplicate-key
  // or ambiguous JSON. Broader issuer serialization requires separate audit.
  if(JSON.stringify(data)!==content||!plain(data))fail();
 }catch{fail();}
 return data;
}
function keyring(kidMap){
 if(!(kidMap instanceof Map)||kidMap.size<1||kidMap.size>12)fail();
 const loaded=new Map();
 for(const [kid,value] of kidMap){
  if(typeof kid!=='string'||!KID.test(kid)||
   !exact(value,['alg','jwk'])||!ALGS.has(value.alg)||
   !plain(value.jwk)||Object.keys(value.jwk).some(k=>[
    'd','p','q','dp','dq','qi','oth','k'
   ].includes(k)))fail();
  let key;
  try{key=createPublicKey({key:value.jwk,format:'jwk'});}catch{fail();}
  const type=key.asymmetricKeyType;
  if(value.alg==='ES256'&&(type!=='ec'||
    key.asymmetricKeyDetails?.namedCurve!=='prime256v1')||
   value.alg==='RS256'&&(type!=='rsa'||
    (key.asymmetricKeyDetails?.modulusLength??0)<2048)||
   value.alg==='EdDSA'&&type!=='ed25519')fail();
  loaded.set(kid,Object.freeze({alg:value.alg,key}));
 }
 return loaded;
}
export function createG42PinnedJwtVerifier({
 issuer,audience,publicKeys,now=Date.now
}={}){
 if(typeof issuer!=='string'||!/^https:\/\/[a-z0-9.-]+\/auth\/v1$/i.test(issuer)||
  issuer.length>160||typeof audience!=='string'||audience!=='authenticated'||
  typeof now!=='function')throw Error('G42 pinned provider issuer/audience required');
 const keys=keyring(publicKeys);
 return Object.freeze(function verifyAccessJwt(token){
  if(typeof token!=='string'||token.length<100||token.length>8192)fail();
  const p=token.split('.');
  if(p.length!==3||!p[2]||p[2].length>700||!B64.test(p[2]))fail();
  const header=part(p[0],400),claims=part(p[1],4900);
  if(!exact(header,['alg','typ','kid'])||
   header.typ!=='JWT'||!ALGS.has(header.alg)||!KID.test(header.kid))
   fail();
  const pinned=keys.get(header.kid);
  if(!pinned||pinned.alg!==header.alg)fail();
  let sig;
  try{sig=Buffer.from(p[2],'base64url');}catch{fail();}
  if(sig.toString('base64url')!==p[2]||
   (header.alg!=='RS256'&&sig.length!==64)||
   (header.alg==='RS256'&&sig.length<256))fail();
  const data=Buffer.from(p[0]+'.'+p[1]);
  let ok=false;
  try{
   ok=header.alg==='EdDSA'?
    cryptoVerify(null,data,pinned.key,sig):
    header.alg==='ES256'?
    cryptoVerify('sha256',data,{key:pinned.key,dsaEncoding:'ieee-p1363'},sig):
    cryptoVerify('RSA-SHA256',data,pinned.key,sig);
  }catch{fail();}
  if(!ok)fail();
  const ms=now();
  if(!integer(ms)||ms>8640000000000000)fail();
  const seconds=Math.floor(ms/1000);
  if(claims.iss!==issuer||claims.aud!==audience||
   claims.role!=='authenticated'||!uuid(claims.sub)||
   !uuid(claims.session_id)||claims.is_anonymous===true||
   !integer(claims.iat)||!integer(claims.exp)||
   claims.exp<=seconds||claims.iat>seconds+30||
   claims.exp<=claims.iat||claims.exp-claims.iat>3600||
   (claims.nbf!==undefined&&(!integer(claims.nbf)||claims.nbf>seconds+30)))
   fail();
  return Object.freeze({
   id:claims.sub.toLowerCase(),sessionId:claims.session_id.toLowerCase(),
   tokenIatMs:claims.iat*1000,expiresAtMs:claims.exp*1000
  });
 });
}
/**
 * Independently consults provider user/session records AND private G42 SQL.
 * No trust in JWT 'aal', 'app_metadata', claims of Admin, browser flags or
 * response headers. Provider MFA confirmation must be sourced separately.
 */
export function createG42ProviderSessionAdapters({
 environment,liveEnabled,localQaOnly,verifyJwt,readProviderUser,
 readProviderSession,readPrivateSessionGrant,now=Date.now
}={}){
 if(environment!=='isolated_staging'||liveEnabled!==false||
  localQaOnly!==true||[
   verifyJwt,readProviderUser,readProviderSession,
   readPrivateSessionGrant,now
  ].some(f=>typeof f!=='function'))
  throw Error('G42 independently attested QA Auth sources required');
 const validSession=(s,v,ms)=>plain(s)&&s.userId===v.id&&
  s.sessionId===v.sessionId&&s.active===true&&
  integer(s.expiresAtMs)&&s.expiresAtMs>ms&&
  s.expiresAtMs>=v.expiresAtMs&&
  typeof s.assuranceLevel==='string'&&
  ['aal1','aal2'].includes(s.assuranceLevel)&&
  integer(s.verifiedAtMs)&&s.verifiedAtMs<=ms;
 const read=async token=>{
  const v=verifyJwt(token);
  const at=now();
  if(!integer(at)||at>=v.expiresAtMs)fail();
  // No fallback to a valid JWT on provider outage.
  const [user,session,grant]=await Promise.all([
   readProviderUser(v.id),
   readProviderSession({userId:v.id,sessionId:v.sessionId}),
   readPrivateSessionGrant({
    userId:v.id,sessionId:v.sessionId,tokenIatMs:v.tokenIatMs
   })
  ]);
  if(!plain(user)||user.id!==v.id||user.is_anonymous===true||
   !(typeof user.email_confirmed_at==='string'||
      typeof user.phone_confirmed_at==='string')||
   !validSession(session,v,at)||grant!==true)fail();
  return {v,user,session,at};
 };
 return Object.freeze({
  async verifyAccessToken(token){
   const {v,user}=await read(token);
   return Object.freeze({
    id:v.id,sessionId:v.sessionId,tokenIatMs:v.tokenIatMs,
    expiresAtMs:v.expiresAtMs,is_anonymous:false,
    ...(typeof user.email_confirmed_at==='string'?
      {email_confirmed_at:user.email_confirmed_at}:{}),
    ...(typeof user.phone_confirmed_at==='string'?
      {phone_confirmed_at:user.phone_confirmed_at}:{})
   });
  },
  async verifySessionNotRevoked({userId,sessionId,at}={}){
   if(!uuid(userId)||!uuid(sessionId)||!integer(at))return false;
   try{
    const s=await readProviderSession({userId,sessionId});
    const grant=await readPrivateSessionGrant({
     userId,sessionId,tokenIatMs:null
    });
    return plain(s)&&s.userId===userId&&s.sessionId===sessionId&&
     s.active===true&&integer(s.expiresAtMs)&&s.expiresAtMs>at&&grant===true;
   }catch{return false;}
  },
  async verifyBackofficeMfa({token,userId,sessionId,at}={}){
   if(!uuid(userId)||!uuid(sessionId)||!integer(at))fail();
   const {v,session}=await read(token);
   if(v.id!==userId||v.sessionId!==sessionId||
    session.assuranceLevel!=='aal2'||at-session.verifiedAtMs>43200000||
    session.verifiedAtMs>at)fail();
   return Object.freeze({
    verifiedByProvider:true,userId,sessionId,assuranceLevel:'aal2',
    verifiedAtMs:session.verifiedAtMs,
    expiresAtMs:Math.min(session.expiresAtMs,v.expiresAtMs)
   });
  }
 });
}
/** Private SQL RPC bridge. Never return true on null/invalid/missing DB data. */
export function createG42PrivateGrantReader({rpc}={}){
 if(typeof rpc!=='function')throw Error('G42 private server SQL RPC required');
 return async({userId,sessionId,tokenIatMs})=>{
  if(!uuid(userId)||!uuid(sessionId)||
   !(tokenIatMs===null||integer(tokenIatMs)))return false;
  const response=await rpc('mobility_stage_g42_session_active',{
   _user:userId,_session:sessionId,_iat_ms:tokenIatMs
  });
  if(!plain(response)||response.error||typeof response.data!=='boolean')
   throw Error('G42 private grant authority unavailable');
  return response.data;
 };
}

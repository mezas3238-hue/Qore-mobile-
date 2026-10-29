/**
 * G171 Redis-atomic multi-instance quota for the EXISTING Render STAGING ingress.
 * Not identity proof: the HTTPS ingress only sees a bearer-shaped credential.
 * Auth, roles and legal eligibility remain G4+PostgreSQL authorities.
 *
 * One EVAL atomic operation on the shared Redis service; no per-process-only
 * decision and no auto-bypass on Redis outage. Quotas do not create rides or
 * enqueue work. This cannot certify public deployment or million-user load.
 */
import {createHash} from 'node:crypto';
export const G171_LIVE_ENABLED=false;
const HASH=/^[a-f0-9]{64}$/;
const LUA=String.raw`
local count=tonumber(redis.call('GET',KEYS[1]) or '0')
local ttl=redis.call('PTTL',KEYS[1])
local limit=tonumber(ARGV[1])
if count>=limit and ttl>0 then
 return {0,ttl}
end
-- The first successful call creates a NEW 60s fixed window. A subsequent
-- successful call never extends that window; Redis EVAL serializes replicas.
local next=redis.call('INCR',KEYS[1])
if next==1 or ttl<0 then redis.call('PEXPIRE',KEYS[1],60000) end
return {1,redis.call('PTTL',KEYS[1])}
`;
const fixed=Object.freeze({GET:90,POST:20});
export function createG171DistributedQuota({redisClient,prefix='qore:qa:ingress:g171'}={}){
 if(!redisClient||typeof redisClient.sendCommand!=='function'||
  prefix!=='qore:qa:ingress:g171')
  throw Error('G171 requires independent Redis client and pinned QA namespace');
 return Object.freeze({
  async claim({credentialHash,method}={}){
   if(typeof credentialHash!=='string'||!HASH.test(credentialHash)||
    !Object.hasOwn(fixed,method))throw Error('G171 invalid quota scope');
   // No raw token, user ID, device ID, IP or PII in Redis.
   const key=prefix+':'+method+':'+credentialHash;
   const response=await redisClient.sendCommand([
    'EVAL',LUA,'1',key,String(fixed[method])
   ]);
   if(!Array.isArray(response)||response.length!==2||
    ![0,1].includes(Number(response[0]))||
    !Number.isFinite(Number(response[1]))||
    Number(response[1])<0||Number(response[1])>60000)
    throw Error('G171 Redis result untrusted');
   return Object.freeze({
    admitted:Number(response[0])===1,
    retryAfterSeconds:Math.max(1,Math.ceil(Number(response[1])/1000))
   });
  }
 });
}
export function hashG171Credential(header){
 if(typeof header!=='string'||header.length<27||header.length>7910||
  !/^Bearer [A-Za-z0-9._~-]{20,7900}$/.test(header))
  throw Error('G171 invalid credential syntax');
 return createHash('sha256').update(header).digest('hex');
}
/** Never attempt Redis connections without explicitly opted-in STAGING env. */
export async function connectG171StagingRedis({url}={}){
 if(typeof url!=='string'||
  !/^redis:\/\/(?:127\.0\.0\.1|localhost):6379(?:\/0)?$/.test(url))
  throw Error('G171 QA accepts only local disposable Redis');
 const {createClient}=await import('redis');
 const client=createClient({url,
  socket:{connectTimeout:2000,reconnectStrategy:false}});
 client.on('error',()=>{}); // a disconnect is handled by claim(); never fallback.
 await client.connect();
 return client;
}

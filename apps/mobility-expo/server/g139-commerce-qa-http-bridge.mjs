/** G139: only the disposable, server-authenticated G45 Buyer stock flow.
 * No commercial checkout, payments, merchant delivery or LIVE.
 */
const URLS=new Set(['/v1/staging/buyer/orders/qa/reserve',
 '/v1/staging/buyer/orders/qa/cancel']);
export function createG139CommerceQaHttpBridge({qa,environment,liveEnabled}={}){
 if(environment!=='isolated_staging'||liveEnabled!==false||
  typeof qa?.reserve!=='function'||typeof qa?.cancel!=='function')
  throw Error('G139 trusted local QA only');
 return async({method,path,headers={},body}={})=>{
  if(method!=='POST'||!URLS.has(path))
   return {status:404,body:{error:'G139 route unavailable'}};
  if(typeof headers.authorization!=='string'||headers.cookie!==undefined||
   headers.Authorization!==undefined)
   return {status:401,body:{error:'G139 bearer required'}};
  const token=/^Bearer ([A-Za-z0-9._~-]{20,7900})$/.exec(headers.authorization)?.[1];
  if(!token)return {status:401,body:{error:'G139 bearer required'}};
  // The G45 authority checks G42 provider session, exclusive Passenger role,
  // stock, current catalog revision, idempotency and real PostgreSQL prices.
  return path.endsWith('/reserve')?
   qa.reserve({bearer:token,body}):qa.cancel({bearer:token,body});
 };
}

/** G139: only the disposable, server-authenticated G45 Buyer stock flow.
 * No commercial checkout, payments, merchant delivery or LIVE.
 */
const URLS=new Set(['/v1/staging/buyer/orders/qa/reserve',
 '/v1/staging/buyer/orders/qa/cancel']);
const RECOVER=/^\/v1\/staging\/buyer\/orders\/qa\/requests\/([0-9a-f-]{36})$/i;
export function createG139CommerceQaHttpBridge({qa,environment,liveEnabled}={}){
 if(environment!=='isolated_staging'||liveEnabled!==false||
  typeof qa?.reserve!=='function'||typeof qa?.cancel!=='function'||
  typeof qa?.recover!=='function')
  throw Error('G139 trusted local QA only');
 return async({method,path,headers={},body}={})=>{
  const read=method==='GET'&&typeof path==='string'?RECOVER.exec(path):null;
  if(!read&&(method!=='POST'||!URLS.has(path)))
   return {status:404,body:{error:'G139 route unavailable'}};
  if(typeof headers.authorization!=='string'||headers.cookie!==undefined||
   headers.Authorization!==undefined)
   return {status:401,body:{error:'G139 bearer required'}};
  const token=/^Bearer ([A-Za-z0-9._~-]{20,7900})$/.exec(headers.authorization)?.[1];
  if(!token)return {status:401,body:{error:'G139 bearer required'}};
  // The G45 authority checks G42 provider session, exclusive Passenger role,
  // stock, current catalog revision, idempotency and real PostgreSQL prices.
  if(read){
   if(body!=null)return {status:400,body:{error:'GET_BODY_FORBIDDEN'}};
   return qa.recover({bearer:token,requestKey:read[1].toLowerCase()});
  }
  return path.endsWith('/reserve')?
   qa.reserve({bearer:token,body}):qa.cancel({bearer:token,body});
 };
}

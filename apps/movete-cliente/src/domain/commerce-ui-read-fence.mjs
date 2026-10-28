/**
 * R46 - In-memory UI read fence for Client commerce screens.
 * Blocks duplicate touches before the first await, and drops obsolete
 * feedback on selection/session changes or component disposal.
 * Does NOT authenticate a server response or cancel a remote transaction.
 */
const fail=code=>Object.freeze({ok:false,code});
export function createCommerceUiReadFence(){
 let closed=false,busy=false,generation=0;
 function invalidate(){if(!closed)generation++;}
 function dispose(){closed=true;generation++;busy=false;}
 function isBusy(){return busy&&!closed;}
 async function run(execute,{onResult=null,onError=null,onFinish=null}={}){
  if(closed)return fail('READ_FENCE_DISPOSED');
  if(busy)return fail('READ_ALREADY_IN_FLIGHT');
  if(typeof execute!=='function')return fail('INVALID_READ_HANDLER');
  busy=true;
  const request=++generation;
  try{
   let result;
   try{result=await execute();}
   catch{
    if(!closed&&request===generation&&typeof onError==='function')onError();
    return fail(closed||request!==generation?'STALE_READ_RESPONSE':'READ_FAILED');
   }
   if(closed||request!==generation)return fail('STALE_READ_RESPONSE');
   if(typeof onResult==='function')onResult(result);
   return Object.freeze({ok:true});
  }catch{
   // Local callback exceptions never expose raw error/PII to a caller.
   return fail('READ_UI_CALLBACK_FAILED');
  }finally{
   busy=false;
   if(!closed&&typeof onFinish==='function'){
    try{onFinish();}catch{/* no user payload in thrown error */}
   }
  }
 }
 return Object.freeze({run,isBusy,invalidate,dispose});
}

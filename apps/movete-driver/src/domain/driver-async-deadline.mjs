/** G159 native Driver operations must settle without leaving infinite spinners.
 * Timeouts are NOT evidence of cancellation, network rollback or failed COMMIT.
 * A late camera result is wiped; late authenticated writes must be reconciled.
 */
export function driverAwaitWithDeadline(operation,{
 ms,timeoutCode,onLateValue
}={}){
 if(typeof operation!=='function'||!Number.isSafeInteger(ms)||
   ms<1||ms>120000||typeof timeoutCode!=='string'||
   !/^[A-Z][A-Z0-9_]{3,63}$/.test(timeoutCode)||
   (onLateValue!==undefined&&typeof onLateValue!=='function'))
  throw Error('DRIVER_DEADLINE_CONFIGURATION_INVALID');
 return new Promise((resolve,reject)=>{
  let elapsed=false;
  const timer=setTimeout(()=>{
   elapsed=true;
   reject(Error(timeoutCode));
  },ms);
  Promise.resolve().then(operation).then(value=>{
   if(elapsed){
    if(onLateValue)try{onLateValue(value);}catch{}
    return;
   }
   elapsed=true;clearTimeout(timer);resolve(value);
  },err=>{
   if(elapsed)return;
   elapsed=true;clearTimeout(timer);reject(err);
  });
 });
}

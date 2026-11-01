/** Owner supplies values. No preloaded or suggested commercial price. */
const fieldRules={
 basePyg:[1000,1000000],perKmPyg:[0,100000],perMinutePyg:[0,20000],
 minimumPyg:[1000,1000000]
};
export function parseG285OwnerAutoFareInput(form){
 if(form===null||typeof form!=='object'||Array.isArray(form)||
    Object.keys(form).length!==5)return null;
 const result={};
 for(const [name,[low,high]] of Object.entries(fieldRules)){
  const raw=form[name];
  if(typeof raw!=='string'||!/^\d{1,8}$/.test(raw))return null;
  const value=Number(raw);
  if(!Number.isSafeInteger(value)||value<low||value>high)return null;
  result[name]=value;
 }
 const percent=form.commissionPercent;
 if(typeof percent!=='string'||!/^\d{1,2}(?:\.\d{1,2})?$/.test(percent))return null;
 const bps=Math.round(Number(percent)*100);
 if(!Number.isSafeInteger(bps)||bps<0||bps>3000||
    Math.abs(bps/100-Number(percent))>0.0000001)return null;
 return Object.freeze({...result,commissionBps:bps});
}

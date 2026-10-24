/** Movete Fácil Driver — explicit opt-in onboarding, isolated localhost QA.
 * NO service-role key, automatic signup, KYC approval or LIVE dispatch.
 */
export const DRIVER_ENROLLMENT_LIVE_ENABLED=false;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const tokenPattern=/^[A-Za-z0-9._~-]{20,7900}$/;
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
export async function enrollDriverIdentity({
 apiOrigin,accessToken,requestKey,driverConsent,request=fetch
}={}){
 if(driverConsent!==true||typeof accessToken!=='string'||!tokenPattern.test(accessToken)||
   typeof requestKey!=='string'||!UUID.test(requestKey)||typeof request!=='function')
  throw Error('Driver registration requires a confirmed session and explicit consent');
 let origin;
 try{origin=new URL(apiOrigin);}catch{throw Error('Invalid Driver QA origin');}
 if(origin.protocol!=='http:'||origin.hostname!=='127.0.0.1'||
    !origin.port||origin.pathname!=='/'||origin.search||origin.hash||
    origin.username||origin.password)
  throw Error('Driver onboarding limited to isolated localhost QA');
 let response;
 try{
  response=await request(origin.origin+'/v1/staging/driver/enrollment',{
   method:'POST',cache:'no-store',credentials:'omit',
   headers:{authorization:'Bearer '+accessToken,
    'content-type':'application/json',accept:'application/json'},
   body:JSON.stringify({requestKey,driverConsent:true})
  });
 }catch{throw Error('Driver enrollment uncertain; verify account role before retrying');}
 if(response?.status===401)throw Error('Driver registration session expired');
 if(response?.status===403)throw Error('Driver registration role ineligible');
 if(response?.status===409)throw Error('Driver account conversion blocked; use a separate identity');
 if(response?.status!==202)throw Error('Driver enrollment unconfirmed');
 let data;
 try{data=await response.json();}catch{throw Error('Driver enrollment receipt invalid');}
 if(!object(data)||Object.keys(data).length!==5||
   data.mode!=='STAGING_DEMO_ONLY'||data.status!=='pending_compliance'||
   data.driverEligible!==false||data.liveOperationsEnabled!==false||
   typeof data.enrollmentId!=='string'||!UUID.test(data.enrollmentId))
  throw Error('Driver enrollment receipt invalid');
 return Object.freeze({enrollmentId:data.enrollmentId,
  status:'pending_compliance',driverEligible:false,liveEnabled:false});
}

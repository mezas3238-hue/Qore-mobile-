/** Movete Fácil Driver: read-only licensed document review in LOCAL QA.
 * Not an eligibility or location-consent claim. Never stores or logs tokens.
 */
export const DRIVER_LICENSE_READINESS_LIVE_ENABLED=false;
const TOKEN=/^[A-Za-z0-9._~-]{20,7900}$/;
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
export async function readDriverLicenseReadiness({
 apiOrigin,accessToken,request=fetch
}={}){
 if(typeof apiOrigin!=='string'||typeof accessToken!=='string'||
  !TOKEN.test(accessToken)||typeof request!=='function')
  throw Error('Driver license session missing');
 let origin;
 try{origin=new URL(apiOrigin);}
 catch{throw Error('Driver license origin invalid');}
 if(origin.protocol!=='http:'||origin.hostname!=='127.0.0.1'||
    !origin.port||origin.pathname!=='/'||origin.search||origin.hash||
    origin.username||origin.password)
  throw Error('Driver license status requires isolated localhost QA');
 let response;
 try{
  response=await request(origin.origin+'/v1/staging/driver/license-readiness',{
   method:'GET',cache:'no-store',credentials:'omit',
   headers:{authorization:'Bearer '+accessToken,accept:'application/json'}
  });
 }catch{throw Error('Driver license status unavailable');}
 if(response?.status===401)throw Error('Driver session expired');
 if(response?.status===403)throw Error('Driver role not authorized');
 if(response?.status!==200)throw Error('Driver license status unavailable');
 let data;
 try{data=await response.json();}
 catch{throw Error('Driver license status response invalid');}
 if(!plain(data)||Object.keys(data).length!==5||
  data.mode!=='STAGING_DEMO_ONLY'||
  typeof data.currentLicenseApproved!=='boolean'||
  data.driverEligible!==false||
  data.liveOperationsEnabled!==false||
  data.verificationScope!=='CURRENT_LICENSE_REVIEW_ONLY')
  throw Error('Driver license status response invalid');
 return Object.freeze({
  currentLicenseApproved:data.currentLicenseApproved,
  driverEligible:false,liveEnabled:false,
  scope:'CURRENT_LICENSE_REVIEW_ONLY'
 });
}

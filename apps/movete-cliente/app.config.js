/** G302: QA APK has a different application ID and visible QA label.
 * Public/Store config remains identical to app.json when QORE_QA_BUILD is not true.
 * No secrets, endpoints or emergency implementation are injected here.
 */
export default ({config})=>{
 if(process.env.QORE_QA_BUILD!=='true')return config;
 if(!config?.android?.package||config.extra?.liveOperationsEnabled!==false)
  throw new Error('QA native build must remain isolated and LIVE OFF');
 return {
  ...config,
  name:config.name+' QA',
  android:{...config.android,package:config.android.package+'.qa'},
  extra:{...config.extra,qaBuild:true,liveOperationsEnabled:false}
 };
};

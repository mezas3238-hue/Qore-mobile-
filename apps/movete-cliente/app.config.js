/** G325: preserve G302 QA isolation; native Maps SDK is opt-in and fail-closed.
 * Never put Maps credentials in EXPO_PUBLIC_* or commit them to Git.
 */
export default ({config})=>{
 let next=config;
 if(process.env.QORE_QA_BUILD==='true'){
  if(!config?.android?.package||config.extra?.liveOperationsEnabled!==false)
   throw new Error('QA native build must remain isolated and LIVE OFF');
  next={
   ...config,
   name:config.name+' QA',
   android:{...config.android,package:config.android.package+'.qa'},
   extra:{...config.extra,qaBuild:true,liveOperationsEnabled:false}
  };
 }
 const key=(process.env.QORE_ANDROID_MAPS_API_KEY??'').trim();
 const approved=process.env.QORE_NATIVE_MAPS_APPROVED==='true';
 const ready=approved&&/^AIza[0-9A-Za-z_-]{30,}$/.test(key);
 return {
  ...next,
  plugins:[
   ...(next.plugins??[]),
   ...(ready?[['react-native-maps',{androidGoogleMapsApiKey:key}]]:[])
  ],
  extra:{...next.extra,qoreAndroidMapsReady:ready}
 };
};

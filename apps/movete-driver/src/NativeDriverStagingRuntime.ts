import * as Crypto from 'expo-crypto';
import {getNativeDriverSupabase} from './NativeDriverAuth';
import {createDriverStagingRuntime} from './domain/driver-staging-runtime.mjs';
import type {DriverStagingRuntime} from './domain/driver-staging-runtime.mjs';

/**
 * G115: mounting the actual Driver offer/trip/custody HTTP adapters in the
 * Expo root. No network, cloud resource or production capability is enabled
 * unless a separately Owner-approved STAGING build supplies all three flags.
 * Never take an endpoint from route params, remote messages, or user input.
 */
export function getApprovedNativeDriverStagingRuntime():DriverStagingRuntime|null{
 if(process.env.EXPO_PUBLIC_QORE_STAGING_RUNTIME_APPROVED!=='true')
  return null;
 const apiOrigin=process.env.EXPO_PUBLIC_QORE_STAGING_API_ORIGIN;
 const approvedStagingHost=process.env.EXPO_PUBLIC_QORE_STAGING_API_HOST;
 if(!apiOrigin||!approvedStagingHost) return null;
 const supabase=getNativeDriverSupabase();
 if(!supabase)return null;
 // createDriverStagingRuntime independently validates exact https://STAGING
 // origin and a pinned DNS host. Never use a phone-supplied host/JWT role.
 return createDriverStagingRuntime({
  apiOrigin,approvedStagingHost,allowedByOwner:true,liveEnabled:false,
  auth:supabase.auth,
  request:fetch,
  makeRequestKey:()=>Crypto.randomUUID(),
  verifyExclusiveDriverRole:async({userId,accessToken})=>{
   try{
    const identity=await supabase.auth.getUser(accessToken);
    if(identity.error||identity.data?.user?.id!==userId)return false;
    const roles=await supabase.from('user_roles').select('role')
     .eq('user_id',userId).limit(3);
    return !roles.error&&Array.isArray(roles.data)&&roles.data.length===1
     &&roles.data[0]?.role==='driver';
   }catch{return false;}
  },
  // No trusted navigation/vehicle-motion provider exists. Keep chat sends
  // disabled rather than infer that the vehicle is stationary.
  verifyStopped:async()=>({
   vehicleStopped:false,source:'unverified',observedAtMs:Date.now()
  }),
  enableKycExpiryStatus:false
 });
}

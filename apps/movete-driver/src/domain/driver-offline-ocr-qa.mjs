/**
 * G299: stand-alone, credential-free offline camera/OCR QA build.
 * NEVER authorize STAGING networking, KYC submission or LIVE operations.
 * This is a build-time/local UI gate, not a server-side authorization.
 */
export function canRunOfflineDriverOcrQa(env){
 if(!env||typeof env!=='object'||Array.isArray(env))return false;
 return env.EXPO_PUBLIC_QORE_G299_OFFLINE_OCR_QA_APPROVED==='true'&&
  env.EXPO_PUBLIC_LIVE_OPERATIONS_ENABLED==='false'&&
  env.EXPO_PUBLIC_QORE_STAGING_RUNTIME_APPROVED==='false'&&
  env.EXPO_PUBLIC_QORE_G290_CAMERA_LAB_APPROVED==='false'&&
  env.EXPO_PUBLIC_QORE_G291_OCR_LAB_APPROVED==='false'&&
  !env.EXPO_PUBLIC_QORE_STAGING_API_ORIGIN&&
  !env.EXPO_PUBLIC_QORE_STAGING_API_HOST&&
  !env.EXPO_PUBLIC_SUPABASE_URL&&
  !env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
}

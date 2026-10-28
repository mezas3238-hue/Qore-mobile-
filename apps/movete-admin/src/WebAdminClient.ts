import {createClient} from '@supabase/supabase-js';
import {verifyWebAdminConfig} from './web-admin-config.mjs';
import {createWebAdminAuth} from './web-admin-auth.mjs';
import type {WebAdminAuth} from './web-admin-auth.mjs';

/**
 * No localStorage or cookies: admin JWT only exists in browser RAM until
 * tab close. A strong browser-side gate is NOT server authorization;
 * backend G75 must separately check provider JWT, AAL2 and exclusive RBAC.
 */
let singleton:WebAdminAuth|null|undefined;
export function getWebAdminAuth():WebAdminAuth|null{
 if(singleton!==undefined)return singleton;
 const c=verifyWebAdminConfig({
  url:import.meta.env.VITE_SUPABASE_URL,
  publishableKey:import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
 });
 if(!c.ok)return (singleton=null);
 const sdk=createClient(c.url,c.publishableKey,{
  auth:{persistSession:false,autoRefreshToken:false,
   detectSessionInUrl:false,flowType:'pkce',storageKey:'movete-admin-volatile'}
 });
 return (singleton=createWebAdminAuth({supabase:sdk}));
}

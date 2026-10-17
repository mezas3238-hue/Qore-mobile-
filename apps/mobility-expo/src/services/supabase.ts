import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { safeSupabaseClientConfig } from '../domain/supabase-public-config';

// Only an explicitly configured public/publishable key; NEVER a service-role key.
// Public variables are embedded in the mobile/web bundle. RLS must remain effective.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
export const backendConfigured = safeSupabaseClientConfig(url, anon);
export const supabase: SupabaseClient | null = backendConfigured
  ? createClient(url!, anon!, {
    auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true,
      detectSessionInUrl: false },
  }) : null;
export function requireBackend(): SupabaseClient {
  if (!supabase) throw new Error('Registro no disponible: la configuración pública de Supabase falta o no es segura. No se han enviado datos.');
  return supabase;
}

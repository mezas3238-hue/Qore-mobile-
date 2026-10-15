import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Only an explicitly configured public/publishable key; NEVER a service-role key.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
export const backendConfigured = Boolean(url && anon && /^https:\/\//.test(url));
export const supabase: SupabaseClient | null = backendConfigured
  ? createClient(url!, anon!, {
    auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true,
      detectSessionInUrl: false },
  }) : null;
export function requireBackend(): SupabaseClient {
  if (!supabase) throw new Error('Registro no disponible: falta configurar Supabase. No se han enviado datos.');
  return supabase;
}

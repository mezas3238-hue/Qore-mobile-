/**
 * Fail-closed: la app publicada en este PR NO solicita transporte real.
 * Las RPC y RLS creadas en Lovable/Supabase se deben auditar y conectar
 * únicamente después de integrar autenticación, GPS, verificación KYC y seguros.
 */
export const LIVE_TRIPS_ENABLED = false as const;
export async function requestProductionRide(): Promise<never> {
  throw new Error('Los viajes reales todavía no están habilitados.');
}

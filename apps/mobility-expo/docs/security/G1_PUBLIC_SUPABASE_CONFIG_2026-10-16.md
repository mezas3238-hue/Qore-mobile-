# G1 — Protección de credenciales y registro
Fecha 2026-10-16. Alcance: aplicación Expo de pasajeros/conductores; no crea ni aprueba cuentas.

- `src/domain/supabase-public-config.ts` valida que `EXPO_PUBLIC_SUPABASE_URL` use endpoint HTTPS de Supabase Cloud sin credenciales, queries ni paths, y que `EXPO_PUBLIC_SUPABASE_ANON_KEY` sea publishable o JWT con rol exacto `anon`.
- Claves `service_role`, `sb_secret_*`, JWT de usuario o inválido => `backendConfigured=false` y `requireBackend()` falla de modo cerrado, no envía datos.
- La clave anónima y URL pública NO son secretos. Una clave `service_role` SIEMPRE es secreta y nunca debe estar en EXPO_PUBLIC_*, builds EAS clientes o GitHub.
- Esta validación local no verifica que la clave corresponda al mismo proyecto; cada entorno requiere comprobación de proyecto/tenant separado y RLS probadas dinámicamente en staging.
- Se conservaron campos de registro/identidad de usuario, `driver-docs` privado y el bloqueo `LIVE_TRIPS_ENABLED=false`.
- CI: ejecutar `npm run check` y export web. E2E signup/driver aún pendiente por staging separado y fixtures. No se han distribuido claves.

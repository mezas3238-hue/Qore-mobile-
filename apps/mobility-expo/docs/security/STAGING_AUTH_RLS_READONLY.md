# G1 — Pruebas de autenticación / RLS en staging (sin tocar producción)

Estado al 2026-10-16: IMPLEMENTADO arnés de humo READ-ONLY. **NO EJECUTADO contra Supabase**, porque no se suministró proyecto STAGING independiente ni credenciales de dos fixtures. Backend Lovable conectado NO debe tratarse como staging seguro.

## Comando manual
Desde `apps/mobility-expo`:
```sh
QORE_MOBILITY_ENV=staging \
QORE_STAGING_PROJECT_REF=<ref-del-proyecto-STAGING> \
QORE_STAGING_ANON_KEY=<clave-PUBLICABLE-ANON> \
QORE_STAGING_PASSENGER_A_EMAIL=<fixture-a> \
QORE_STAGING_PASSENGER_A_PASSWORD=<fixture-a-password> \
QORE_STAGING_PASSENGER_B_EMAIL=<fixture-b> \
QORE_STAGING_PASSENGER_B_PASSWORD=<fixture-b-password> \
node scripts/staging-auth-readonly.mjs
```
No pegar datos reales en GitHub, chat, logs ni ejemplos de pruebas. Inyectar secretos mediante runner seguro y no imprimir env. Jamás service_role. No ejecutar en producción.

## Alcance del smoke
- Login de dos pasajeros de prueba previamente creados en STAGING.
- Perfil propio visible y único; perfil ajeno no visible.
- Roles ajenos inaccesibles; perfiles no accesibles con anon sin autenticación.
- CERO escrituras SQL o HTTP que creen/alteren viajes, usuarios o pagos.

## No demuestra todavía
- Prohibición de self-assign admin / update RLS, SECURITY DEFINER, search_path y grants.
- Aislamiento de documentos de conductores, buckets y revisión de pruebas de identidad.
- Negación de viaje a conductor no aprobado; transiciones concurrentes/idempotencia.
- Sign-up y confirmación email, recovery, JWT revocation, múltiples dispositivos.
- Moto pasajero, seguros, GPS real, Maps, pagos, wallet y operaciones comerciales.
Esas pruebas requieren entorno descartable, políticas versionadas y seguridad independiente. No mezclar fixtures con datos reales ni reutilizar secrets de trading.

## Dependencias antes de ejecutar
1. Proyecto Supabase STAGING distinto de Lovable/producción, con migraciones desde snapshot real.
2. Dos pasajeros de prueba y sus perfiles creados por el flujo de registro, correos de prueba y sin PII real.
3. Snapshot de pg_policies, pg_proc, grants, storage policies, storage buckets y restricciones de DB.
4. Control de seguridad de la identidad de admin inicial a través de procedimiento autorizado.
5. Revisar resultado E2E para 0 fugas entre usuarios antes de publicar onboarding.

## Guard G2
`src/domain/vehicle-eligibility.ts` es contrato puro (no autorización backend): AUTO/MOTO separados, status conductor/vehículo, licencia, habilitación, seguro para pasajero remunerado y vencimientos, inspección, 2 cascos para moto, seguridad de ruta, GPS opt-in sin stale. `LIVE_TRIPS_ENABLED=false` continúa.

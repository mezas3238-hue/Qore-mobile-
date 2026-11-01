# G278 — QA real Cliente ↔ Railway ↔ Supabase, lectura solamente

Objetivo: probar el primer tramo exterior tras el alta Auth 8/8, **sin viajes, KYC falso, aprobación Admin, despachos, pedidos o pagos**. En el último chequeo PostgreSQL: 8 Auth/7 roles (4 Driver, 3 Passenger, Admin sin rol), 0 viajes, 0 comercios y 0 documentos Driver. Railway desplegado sobre commit `bd7ac7a`.

## Qué verifica

- Solo proyecto Supabase STAGING `mrjzxftsdxzepzbcuids`; registro público debe estar cerrado.
- Desde **host operador privado**, inicio de sesión por contraseña de `passenger`, `driver_auto` y `owner_admin`. Validación independiente de cada identidad en `/auth/v1/user`.
- Origin Railway HTTPS fijo: `https://qore-mobile-backend-staging-staging.up.railway.app`.
- GET sin bearer de `/v1/staging/rider/history`: debe devolver 401.
- GET autenticado Passenger: 200, propietario idéntico al sujeto de Auth, historial inicialmente vacío (porque no hay viajes).
- GET Driver y Admin sin rol pasajero al historial: 403 cada uno. No se concede G27.
- Cierre de sesión local en Supabase de todas las sesiones abiertas por la prueba; nueva lectura con bearer cerrado debe ser 401. Si se acepta, código `REVOKED_PASSENGER_SESSION_STILL_READABLE` y **no hay certificación**.

Solo se utilizan la clave pública de Supabase y el archivo de credenciales privadas ya generado. **No usa la clave administrativa de Codespaces, no crea Auth users y no modifica datos comerciales.** Autenticarse crea sesiones efímeras en el proveedor, que se revocan en la misma ejecución. Si el proveedor no permite confirmar el cierre, se reporta bloqueado.

## Ejecución manual desde Android Codespaces

Ejecutar solo en el Codespace con el archivo privado `$HOME/.qore-qa-private/actors.json`, secretos de Codespaces disponibles y variables STAGING ya configuradas. No cargar manifest en GitHub ni compartir JWT/secretos. El operador puede dejar el manifest en `QORE_QA_MANIFEST_FILE`.

```bash
git fetch origin
git switch --track origin/integration/qore-g278-real-qa-railway-rider-history-readonly-20261031
export QORE_STAGING_PROJECT_REF=mrjzxftsdxzepzbcuids
export QORE_MOBILITY_ENV=staging
export LIVE_TRIPS_ENABLED=false
export QORE_QA_MANIFEST_FILE="$HOME/.qore-qa-private/actors.json"
QORE_QA_AUTH_BRIDGE_APPROVED=CONFIRM_READ_ONLY_STAGING node apps/mobility-expo/scripts/g278-real-qa-railway-readonly.mjs --verify
```

Si la rama ya está creada localmente, usar `git switch integration/qore-g278-real-qa-railway-rider-history-readonly-20261031 && git pull --ff-only`. Nunca ejecutar `--apply` de G275 nuevamente. La salida G278 contiene únicamente códigos de seguridad, sin datos personales ni tokens.

## Qué NO certifica

No certifica Driver KYC: el gateway Driver requiere autoridad independiente de sesión + KYC y permanece cerrado sin ella. El rol nativo Admin sin aprobación G27 no es Owner. El slot `merchant_owner` tiene rol de usuario Passenger, pero aún no está vinculado a ningún comercio. No existe proveedor vial ni evidencia de rutas/recogidas; G269/G277 despacho no están migrados a PostgreSQL 17 remoto. **Cinco E2E externos certificados: 0/5 hasta prueba completa por mismo ID y persistencia real.**

CI ejecuta únicamente respuestas simuladas y no usa secretos ni redes externas. Railway sigue sin despliegue nuevo en este PR.

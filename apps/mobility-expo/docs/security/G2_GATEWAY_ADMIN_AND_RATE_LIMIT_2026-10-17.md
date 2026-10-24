# QORE Mobile — G2 Gateway: doble autorización administrativa y límite de solicitudes

**Fecha:** 2026-10-17. **Entorno:** servicio local prototipo de STAGING del repositorio QORE Mobility, PR #7 DRAFT. **No desplegado en internet, no conectado a Expo ni a Lovable frontend.**

## Qué se corrigió

Anteriormente el gateway validaba el JWT con `supabase.auth.getUser(token)` pero llamaba directamente a la RPC administrativa y delegaba la comprobación del rol por completo al SQL. No había cuota por usuario. La base sí exigía rol admin en sus funciones, pero faltaba defensa independiente en el perímetro del servicio.

Se añadió `createStagingRateLimiter()` al módulo `server/g2-staging-vehicle-gateway.mjs`, con política local configurable y memoria acotada:

- Clave de conteo: UUID de usuario **verificado por Auth**, más tipo de operación; no se conserva JWT, email o IP en el mapa.
- Límite del prototipo local: **4 envíos de solicitudes / minuto y 6 operaciones administrativas / minuto por tipo de operación**; duración 60 segundos; máximo 1024 identidades-operaciones activas por proceso.
- La saturación del mapa **deniega solicitudes nuevas** sin expulsar identidades que reiniciarían su cuota. Un reloj inválido, una excepción o una respuesta diferente del booleano literal `true` bloquea la operación. No devuelve secretos al cliente.
- El gateway rechaza con HTTP `429` al agotar el límite, `503` si el control lanza error, antes de cualquier llamada privilegiada.

Se añadió `authorizeAdmin` como adaptador **obligatorio** que verifica en servidor `user_roles` para las rutas `POST /v1/staging/admin/vehicle-reviews` y `POST /v1/staging/admin/materialize-pending`. Ante rol ajeno, ausente o falsificado devuelve `403`, ante error de consulta devuelve `503`; se exige literalmente `true`. La identidad del revisor sigue derivando de `getUser(token)`, **nunca del JSON del solicitante**.

El ejecutable local `server/run-g2-local-staging-gateway.mjs` conecta `authorizeAdmin` con una consulta server-side de Supabase utilizando credencial privilegiada **solo servidor** y conecta el limitador local; sus conexiones siguen en `127.0.0.1` y configura tiempos máximos de recepción de request. **La autorización SQL original permanece activa y verifica de nuevo el rol admin**, por lo que existen dos barreras.

## Pruebas automatizadas

En `server/g2-staging-vehicle-gateway.test.mjs` hay pruebas de rechazo de no-admin en revisión y materialización, falla de consulta, callback de límite ausente, saturación, restablecimiento de ventana, aislamiento por operación, rechazo de respuestas truthy/promesas y protección contra divulgación de errores. CI sigue ejecutando contratos de dominio Expo, PostgreSQL G1/G2 y guard `LIVE_TRIPS_ENABLED=false`.

## Limitaciones que no deben omitirse

- El limitador `Map` es **local al proceso y no distribuido**, no protege múltiples instancias, reinicios, ni carga de tráfico previo a `auth.getUser`; se requieren límites en borde y cuotas compartidas Redis/WAF, alertas y límites por IP/dispositivo antes de cualquier exposición.
- No se ha ejecutado contra **dos cuentas JWT reales** del Supabase nuevo. No existen cuentas de prueba ni archivos de prueba remotos según la última inspección.
- La autorización de administradores reales debe requerir provisioning manual verificado, MFA, revisión humana y control de revocación. Esta prueba no autoriza acciones comerciales ni demuestra seguridad de despliegue público.
- Lovable STAGING no está publicado y el bloqueo del registro público Auth `disable_signup=true` sigue **sin certificar**; la última observación verificable era `false`. La seguridad nativa no se debe confundir con quitar la opción de alta en la UI.
- No subir keys `sb_secret_*` ni `service_role` a Expo o repositorio; no iniciar una prueba remota hasta verificar ref de STAGING. Mantener `LIVE_TRIPS_ENABLED=false` y la congelación comercial MOTO.

## Estado de base remota tras esta ronda

Consulta **read-only** a Lovable STAGING nuevo `9c677bb2-746b-419f-ad9c-dd6d26bab944`: **10 tablas, 0 usuarios, 0 solicitudes, 0 vehículos, 0 revisiones y 0 objetos**; RPCs de materialización y review no ejecutables por `authenticated`, y la tabla de solicitudes sigue inmutable incluso para `service_role` (UPDATE=false). No se ejecutaron migraciones ni escrituras.

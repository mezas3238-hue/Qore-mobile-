# QORE Mobile — G4 arranque fail-closed, adaptadores Supabase y origen fijado

**Fecha:** 2026-10-17 · **Estado:** código integrado en rama PR #7, **NO desplegado**, sin usuarios reales ni GPS real. Nunca habilitar LIVE/MOTO comercial ni fusionar sin gates de seguridad.

## Avance verificable

El módulo `server/g4-staging-runtime.mjs` une los contratos previamente creados:
- `GET /v1/staging/rider/trips/:id/status` consulta en el servidor una fila de `mobility_stage_auto_demo_trips` **por UUID de viaje y passenger_id del usuario autenticado**.
- `GET /v1/staging/driver/offers/:id` consulta una oferta **solo para driver_id del JWT** y verifica que el viaje asociado siga buscando conductor.
- `POST .../accept`/`decline` llama RPC G4 `mobility_stage_auto_demo_accept_offer` y `mobility_stage_auto_demo_decline_offer` mediante credencial privilegiada **solo de proceso servidor**, nunca de Expo.
- Los roles passenger/driver se vuelven a consultar a `user_roles` con el servidor; el JWT se valida con `supabase.auth.getUser(token)` y no con claims locales sin firma.

**Arranque obligatorio:**
1. `QORE_MOBILITY_ENV=staging`, `LIVE_TRIPS_ENABLED=false` y `QORE_G4_LOCAL_QA_ONLY=true`.
2. Supabase **nuevo** con ref independiente y claves distintas anon/publishable y server-only `service_role`. La antigua ref `qdqrlgzlotnfdxzpacxs` se rechaza.
3. GET read-only del endpoint Auth nativo `/auth/v1/settings`: exige `disable_signup === true`. Si false/inaccesible/error, **no se crea el servidor HTTP de QA**. La política se vuelve a comprobar en **cada petición** para bloquearse si cambia después.
4. Comprobación read-only de `mobility_stage_auto_demo_trips`, `mobility_stage_auto_demo_offers`, `mobility_stage_auto_demo_events` y `mobility_stage_auto_demo_push_outbox`. Si alguna no existe o sus permisos deniegan SELECT, el arranque falla.
5. Solo entonces se construye transporte de QA `127.0.0.1`. La implementación ya prohíbe `listen()` en host distinto; este servidor **no dispone de TLS, WAF ni controles distribuidos** y jamás debe publicarse o reenviarse a Internet.

**Comando preparado** (solo cuando el dueño haya realizado la configuración segura y aprobado fixtures):

```bash
cd apps/mobility-expo
# Configurar LOCALMENTE las variables anteriores y:
# QORE_STAGING_PROJECT_REF=<ref nueva verificada>
# QORE_STAGING_PUBLISHABLE_KEY=<clave anon/public de STAGING>
# QORE_STAGING_SERVICE_ROLE_KEY=<secreto server-only, nunca EXPO_PUBLIC_ ni GitHub>
npm install --no-audit --no-fund
node server/run-g4-local-staging-radar.mjs
```

No pasar claves al chat o repositorio. El proceso no imprime secretos ni produce migraciones o cuentas. Actualmente, por diseño, este comando **debe negarse a arrancar**: G3/G4 aún no están instalados en Supabase STAGING y `disable_signup=true` no está verificado.

## Limitaciones explícitas

- La tabla G1 `profiles` solo contiene un UUID y fecha; **NO almacena nombre, foto, rating ni perfil humano verificado**. Por eso, tras una aceptación, el adaptador `arrivalEvidence` por defecto responde con error y el pasajero recibe 503, **no una ficha ni ETA inventadas**. Es necesario crear un servicio auditado de visualización, evidencia y fotografía con acceso temporal y consentido.
- `trackingSequence` se conserva en 0 porque el esquema G3 no tiene revisiones de GPS aún. Para seguimiento en vivo se requiere tabla/servicio de posiciones versionado, reglas de retención, consentimiento válido y rutas Google calculadas server-side. No fingir tracking.
- La protección local contra abuso ofrece cuotas por usuario **en memoria, por proceso**. Antes de exposición pública se requiere rate limiting distribuido, detección de spam y protección por borde/IP/dispositivo.
- Verificar `disable_signup` en cada petición prioriza seguridad por encima de latencia de QA. En producción hay que diseñar política de control más robusta sin perder revocación/fail-closed.
- La función preparada no crea viaje nuevo, conductor, factura o notificación, ni controla envío de GPS real; G3/G4 solo existen en PostgreSQL desechable de CI.
- **No** confundir tests HTTP con datos reales de Supabase. Los tests de runtime usan clientes, Auth, SQL y tokens sintéticos inyectados; `service_role` nunca aparece en las respuestas.

## Seguridad del JWT del pasajero

`src/domain/qore-radar-polling.ts` ahora exige `pinnedApiOrigin` además de `apiOrigin`. El pin debe provenir de configuración de build confiable de la aplicación, **nunca de contenido editable por pasajero, deep links, mensajes de notificación o URL dinámica sin validar**. Rechaza otros dominios aunque tengan HTTPS antes de transmitir `Authorization: Bearer`. HTTP loopback se permite solo con `enableLoopbackQA=true`, para QA; el backend antiguo no se acepta. Las pruebas muestran que los tokens no salen hacia hosts alternativos.

## Evidencias CI y próxima integración

- `server/g4-staging-runtime.test.mjs`: con mocks de Supabase prueba Auth abierto antes y después de arrancar, falta G4, roles, usuario ajeno, JWT y RPC con identidad del servidor, garantía de no mostrar perfil humano falso y separación de secretos.
- `server/run-g4-local-staging-radar.test.mjs`: proceso Node real se niega a arrancar sin flag explícito, sin `QORE_MOBILITY_ENV=staging` o con LIVE habilitado, antes de conectar a DB.
- `src/domain/qore-radar-polling.test.ts`: verifica pin de host TLS y ausencia de fuga del JWT.
- CI revisa además `node --check server/run-g4-local-staging-radar.mjs`, PostgreSQL G1–G4 efímero con dos conductores, Expo, Auth, Storage y guard no-LIVE. Citar solo el último commit con check aprobado al comunicar.
- **Postcheck remoto read-only** del proyecto Lovable nuevo `9c677bb2-746b-419f-ad9c-dd6d26bab944`: 10 tablas públicas, 0 usuarios, 0 vehículos, 0 documentos, **G3=false y G4=false**. No se realizaron escrituras.

## Siguiente gate obligatorio

1. En el editor del proyecto Lovable STAGING, activar **Cloud → Users → Auth settings → Disable sign-up** y comprobar el valor `disable_signup=true` mediante REST nativo. Última evidencia independiente **no certifica** ese estado.
2. Provisionar 3 cuentas ficticias verificadas manualmente (1 pasajero, 2 conductores) y probar Auth/RLS/Storage con JWT verdaderos y evidencia privada.
3. Revisar/adaptar SQL G3/G4 antes de migrar a STAGING, con scripts seguros de pre/postcondiciones, rollback y gate `LIVE_TRIPS_ENABLED=false`. La versión actual de archivos es **solo CI** y debe ser revisada antes de instalación.
4. Crear perfil de conductor/vehículo verificado y sistema seguro de ETA GPS, permisos Android/iOS, claves Google Routes restringidas al servidor, push FCM/APNs, receipts y canales Realtime privados con RLS.
5. QA de **3 teléfonos físicos** y cumplimiento regulatorio/seguro/PSP antes de piloto AUTO. MOTO comercial sigue bloqueada.

**Invariantes:** PR #7 DRAFT; Flutter trading PR #2 intacto, LIVE_TRIPS_ENABLED=false, no deployments, no pagos, no GPS público y nunca backend antiguo.

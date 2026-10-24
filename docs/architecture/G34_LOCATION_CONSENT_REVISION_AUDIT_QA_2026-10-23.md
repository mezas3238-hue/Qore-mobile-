# G34 — Consentimiento de GPS versionado y auditoría privada

**Movete Fácil · Arquitecto A · 2026-10-23 · PR #7 DRAFT**

## Alcance

Este bloque resuelve un problema específico de G32: hasta G34, el `consentRevision` que inyectaba el backend no estaba atado a una versión de consentimiento **autoritativa en PostgreSQL**. Por lo tanto, retirar y volver a autorizar GPS podía crear una sesión de consentimiento diferente sin que la versión aportada al RPC fuese contrastada en SQL.

**G34 sólo está implementado en la cadena PostgreSQL 16 descartable. NO se ejecutó ninguna migración de Supabase remoto, ni hay app LIVE, GPS auténtico, telefonía o comunicación con clientes reales.**

### Cambios en las fuentes

- `G34_CONSENT_REVISION_AUDIT_FENCING_POSTGRES_CI_ONLY.sql`: agrega `revision bigint` con valor inicial 1 a `public.mobility_location_consents`; un trigger servidor **aumenta la revisión de forma monotónica** en cualquier cambio de consentimiento, impidiendo al llamador escoger unilateralmente la revisión siguiente. Si se revoca y se reactiva, exige un nuevo `opted_in_at` posterior a la revocación. Los cambios sin estado distinto se rechazan.
- Nueva tabla `mobility_stage_g34_consent_audit`, apéndice privado con `event_id,driver_id,consent_revision,action,occurred_at`. Acciones: `OPT_IN`, `REVOKE` y `RE_OPT_IN`. No almacena GPS, documentos, puntos de ruta, email, teléfono o tokens. Los clientes `anon/authenticated` no tienen privilegios; `service_role` puede leer, pero no modificar directamente el log. El trigger `SECURITY DEFINER` es dueño exclusivo de inserción en el registro histórico.
- Reemplaza **sin cambiar la firma ni los permisos** la función privada `mobility_stage_g32_quarantine_signal`. La revisión de consentimiento se lee de la fila `FOR SHARE` **dentro del bloqueo de Driver** junto con `opted_in_at` y `revoked_at`; el RPC sólo persiste cuando `_consent_revision` coincide exactamente con la revisión actual. Un token previamente asociado a la versión 1 deja de ser válido si se revoca a la versión 2 y se vuelve a autorizar a la versión 3.
- No cambia ninguna fila, índice ni política de `mobility_stage_g31_zone_observations`. No publica ningún conteo de Driver. La geocerca/antifraude sigue inyectada sintéticamente en G32 y **no puede considerarse una prueba real de localización**.

### Contrato y pruebas

El test `G34_CONSENT_REVISION_AUDIT_ASSERT_POSTGRES_CI_ONLY.sql` trabaja en una transacción ROLLBACK con dos identidades sintéticas y una zona AUTO_DELIVERY:

1. Consentimiento inicial revisión 1: prueba señal con versión 1 aceptada y versión futura 99 rechazada.
2. Revocación registrada y versionada a revisión 2: no habilita señales y genera `REVOKE`.
3. Nueva autorización GPS posterior a la revocación: revisión 3 con `RE_OPT_IN`; señales con revisión 1 y 2 quedan rechazadas aun cuando el consentimiento volvió a estar activo, mientras revisión 3 permite la siguiente secuencia G32.
4. El log contiene exactamente los tres eventos en versiones 1, 2 y 3; nunca se alteran observaciones agregadas de G31.

La **aceptación de señales** sigue requiriendo rol Driver exclusivo, verificación JWT y geocerca del servidor, controles anti-replay, integridad/antisuplantación y consentimiento vigente. La tabla G34 NO agrega nuevos permisos a cliente, Owner ni Admin Web.

### Bloqueos que siguen siendo reales

- Antes de migrar un proyecto existente, diseñar backfill auditado de consentimientos antiguos y validar compatibilidad con su propio historial de revocación.
- Proveedor real de identidad/revocación y atestación de dispositivo/GPS con geocercas autorizadas para Paraguay, consentimientos en Driver Android/iOS con prueba explícita, almacenamiento/retención acorde a ley.
- La auditoría del consentimiento no es un mecanismo completo de expiración de sesiones; también deben revocarse los tokens de proveedor y limpiar cachés de telemetría.
- G33 sólo ofrece un **diagnóstico privado de QA** de señales; no promover candidatos a `g31_zone_observations` mientras `eligible_by_policy=false`, KYC/legalidad, cobertura, estado de ocupación total, verificaciones GPS reales y privacidad estén sin certificar.
- Owner Finance sigue sin API autorizada porque G7 contiene pagos simulados.

## Coordinación

Se mantiene la propiedad A/B: Arquitecto A edita servidor, SQL descartable, CI y `docs/architecture/**`; Arquitecto B controla Cliente y Admin Web en PR #8. No tocar archivos B, no merge, no LIVE, no VPS, no pagos, no SQL remoto.

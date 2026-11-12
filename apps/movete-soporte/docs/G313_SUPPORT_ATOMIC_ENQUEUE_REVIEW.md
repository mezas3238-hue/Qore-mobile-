# G313 — Verificación transaccional de solicitudes de soporte

**Fecha:** 12 de noviembre de 2026. **Frente:** Arquitecto C / issue #120.

## Estado de plataforma

- Supabase STAGING `mrjzxftsdxzepzbcuids` fue hallado `INACTIVE` el 12-nov. Se solicitó restauración y el proveedor respondió `success:true`, pasando a `COMING_UP`. No significa que esté listo hasta comprobar `ACTIVE_HEALTHY` y SQL read-only.
- No se ejecutaron migraciones ni se desplegaron Edge Functions. No se alteraron accesos a datos de clientes.
- Este PR utiliza PostgreSQL 16 **descartable**; no requiere Supabase activo.
- El changelog de Supabase (12-nov-2026) anuncia CLI v3 (4-nov) con cambio de contexto local y cambios de TLS (10-nov). CI usa `psql` dentro del runner y no actualiza CLI.

## Nuevos controles implementados

La función `qore_support_private.mobility_stage_g313_enqueue_qa` es `SECURITY DEFINER` **excepcional**, en esquema NO expuesto y ejecutable únicamente por `service_role`. Se utiliza para consultar y bloquear los registros privados de `auth.sessions`, `auth.users` y `auth.mfa_factors` sin otorgar lectura ni escritura directa sobre ellos a `service_role`. La función usa `SET search_path=''`, nombres de tablas totalmente calificados, argumentos cerrados y deniega cualquier rol distinto de Soporte. Requiere revisión de seguridad independiente antes de aplicarla. Rechaza:

- actor que no tiene rol independiente de soporte activo y aprobado por Owner activo;
- sesión/Auth borrada, expirada, baneada o no confirmada; MFA sin `totp` verificado o sin `aal2`;
- usuario con rol paralelo de Driver/Passenger/Owner/Admin;
- expediente que no esté asignado explícitamente a ese agente (incluidos tickets de la cola sin asignar);
- estado anterior no coincidente, acción prohibida o transición de `RESOLVE_INFORMATIONAL` prematura;
- reuso de clave idempotente para otra acción.

Bloquea filas de autoridad existentes y expediente con `FOR SHARE` / `FOR UPDATE`, e inserta solo un registro `QUEUED`, sin actualizar ticket ni enviar ninguna comunicación. Un reintento con la misma clave retorna el UUID inicial si permisos y estado siguen válidos.

El contrato **no concede** capacidad de iniciar sesión, modificar estados, contactar clientes, mover dinero, aprobar documentos, enviar SOS ni acceder a datos fuera de soporte.

## Limitaciones y revisión obligatoria

1. La función recibe `_actor` y `_session` desde un backend de confianza. El futuro Edge Function debe validar JWT con `auth.getUser(token)` y comprobar `session_id` enlazado al actor; jamás exponer servicio privilegiado en navegador.
2. El modelo de aprobación requiere un Owner realmente registrado y aprobado con un actor distinto, aún sin certificar en STAGING.
3. Se comprobó en Supabase PostgreSQL 17 real que `service_role` **NO** tiene `SELECT` en `auth.users`, `auth.sessions` ni `auth.mfa_factors` (12-nov-2026). La función elevada en esquema privado evita conceder permisos directos sobre esos datos. El test PG16 exige también cero SELECT/UPDATE Auth para `service_role`. **Auditar especialmente `SECURITY DEFINER`**, propietario de función, privilegios `EXECUTE`, búsqueda vacía y qué roles pueden cambiar su definición; si estos requisitos no se pueden cumplir, bloquear la instalación.
4. Revocaciones que introduzcan *nuevos* roles en tablas paralelas pueden competir con las comprobaciones de ausencia. Sus escritores autorizados deberán tomar un bloqueo de asesoramiento compatible o usar un coordinador transaccional para cerrar esa carrera.
5. Una solicitud `QUEUED` no significa que el ticket esté `RESOLVED` ni que una respuesta se haya enviado. Hace falta worker/revisión y bitácora independiente con anti-spam y retención.
6. **NO MERGE / NO DEPLOY / NO LIVE.** Los otros frentes (#118 móvil, #119 comercio/pagos) no se modifican.

## Evidencia de CI

`apps/movete-soporte/scripts/sql/g313-support-atomic-disposable-ci.sql` reutiliza pruebas G312 y añade escenarios positivos/negativos para: AAL2 válido, separación de agentes, cola sin asignar, estado obsoleto, acción de finanzas prohibida, Owner sin permiso, agente revocado, vencimiento de sesión, TOTP revocado, Owner aprobador revocado y reintentos idempotentes.

CI: `.github/workflows/qore-g313-support-atomic-enqueue-pg.yml`. No se ha certificado con identidades reales; las pruebas de laboratorio deberán repetirse contra PG17 STAGING, sin datos sensibles.

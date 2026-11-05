# G311 — Soporte: contrato de acciones y backend pendiente

**Fecha:** 2026-11-04. **Enlace de coordinación:** issue #120. **Estado:** laboratorio QA; sin despliegue, sin login real, sin mutaciones de PostgreSQL 17 ni tickets reales.

## Contrato del cliente — estrictamente cerrado

El frontend solo puede proponer uno de estos tipos predefinidos:

- `ACKNOWLEDGE`: acuse automático predefinido.
- `REQUEST_INFORMATION`: solicitud predefinida de detalles no sensibles.
- `ESCALATE_SAFETY`: propuesta de escalamiento a seguridad.
- `ESCALATE_FINANCE`: propuesta de escalamiento a responsable financiero, **sin mover dinero**.
- `RESOLVE_INFORMATIONAL`: propuesta de resolución de consulta informativa, **sin aprobar pagos o KYC**.

Request exacto: `ticket_id`, `expected_status`, `action`, `idempotency_key`. Los IDs usan UUID. **No hay texto libre, teléfono, PII, GPS, banco, totales, adjuntos, actor, ni URL**. El actor y la autorización son decisión del servidor a partir de JWT y sesión vigente.

La respuesta validada del futuro backend solo puede indicar `QUEUED` y un `request_id`. **Nunca equivale a respuesta entregada, reclamo resuelto, pago efectuado, ni acceso a datos protegidos.**

## Gate de seguridad

El nuevo `enqueueSupportAction` retorna `ACTION_BACKEND_DISABLED` sin siquiera pedir sesión por defecto. No está conectado a botones ni puede habilitarse vía el PR presente. Una futura integración requiere:
1. Implementar `qore-support-actions` como Supabase Edge Function (aún INEXISTENTE), publicable solo tras auditoría.
2. Autenticación server-side con Auth + AAL2 real + `auth.sessions`, rol único de Soporte activo, no heredado de Admin/Owner/Driver/Cliente, revocación inmediata.
3. Resolver ticket y asignación **en PostgreSQL**. Hacer `SELECT ... FOR UPDATE` sobre el ticket y aplicar validación de versión/estado, transición autorizada, unicidad de `idempotency_key` por agente+ticket y append-only audit en la MISMA transacción.
4. Los intentos no autorizados o alterados no pueden insertar nada, ni revelar si un ticket ajeno existe. Denegar escritura directa de `anon` y `authenticated` mediante GRANT + RLS. Nunca exponer `service_role` al navegador.
5. Registrar custodia, retención mínima, consentimiento, tiempos de respuesta y políticas de escalamiento sin incluir secretos en logs.
6. Matriz real PG17 de 2 agentes A/B, AAL1, suspensión, rol cambiado entre petición y commit, session_id revocado, intento de ticket ajeno, duplicado, carrera concurrente y repetición de webhook/evento.
7. Solo después: conectar UI y flags STAGING explícitos; mantener NO LIVE hasta certificación y autorización.

**Estado Supabase revisado:** 2026-11-04, no se encontraron tablas `public.*support*` en PG17. #104 contiene SQL propuesto sin aplicar. G311 no crea tablas ni llama endpoints reales.

## Propiedad de archivos
Este PR toca exclusivamente `apps/movete-soporte/**` y conserva los contratos G301 + G309. Arquitecto A móvil (#118), B comercio/pagos (#119) no deben trabajar sobre esta carpeta. 

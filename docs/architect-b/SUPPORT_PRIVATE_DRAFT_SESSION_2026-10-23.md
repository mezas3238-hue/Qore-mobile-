# Arquitecto B — continuación del borrador privado de soporte (23 octubre 2026)

**Rama:** feature/mobility-cliente-admin-parallel-20261022 · **PR #8:** DRAFT · NO MERGE / NO LIVE / NO DEPLOY.

## Implementación
- Borrador puramente local/efímero por sesión: controlador support-draft-session.mjs sin storage, HTTP ni casos ficticios.
- El montaje de soporte se reinicia al variar privateViewRevision (logout, cambio de cuenta, relogin y rotación de credenciales) y el teardown dispone de la sesión.
- Edición de categoría, UUID o texto borra el feedback validado para evitar mensajes obsoletos.
- Eliminación manual que vacía categoría, UUID, descripción y mensajes. Callbacks posteriores al dispose no regeneran información.
- Endurecimiento best-effort de texto contra correo, móvil PY, documento, enlace, ubicación precisa, PAN y secretos. NO equivale a detección universal de PII.
- UX con encabezado inequívoco “NO 911 / NO SOS / NO ENVIADO”; ningún campo caseId/receipt ni transporte.
- Pruebas unitarias adversariales para controlador y validador, sin datos reales.

## Bloqueo real acotado del backend A
En OpenAPI 1.0.0-g11 de A (HEAD 75e3bee1e8d8), POST /v1/staging/safety/incidents/report retorna 201 Success **genérico** y GET /v1/staging/safety/incidents/{incidentId}/status retorna 200 Success **genérico**.
Se requiere contrato tipado e implementado por A: receiptId, incidentId, actor derivado de JWT, ownership, monotonic revision, estado, timezone/observedAt, timestamps, errores tipados, idempotencia y RLS/RBAC; sin exponer PII ni habilitar SOS ficticio.
Hasta que A implemente y certifique STAGING, **no conectar** al reporte remoto ni afirmar recepción, atención, asignación o emergencia.

## Verificación
Pruebas aisladas del módulo ejecutadas localmente: 10/10 PASS antes del commit. Validación TypeScript y export Expo de la rama deben comprobarse con GitHub Actions para el HEAD de este commit. QA con contenido sintético exclusivamente.

## Próximos pasos
1. Revisar jobs Cliente/Driver y límites de archivos del commit en Actions.
2. Pedir a A en issue #9 el DTO versionado de incidentes y POST/GET probado con JWT por usuario y sin doble reporte.
3. Avanzar otros módulos de Cliente/Admin sin bloquear por ausencia de incident receipt.
4. Cuando backend A esté listo, conectar gateway de incidentes fail-closed y hacer E2E en STAGING sintético. Mantener mensajes “NO SOS” hasta un canal de seguridad operativo y legalmente validado.

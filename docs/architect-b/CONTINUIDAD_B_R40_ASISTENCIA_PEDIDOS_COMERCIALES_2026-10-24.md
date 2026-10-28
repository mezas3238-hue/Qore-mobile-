# QORE Mobile — Arquitecto B | R40 Asistencia para pedidos comerciales (2026-10-24)

**Repositorio:** `mezas3238-hue/Qore-mobile-`. **Rama B:** `feature/mobility-cliente-admin-parallel-20261022` · PR #8 DRAFT. **Arquitecto A:** PR #7, dueño de API/Auth, PostgreSQL, pagos, Driver, incidencias servidor y dispatch. **NO MERGE / NO LIVE / NO DEPLOY**, sin orden expresa del Owner.

## Trabajo ejecutado desde R39

1. `apps/movete-cliente/src/domain/merchant-support-guide.mjs`: guía local para pedidos de supermercado, restaurante, farmacia OTC y otros comercios. Enumera motivos `MISSING_ITEM`, `WRONG_ITEM`, `DAMAGED_ITEM`, `LATE_DELIVERY`, `PRICE_DISPUTE`, `SAFETY_CONCERN`, vinculados estrictamente a categorías G40 `LOSS`, `QUALITY`, `DISPUTE` y `SAFETY`. El usuario elige además severidad `LOW/MEDIUM/HIGH` sin automatizar ni emitir SOS. Se exige UUID sintácticamente válido; **no se afirma titularidad** hasta validación servidor.
2. Memoria efímera ligada a `passenger` + `subject` UUID + `sessionRevision`; otro rol, cambio de cuenta, JWT/revisión o cierre de sesión purga la guía. `review` devuelve **solo** un objeto para revisión local, sin idempotency key ni transferencia: `caseCreated:false`, `operatorNotified:false`, `merchantContacted:false`, `sosDispatched:false`, `ownershipVerified:false`, `submitted:false`. Sin métodos de red, push, llamada o creación de caso.
3. `merchant-support-guide.d.mts`: tipos para el módulo y las categorías de G40.
4. `merchant-support-guide.test.mjs`: pruebas adversariales con separación de roles/cuentas, rotación de sesión, UUID inválido, PII/control/bidi, campos inyectados, edición incompleta, gravedad de seguridad sin SOS, mapeo de motivos, clear/dispose y ausencia de POST.
5. `app/soporte.tsx`: panel de "Ayuda con pedidos", visible **solo con sesión Cliente autenticada**, con motivo, gravedad e ID, revisión segura y borrado. La pantalla existente de borrador libre y el formulario estructurado G40 de STAGING permanecen separados; no se transforma una guía en ticket sin consentimiento/contrato. React key por `privateViewRevision` y `dispose` en desmontaje.

## Estado de contratos A auditado

HEAD A `9cfbacb530b9119537670ae2da41431380655ccf` al inicio de R40, OpenAPI `1.0.0-g57`: `POST /v1/staging/safety/incidents/report`, `GET /v1/staging/safety/incidents/{incidentId}/status` y `GET /v1/staging/admin/incidents/queue` siguen `x-qore-runtime-wired:false`. También `GET buyer branches/catalog` y `POST buyer reservations-g45` permanecen sin montar. El nombre de ruta G40 no garantiza que un comercio atienda casos, que haya operadores ni un SOS. Ningún dato real de usuario ni credenciales fue enviado.

## Dependencias del Arquitecto A

- Identidad, propiedad del `MERCHANT_ORDER`, relación con comercio y reparto, RBAC y RLS verificadas en servidor.
- Contrato explícito de reporte vinculado a pedido real, categoría y severidad, número de caso persistido y estado verificable, idempotencia y conciliación de respuesta ambigua.
- Comunicación comercial/soporte con autorización temporal, moderación y privacidad. Asignación de operador y respuestas reales; no inferir contacto desde escritura QA.
- Canal de seguridad/emergencia operado, certificado y legalmente adecuado; no presentar formulario como respuesta a peligro inmediato.
- Políticas de evidencia, privacidad, trazabilidad, vencimiento y retención; farmacéuticos y otros artículos regulados sujetos a requisitos legales.

## QA

Comprobar tres workflows **sobre el mismo SHA final**: ownership B, Admin Web QA y two-app isolation (Cliente/Driver npm tests/typecheck/export). Un export web verde no equivale a app Android/iOS certificada. El siguiente arquitecto debe leer este documento y los handoffs R1–R39, **no repetir** trabajo, continuar R41 o un módulo independiente en B si A aún no puede montar incidentes. Registra bloqueos en issue #9. PR #8 conserva DRAFT; NO MERGE / NO LIVE.

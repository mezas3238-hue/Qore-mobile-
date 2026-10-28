# QORE Mobile — Arquitecto B · R41 Seguimiento verificable de incidencias QA

Fecha: 2026-10-24. Rama: `feature/mobility-cliente-admin-parallel-20261022`. PR #8 DRAFT. Repositorio: `mezas3238-hue/Qore-mobile-`.

## Alcance y contexto
Tras R40 (guía de soporte local para pedido comercial), R41 endurece la **presentación de estado de la incidencia G40 existente**. El backend del Arquitecto A todavía declara `POST /v1/staging/safety/incidents/report` y `GET /v1/staging/safety/incidents/{incidentId}/status` QA-only con `x-qore-runtime-wired:false` en OpenAPI `1.0.0-g57` consultado durante R41. Un recibo de base QA no es una incidencia operativamente atendida, no genera un ticket comercial real, no contacta emergencias y no acredita contacto al repartidor o comercio.

## Código implementado
- `apps/movete-cliente/src/domain/g40-incident-status-view.mjs`: proyector puro sin HTTP, storage, navegación ni efectos. Recibe exclusivamente snapshot del flujo G40 preexistente; exige Auth Cliente, `contractReady:true`, `qaDatabaseOnly:true`, `statusFresh:true`, `phase:'acknowledged'`, `operatorNotified:false`, `sosDispatched:false`. Revalida forma exacta del recibo `incidentId/receiptId/state/revision/createdAt/observedAt/receiptStatus`, UUID, ISO, cronología y **frescura máxima inferior a 45 segundos**, sin aceptar timestamps futuros. El estado `open/triaged/investigating/resolved/dismissed` se proyecta a etiquetas explícitamente de QA; no infiere historial, operador, gestión humana, comunicación comercial ni SOS. Errores ocultan recibo, estado e IDs anteriores.
- `g40-incident-status-view.d.mts`: tipos de entrada/salida QA-only y flags negativos.
- `g40-incident-status-view.test.mjs`: 10 regresiones de frescura, actor, tipos, cronología, campos contaminados, revisión, estado desconocido, logout, permisos y semántica no-SOS.
- `apps/movete-cliente/app/soporte.tsx`: el componente `StructuredQaIncident` usa el proyector antes de mostrar `receiptId` o estado. Si el snapshot está ausente, caducado, en vuelo, bajo rotación de sesión o inválido, muestra "Estado no verificado o vencido" y oculta datos anteriores; conserva la acción de `refreshIncidentStatus` G40 existente (solo si el reporte ya está `acknowledged`). Se preservan borradores R40 y G40, sin crear ticket, mensaje ni contacto nuevos.

## Problemas evitados
- No mostrar estados QA antiguos como si fueran situación actual cuando `statusFresh` ya no es suficiente.
- No afirmar que `triaged`, `investigating`, `resolved` o `dismissed` implican intervención humana.
- Nunca fabricar cronología, historial de contactos, tiempos de respuesta ni una persona responsable a partir de un único snapshot.
- No copiar referencias visuales o código de competidores; no exponer datos de otros usuarios.
- Reutilizar controlador G40 para consulta autenticada y reconciliación de estados; **no se añadió un segundo gateway ni un segundo POST**.
- No tocar propiedad del Arquitecto A (`apps/mobility-expo/**`/Driver/backend) ni Admin B innecesariamente.

## Pendientes de Arquitecto A / issue #9
1. Montar y certificar Auth Passenger, pertenencia del `MERCHANT_ORDER`, PostgreSQL RLS, roles y revocación para G40; no basta una ruta OpenAPI.
2. Contrato específico de atención comercial: confirmación de operador asignado, tiempos de respuesta, mensajería y recepción efectiva por comercio, sin convertir estado QA en gestión.
3. Estados operativos y transiciones auditadas, temporalidad/TTL, paginación de eventos solo cuando exista una API server-authoritative y con permisos adecuados.
4. SOS/emergencia necesita integración operativa separada; prohibido falsear llamadas.
5. E2E QA con dos sesiones, JWT rotado, receipts obsoletos, otros propietarios y periodos de desconexión. Pruebas nativas Android/iOS además de Expo web.

## Pruebas, publicación y continuidad autónoma
Verificar **3/3 workflows del HEAD FINAL**, no únicamente un commit intermedio: propiedad de archivos B, Admin Web QA y aislamiento Expo Client/Driver, incluyendo tests Node y TypeScript/export WEB. Export web no equivale a app nativa certificada. Registrar fallos con logs y corregir antes de certificar.

Siguiente R42: ampliar el seguimiento de comunicaciones operativas **solo si** el Arquitecto A monta y certifica identidad, mensajes y receipts; de lo contrario avanzar validadores de UX/privacidad sobre Cliente o Admin independiente, sin reescribir G40/G51/G52/G53 ya existentes. Revisar siempre HEAD A/HEAD B y evitar conflictos con Arquitecto A.

**Prohibiciones:** NO MERGE, NO LIVE, NO VPS, NO PSP real, no secrets, no PII reales, sin impacto a Driver; PR #8 continúa DRAFT. El Owner no autoriza cambios de producción por pedir "avanza".

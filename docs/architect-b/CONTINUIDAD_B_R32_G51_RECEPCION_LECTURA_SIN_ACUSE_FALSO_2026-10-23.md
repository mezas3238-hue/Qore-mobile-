# QORE Mobile · Arquitecto B — R32: acuse de lectura privado G51 sin falsos positivos

**Corte:** 23-oct-2026 (Paraguay). Repositorio `mezas3238-hue/Qore-mobile-`, rama `feature/mobility-cliente-admin-parallel-20261022`, [PR #8](https://github.com/mezas3238-hue/Qore-mobile-/pull/8) **DRAFT**. Sin merge, LIVE, VPS, datos reales ni cambios a áreas Arquitecto A.

## Base histórica certificada

- R31 funcional [`3701d1db`](https://github.com/mezas3238-hue/Qore-mobile-/commit/3701d1db82c87e5811361a98e39f756486b3941f), CI [#40050869570](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40050869570): **Cliente 542/542 PASS**, **Driver 45/45 PASS**, TypeScript/export web e aislamiento SUCCESS; Admin [#40050869557](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40050869557) **185/185 PASS**; ownership [#40050869683](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40050869683) SUCCESS. **727/727 Cliente + Admin PASS**; QA sintética, no teléfonos reales ni backend conectado.
- OpenAPI rama A leído al iniciar R32: `1.0.0-g53`, **63 paths**, blob `db55e27a78b79353586dd94a50cfbd9acf12a8fc`. Chat G51/G52/G53 permanece marcado `x-qore-runtime-wired:false`. G51 `POST /v1/staging/chat/conversations/{conversationId}/read-receipt` recibe `{throughSeq:number}` y responde `{conversationId,readThrough,qaOnly:true}`. El historial G52 `ChatHistoryMessageG52` incluye `messageId, senderRole, body, createdAt, revision` pero **NO tiene `seq`**. Por eso ni `revision` ni `createdAt` pueden tomarse como lectura `throughSeq` sin un contrato nuevo.
- Handoff de R31 [`cca88821`](https://github.com/mezas3238-hue/Qore-mobile-/blob/cca8882180dba224d495d9cac3e8b12f1ab3a304/docs/architect-b/CONTINUIDAD_B_R31_G53_ENVIO_IDEMPOTENTE_2026-10-23.md).

## R32 — implementación y pruebas en B

1. [`2f912ce1`](https://github.com/mezas3238-hue/Qore-mobile-/commit/2f912ce156e80aaa2e4391dacb8d7ebbc2a73e4f): `apps/movete-cliente/src/domain/g51-chat-read-receipt-http-gateway.mjs`. Nuevo transporte HTTP independiente `createG51ChatReadReceiptHttpGateway` con flags `enabled, contractCertified, stagingRuntimeVerified` **OFF por defecto**; sin endpoint ni secretos codificados. `markRead` requiere `conversationId` UUID, `throughSeq` entero seguro no negativo **explícito** (no deriva del GET G52), `subject` Passenger, `sessionRevision`.
   - HTTPS exacto fijado mediante `origin`/`pinnedOrigin`, token Bearer saneado, JWT revisado antes/después de POST, `credentials:'omit'`, `redirect:'error'`, `cache:'no-store'`, body JSON exclusivo `{throughSeq}`, nada de cuerpos privados ni PII en recibo.
   - AbortController, timeout, bounded response, content-type y ACK whitelist: `conversationId` debe coincidir, `readThrough >= throughSeq` y `qaOnly:true`; cambios de JWT/logout descartan respuestas viejas; 401/403 solo revocan sesión estable.
   - Un 200 corrupto, ACK de otro hilo, watermark atrasado, 503 o timeout **NO** confirman lectura, retornan `READ_RECEIPT_UNCONFIRMED`. No se notifica “leído” sin ACK.
   - **Intencionalmente NO conectado a `ClientExperience` ni a UI**: todavía no hay `seq` verificada para generar una solicitud segura, y el endpoint A NO está montado.
2. [`4e34752f`](https://github.com/mezas3238-hue/Qore-mobile-/commit/4e34752f7d8dc292874095e03d508443c6fbc7bf): once pruebas unitarias (flags OFF, URL+JSON, secuencias inválidas/cross-user, JWT Driver/expirado/header injection, ACK falso/PII, respuesta corrupta, 401/403, rotación JWT, cancelación, throughSeq 0 y concurrencia).
3. [`46b1914b`](https://github.com/mezas3238-hue/Qore-mobile-/commit/46b1914b2459ee39b1f20eeb498822a222e79f2a): `app/conversaciones.tsx` deja de truncar el contador de mensajes no leídos a “99+”; ahora muestra el número **completo** que autorizó G51 (el store ya aceptaba 151+ sin recortes). El footer explica que abrir historial no equivale a marcar leído y se requiere ACK servidor.
4. [`08a25339`](https://github.com/mezas3238-hue/Qore-mobile-/commit/08a2533994a13a9cafdb54249153cb809220605c): prueba de integración Cliente con G51 bandeja `unreadCount=151` y G52 GET de historial que verifica que leer la página NO crea un POST de read-receipt ni cambia el contador local sin ACK.

## CI y validación

- Para el último código R32 `08a25339`, consultar las tres ejecuciones GitHub Actions asociadas; verificar Cliente/Driver isolation, Admin Web y Architect B ownership. **No atribuirle resultados anteriores de R31.** Se deberán revisar conteos Node `# tests`, `# pass`, `# fail`, TypeScript y export web y corregir cualquier regresión antes de certificar.
- Las once pruebas de gateway y una prueba end-to-end Cliente son sintéticas, no certifican una base real.

## Bloqueos precisos de A y próximos pasos

1. **Contrato A:** agregar `seq` monotónica confirmada por backend a `ChatHistoryMessageG52` (o un watermark equivalente explícito y firmado por actor/hilo) y documentar si (readThrough) se permite solo hasta secuencia propia visible o la del último mensaje legítimo. No inferir seq de `revision`, `createdAt`, índice local, UUID ni cursor.
2. **Runtime A:** montar `POST /v1/staging/chat/conversations/{conversationId}/read-receipt` autenticado con G42/PG/RLS y validación de asignación actual, impedir marcar mensajes de terceros o secuencias futuras, asegurar `readThrough` monotónico en SQL, probar reintentos, 401/403 y dos identidades sintéticas. Presentar SHA, CI y evidencia de STAGING real.
3. **B al recibir evidencias:** conectar `markRead` solo tras GET autorizado con watermark seq exacto de A, no al simple abrir chat, nunca con seq inventada y no usar datos personales reales. Preservar contador G51 hasta refrescar desde servidor.
4. Seguir pruebas nativas Android/iOS y E2E Cliente↔Driver cuando A monte también G52 GET y G53 POST/ACK con idempotencia; no confundir 727/727 pruebas QA con disponibilidad LIVE.

**Estado operativo:** ninguna escritura HTTP ni lectura real se activa por este corte. PR #8 sigue DRAFT, sin merge/deploy. El nuevo gateway está aislado y apagado por falta de runtime y seq de A.

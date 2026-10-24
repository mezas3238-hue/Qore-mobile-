# QORE Mobile · Arquitecto B — R31 G53 POST idempotente con lectura G52

**Corte de ingeniería:** 23-oct-2026, Paraguay. Repositorio `mezas3238-hue/Qore-mobile-`, rama `feature/mobility-cliente-admin-parallel-20261022`, PR [#8](https://github.com/mezas3238-hue/Qore-mobile-/pull/8) **DRAFT**. Solo área B (`apps/movete-cliente/**`, `docs/architect-b/**`). NO MERGE, NO LIVE, NO secretos, datos reales, VPS ni pagos.

## Baseline

- R30 funcional [`07df8938`](https://github.com/mezas3238-hue/Qore-mobile-/commit/07df8938832a960a963ca70615cef137f3be03c7): [CI aislamiento/Cliente/Driver #40050139688](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40050139688) 3/3 SUCCESS en combinación con Admin [#40050139702](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40050139702) y boundary [#40050139698](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40050139698). Cliente **529/529**, Admin **185/185**, Driver **45/45**. 714/714 Cliente+Admin PASS, QA sintética y Expo web. [Handoff R30](./CONTINUIDAD_B_R30_G52_SOLO_LECTURA_INTEGRACION_2026-10-23.md).
- A publica OpenAPI `1.0.0-g53`, **63 rutas**, blob `428c4ba60fc9d4906c9bc368231c01f713ec2ac6`, nuevo **POST `/v1/staging/chat/services/{serviceKind}/{serviceId}/conversations/{conversationId}/messages`**, request `ChatPassengerSendRequestG53` con `requestKey+body`, ACK `ChatPassengerStoredAckG53` con `conversationId,serviceId,requestKey,messageId,senderRole,body,createdAt,revision,serverStored`. Contrato corresponde al Cliente B, pero **`x-qore-runtime-wired:false`, `x-qore-qa-only:true`**. Ningún POST está montado en servidor.
- G52 GET y G53 POST siguen sin runtime verificado en A; no activar escrituras a nivel de producción.

## Trabajo publicado R31

1. [`8e64ff6d`](https://github.com/mezas3238-hue/Qore-mobile-/commit/8e64ff6d8fe4931f0e611100cd5f2a2970581fc6): nuevo `apps/movete-cliente/src/domain/g53-chat-send-http-gateway.mjs`.
   - `createG53ChatSendHttpGateway` con `enabled/contractCertified/stagingRuntimeVerified` **OFF por defecto**, origen HTTPS estricto y pin independiente, JWT Passenger desde sesión actual y validación `subject/sessionRevision/authRevision`.
   - Rechaza ID malformado, tipo no permitido, body con PII/URLs/correos/controles, tokens Bearer con CRLF/espacios, credenciales URL/redirect/cookies; solo envía JSON estricto `{requestKey,body}` en POST al hilo fijado en path.
   - Un único POST en vuelo, AbortController, deadline y lectura acotada en bytes; 401/403 revocan únicamente la sesión **estable**; respuesta de JWT rotado descarta ACK antiguo. El gateway nunca escribe archivos, logs de body ni token.
   - ACK requiere whitelist y coincidencia exacta de `requestKey/body/conversationId/serviceId/senderRole:'passenger'/serverStored:true`, UUID de mensaje, timestamp seguro y revisión no menor que 2; `passenger-chat-flow` vuelve a validar ACK contra revisión autorizada del GET.
   - **Fundamental idempotencia:** tras despachar POST, timeout, 5xx, 409, 200 malformado, content-type incorrecto, sobre presupuesto de bytes o ACK inconsistente devuelven `CHAT_NETWORK_OR_TIMEOUT`, por lo que el flujo conserva el mismo pending body/requestKey y evita reenvío con nueva clave. Nunca afirmar entrega sin ACK de commit.
2. [`13a1749b`](https://github.com/mezas3238-hue/Qore-mobile-/commit/13a1749b403ded7827354ce3e2d76f157facc900): 10 pruebas unitarias de POST autenticado, flags OFF, HTTPS pin, requestKey en JSON, HTTP sin cookies, scope, contenido malicioso, ACK falso/corrupto, error ambiguo, 401/403 seguro, JWT rotado, abort y concurrencia.
3. [`52abf136`](https://github.com/mezas3238-hue/Qore-mobile-/commit/52abf136f7a9b14fdc767bf73c087dd68c9433ef): composición opt-in de G52 reader y G53 writer en `createClientExperience`. Writer se expone al motor únicamente si **ambos** gateways `isConfigured()===true` y sus orígenes/pins **son idénticos**. Si writer está apagado o apunta a otro origen se conserva G52 **solo lectura** y el UI no muestra editor. La cancelación conjunta aborda lecturas/escrituras en vuelo cuando se cierra sesión.
4. [`3701d1db`](https://github.com/mezas3238-hue/Qore-mobile-/commit/3701d1db82c87e5811361a98e39f756486b3941f): tres pruebas en `client-experience.test.mjs`: GET G52+POST G53 con ACK persistido sintético y ruta exacta, gate bloqueado por runtime OFF/u otro host y 200 malformado que se reconcilia con **misma** `requestKey` (dos POST idénticos; no duplicación en el motor).

## QA CI

- Código R31 `3701d1db`: [aislamiento+Cliente+Driver #40050869570](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40050869570), [Admin #40050869557](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40050869557), [ownership #40050869683](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40050869683).
- **AL MOMENTO DE ESCRIBIR, en cola; no se declara PASS.** Inspeccionar logs Node tests, TypeScript y exports web, corregir solo en archivos B si falla; registrar pruebas y SHA exactos. No extrapolar R30 a R31.

## Continuidad inmediata y dependencias reales

1. Confirmar CI del último SHA del código y corregir cualquier falla; no inventar certificados ni métricas.
2. Arquitecto A debe **montar** G52 GET/G53 POST en runtime STAGING con JWT de proveedor, sesión G42, autorización PostgreSQL/RLS por servicio/driver, commit atómico, garantía de unicidad `requestKey` por conversación/actor, recuperación idempotente de ACK y reglas al revocar asignación. Se requiere evidencia SHA/CI, pruebas entre cuentas sintéticas y Driver y fallas 401/403/409/timeout.
3. Validar que el backend reconcilie POST duplicado con el mismo cuerpo/clave retornando el ACK **original** y jamás cree otro mensaje, incluso si la primera respuesta 200 se perdió; el frontend solo puede preservar la key, la unicidad es responsabilidad del servidor.
4. Con autorización explícita, pruebas nativas Android/iOS en STAGING de Cliente↔Driver con reintento tras ACK incierto, servicio cerrado, reasignación y sesión revocada, sin revelar texto a cuentas ajenas. Lovable seguirá siendo interfaz posterior a infraestructura.
5. Mantener PR #7 A, PR #8 B DRAFT, NO MERGE/NO LIVE, y coordinación [issue #9](https://github.com/mezas3238-hue/Qore-mobile-/issues/9).

**Estado real:** desarrollo integrado del lado Cliente con endpoints **contratados en OpenAPI pero aún no desplegados**; no existe chat comercial operativo ni se debe anunciar disponibilidad a usuarios.

# QORE Mobile / Movete Fácil — Arquitecto B, continuidad R28–R29

**Fecha de corte:** 23/oct/2026, Paraguay. Repositorio `mezas3238-hue/Qore-mobile-`. Rama `feature/mobility-cliente-admin-parallel-20261022`, [PR #8](https://github.com/mezas3238-hue/Qore-mobile-/pull/8) **DRAFT**. Sin merge, LIVE, VPS, pagos, secretos ni datos privados de usuarios. Se respetan rutas B `apps/movete-cliente/**`, `apps/movete-admin/**`, `docs/architect-b/**` y límites A/B.

## Base real verificada

- Handoff previo [R26–R27 SHA `39687780`](https://github.com/mezas3238-hue/Qore-mobile-/commit/39687780ae22b0dc161c41339ed7bb9c9b50cb6f): **3/3 workflows SUCCESS** confirmados de ese documento.
- Corte funcional R27 [`1e638aae`](https://github.com/mezas3238-hue/Qore-mobile-/commit/1e638aaecf02ddb1d62fbf2129e0e37b1a1b4d82): 3/3 workflows SUCCESS, **Cliente 511/511**, **Admin 185/185**, total **696/696 QA PASS**, Typescript y Expo web export. Son pruebas sintéticas, NO pruebas en teléfonos ni endpoints LIVE.
- Lectura directa de OpenAPI A rama `feature/mobility-monorepo-isolated-20261016`: `1.0.0-g52`, **62 paths**, blob `7b291c5de91db201bd66d0e1bf8b102e8e2311a0`. Nuevo **GET** `/v1/staging/chat/services/{serviceKind}/{serviceId}/messages`: DTO `ChatHistoryPageG52` compatible con los campos estrictos Cliente B (IDs, propietario, estado ACTIVE, asignación, revisión, TTL, mensajes, cursor, role, body y createdAt numérico). A especifica encabezado `X-Qore-Chat-History-Cursor`, `expectedConversationId` query, page size <=100. **`x-qore-runtime-wired:false` y `x-qore-qa-only:true`**: endpoint **no está montado**. La operación POST de G50 todavía no cuenta con el ACK B de `requestKey`; no habilitar chat real.

## R28 — transporte de historial HTTPS en STAGING solo bajo opt-in

- [Implementación `785efbd4`](https://github.com/mezas3238-hue/Qore-mobile-/commit/785efbd4a9a70afdac7e041a4849bc0153286cab): `apps/movete-cliente/src/domain/g52-chat-history-http-gateway.mjs`.
- Fábrica `createG52ChatHistoryHttpGateway({enabled,contractCertified,stagingRuntimeVerified,origin,pinnedOrigin,getSession,fetchImpl,onSessionInvalid,now,timeoutMs,maxBytes})`. **Todos los gates OFF por defecto**, sin origen ni token preconfigurados y **sin función `sendMessage`**: no permite ACK inventados.
- Sólo GET exacto G52 con `serviceKind/serviceId` previamente validados, `?limit=100`, `expectedConversationId` query si existe, cursor opaco sólo en `X-Qore-Chat-History-Cursor`. Origen HTTPS fijado y sin user-info, path, query, hash, puerto ni redirect; `Authorization: Bearer <token>` ASCII saneado; `credentials:omit`, `cache:no-store`, `referrerPolicy:no-referrer`.
- Validación JWT/sesión: Passenger, `subject` exacto, token, `authRevision`, `sessionRevision`, vencimiento, igualdad antes y después del GET. Respuesta 401/403 **solo** revoca sesión actual, sin perjudicar token rotado; logout/clear llaman `cancelPending()` para descartar respuestas tardías.
- AbortController, deadline, bounded streaming JSON, content-type y content-length. DTO whitelist estricto: `ownerId` igual actor, asignación actual, estado ACTIVE, `productionEnabled:false`, no PII extra, mensajes 1–500 sans teléfonos/URLs/correos/control/bidi, no duplicados, revisión monotónica por página, timestamps newest-first; cursor no puede repetirse ni aparecer tras página vacía; TTL <=300 segundos.
- [Pruebas R28 `b7669d7e`](https://github.com/mezas3238-hue/Qore-mobile-/commit/b7669d7e5a8b8c5f35d75db8cf9eedf328fbf8b5): 10 escenarios de gates OFF, HTTPS/cursor, scope/headers, DTO falso, paginación válida, 401 JWT rotado, 200 tardío, cancelación, JSON/redirect y deadline.
- **CI SHA `b7669d7e` a verificar**: [Cliente+Driver+aislamiento #40049130675](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40049130675), [Admin #40049130784](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40049130784), [ownership #40049130673](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40049130673). Al publicarse documento, Admin y boundary SUCCESS; isolation pendiente. **NO afirmar conteo hasta leer logs**.

## R29 — pin de hilo de conversación end-to-end

- [Fix `d8a0464a`](https://github.com/mezas3238-hue/Qore-mobile-/commit/d8a0464aaeb4d6b0a3480b17b812f62cdcf1f674), `passenger-chat-flow.mjs`: al invocar gateway GET inicial desde Inbox añade `expectedConversationId` de la ruta, al paginar `older:true` usa el `conversationId` autorizado de página anterior y al reconciliar un POST de respuesta ambigua/TTL expirado obliga al backend a revalidar el **hilo inmutable original**. Esto es una defensa adicional al chequeo del DTO posterior, y aprovecha explícitamente el parámetro G52.
- [Tests `94cf002d`](https://github.com/mezas3238-hue/Qore-mobile-/commit/94cf002d4ac0518b4da7b8376fc8cdb9de39631d): 3 regresiones de hilo fijado en paginación, primera GET desde Inbox y retry pendiente tras TTL con idéntico `requestKey`. No se alteraron POST/send/ACK ni los gates.
- **CI SHA `94cf002d` a verificar**: obtener runs asociados al SHA de tests y confirmar 3/3 con logs; no extrapolar la certificación R28 a R29.

## Estado y continuación

1. Revisar CI de ambos SHAs de código y arreglar dentro de áreas B si falla TypeScript, Node tests, Expo export o límites de propiedad.
2. Esperar A para G52 runtime HTTPS autenticado con JWT Passenger y Driver, RLS, sesión G42, asignación, 401/403, revocación y cursores firmados. No activar flags ni producción sin evidencia de STAGING con dos cuentas sintéticas.
3. Alinear GET `createdAt` newest-first, revisión y orden monotónico. Necesitamos POST de mensajes que confirme `requestKey` exactamente, ACK durable y recepción Driver; G50 POST sin correlación sigue bloqueando conexión bidireccional. No convertir el lector GET en chat habilitado por sí solo.
4. Seguir Cliente/Admin: UX de reconexión, historial, UI accesible, pruebas nativas Android/iOS con datos sintéticos. No afirmar app comercial lista por CI.
5. Documentar todos los SHA y transferir a siguiente arquitecto, continuar desarrollo sin detenerse salvo bloqueo real.

**Advertencia**: Este lector es componente de transporte opt-in, aún no conectado automáticamente a la app: falta un contrato de escritura compatible. La ruta OpenAPI no implica existencia de servidor operativo. Mantener PR #8 DRAFT y no modificar áreas A.

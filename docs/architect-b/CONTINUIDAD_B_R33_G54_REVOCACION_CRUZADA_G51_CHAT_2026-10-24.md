# Movete Fácil · Arquitecto B · R33 — purga cruzada de chat por reasignación verificada

**Fecha:** 24 de octubre de 2026, hora de Paraguay. Repositorio `mezas3238-hue/Qore-mobile-`, rama `feature/mobility-cliente-admin-parallel-20261022`, PR #8 DRAFT. Sin merge, LIVE, VPS, pagos ni datos reales.

## Base R32 y contrato A

- Estado funcional R32: [run Cliente/Driver/aislamiento #40051661349](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40051661349) SUCCESS, **Cliente 554/554 PASS**, **Driver 45/45 PASS**, Admin [#40051661339](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40051661339) **185/185 PASS**, ownership [#40051661284](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40051661284) SUCCESS. **739/739 Cliente+Admin**.
- [Handoff R32](./CONTINUIDAD_B_R32_G51_RECEPCION_LECTURA_SIN_ACUSE_FALSO_2026-10-23.md) documenta GET G52, POST G53 y read receipt G51 opt-in; se mantiene OFF por falta de server runtime/seq.
- OpenAPI A leído directamente al iniciar R33: `1.0.0-g54`, 63 rutas, blob `0b96efe243e8997abbd332409653ffebfe8956e3`. G54 agrega `ChatReadReceiptG54` y `ChatReadReceiptRequestG54` con `throughSeq`, aclara uso de ticket `CHAT_READ` monouso y bloqueo G42/RLS delegado, pero **ninguna ruta Chat tiene `x-qore-runtime-wired:true`**. `ChatHistoryMessageG52` aún NO contiene `seq`; Cliente NO puede marcar lectura automática.

## Problema de privacidad resuelto en R33

Un usuario puede tener en memoria un historial Cliente autorizado para servicio `RIDE/DELIVERY/MERCHANT_ORDER` y luego consultar la bandeja G51 cuando ese mismo servicio tenga una nueva conversación por reasignación de Driver. Antes, `loadChatInbox` no reconciliaba esta prueba positiva de que el hilo local ya no coincide y el historial antiguo podía seguir visible hasta nueva apertura, logout o vencimiento TTL.

### Implementación

- [`271c9b2e`](https://github.com/mezas3238-hue/Qore-mobile-/commit/271c9b2ed154c79b5dbefcd41d1b9b2ba94a2452), `apps/movete-cliente/src/domain/client-experience.mjs`: después de que `chatInbox.load(args)` devuelva `ok:true`, usa **únicamente** `chatInbox.snapshot()` con `readReady && !loading && !stale`, busca fila con **igual servicio y tipo** que `chatFlow.snapshot()` y **conversationId distinto**. Si encuentra contradicción certificada, invoca `chatFlow.clear()` y `chatHintStore.clear()`. El clear aborta/descarta flujo GET/POST activo, mensajes privados en memoria y estado pending ambiguo; la UI genera una nueva view key al perder autorización para desmontar el draft local.
- No se infiere revocación por ausencia de un servicio en la página (paginación de 100 sin límite global), por una respuesta fallida/inválida ni por una fila de otro servicio. No modifica G51, G52, G53 ni A.
- [`2f4e6fe7`](https://github.com/mezas3238-hue/Qore-mobile-/commit/2f4e6fe7454a040c14eebcf5ba66db2ae8248318), `apps/movete-cliente/src/domain/client-experience.test.mjs`, **4 pruebas sintéticas**: purga al cambiar conversationId del servicio, conservación ante página vacía/otro servicio/ID coincidente, ignorar página malformada, y no reintentar POST ambiguo de un hilo reasignado (se conserva NO-ACK: jamás afirmar entrega).

## QA / CI

SHA de funcionalidad + tests: `2f4e6fe7454a040c14eebcf5ba66db2ae8248318`.

- [Cliente/Driver/aislamiento #40056756096](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40056756096)
- [Admin #40056756150](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40056756150)
- [ownership #40056756148](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40056756148)

**En el momento de redactar:** aislamiento SUCCESS, Cliente/Driver en ejecución y Admin/ownership sin verificación final. El siguiente arquitecto debe obtener los logs `# tests/# pass/# fail`, confirmación TS/export web y CI 3/3; corregir únicamente rutas B antes de declarar R33 certificado.

## Dependencias y próximos pasos

1. Arquitecto A montar realmente las rutas G51 inbox/read receipts, G52 GET y G53 POST con JWT Passenger/Driver, RLS, persistencia, idempotencia `requestKey` y snapshot firmado actualizado ante reasignación. Mantener pruebas de dos cuentas sintéticas y revocación en tiempo de ejecución. No usar la mera aparición de schemas `G54` para inferir servidor activo.
2. A agregar `seq` real por mensaje (o watermark firmado equivalente) antes de que B conecte G51 receipt; no derivar `throughSeq` de timestamps, UUID, revision o índice local.
3. B probar reasignación durante GET/POST real, cachés de Inbox paginadas y borrado de borradores en Android/iOS cuando exista backend STAGING. Las pruebas actuales ejercitan lógica Node y export Expo web, no simulan teléfonos conectados.
4. Continuar paralelamente Cliente/Admin dentro del ownership B, coordinar por issue #9, PRs DRAFT, sin merge ni despliegue hasta mandato Owner.

**Regla de privacidad:** una evidencia positiva y autorizada de hilo reemplazado purga inmediatamente el anterior; la simple ausencia en una página NO autoriza conclusiones sobre asignaciones.

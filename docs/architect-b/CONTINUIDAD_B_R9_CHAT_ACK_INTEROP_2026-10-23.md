# QORE Mobile — Arquitecto B R9 · Chat: ACK idempotente e interoperabilidad sintética

**Fecha:** 2026-10-23. **Owner:** Movete Fácil debe permitir que Cliente escriba al conductor o repartidor **asignado**, y recibir respuesta en su app independiente. **PR #8 DRAFT**. Sin merge, sin LIVE, sin pagos, sin VPS, sin datos reales.

## Anteriores obligatorios

Leer primero los handoffs de B R3→R8, especialmente `docs/architect-b/CHAT_CLIENTE_DRIVER_DELIVERY_R6_2026-10-23.md` y `docs/architect-b/CONTINUIDAD_B_R8_CHAT_PUSH_REVOCACION_2026-10-23.md`. La rama del Arquitecto A en PR #7 conserva backend, Driver, OpenAPI, Auth, PostgreSQL y CI global; B solamente edita `apps/movete-cliente/**`, `apps/movete-admin/**` y `docs/architect-b/**`.

## Implementación concreta (nuevo trabajo R9)

| Commit | Qué cambia | Pruebas |
|---|---|---|
| [`595a9a9b`](https://github.com/mezas3238-hue/Qore-mobile-/commit/595a9a9b787e6b5501a65c9f3f02e254458f9839) | `passenger-chat-flow.mjs`: un ACK con `messageId` previamente visto es éxito solamente si coincide **body, senderRole, createdAt y revision** de la misma fila; la colisión se rechaza y purga el hilo. Un replay exactamente idéntico sigue siendo válido para idempotencia. | +3 pruebas, CI ownership/Admin/aislamiento SUCCESS. |
| [`75524a62`](https://github.com/mezas3238-hue/Qore-mobile-/commit/75524a62d60a7e5ed8d8e29eac4cc725999acee3) | Si un ACK válido llega después de caducar el permiso temporal, el Cliente NO afirma entrega pero conserva `body` y `requestKey` para revalidar con `retryPending()`. La UI comunica condición incierta. ACK con identidad cruzada es inválido. | +2 pruebas, CI ownership/Admin/aislamiento SUCCESS. |
| [`8cbf3b2f`](https://github.com/mezas3238-hue/Qore-mobile-/commit/8cbf3b2f6e0b15969375c0fc16ead7e8d064bca8) | `passenger-chat-interop.test.mjs`: nuevo ensayo **sintético en memoria**, dos actores pasajero/repartidor, intercambio bidireccional, denegación a impostor/otro pasajero, revocación, timeout después de commit, idempotencia de clave y 640 mensajes paginados (sin cuota global), más privacidad de hints. | +6 pruebas. Confirmar CI de este SHA: **no confundir simulador con backend real**. |

Total nuevas pruebas declaradas R9: **11**. Extraer cifras de GitHub Actions del último SHA para certificar: Cliente Node test, TypeScript, Expo export, Driver typecheck/export, Admin web test/build y ownership.

## Estado real de la integración

- **Funcional en dominio Cliente QA:** chat por RIDE/DELIVERY/MERCHANT_ORDER, seguridad de sesión, reintentos idempotentes, validación de ACK, historial por cursor, cambio de conversación sin filtrar borradores y hints sin texto privado.
- **No disponible todavía:** mensajes reales cruzando red entre las apps, persistencia PostgreSQL, push de Android/iOS, bandeja/respuesta en Driver, operador de seguridad y Auth real certificado.
- Último PR A consultado: SHA `4a4bdb51fa7e1f32ae6b0328acc92952a5c23805`, OpenAPI `1.0.0-g47`, 54 rutas, **sin** endpoints `chat/message/conversation`. El `driver/inbox` que existe es para ofertas, no mensajería.
- El simulador B es una **prueba de aceptación** que A podrá utilizar al implementar su servicio, no una app Driver ni autorización de producción.
- **Mantener dos apps separadas**: `apps/movete-cliente` vs `apps/movete-driver`, Admin Web aparte.

## Próximas tareas sin detenerse salvo bloqueo real

1. Comprobar CI del último código y del presente documento; si falla, inspeccionar logs y reparar en B.
2. Prioridad Arquitecto A: contrato OpenAPI de chat versionado, vínculo de conversación por assignment activo y JWT, persistencia e idempotencia real `(actorId,conversationId,requestKey)`, lista/inbox en Driver, push genérico, controles de revocación y límites antiabuso; demostrar runtime HTTPS STAGING montado.
3. Prioridad B desbloqueada: robustecer comportamiento de actualizaciones, paginación, errores de transporte 2G, seguridad de privacidad y UI accesible; luego integrar ruta real solo con contratos de A y pruebas inter-actor que impidan falsificar destinatario.
4. El servidor deberá garantizar que el **mismo messageId** nunca signifique dos mensajes diferentes; conservar `requestKey` tras respuesta ambigüa, y no certificar entrega/lectura sin ACK durable.
5. No modificar backend/Driver ni fusionar PR #8; no LIVE/PSP/PII real. Documentar discrepancias en [issue #9](https://github.com/mezas3238-hue/Qore-mobile-/issues/9).

**Continuidad:** reanudar desde HEAD actual PR #8, jamás desde cero, y avanzar por trabajos B independientes hasta que el bloqueo de backend A se resuelva.

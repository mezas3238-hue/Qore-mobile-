# QORE Mobile — Movete Fácil / Arquitecto B R10 · Bandeja privada de conversaciones

**Fecha:** 23-oct-2026 (Paraguay). **PR #8 DRAFT**, rama `feature/mobility-cliente-admin-parallel-20261022`. **Sin merge, producción, LIVE, VPS ni pagos reales.**

## Handoffs previos (no reiniciar trabajo)
R3 `HANDOFF_MAESTRO_B_R3_CLIENTE_ADMIN_TOTAL_2026-10-23.md`, R4 `CONTINUIDAD_B_R4_G44_BUYER_BRANCHES_2026-10-23.md`, R5 `CONTINUIDAD_B_R5_G44_HTTP_G45_QA_2026-10-23.md`, R6 `CHAT_CLIENTE_DRIVER_DELIVERY_R6_2026-10-23.md`, R7 `CHAT_CLIENTE_DRIVER_R7_SEGURIDAD_RECONEXION_2026-10-23.md`, R8 `CONTINUIDAD_B_R8_CHAT_PUSH_REVOCACION_2026-10-23.md`, R9 `CONTINUIDAD_B_R9_CHAT_ACK_INTEROP_2026-10-23.md`.

## Implementado en R10 — área B únicamente

| Commit | Entrega | Verificación |
|---|---|---|
| [`829304ba`](https://github.com/mezas3238-hue/Qore-mobile-/commit/829304ba6b5c6e7dfdc4baf1653ccb521988e91a) | Nuevo `apps/movete-cliente/src/domain/passenger-chat-inbox.mjs` + tests. Bandeja privada por usuario Passenger, validación estricta de DTO con campos exactos, servicios RIDE, DELIVERY y MERCHANT_ORDER, solo asignación activa, `canSend:true`, revisión y expiración, errores fail-closed, cursores opacos; paginación ilimitada en servidor y ventana local de 300 filas predeterminada. | +10 tests, workflows ownership/Admin/aislamiento SUCCESS |
| [`459637a2`](https://github.com/mezas3238-hue/Qore-mobile-/commit/459637a2a06a44ac0935ae61ac6050f6b1ca1371) | Estado privado en `client-experience.mjs` y tipos, acciones `loadChatInbox/clearChatInbox`, limpieza en logout/JWT rotado, ruta Expo `/conversaciones`, enlace desde Inicio, lista accesible y paginación manual; abrir desde lista hacia `/mensajes` revalida asignación en su propio gateway. | +3 tests integración. [CI Cliente/Driver #40025325395](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40025325395) SUCCESS: **437/437 Cliente PASS** y export TypeScript/Expo/Driver SUCCESS; [Admin #40025325369](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40025325369) SUCCESS **185/185**; [Boundary #40025325399](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40025325399) SUCCESS. |

**Resultado QA:** **622/622 pruebas Cliente+Admin PASS**, más exportación web TypeScript y aislamiento. No certifica funcionamiento Android/iOS real ni HTTPS, RLS, notificaciones móviles o cuenta Driver.

## Reglas de seguridad de la bandeja

- **OFF por defecto** sin `enabled=true`, `contractCertified=true`, `stagingRuntimeVerified=true`, `isConfigured()===true` y transporte `readInbox` explícitamente inyectado. `ClientRuntimeProvider` por defecto NO inyecta nada. No inventar URLs.
- Cada página debe pertenecer al **Passenger autenticado**, no al conductor; el backend nunca debe confiar en el subject emitido por frontend sin vincularlo al JWT.
- `items` máximo 100 **por página**, sin límite global de conversaciones. Ventana móvil 300 filas, configurable 100–5000, para no saturar RAM.
- Nunca incluir nombres, teléfonos, fotos, GPS, preview de mensaje, payload push, tokens, PII o datos de otro usuario en el DTO de bandeja. Abrir una conversación **requiere otra verificación autoritativa** de asignación activa en el servidor.
- Revisión coherente y cursor no repetido, protección de actor/revisión de sesión antes y después de cada lectura, descarga fuera de sesión y revocación inmediata del gate.
- El número de mensajes no leídos proviene del servidor, la UI no inventa acciones `markRead` ni afirma entrega o lectura.

## Bloqueos A y responsabilidades

El Owner exige dos apps móviles **separadas**: Cliente y Driver. Arquitecto A tiene `apps/movete-driver/**`, `apps/mobility-expo/**`, Node/PostgreSQL/OpenAPI/SQL/Auth y workflows; Arquitecto B solo `apps/movete-cliente/**`, `apps/movete-admin/**`, `docs/architect-b/**`.

Al último corte comprobado, **PR #7 HEAD `4a4bdb51fa7e1f32ae6b0328acc92952a5c23805`**, OpenAPI **G47**, sin endpoints `chat/message/conversation`. Un inbox de ofertas Driver NO es mensajería. A debe construir:
1. Conversations Inbox autoritativo JWT/RLS por Passenger y Driver con cursor HMAC y limit por página, revisiones/TTL.
2. Mensajes bidireccionales `GET` paginada y `POST` idempotente de texto, `requestKey` + `messageId` únicos, ACK duradero, bloqueo de colisión y revocación al cambiar/terminar asignación.
3. Chat e inbox dentro de **app Driver**, con seguridad contra escritura al conducir; entrega auto/moto y viaje auto, push genérico privado/antiabuso y SLA/retención según política.
4. Staging HTTPS realmente montado con JWT, aislamiento entre 2 pasajeros y 2 conductores, intercalado de sesiones, duplicados/paginación 100+, pruebas nativas Android/iOS y E2E. No autorizar flags `runtime-wired` por la sola existencia de esquema.

Issue [#9](https://github.com/mezas3238-hue/Qore-mobile-/issues/9) contiene la transferencia específica a A; PR #8 DRAFT conserva la implementación B.

## Siguiente trabajo B
1. **Confirmar 3/3 CI del nuevo HEAD** después de este documento y corregir errores propios con logs. Sin esperar un permiso si los tests fallan.
2. Extender pruebas de reintentos y cursores contra respuestas HTTP sintetizadas y E2E visual Android/iOS cuando herramientas de ejecución lo permitan.
3. Integrar el backend de conversaciones al recibir **contrato A y pruebas STAGING reales**; nunca activar datos sintéticos como producción.
4. Continuar UX Cliente y seguridad Admin Web donde no depende de A. Mantener PR DRAFT, sin merge, LIVE ni despliegues.

**Mandato continuidad:** nunca comenzar de cero, desarrollar en el área B sin pisar A; si A aún no tiene API, documentar el bloqueo y continuar con otra tarea B.

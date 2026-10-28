# QORE Mobile — Movete Fácil · R6 Mensajería Cliente ↔ Driver / Delivery

**Fecha:** 2026-10-23 · **Owner:** requisito explícito de mensajes de Cliente a conductor de viaje o repartidor de envíos/pedidos. **No es todavía un servicio desplegado.** PR #8 DRAFT, sin merge ni LIVE.

## Experiencia comprometida

- App **Cliente**: en seguimiento de un automóvil efectivamente asignado, abrir **Mensajes con mi conductor**; para DELIVERY o MERCHANT_ORDER, abrir el mismo chat desde el **seguimiento autoritativo** del envío o pedido cuando el servidor certifique esa asignación. La pantalla existe pero se mantiene desactivada sin backend.
- App **Driver**: cada conductor o repartidor recibe y contesta desde su **propia app independiente**, nunca desde Cliente. Priorizar seguridad al conducir (silenciar redacción activa en movimiento / opciones de respuesta segura definidas por A).
- Conversación **privada por servicio**, con mensajes escritos, recepción bidireccional, historial paginado, notificación genérica de mensajes nuevos, eventual evidencia explícita de entregado/leído si el backend lo certifica.
- No requerir ni exponer teléfono personal. Bloquear URL/PII en logs; no prometer cifrado E2E inexistente. No incluir adjuntos, enlaces, fotos, audio, GPS ni teléfono oculto como mensajes automáticos hasta una política revisada.
- Seguridad: chat NO sustituye botón SOS, servicio de emergencias ni soporte. Prever bloqueo y reporte de abuso, rate-limit por identidad/servicio, retención auditada y push sin texto sensible visible en dispositivo bloqueado.

## Código implementado por B, sin tocar A

| SHA B | Implementación |
|---|---|
| `0eb69ca5` | `apps/movete-cliente/src/domain/passenger-chat-flow.mjs`, test inicial. Flujo de conversación por RIDE/DELIVERY/MERCHANT_ORDER, proof de asignación persistida (DTO certificado por A), actor/rol Passenger, receptor Driver, cursor, version/revision/TTL, ACK serverStored, requestKey idempotente. Primera CI halló nombre de función erróneo. |
| `36cbb4e0` | Bloqueo de cambio de hilo si existe mensaje ambiguo no reconciliado; conserva requestKey. |
| `f4b49607` | Reparación del fallo de CI en ACK: `validMessage` → `validateMessage`, suite posterior SUCCESS. |
| `df31dd8f` | Integración en ClientExperience/d.mts, callbacks abrir/enviar/reintentar; purga en logout/JWT rotado; pruebas sintéticas de sesión. |
| `6ad042c5` | `retryPending` conserva body/requestKey exactos para no duplicar mensajes ante red incierta. |
| `ed7bd630` | Nueva pantalla Expo `app/mensajes.tsx`, ruta, navegación desde inicio/seguimiento, texto de estado para envíos, a11y, teclado, sin fake delivery. |
| `3f237b5b` | Corrección de `keyboardDismissMode="on-drag"` detectada por suite accesibilidad; último **HEAD funcional** antes de este documento. |

**QA funcional sobre SHA `3f237b5b6cb144de1dcd5a94a4c6fabb109333b6`:**
- [Cliente/Driver aislamiento #40007137600](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40007137600): SUCCESS. **Cliente 387/387 PASS**, TS + Expo web export SUCCESS; Driver TypeScript/export SUCCESS; aislamiento SUCCESS.
- [Admin Web #40007137571](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40007137571): SUCCESS.
- [B ownership #40007137521](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40007137521): SUCCESS.
- El frontend con `ClientRuntimeProvider` por defecto **no instala gateway de chat**, evita inventar conexión o presentar un chat real. Pese a estas pruebas, **NO existe chat bidireccional E2E real**.

## Contrato pendiente a cargo de A (issue #9)

**A** implementa Node/OpenAPI/PostgreSQL + Driver UX, sin editar archivos B:
1. Descubrimiento autoritativo de conversaciones por cuenta autenticada y servicio; solo servicios asignados actualmente; roles Passenger ↔ Driver y asignación persistida. No permitir elegir destinatario con UUID arbitrario; servidor verifica a cada solicitud.
2. GET lectura paginada por cursor opaco vinculado a cuenta/conversación/revisión; máximo 100 mensajes **por página**, sin máximo global de historial.
3. POST idempotente `requestKey` UUID para texto 1–500 chars y ACK persistido `serverStored=true`, `messageId`, `createdAt`, `revision`. Estado de entrega/lectura solo bajo evidencia. Reintentos no producen duplicados, incluso si vence conexión.
4. Recibir respuesta de conductor/repartidor en Driver, persistir en un hilo común, notificación push mínima, reglas contra spam, revocación/cancelación/finalización, auditoría y privacidad. WebSocket/SSE/polling según contrato de A; fallback no debe inventar mensajes.
5. Auth real JWT verificado por proveedor, actor / service owner desde token + BD, RLS, límites, moderación y carga legal de datos; pruebas interusuario, conductor sustituido, viaje completado, delivery cancelado, transporte en moto/auto, mensajes fuera de orden/duplicados y replay de cursor.
6. Publicar OpenAPI y HTTP **STAGING realmente montado** con pruebas de integración y banderas runtime-wired verificadas. Nada de producción sin Owner.

**UI Envios:** aún no existe pantalla de seguimiento de envío con reparto asignado en Cliente; conectar a `/mensajes?serviceId=<id>&serviceKind=DELIVERY` solo desde una confirmación autorizada del backend. Para pedidos usar MERCHANT_ORDER. Nunca abrir el hilo al preparar borrador local ni antes de asignar un repartidor.

**Estado externo consultado:** OpenAPI del A `v1.0.0-g46` no contenía rutas de mensajes/chat, solo inbox de ofertas de Driver. Issue [#9](https://github.com/mezas3238-hue/Qore-mobile-/issues/9) actualizado con requisito y handoff de responsabilidades.

## Próximo trabajo de B
- Revalidar CI en SHA del commit documental actual (no imputar anterior).
- Test de usabilidad nativo Android/iOS, teclado, lector de pantalla, conversaciones de delivery, múltiples páginas, reconexión sin duplicar y paso de mensajes.
- Luego del contrato montado por A, integrar gateway autenticado, notificaciones de hilo y respuestas reales con pruebas E2E; no activar flags solo porque existe esquema.
- Conservar PR #8 DRAFT, NO MERGE / DEPLOY / LIVE / VPS / PSP / PII real, y división de propiedad A/B sin pisarse.

**Continuidad ininterrumpida:** nuevo arquitecto B leer R3→R4→R5→R6, HEAD PR #8 y issue #9, construir y probar automáticamente salvo bloqueo real.

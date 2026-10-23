# QORE Mobile / Movete Fácil — Arquitecto B R8: chat privado y avisos mínimos

**Fecha:** 23-oct-2026 · **Repositorio:** `mezas3238-hue/Qore-mobile-` · PR #8 DRAFT, rama `feature/mobility-cliente-admin-parallel-20261022`. **Sin merge, despliegue, LIVE, PSP, datos personales reales ni VPS.**

## Contexto previo obligatorio
Leer en orden:
1. `docs/architect-b/HANDOFF_MAESTRO_B_R3_CLIENTE_ADMIN_TOTAL_2026-10-23.md`
2. `docs/architect-b/AVANCE_POST_R3_CLIENTE_CATALOGO_G40_2026-10-23.md`
3. `docs/architect-b/CONTINUIDAD_B_R4_G44_BUYER_BRANCHES_2026-10-23.md`
4. `docs/architect-b/CONTINUIDAD_B_R5_G44_HTTP_G45_QA_2026-10-23.md`
5. `docs/architect-b/CHAT_CLIENTE_DRIVER_DELIVERY_R6_2026-10-23.md`
6. `docs/architect-b/CHAT_CLIENTE_DRIVER_R7_SEGURIDAD_RECONEXION_2026-10-23.md`

## Entregas nuevas R8 — archivos exclusivamente del Arquitecto B

| Commit | Trabajo realizado | Evidencia |
|---|---|---|
| [`71fbe41b`](https://github.com/mezas3238-hue/Qore-mobile-/commit/71fbe41b6bca2d31b825e3c63069710d6375e84c) | Chat revocable a mitad de GET/POST/ACK, purga conversaciones, respuesta tardía ignorada, control `isConfigured` que puede fallar, sin recuperación de caché al restablecer certificación | +4 tests, [CI aislamiento #40012792205 SUCCESS](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40012792205) |
| [`7ad0f5ff`](https://github.com/mezas3238-hue/Qore-mobile-/commit/7ad0f5ff09ca19b783aed0c80fb835cd48b74481) | Clave React para desmontar inmediatamente el editor al cambiar `serviceId` / tipo servicio / revisión de JWT; prueba de parámetros maliciosos | +2 tests; CI inicial FAIL por inferencia TypeScript nullable; no se ocultó |
| [`f63fe17b`](https://github.com/mezas3238-hue/Qore-mobile-/commit/f63fe17b56cfedb91b508506695f80861875fe63) | Proyección de **aviso privado de chat**, metadatos mínimos validados, TTL, antireplay por revisión, ventana de memoria por dispositivo, sin cuerpo, teléfono, nombre ni identidad del conductor | +6 tests, todavía heredaba fallo TS del commit anterior |
| [`b5339855`](https://github.com/mezas3238-hue/Qore-mobile-/commit/b53398551c8f7c2ac5132e4edb36791773773a6a) | Corrigió inferencia TS de parámetros `string | null` de chat route, limpió regex no utilizada | [CI aislamiento #40013575971 SUCCESS](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40013575971) |
| [`f089b398`](https://github.com/mezas3238-hue/Qore-mobile-/commit/f089b398b1ecbd25c18df9f386d83374db5b647f) | Enlazó avisos mínimos al estado privado de Cliente, pantalla Inicio, logout/rotación JWT, solo si chat está certificado. No configura notificaciones SO/push ni inventa entrega | +3 tests; CI final verificada sobre este SHA |

**Último código funcional verificado:** `f089b398b1ecbd25c18df9f386d83374db5b647f`.
- [Cliente/Driver/Aislamiento #40013845973 SUCCESS](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40013845973): **413/413 Cliente PASS**, TypeScript y Expo web export SUCCESS; Driver typecheck/export SUCCESS; aislamiento SUCCESS.
- [Admin Web #40013845977 SUCCESS](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40013845977): **185/185 Admin PASS**, TypeScript y Vite build SUCCESS.
- [Ownership boundary B #40013845867 SUCCESS](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40013845867).
- **Total 598/598 unit tests PASS**. No se afirma certificación nativa Android/iOS, datos reales, mensajería conectada, E2E, Auth del servidor ni GPS.
- Este commit documental generará un SHA posterior; confirmar su propia CI independientemente.

## Arquitectura aprobada
- **App Cliente** exclusiva pasajeros/compradores/receptores: `apps/movete-cliente/**`.
- **App Driver** exclusiva conductores/repartidores, incluido moto delivery: `apps/movete-driver/**`. La construye A, no editar desde B.
- **Admin Web** independiente: `apps/movete-admin/**` (B).
- Chat RIDE, DELIVERY, MERCHANT_ORDER **bidireccional por servicio asignado**. Mensajes 1–500 caracteres, texto sencillo. Sin teléfonos intercambiados, datos de contacto ni enlaces en la vista de QA. Entregado/Leído solo con confirmación persistida real.
- Chat/avisos/permiso temporal siempre **OFF** de forma predeterminada; inyectar un mock no autoriza activar producción.
- Una cuota de 100 mensajes por página / ventana local de 500 no restringe mensajes globales de ningún usuario. Cursores serán firmados y privados por servidor.
- Un aviso de chat NO concede acceso al hilo ni reemplaza la revalidación de la asignación en backend; tampoco es SOS.

## Dependencia actual de A y bloqueo de activación

PR #7 HEAD A consultado `4a4bdb51fa7e1f32ae6b0328acc92952a5c23805`, OpenAPI `1.0.0-g47`, 54 paths, **cero chat/message/conversation**. El inbox Driver es de ofertas, NO mensajes.

A debe implementar de forma independiente:
1. Contrato de conversación ligado a RIDE/DELIVERY/MERCHANT_ORDER y comprobación de asignación activa en BD en cada GET/POST, permisos passenger↔driver, Auth de proveedor JWT, revocación/RLS, autorización al cambiar repartidor, terminar o cancelar servicio.
2. Backend PostgreSQL de mensajes + idempotencia durable `requestKey`, ACK `serverStored=true` solo tras transacción confirmada, lectura de mensajes con cursor firmado y TTL/revisión, errores 401/403/404/409/429/503.
3. **App Driver**: inbox de mensajes distinto del inbox de ofertas, recepción y respuesta, bloqueo de redacción mientras conduce, protección contra abuso y datos sensibles.
4. Push/notificaciones SO con **payload mínimo**; nunca texto privado ni identidad del remitente en pantalla bloqueada. Idealmente solo `eventId, ownerId, serviceId, serviceKind, kind, revision, issuedAt, expiresAt, unreadCount, contentIncluded=false`; reconciliar contra servidor.
5. Certificar HTTPS STAGING realmente montado, E2E cross-account/driver cambiado, reconnect 2G, reintento mismo requestKey, caducidad y mensaje duplicado, autorización/sesión y seguridad. Publicar rutas exactas a B por [issue #9](https://github.com/mezas3238-hue/Qore-mobile-/issues/9).

## Siguiente trabajo de B sin detenerse
1. Comprobar CI del último HEAD B tras este documento; reparar cualquier error en área B.
2. Tests adversariales: cursores repetidos o mezclados, mensajes de otra sesión, permisos revocados a mitad de POST/GET, páginas viejas y payloads push inyectados.
3. Preparar conectores de chat HTTPS reales **solo tras contrato A documentado y runtime certificado**, sin inventar rutas ni afirmar que la app habla con Driver.
4. Pruebas nativas Android/iOS y de accesibilidad con servicios STAGING autenticados; no inferir certificación con Expo web export.
5. Continuar trabajo paralelo de comercios y seguridad Admin Web, manteniendo PR #8 DRAFT y responsabilidad B. **Nunca MERGE/LIVE sin Owner.**

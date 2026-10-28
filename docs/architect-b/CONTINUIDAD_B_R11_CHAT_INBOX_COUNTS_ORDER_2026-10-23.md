# QORE Mobile — Arquitecto B R11: Bandeja chat, contador ilimitado y paginación consistente

**Fecha:** 2026-10-23 · Owner: Movete Fácil, Paraguay. **PR #8 DRAFT**, rama `feature/mobility-cliente-admin-parallel-20261022`. No merge, no LIVE, no despliegue, no VPS, no pagos ni PII real. Arquitecto B edita únicamente `apps/movete-cliente/**`, `apps/movete-admin/**`, `docs/architect-b/**`.

## Continuidad anterior obligatoria
No comenzar desde cero: revisar R3→R10 en `docs/architect-b/`, especialmente `CONTINUIDAD_B_R10_BANDEJA_CHAT_2026-10-23.md`, estado del PR #8 y coordinación [issue #9](https://github.com/mezas3238-hue/Qore-mobile-/issues/9).

## Desarrollo R11 publicado
1. [`530e724f`](https://github.com/mezas3238-hue/Qore-mobile-/commit/530e724fd0494804dd7cc7eb34619d8f407372b2) — **Se elimina la limitación artificial a 99 mensajes sin leer**. `passenger-chat-inbox.mjs` acepta `unreadCount` de 0 a `Number.MAX_SAFE_INTEGER`; `passenger-chat-push-hint.mjs` acepta de 1 a MAX_SAFE_INTEGER, representa **99+ únicamente en el badge**, `app/conversaciones.tsx` muestra 99+ sin truncar el valor de origen. +2 pruebas. Workflows ownership/Admin/aislamiento SUCCESS.
2. [`2b816324`](https://github.com/mezas3238-hue/Qore-mobile-/commit/2b81632439a1d31cfb13280644133a6fd74e9f9f) — Rechaza respuesta de bandeja con `items=[]` y `nextCursor` no nulo, evitando bucles infinitos; no admite dos hilos ACTIVE para la misma pareja `serviceKind/serviceId` dentro de una página o ventana cacheada entre páginas. +3 pruebas, CI SUCCESS.
3. [`6f33ef48`](https://github.com/mezas3238-hue/Qore-mobile-/commit/6f33ef48a6f91cd01700c2e58590668eedb9cc83) — Verifica orden de cursor estable por **updatedAt DESC y conversationId DESC** en filas con igual fecha, tanto dentro de página como entre páginas. Impide reintroducir una conversación previamente descartada de la ventana móvil por retornar a una clave más nueva. +3 pruebas (desorden, replay tras 110 páginas, desempate). Verificar CI de este SHA antes de certificar.

**Datos**: esta paginación no tiene límites globales de mensajes, cuentas o conversaciones; solo se acota cada página a 100 y la ventana de memoria del dispositivo, para rendimiento. El servidor debe aplicar orden estable, deduplicación persistente e idempotencia real. El `unreadCount` seguro no es una cuota ni implica disponibilidad de un chat realmente conectado.

## QA y contrato externo
- Corte anterior a R11: **437/437 Cliente y 185/185 Admin PASS** sobre `459637a2`, Expo/Driver/aislamiento GREEN.
- R11 añadió **8 pruebas** nuevas de dominio. Contar directamente `# tests`, `# pass` y `# fail` en GitHub Actions del último SHA de código y del propio SHA documental antes de reportar cifras finales.
- A PR #7 HEAD `201a687abf68df13b4947296f230b53b2f361fd6`, OpenAPI `1.0.0-g48` con 57 rutas, **cero rutas chat/message/conversation** a la inspección. Backend chat, PostgreSQL con RLS/JWT, DTO de conversaciones, lector/respuesta Driver y notificaciones push SO permanecen **PENDIENTES**. El Driver conserva su propia aplicación y espacio de código.
- Se actualizó [issue #9](https://github.com/mezas3238-hue/Qore-mobile-/issues/9) con requerimiento de orden estable del cursor; A deberá acordar y certificar el orden y DTO de servidor para activar el gateway Cliente. Jamás inventar una URL funcional porque hay una vista.
- **Chat y bandeja permanecen OFF por defecto**, solo sintéticos en QA hasta runtime HTTPS STAGING montado y pruebas cross-actor reales. Ninguna frase «funciona para usuarios» es válida todavía.

## Siguientes pasos Arquitecto B sin detenerse
1. Revisar últimos workflows y corregir cualquier fallo; certificar métricas exactas.
2. Fortalecer UI bajo redes intermitentes y datos de backend con identidad revocada, **sin inventar** pagos, conductores ni asignaciones.
3. Preparar E2E nativo Android/iOS a partir del contrato implementado por A, incluyendo cursor firmado, suplantación, reasignación, duplicidad y notificaciones privadas; no confundir pruebas sintéticas con integración real.
4. Seguir trabajos Cliente/Admin fuera de dependencias bloqueadas por A. No modificar SQL/Node/OpenAPI/Driver, no merge/LIVE/PSP hasta mandato expreso Owner.

**Directiva de continuidad:** leer handoffs, validar HEAD antes de commit y avanzar sin detenerse salvo bloqueo técnico real.

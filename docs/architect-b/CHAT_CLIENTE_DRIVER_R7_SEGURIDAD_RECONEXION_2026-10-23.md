# QORE Mobile — Arquitecto B R7: mensajería Cliente ↔ Driver y delivery

**Fecha:** 2026-10-23 · Paraguay · Continuación de [R6](./CHAT_CLIENTE_DRIVER_DELIVERY_R6_2026-10-23.md), PR #8 DRAFT. **Sin merge, LIVE, PSP, deploy, VPS ni datos reales.**

## Trabajos nuevos entregados

| Commit B | Implementación | Evidencia |
|---|---|---|
| [`6eb3a3d`](https://github.com/mezas3238-hue/Qore-mobile-/commit/6eb3a3d253911c4bd83f010e608e3e51db2d867a) | `passenger-chat-flow.mjs`: deniega texto con teléfonos/correos/URLs y caracteres Unicode bidi de suplantación; validación estricta de revisión de mensajes entrantes y ACK mínimo de revisión actual | +3 tests. CI SUCCESS en este SHA |
| [`1a3390c`](https://github.com/mezas3238-hue/Qore-mobile-/commit/1a3390c0ff04e37d6a44503baa3a88eab92f649d) | `passenger-chat-navigation.mjs` + 3 tests; historial Cliente muestra acceso a Mensajes para servicio propio RIDE/DELIVERY/MERCHANT_ORDER en estado assigned/in_progress, **solo si** chat certificado. Backend siempre verifica asignación. | CI de este commit **FAIL TypeScript** por inferencia errónea de nullable, no por acceso a datos |
| [`2f91cf96`](https://github.com/mezas3238-hue/Qore-mobile-/commit/2f91cf9647cb749ce4df6c5f1fec7ee1f3cff526) | Ventana local de chat por dispositivo (default 500, configurable 100–5000), contadores read/evicted, historial servidor paginable sin máximo global. Limpieza de estado local aunque un cancelPending del transporte falle. | +2 tests, 620 páginas sintéticas. Hereda error TS anterior, no atribuir PASS |
| [`1980f70a`](https://github.com/mezas3238-hue/Qore-mobile-/commit/1980f70ae7933a7ac218370dbfcbdcfce8e999d0) | Corrección fail-closed del tipo de navegación; interfaz Mensajes ahora muestra ventana, botón Actualizar, rechazo explicativo de PII y fallo al generar UUID seguro sin simular envío | [Aislamiento #40011259773](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40011259773) SUCCESS, [Admin #40011259731](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40011259731) SUCCESS, [Ownership #40011259735](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40011259735) SUCCESS |
| [`c568503e`](https://github.com/mezas3238-hue/Qore-mobile-/commit/c568503e94bfea0023791a1ddbc07e52421bc3bc) | Chat con respuesta ambigua + TTL vencido: conserva pendiente/clave sin exponer filas vencidas; antes de reintentar relee el mismo hilo de servidor y verifica actor, asignación, estado ACTIVE, conversationId y TTL; nunca crea nuevo requestKey, falla cerrado si cambió destinatario | +3 tests. **CI debe confirmarse en el SHA**, pendiente al escribir |

**Total nuevas pruebas declaradas en R7:** 11 (3+3+2+3), sujeto a conteo de logs de CI. No confundir 100 mensajes por página o ventana local de 500 con un máximo global del historial; miles de páginas se recorren por cursor autorizado.

## Mandato funcional integral

Cliente enviará y recibirá mensajes con Driver o delivery en las **apps separadas**:
- Cliente en `apps/movete-cliente` y conductor/repartidor en `apps/movete-driver`.
- Conversación privada y bidireccional únicamente cuando A haya persistido asignación de viaje/entrega, validación JWT/RLS por cada llamada y autorización de ambos participantes.
- Tipos `RIDE`, `DELIVERY`, `MERCHANT_ORDER` (automóvil viaje, auto/moto de carga).
- Mensajes de texto de hasta 500 caracteres, sin URL, datos personales de contacto, adjuntos, GPS, medios ni llamadas por el momento; no inventar recibido/leído. Confirmación `serverStored=true` únicamente con ACK válido.
- Idempotencia `requestKey` en POST, recepción y persistencia server-side, anti-spam/abuso, push de notificación genérica y cifrado en tránsito/reposo según implementación auditada de A.
- Sos y soporte son canales separados: chat no responde a emergencias.
- Nunca permitir conducir y escribir de forma insegura. Driver UI separada a cargo de A.

## Bloqueos reales externos y estado observado

Arquitecto A HEAD consultado `c7d5bd098dae7615a71acde3295dc3b67528494f`, OpenAPI `1.0.0-g46` con 52 rutas; **no contiene endpoints chat/messages/conversations**, solo `/v1/staging/driver/inbox` para OFERTAS Driver, no mensajería.

**Lo que falta a cargo del Arquitecto A**: OpenAPI chat versionado, proveedor Auth y JWT/roles/RLS reales, prueba de asignación en Postgres, backend de persistencia y paginación opaca, POST idempotente, bandeja y respuesta desde Driver, push seguro y auditoría/resolución de abusos. Notificar a B con commit, tests y evidencia **runtime HTTPS STAGING efectivamente montado**; no activar flags por schema.

**Lo que sigue B sin pisar A**: comprobar CI del HEAD, completar test de lecturas/reintentos con redes 2G e intercalado de identidad, preparar contrato de transporte al recibir rutas de A, pruebas UI Android/iOS reales y notificaciones de chat sin exponer texto privado; mantener chat OFF y PR #8 DRAFT.

**Continuidad:** leer handoffs B R3/R4/R5/R6 y R7 + issue #9; siempre trabajar sobre el HEAD actual PR #8 y no reiniciar el proyecto ni alterar A.

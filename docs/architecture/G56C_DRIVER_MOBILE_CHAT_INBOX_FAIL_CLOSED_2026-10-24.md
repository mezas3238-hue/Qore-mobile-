# G56C — Driver Mobile: control de estado privado del chat sin montaje HTTP

**Fecha:** 2026-10-24. **Scope:** `apps/movete-driver/src/domain/driver-chat-inbox.mjs` y `.d.mts`. **Estado:** QA aislado y módulo sin montar; `DRIVER_CHAT_LIVE_ENABLED=false`.

## Propósito

Preparar integración móvil Driver ↔ backend G56B sin dejar datos privados obsoletos ni fingir conectividad. El `DriverChatInboxController` únicamente recibe un `readPage` **inyectado por un componente de confianza**; no conoce URL, Auth externo ni secrets, ni se monta automáticamente. No se proporciona proveedor por defecto, no se realiza HTTP, no se envía ningún mensaje.

## Interfaces

- `setSession({role:'driver',userId,accessToken})` acepta exclusivamente identidad Driver con UUID de cinco grupos y token de sesión efímero. No guarda identidad/token en estados visibles ni persistencia del dispositivo.
- `refresh()` vacía la lista antes de una consulta nueva; nunca muestra una respuesta vieja mientras cambia la cuenta.
- `loadMore()` usa cursor opaco de G56B, conserva revisión del lote y hace crecer la lista sin máximo global; rechazo si hay fila repetida, servicio duplicado, hilos reordenados, revisión distinta o una conversación rotada entre páginas.
- `clear()`, `invalidate()`, `tick()` eliminan la lista cuando corresponde; tras logout, cambio de cuenta, error de red, rechazo 401/409/503 o caducidad de datos, no persisten filas.
- El estado visible solo contiene `phase, conversations, hasMore, expiresAt, productionEnabled:false, qaOnly:true`; nunca JWT, actorId, raw cursor, números telefónicos, cuerpo del mensaje, documentos KYC ni datos de ubicación.

## Pruebas

`apps/movete-driver/src/domain/driver-chat-inbox.test.mjs` prueba carrera de logout durante request en vuelo, intercambio de cuenta, paginación sin cap global, respuesta de otro owner, PII no autorizada, duplicación de un mismo servicio, respuesta caducada y rechazo por sesión/servidor.

## Bloqueadores del circuito operativo

No hay gateway JWT/JWKS real conectado al Driver. El frontend `mensajes.tsx` sigue mostrando que el chat no está disponible. Antes de montar este controlador en una vista real, hay que inyectar un proveedor Auth genuino (sin token en estado React), HTTPS de STAGING verificado, executor SQL no-owner y errores de red; también se requieren confirmaciones de lectura contiguas G57 y pruebas con teléfonos Android/iOS. En ningún caso el GET del inbox marca algo como leído.

**Sin merge, LIVE, deploy, secretos, PII ni cruces de ownership con Arquitecto B.**

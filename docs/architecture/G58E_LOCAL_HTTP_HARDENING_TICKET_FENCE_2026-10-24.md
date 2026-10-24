# QORE Mobile — G58E/A45, HTTP local resistente y doble control de tickets

**Fecha:** 24 de octubre de 2026. **Arquitecto:** A. **Repositorio soberano:** `mezas3238-hue/Qore-mobile-`, PR #7 DRAFT. **Entorno:** QA local, datos y proveedores simulados. **Sin LIVE, merge, VPS ni despliegue.**

## Trabajo implementado

### HTTP local / rechazo de clientes lentos y exceso de solicitudes
- `apps/mobility-expo/server/g58-chat-loopback-transport-qa.mjs`: el único servidor HTTP de mensajería continúa escuchando solo en `127.0.0.1` y puerto aleatorio de pruebas. Ahora verifica que ambos extremos del socket son loopback, con 8192 bytes máximos de cabeceras, 32 cabeceras máximas, timeout de headers de 2000 ms, de request 3000 ms, de socket inactivo 3000 ms, keep-alive 1000 ms, 10 requests por socket y 16 conexiones activas. Máximo 12 requests simultáneos en el handler; el decimotercero devuelve `G58E_GATEWAY_CAPACITY` sin pasar por Auth/SQL.
- El handler tiene un límite de 2400 ms; al vencer responde `503 G58E_OUTCOME_UNKNOWN`. **La respuesta NO demuestra rollback ni que el COMMIT no ocurrió**: jamás reintentar automáticamente operaciones de escritura tras outcome unknown. Una escritura podría terminar en PostgreSQL después del cierre HTTP; el SQL sigue obligado por su propio `statement_timeout` y fences. No se habilitaron rutas de SEND.
- `apps/mobility-expo/server/g58e-loopback-hardened-qa.test.mjs`: configuración de timeouts y límites, 12 handlers concurrentes y overflow, deadline de handler inconcluso (nunca emite ACK positivo), parser Node rechazando exceso de headers y bind solo localhost. No hay listener público.

### Revalidación de actor y sesión en emisión de tickets sintéticos
- `apps/mobility-expo/server/g58e-audited-qa-ticket-issuer.mjs`: nueva barrera server-only QA para las 6 clases exactas de tickets que consume el pipeline: Driver Inbox, Driver History, Driver Mark Visible, Passenger Open, Passenger History y Passenger Mark Read. Solo acepta `actorId`, `sessionId`, `tokenIatMs` y scope completo que le pasan los adaptadores G42 existentes, sin aceptar `role`, `sql`, `throughSeq`, campos extra o un emisor admin. Vuelve a comprobar sesión G42 y **rol exclusivo** antes y después de llamar a la función inyectada `issueSyntheticTicket`.
- Si la sesión se revoca o el rol cambia durante la emisión, no entrega ningún ticket al llamador, aunque haya sido creado provisionalmente por el fixture. La función SQL G42 lo deniega al consumirlo después de revocación y los TTL siguen fijados a un máximo 20 s. El token devuelto debe coincidir exactamente en operación, expiración y `qaOnly:true`, `productionEnabled:false`.
- `apps/mobility-expo/server/g58b-local-auth-chain-qa.mjs`: incorpora la barrera como `mintOwnerTicket` sin exponer issuer, credenciales o SQL por HTTP. G42 conserva autoridad JWT firmada, provider user/session y grant SQL por separado.
- `apps/mobility-expo/server/g58e-audited-qa-ticket-issuer.test.mjs`: cobertura de seis operaciones, scope/rol indebido, actor o sesión inventados, token expirado, revocación y cambio de rol entre comprobaciones, código owner arbitrario, rechazo de modalidad LIVE y ausencia de mint ante denegación inicial.

## Controles anteriores preservados

- G56B Driver Inbox, G57A y G57B lectura por marcador contiguo, G58B JWT fijado y proveedor sintético, G58C rate budget de 30 requests/min por actor y G58D pool bounded de 4 conexiones más SQL `SET LOCAL` timeouts, roles NOLOGIN en PostgreSQL16 desechable.
- A/B separados. **No se tocó** `apps/movete-cliente/**`, `apps/movete-admin/**`, `docs/architect-b/**`.

## Bloqueos reales, sin afirmaciones de disponibilidad comercial

1. La nueva barrera **NO** equivale a un emisor de tickets productivo: `issueSyntheticTicket` sigue siendo una función de laboratorio con autoridad owner y datos sintéticos. La autorización de un servidor real requiere un emisor que ate la identidad verificada a un proceso privilegiado aislado, con auditoría, confianza entre procesos y sin funciones owner expuestas a una app.
2. Persisten sin conexión las fuentes de usuario/sesión reales, JWKS con rotación y el PostgreSQL con login de gateway controlado en STAGING autorizado. Sin TLS remoto, móvil Android/iOS, pruebas de viewport físico, push ni envío SEND HTTP.
3. El límite de handler Node es de disponibilidad de respuesta, **no** una cancelación garantizada de SQL ni garantía de no-commit. Tras `G58E_OUTCOME_UNKNOWN` debe reconciliarse en DB usando identificador idempotente; no afirmar operación cancelada.
4. El servidor local no es un gateway productivo distribuido: faltan protección de reverse proxy/TLS, rate limiting global, control de consumo real de RAM y E2E de cargas de comercios y envíos.

## Continuidad recomendada G58F

Diseñar y ensayar en PostgreSQL16 desechable un emisor de ticket con función SECURITY DEFINER mínima, rol NOLOGIN independiente del rol delegado, bloqueo G42 y prueba de revocación frente a dos conexiones sin claims del cliente. **No publicarlo en LIVE** sin proveedor/secretos y aprobación. Completar conciliación de respuestas de commit incierto y observabilidad sin PII antes de montar Driver UI. Mantener PR #7/#8 DRAFT, sin merge.

El cierre de G58E requiere confirmar PostgreSQL, Node, Expo y aislamiento **SUCCESS sobre el mismo HEAD**, no sobre commits previos.

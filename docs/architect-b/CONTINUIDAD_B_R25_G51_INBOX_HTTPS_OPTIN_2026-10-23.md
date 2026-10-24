# Movete Fácil · Arquitecto B · R25 transporte G51 Inbox HTTPS (OFF por defecto)

**Corte:** 23-oct-2026 (Paraguay). Rama B `feature/mobility-cliente-admin-parallel-20261022`, [PR #8](https://github.com/mezas3238-hue/Qore-mobile-/pull/8) DRAFT. No merge, LIVE, VPS, PSP, datos personales reales ni secretos. Continuidad desde [R23](./CONTINUIDAD_B_R23_BORRADOR_PRIVADO_REASIGNACION_2026-10-23.md) y [R24](./CONTINUIDAD_B_R24_RECUPERACION_CHAT_PENDIENTE_2026-10-23.md).

## Evidencia nueva del Arquitecto A

Consulta directa a `apps/mobility-expo/docs/backend/openapi/movete-facil-staging.openapi.json` en la rama A (blob `db96ef112f88515b03ebb9ac7d88a3fade8aa962`): **OpenAPI 1.0.0-g51 con 61 rutas**, de las que el ámbito chat contiene:
- POST `/v1/staging/chat/services/{serviceKind}/{serviceId}/conversation`
- GET y POST `/v1/staging/chat/conversations/{conversationId}/messages`
- GET `/v1/staging/chat/conversations` con cursor firmado en encabezado `X-Qore-Chat-Cursor` y `limit`
- POST `/v1/staging/chat/conversations/{conversationId}/read-receipt`

**TODAS siguen `x-qore-runtime-wired:false`**. G51 es un **contrato de API / implementación QA**, no prueba de servicio HTTPS/Driver en teléfonos. A administra JWT/RLS, PG, rutas reales, transporte Node y autorización por asignación. No iniciar LIVE.

## Cambios B R25

1. [`66bf326a`](https://github.com/mezas3238-hue/Qore-mobile-/commit/66bf326a29217bab06cb87be4fc66d34ee36d267) crea `apps/movete-cliente/src/domain/g51-chat-inbox-http-gateway.mjs`:
   - `enabled/contractCertified/stagingRuntimeVerified` **OFF por defecto** y pin estricto de un origen HTTPS sin credenciales, query inesperada, path, puerto, redirecciones ni secretos codificados. Con un gate falso no se ejecuta fetch.
   - Solo GET ruta G51 firmada; cursor únicamente por `X-Qore-Chat-Cursor` validado, nunca en URL ni logs; página hasta 100, **sin techo global** de registros.
   - JWT Passenger desde el proveedor actual, `subject`, `authRevision`, `sessionRevision`, fecha de vencimiento; comparación antes/después de red. 401/403 invalidan **solo** sesión idéntica, sin borrar JWT nuevo por respuestas atrasadas.
   - AbortController, cancelación por logout/cambio de sesión, timeout, no cookies/referrer/cache/redirect, Content-Type JSON, límite de bytes en streaming y `Content-Length`.
   - Proyección DTO G51 cerrada: sin nombres/teléfonos/textos del remitente; ownerId exacto, versión, TTL, orden por store, `assignmentVerified`, `canSend`, `counterpartRole:'driver'`, `productionEnabled:false`.
2. [`a4cfa3fa`](https://github.com/mezas3238-hue/Qore-mobile-/commit/a4cfa3fa048c221e461d0834d18d8ad5f197568d) integra opcionalmente `g51ChatInboxHttpOptions` en `client-experience.mjs` con bridge de JWT de sesión. Si no hay configuración, no se crea gateway. Si hay inyección `chatInboxGateway` explícita de pruebas, conserva prioridad. Nunca habilita chat de envío ni HTTP de producción por defecto.
3. [`307e4dba`](https://github.com/mezas3238-hue/Qore-mobile-/commit/307e4dbae796d110164355ea3e3a982263a50ea4) crea 11 pruebas unitarias para gates OFF, pin, cursor en header, JWT y rol, DTO PII/flags falsos, integración con store, carreras sesión 401/200, cancelación, tipos y límite de respuesta, deadline.
4. [`6f5a7845`](https://github.com/mezas3238-hue/Qore-mobile-/commit/6f5a784530d5f2bdbacd944e1c4c4b887185774c) agrega 2 pruebas de composición Cliente, OFF y habilitación artificial de QA usando token de sesión sintético y DTO G51, sin URL real.
5. [`657ae065`](https://github.com/mezas3238-hue/Qore-mobile-/commit/657ae065ab798f07db2e2c2256256433f2259e9c) corrige un error de tipado R24 en helper de recuperación de mensajes, detectado por TypeScript CI del commit `f682ddc2`: JSDoc de `null|string` en propiedades de navegación. La CI previa R24 falló solo en `app/mensajes.tsx`, no ocultar ese hallazgo.

## CI: verificación obligatoria, no inferir éxito

- **R23 certificado** `f7b5102a`: [aislamiento/Cliente/Driver #40047684985](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40047684985) SUCCESS, Cliente **488/488 PASS (0 FAIL)**; [Admin #40047685064](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40047685064) SUCCESS; [ownership #40047685069](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40047685069) SUCCESS.
- **R24 previo** `f682ddc2`: [aislamiento #40047798940](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40047798940) **FAIL**, con TS2322 por inferencia `null|undefined` en `passengerPendingRecoveryRoute` llamado desde `app/mensajes.tsx`; NO calificar este SHA como PASS.
- **R25 + fix** `657ae065`: [aislamiento/Cliente/Driver #40048090271](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40048090271), [Admin #40048090084](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40048090084), [ownership #40048090166](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40048090166). Verificar CI y logs **en el SHA real**; no afirmar resultados sin evidencia.

## Continuación sin detenerse salvo bloqueo real

1. Resolver cualquier fallo real de TypeScript, test o CI R25 dentro de rutas B, confirmar todos los workflows y conteos.
2. A debe montar GET Inbox G51 STAGING con JWT emitido, RLS/asignación, contrato de cursor y 401/403 revocación, autenticación por dos cuentas sintéticas antes de marcar flags true.
3. Cubrir con E2E **dispositivos reales** la transición offline/reasignación/timeout y performance de FlatList, con evidencias nativas; Expo web export no basta.
4. Aún queda acordar adaptador de **mensajes bidireccionales** G50 y Driver, read receipts, orden `seq`, `requestKey` en ACK y prueba de no duplicación; [issue #9](https://github.com/mezas3238-hue/Qore-mobile-/issues/9). Las rutas actuales siguen desconectadas.
5. Mantener PR #7 A y #8 B DRAFT, sin merges ni despliegues no autorizados. Continuar QA independiente de Cliente/Admin.

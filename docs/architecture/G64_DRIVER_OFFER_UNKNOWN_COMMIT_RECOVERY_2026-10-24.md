# QORE Mobile — G64: Recuperar decisiones Driver cuando se pierde el ACK

**Arquitecto A · 24 de octubre de 2026 · PR #7 DRAFT · SIN MERGE, LIVE NI DEPLOY**

## Problema resuelto

G63 permitía aceptar/rechazar una oferta privada de auto o reparto en STAGING, pero cuando el servidor persistía la decisión y se cortaba la respuesta HTTP, el Driver no tenía cómo saber si la operación se había confirmado sin arriesgar duplicidad. **G64 añade una consulta independiente a la persistencia**, no vuelve a ejecutar aceptación/rechazo.

### SQL PostgreSQL16 descartable

`apps/mobility-expo/docs/backend/staging_only/G64_DRIVER_OFFER_DECISION_RECOVERY_POSTGRES_CI_ONLY.sql` instala una función owner-only y no pública:

`public.mobility_stage_g64_reconcile_offer_decision_owner_qa(kind, offerId, actorId, sessionId, tokenIatMs, requestKey, action)`

- Bloquea `mobility_stage_g42_lock_session` con `FOR SHARE` hasta COMMIT, validando revocación y vigencia; exige exactamente un rol `driver` persistido. No confía en role/actorId aportados por el teléfono.
- Lee `mobility_stage_auto_demo_offers` o `mobility_stage_delivery_offers` del G4/G10 con `FOR SHARE`; verifica que la oferta le pertenezca al conductor original.
- Solo `status='accepted'` con `decision_key` original idéntica y `decision_event_id` no nulo, o `status='declined'` con clave original y evento nulo, constituyen `state:'COMMITTED'`. Devuelve el ID durable **original** del evento/offer y `serverPersisted:true`. No promete entrega push.
- Si la fila sigue `offered` sin decisión observada, devuelve `NOT_YET_OBSERVED` con `retrySafe:false`; no autoriza otra aceptación. Una clave diferente, acción diferente, oferta ajena o terminal incorrecto deniega.
- No escribe ofertas, servicios, eventos, asignaciones ni pagos. Función `SECURITY DEFINER`, `search_path=''`; sin EXECUTE para `anon`, `authenticated`, `service_role` ni los roles de gateways anteriores.
- `g64-driver-offer-decision-recovery-ci.py` lee aceptaciones sintéticas históricas **reales** de los fixtures G16 AUTO y G14 delivery, sin violar el fence legal G38. Prueba aceptación original, desconocido, rol cruzado, clave errónea, simultaneidad de dos lecturas, ausencia de nuevos eventos, revocación G42 concurrente y denegación de EXECUTE a roles de SDK.
- El workflow PostgreSQL disposable instala y prueba G64 **después** de G60C. No hay migración remota ni servidor público.

### Backend Node privado

`g64-driver-offer-reconcile-qa.mjs` y test: puerta interna con las rutas lógicas de solo consulta:

- `POST /v1/staging/driver/offers/reconcile`
- `POST /v1/staging/courier/delivery-offers/reconcile`

El body permitido es **solo** `{offerId,requestKey,action}`. Verifica JWT/usuario/sessionId/tokenIatMs, concesión de sesión, rol Driver exclusivo y rate gate a través de callbacks confiables **del servidor**, y delega la lectura PostgreSQL owner-only. Comprueba que coincidan tipo, acción, ID, llave y recibo; no devuelve secreto ni PII. `NOT_YET_OBSERVED`, tiempo agotado, DB inaccesible o recibo forjado no significan `retrySafe:true`. Este handler **no está montado sobre HTTPS público** ni es un reemplazo del IdP real.

### Driver Expo

- `reconcilePrivateDriverOffer` en `driver-offer-decision.mjs`: llama exclusivamente a la URL STAGING aprobada de consulta, no a `/accept` ni `/decline`; exige respuesta exacta `STAGING_DEMO_ONLY/COMMITTED` con llave original y `serverPersisted:true`.
- `driver-offer-actions.mjs`: preserva de forma **privada en memoria** `requestKey`, acción y offer ID cuando `decide` queda incierto. Un toque explícito `reconcilePending` consulta el comprobante una o más veces con **la misma llave**, nunca repite el POST de decisión. Ni la llave, ni token, ni actor se añaden al snapshot UI. Un cierre/cambio de sesión invalida los datos y cualquier resultado HTTP tardío.
- `driver-staging-runtime.mjs` integra esta ruta con el mismo host fijado G62/G63; `DriverOfferActionsProvider` solo permite consultar con workspace conectado, y `app/ofertas.tsx` muestra el botón de consulta incluso si la oferta ya desapareció del inbox tras la aceptación.
- Tests cliente/server: ACK original, llave igual, outcome desconocido, rechazo de recibo alterado, replay prohibido y logout en curso. La integración E2E Node prueba una respuesta HTTP perdida después de COMMIT con un backend **simulado**, no un servidor remoto real.

## Peligros y limitaciones explícitas

- Los estados `NOT_YET_OBSERVED` no prueban rollback; la UX no ofrece «Reintentar aceptación». Sin prueba server-side verificable no se afirma aceptación.
- La app sigue con `runtime=null` por defecto, sin credenciales reales; la función PostgreSQL se instala solo en base `qore_disposable_chain`.
- G38 rechaza intencionalmente nuevas aceptaciones comerciales por falta de habilitaciones legales/geográficas: que G64 pueda recuperar una aceptación histórica de QA **no** equivale a permitir despacho real.
- Una consulta desconocida almacenada solo en memoria desaparecerá al reiniciar/cerrar sesión. Para continuidad entre reinstalaciones será necesario un mecanismo autorizado de recuperación por identidad/asignación sin exponer keys/PII ni inventar confirmaciones.
- Para lanzar faltan proveedor IdP HTTPS STAGING real, funciones de aceptación enlazadas a roles SQL mínimos, dispositivo físico, Cliente↔Driver, KYC completo, pagos y operación/seguridad. Los 17 gates comerciales continúan `NO_GO`.

## Continuidad priorizada

**G65:** STAGING autorizado y pruebas de cabecera a cola con Client/Driver reales, correlación de oferta y servicio, sin confundir cobertura con disponibilidad; validar seguridad vial y revocación en teléfonos físicos. Coordinar contratos con B por issue #9. Arquitecto B mantiene sus carpetas Cliente/Admin sin conflictos. No merge/live/pagos/VPS/secretos reales sin orden Owner.

# QORE Mobile — G69 A58: intercambio de lectura privada remitente con privilegio mínimo
**Fecha:** 24 octubre 2026 · Arquitecto A · PR #7 DRAFT · QA exclusivamente desechable

## Punto de partida
G68 ya expone un DTO del remitente, protegido con G42 rol Passenger y SQL `delivery_id + sender_id`. Su función SQL `mobility_stage_g68_sender_custody_owner_qa` es **owner-only**, y nunca puede concederse sin restricciones a una app, web, `service_role` genérico o token Passenger. Para la integración futura con un backend autorizado hace falta una frontera de delegación de un solo uso, con la comprobación de sesión bloqueada transaccionalmente.

## Entrega técnica real G69
- `apps/mobility-expo/docs/backend/staging_only/G69_SCOPED_SENDER_CUSTODY_EXCHANGE_POSTGRES_CI_ONLY.sql`: crea roles `mobility_g69_definer_ci` y `mobility_g69_execute_ci`, ambos **NOLOGIN NOINHERIT**. Solo el definer tiene acceso al registro privado; solo el execute posee EXECUTE de `mobility_stage_g69_sender_exchange_qa(uuid)`. Nadie recibe privilegios de INSERT/SELECT de la tabla, emisión de atestación ni lectura directa de G68.
- Tabla `mobility_stage_g69_sender_read_proofs`: `sha256(UUID)` (no almacena la prueba cruda), `sender_id`, `session_id`, `token_iat_ms`, `delivery_id`, emisión/expiración (TTL máximo 12 segundos), marca `redeemed_at` y tipo `QA_OWNER_VERIFIED_SESSION_NO_LIVE_IDP`. RLS habilitada y grants denegados a anon/authenticated/service_role y gateways heredados.
- La atestación **solo se inserta desde un fixture owner de CI** tras verificar que el sujeto y la sesión son auténticos. **NO EXISTE** API de emisión en Internet: de existir, permitiría leer envíos ajenos si se falsifica el sender_id.
- RPC `mobility_stage_g69_sender_exchange_qa`: bloquea el hash de prueba `FOR UPDATE`, deniega revocada/redeemed/caducada, llama G68 (que bloquea G42 sesión en la misma transacción, comprueba rol Passenger exclusivo, propiedad SQL y G67 proof), valida **las 11 claves exactas y la identidad del DTO B R62**, consume una sola vez con UPDATE. Un rechazo o timeout nunca debe reenviar la petición como si fuese nuevo resultado.
- `G69_SCOPED_SENDER_CUSTODY_EXCHANGE_ASSERT_POSTGRES_CI_ONLY.sql`: verifica RLS, roles NOLOGIN, función SECURITY DEFINER y `search_path` vacío, EXECUTE mínimo y ausencia de bypass por roles clientes.
- `apps/mobility-expo/server/g69-sender-custody-scoped-read-race-ci.py`: pruebas PostgreSQL16 local con dos cuentas Passenger independientes, propiedad SQL, dos conexiones compitiendo por una prueba, TTL, revocación G42 y negaciones `42501` a roles no autorizados. No emplea datos reales ni aplicaciones físicas.
- `apps/mobility-expo/server/g69-trusted-sender-read-qa.mjs` + `.test.mjs`: adapter privado Node que exige JWT previamente verificado, sesión válida, rol Passenger exclusivo, rate gate, *owner attestation* server-side y exchange SQL delegado. Deniega JWT falsos, sesión caducada, respuesta con PII extra o `proofVerified:false` en entrega terminada, nunca devuelve ticket/proof/JWT. No es un endpoint HTTPS montado.
- Workflow PostgreSQL16 disposable instala, comprueba grants y ejecuta la carrera; Node/Expo/aislamiento procesan el código en el mismo SHA. 4/4 éxito significa únicamente certificación QA; no es gate comercial.

## Riesgos y límites innegociables
1. **Sin IdP/HTTPS/Storage externos autorizados**: no existe integrador capaz de emitir atestaciones reales; la app Cliente B **NO** debe activar `stagingRuntimeVerified`, `contractCertified` ni `enabled` en un entorno real.
2. Proof UUID efímera de 12 segundos no es sesión de usuario ni mecanismo general de Auth. Solo el backend confiable determina `sender_id/session_id/delivery_id`, no se toma ese ámbito del cuerpo enviado por la app.
3. La fila G69 ya consumida sigue indeleble en laboratorio; la ausencia de una prueba consumida por TTL no demuestra rollback. Si se pierde respuesta, **no emitir un proof nuevo automáticamente sin volver a autenticar/verificar e inspeccionar el estado de una lectura nueva**.
4. G68/G67 siguen siendo la autoridad sobre servicio; G69 no cambia movimientos, GPS, precios, mensajes, fotos ni entrega.
5. Solo `qore_disposable_chain` local con `application_name=qore_ci_disposable_chain`. **NO ejecutar migraciones CI_ONLY en bases remotas, no abrir service_role ni generar credenciales reales.**
6. Separar funciones Driver/Cliente, no alterar apps Cliente/Admin de B. Coordinar contrato en [issue #9](https://github.com/mezas3238-hue/Qore-mobile-/issues/9).

## Bloques siguientes sin pausa
- **G70 (sin desplegar):** especificación y pruebas de montaje de API HTTPS STAGING con JWT firmado pinneado, revocación, rate y conexión del ledger/sesiones reales *solamente con infraestructura aprobada*. Código fail-closed y preflight pueden avanzar sin proveedor.
- **G71:** pruebas de extremo a extremo sobre **dos dispositivos** con permisos y datos sintéticos después de autorización de hosting/IdP/ubicación; chat Driver/Cliente, viaje AUTO y custodia DELIVERY separados.
- **G72+:** completar KYC y documentos verdaderos, PSP/reembolsos/comisiones, SOS con operador, GPS real, comercios, soporte, firma de binarios independientes y 17 gates comerciales verificados con aprobación Owner.

**MANDATO:** seguir implementando código y pruebas QA, no detener todo el desarrollo ante un bloqueo parcial externo; no merge, no live, no VPS, no PSP, no secretos ni PII reales sin autorización.

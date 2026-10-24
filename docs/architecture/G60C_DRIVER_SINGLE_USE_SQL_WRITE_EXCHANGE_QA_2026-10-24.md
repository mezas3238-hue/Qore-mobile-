# QORE Mobile — G60C / Arquitecto A: Prueba de un solo uso para SEND y RECONCILE Driver

Fecha: 24 de octubre de 2026. Rama A `feature/mobility-monorepo-isolated-20261016`; PR #7 DRAFT. **Alcance: PostgreSQL16 descartable y Node QA privado; NO servidor productivo.**

## Problema cerrado

G60A y G60B construyeron la experiencia de mensajería Driver y el transporte de ensayos locales. El backend SQL G56 SEND/G59B RECONCILE sigue siendo owner-only. G60C añade una frontera de permisos mínimos verificable para que una identidad externa solo pueda solicitar una operación ya autenticada y **no** llamar directamente a las funciones SQL privilegiadas.

## Implementación técnica

- `G60C_DRIVER_MIN_PRIVILEGE_WRITE_EXCHANGE_POSTGRES_CI_ONLY.sql`: roles separados `mobility_g60c_definer_ci` y `mobility_g60c_execute_ci`, ambos NOLOGIN/NOINHERIT, sin CREATE en schema, sin acceso a las tablas de sesión, mensajes, tickets o attestation. La única función delegada es `mobility_stage_g60c_driver_exchange_qa(proof_uuid)`, `SECURITY DEFINER` con `search_path=''` y dueño NOLOGIN. Ninguna llamada delegada acepta actor, rol, `iat`, servicio, conversación, solicitud ni body como parámetros.
- `mobility_stage_g60c_driver_proofs`: tabla RLS con `SHA-256(proof UUID)`, Driver/session/iat, operación exacta `DRIVER_SEND` o `DRIVER_RECONCILE`, servicio/conversación, `requestKey` y body originales, vigencia SQL no superior a 12 segundos, evidencia fija `QA_OWNER_ATTESTED_NO_LIVE_IDP`. Únicamente una **fixture owner de laboratorio** puede sembrar pruebas. Esto **no constituye verificación criptográfica del IdP de producción**.
- La función ejecutora bloquea la fila de prueba `FOR UPDATE`, valida `G42_lock_session` hasta COMMIT y revalida rol exclusivo, asignación y autorización de chat mediante las funciones SQL G56/G59B. `DRIVER_SEND` emite un ticket G56 limitado y lo consume en **la misma transacción**; si hay fallo SQL, toda transacción revierte. `DRIVER_RECONCILE` **solo lee el mensaje durable**, no lo vuelve a enviar.
- `G59B` devuelve `COMMITTED` con el ACK original `ack.revision` y `latestRevision` independiente. Si el mensaje no es visible aún, `NOT_YET_OBSERVED` no prueba rollback y no autoriza reenviar. `G50` impone idempotencia con `(conversation_id,sender_id,request_key)`, incluso si dos pruebas distintas compiten por el mismo envío.
- Los roles `anon`, `authenticated`, `service_role`, gateways anteriores y el definidor no pueden llamar al intercambiador. La prueba misma solo se puede usar una vez; tiempo vencido, rol errado, sesión revocada o reasignación deniegan.
- `g60c-verified-driver-write-qa.mjs`: adaptador Node que exige verificador de JWT independiente, proveedor de revocación, consulta de rol exclusivo Driver, rate gate, fixture de siembra y ejecutor delegado. Los campos de identidad provienen del proveedor, no del body del cliente; resultado ACK y revisiones se validan estrictamente y no se exponen secrets. El timeout SQL se maneja como resultado incierto, no rollback. Devuelve el contrato reducido que espera G60B.
- `G60C_DRIVER_MIN_PRIVILEGE_WRITE_EXCHANGE_ASSERT_POSTGRES_CI_ONLY.sql` y `g60c-driver-write-exchange-race-ci.py`: validan los grants, dos intentos con la misma llave, la carrera por una misma prueba, estado desconocido, modificación del body, asignación terminal, expiración, roles cruzados, versión posterior y el bloqueo de revocación G42.
- `g60c-verified-driver-write-qa.test.mjs`: comprueba JWT/role/session falsos, shape exacto, fallo del proveedor, respuesta SQL adulterada, expiración y protección de PII.
- El workflow PostgreSQL descartable instala la migración, los asserts y la prueba de concurrencia **después de G59B**. Node y Expo se validan en sus workflows separados.

## Contrato entre G60B y G60C

G60B conserva exclusivamente las dos rutas POST locales, con Bearer y body exacto `{requestKey,body}`; el callback independiente `verifyStopped` exige vehículo detenido **antes de `DRIVER_SEND`**. G60C valida token/rol/sesión y entrega exclusivamente una prueba opaca a un ejecutor SQL limitado. Si un ACK HTTP se pierde después de COMMIT, una **nueva prueba** `DRIVER_RECONCILE` consulta por la llave original y el cuerpo exacto. Nunca vuelve a ejecutar `DRIVER_SEND` silenciosamente.

**Limitación explícita:** la conexión entre la app física y un IdP/HTTPS STAGING productivo **no existe en esta etapa**; el fixture de pruebas no puede sustituirla. Esta etapa certifica SQL y Node aislados, no mensajería comercial.

## Gates y responsabilidades

- Ejecutar y verificar en el mismo commit PostgreSQL, Node STAGING, Expo y aislamiento.
- A mantiene `apps/mobility-expo/**`, `apps/movete-driver/**`, `docs/architecture/**` y workflows comunes.
- B mantiene `apps/movete-cliente/**`, `apps/movete-admin/**`, `docs/architect-b/**`. No cambiar archivos B ni fusionar PR #7/#8.
- Sin VPS, push, JWT productivos, SQL remotos, datos reales, PSP ni despliegue sin autorización explícita.

## Siguiente etapa

**G60D**: composición verificable en un test de integración local G60B → G60C → exchange delegado, con authenticación G42 y roles provenientes del servidor, y plan de contrato HTTPS STAGING (sin desplegar). **G61**: trazabilidad de app Driver/Cliente por dispositivos físicos, backend seguro y pruebas de reasignación, seguridad vial y privacidad; requerirá infraestructura y autorizaciones cuando proceda.

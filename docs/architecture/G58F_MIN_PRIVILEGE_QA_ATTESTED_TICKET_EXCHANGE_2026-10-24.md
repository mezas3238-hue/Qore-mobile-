# G58F / A46 — Canje QA de tickets de chat con privilegios mínimos
**Fecha:** 2026-10-24 · **Owner:** Arquitecto A · **Rama:** `feature/mobility-monorepo-isolated-20261016`
**Estado:** Implementado en rama A; CI en verificación. **NO LIVE / NO DEPLOY / NO MERGE / NO proveedor real.**

## Problema de seguridad
Las funciones heredadas G49/G54/G56/G56B/G57B emiten capacidades sintéticas bajo titular SQL de QA, no bajo un emisor productivo autenticado. Dos comprobaciones Node de la sesión no retienen un bloqueo hasta el COMMIT. Un cliente nunca puede atribuirse actor, sesión, rol o `tokenIatMs` al solicitar un mint.

## Implementación
- Migración **solo PostgreSQL16 desechable** `apps/mobility-expo/docs/backend/staging_only/G58F_MIN_PRIVILEGE_TICKET_EXCHANGE_POSTGRES_CI_ONLY.sql`. Abortará en otra base o con otro `application_name`.
- Roles NOLOGIN/NOINHERIT separados: `mobility_g58f_definer_ci` propietario de función/tabla, y `mobility_g58f_exchange_ci` con EXECUTE únicamente sobre `mobility_stage_g58f_exchange_attestation_qa(uuid)`.
- El rol de canje recibe **únicamente un UUID aleatorio opaco**, no `actorId`, `role`, `iat`, consulta SQL ni servicio. Almacena su hash SHA-256. Su ámbito viene de una atestación cargada **únicamente por el propietario del fixture local** y nunca desde una petición HTTP.
- TTL máximo de atestación 15 segundos, una sola redención, `SELECT ... FOR UPDATE` y `G42_lock_session` antes de invocar la emisión acotada existente. La revocación concurrente espera hasta el COMMIT; una revocación anterior hace fallar la emisión.
- El definer no es propietario de otras tablas privadas ni tiene permiso directo para mensajes, RLS de otros usuarios o cambios de roles. Se concedió solo EXECUTE de los seis mint heredados que requiere, sin restablecer los grants de `service_role`.
- `SECURITY DEFINER SET search_path=''`, propietario NOLOGIN, RLS activada en tabla de atestaciones. La concesión temporal CREATE del rol definer se revoca antes del COMMIT de la instalación.
- Operaciones QA acotadas: `CHAT_OPEN`, `CHAT_HISTORY`, `CHAT_INBOX`, `CHAT_READ`, `DRIVER_INBOX`, `DRIVER_HISTORY`, `DRIVER_MARK_VISIBLE`. Las funciones anteriores vuelven a comprobar rol, servicio y asignación. No se montan nuevas rutas públicas.
- Node `g58f-qa-ticket-exchange.mjs` acepta solo identidad que retorna el verificador inyectado del servidor, rechaza claims de identidad/rol en scope, valida flag de entorno aislado, respuesta y vencimiento, y no permite producción. Es un contrato de QA: el mock de proveedor **no es** un IdP real.

## Pruebas
- `G58F_MIN_PRIVILEGE_TICKET_EXCHANGE_ASSERT_POSTGRES_CI_ONLY.sql`: grants efectivos y NOLOGIN, definer, search_path, owner, RLS, revocación CREATE, roles existentes sin capacidad de mint.
- `g58f-scoped-ticket-exchange-race-ci.py`: dos conexiones PostgreSQL reales sobre el mismo proof, exactamente un ganador; replay denegado; cross-role, sesión ajena, `iat` inválido, proof caducado, rol anon/authenticated/service_role sin EXECUTE, y revocación antes/durante transacción.
- `g58f-qa-ticket-exchange.test.mjs`: entradas JavaScript adulteradas, claim ajeno, sesión revocada/no pinneada, alcance impropio, respuesta peligrosa o LIVE activado.
- `.github/workflows/mobility-g4-postgres-disposable.yml`: instala migración al final de la cadena G58D, ejecuta ASSERT y carrera Python. Node STAGING ejecuta automáticamente `*.test.mjs`.
- Confirmar PostgreSQL, Node, Expo e aislamiento en **el mismo SHA** antes de etiquetar este gate como QA verificado. Un resultado rojo implica corregir y repetir, no declarar PASS.

## Lo que NO resuelve
1. **La atestación inicial es sintética y privilegiada**. Su inserción por el propietario local no equivale a prueba criptográfica de proveedor. El despliegue real exige IdP JWT con issuer/audience/JWKS y sesión verificada, SQL pool con identidad/credenciales mínimos, diseño y auditoría de emisor de proofs y aprobaciones Owner.
2. Los viejos métodos `mint_owner_qa` permanecen reservados al propietario del laboratorio, para compatibilidad. Este cambio no crea un emisor público productivo ni una ruta HTTPS.
3. Revocación y COMMIT son atómicos dentro de PostgreSQL, pero un timeout después de COMMIT requiere **G59 reconciliación por requestKey**. No confirmar entrega, lectura o pago por timeout o por sólo HTTP 200.
4. Ninguna señal de chat de dispositivo físico, notificación real ni proveedor Auth fue certificada aquí. No habilita usuarios ni viajes reales.

## Siguiente gate
**G59:** recibo idempotente post-timeout (requestKey + payload hash + consulta autoritativa), recuperación de G53 ACK histórica frente a revisiones G52 más nuevas, límites distribuidos/GC de proofs, manteniendo semántica del servidor. Coordinar exclusivamente por issue #9 con B; NO editar `apps/movete-cliente/**` ni `apps/movete-admin/**`.

# QORE Mobile — Arquitecto A / G49: puente de identidad y delegación privada de chat

**Fecha:** 23-oct-2026 (Paraguay). **Estado:** implementación/ensayo de autorización QA; NO conexión remota, NO LIVE, NO MERGE. Rama A PR #7 DRAFT. El objetivo es eliminar la tentación de exponer `*_owner_qa` directamente a un futuro servidor o a la app.

## Estado observado antes de G49

G42 ya tiene un verificador criptográfico de JWT con issuer HTTPS, audience `authenticated`, JWK públicos y algoritmos fijados (ES256, RS256, EdDSA), además de la verificación independiente del usuario, la sesión del proveedor y un grant SQL privado. G43 bloquea revocaciones contra transacciones. G50–G53 prueban mensajería e inbox en PostgreSQL 16 **exclusivamente descartable**: los tres RPC de chat necesitan permisos del propietario y **no** son un endpoint seguro tal cual. G48 ofrece un precedente de tickets de un solo uso pero no concede acceso a chat.

## G49 construido (sin invadir la rama del Arquitecto B)

1. `apps/mobility-expo/docs/backend/staging_only/G49_SCOPED_CHAT_AUTH_BRIDGE_POSTGRES_CI_ONLY.sql`: crea `mobility_g49_chat_gateway_ci` como `NOLOGIN NOINHERIT`, sin superusuario ni permiso de DDL. El rol no puede consultar la tabla de tickets, mensajes, sesiones o llamar `G50/G52/G53` directamente. **Solo puede ejecutar** `mobility_stage_g49_open_qa(ticket)`, `mobility_stage_g49_history_qa(ticket,revision,beforeSeq,limit)` y `mobility_stage_g49_send_qa(ticket,requestKey,body)`.
2. Las pruebas `G49_SCOPED_CHAT_AUTH_BRIDGE_ASSERT_POSTGRES_CI_ONLY.sql` validan que ninguna función de mint o consumo sea ejecutable por `anon`, `authenticated`, `service_role`, G48 o por el delegado G49; que tickets inventados, consumidos, reutilizados para un propósito distinto, cuentas Driver/extranjeras, asignaciones cambiadas y sesiones revocadas nunca autoricen chat. El harness usa usuarios exclusivamente sintéticos y `ROLLBACK`.
3. El propietario de QA (fuera de HTTP) puede emitir un token aleatorio de un solo uso, ligado a `actorId`, `sessionId`, `tokenIatMs`, `CHAT_OPEN/HISTORY/SEND`, servicio e hilo; solo se guarda `SHA-256(ticket UUID)`, con vencimiento de 20 s. La operación delegada bloquea fila de ticket con `FOR UPDATE`, bloquea sesión G42, revisa exclusividad Passenger y reasignación real **en la misma transacción**, consume y llama al RPC seguro G50/G52/G53.
4. `apps/mobility-expo/server/g49-pinned-chat-scoped-bridge-qa.mjs` compone `createG42PinnedJwtVerifier` y `createG42ProviderSessionAdapters`; recibe un JWT firmado (no un actor/rol proporcionado por el dispositivo), consulta registros de usuario/sesión/grant de fuentes distintas y aplica autoridad exclusiva de Passenger, rate gate y emisión privada QA antes de delegar. El contrato de entrada tiene campos exactos y evita los `actorId`, `sessionId`, `role` o nombres SQL elegidos por usuario.
5. `g49-pinned-chat-scoped-bridge-qa.test.mjs`: genera JWT ES256 **firmados de verdad** durante la prueba, rechaza firma falsificada, issuer equivocado, usuario inexistente, session_id cambiado, claim de role privilegiado, proveedor caído, grant faltante, boleto adulterado, mal uso del propósito, recepción contaminada y modo LIVE.
6. `g49-pinned-chat-scoped-bridge-openapi-contract.test.mjs` y OpenAPI agregan banderas de bloqueo sin nuevas rutas HTTP, sin activar una sesión real. La cadena PostgreSQL G49 se ejecuta **después de G53**, aunque su número identifica el prerrequisito arquitectónico originalmente pendiente.

## Seguridad y limitaciones obligatorias

**Este puente NO está listo para tráfico real.** `mint_owner_qa` es explícitamente una simulación de attestación del propietario; no equivale a conectar un issuer productivo ni a disponer de un usuario SQL con sesión restringida en un servidor. El rol NOLOGIN no es una credencial de conexión remota. Los callbacks `readProviderUser`, `readProviderSession`, `readPrivateSessionGrant`, `mintOwnerTicket` y `executeScopedTicket` son inyectables para pruebas, **no conexiones a Supabase reales**. No hay secrets/provider credentials, emisión remota de tickets ni middlewares HTTPS.

El ticket es bearer opaco y no cifra mensajes; su secreto operativo reside solamente en backend. Un reintento de `CHAT_SEND` exige ticket nuevo verificado y **el mismo** requestKey para recuperar el ACK persistido G53. Nunca marcar como entregado al conductor simplemente por recibir `serverStored:true`. Los límites por página de 100 no son topes globales de registros.

## Pendientes bloqueantes para una aplicación real

- Conectar issuer/audience/JWKS administrado, política de rotación de claves, lectura autenticada de usuarios y sesiones del proveedor, verificación de MFA para Admin; documentación de amenazas y logs sin JWT/cuerpo de chat.
- Aprovisionar un ejecutor SQL de privilegio mínimo real, cuya credencial nunca salga al cliente. Sustituir el mint sintético del owner por emisión segura ligada a la identidad verificada, con rate limiting distribuido y auditoría sin PII.
- Montar servidor HTTPS, políticas de conexión, sesiones, recuperación de fallos, y completar pruebas Cliente ↔ Driver sobre staging aislado y dispositivos reales. No habilitar aún mensajería ni pagos.
- Continuar implementando autorización Driver propia, push privado y read receipts de G51 a través de rutas mínimas, no reutilizar privilegios Passenger. Mantener PR #7 A y PR #8 B en DRAFT.

**NO MERGE / NO LIVE / NO DEPLOY** sin aprobación del Owner. Certificaciones CI de este documento son exclusivamente SQL/Node de prueba.

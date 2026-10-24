# QORE Mobile — G53 / Arquitecto A · Confirmación durable de mensajes Cliente

**Ámbito:** PostgreSQL 16 descartable + Node QA, nunca producción. PR A #7 DRAFT, sin merge, deploy, LIVE, PSP, datos personales reales ni cambios en directorios del Arquitecto B. Fecha de corte: 23-oct-2026 Paraguay.

## Avance concreto

G50 almacenaba idempotentemente el mensaje, G52 asociaba cada mensaje a su revisión duradera, y Cliente B (`passenger-chat-flow.mjs`) exige al enviar un ACK sellado exacto de nueve campos: `conversationId,serviceId,requestKey,messageId,senderRole,body,createdAt,revision,serverStored`. G53 une ambos contratos sin permitir que el navegador fabrique actor, sesión, rol o un recibo confirmado.

- SQL `apps/mobility-expo/docs/backend/staging_only/G53_PASSENGER_CHAT_SEND_POSTGRES_CI_ONLY.sql`: solo servicio RIDE/DELIVERY/MERCHANT_ORDER, hilo exacto asignado y actor **Passenger**, G42 bloqueada en la misma transacción, G50 valida servicio y persiste, G52 recupera revisión inmutable desde `mobility_stage_g52_message_versions`. La respuesta se construye exclusivamente con el mensaje leído en BD; `serverStored:true` solo tras commit del RPC.
- SQL `G53_PASSENGER_CHAT_SEND_ASSERT_POSTGRES_CI_ONLY.sql`: ensaya ACK exacto, dos mensajes, el mismo requestKey y cuerpo recupera idéntico ACK aun con revisión actual posterior; replay modificado, Driver/actor ajeno, tipo/ID falso, HTML, reasignación, servicio terminal y sesión revocada se rechazan. Todos los fixtures se deshacen con `ROLLBACK`.
- Node `apps/mobility-expo/server/g53-passenger-chat-send-qa.mjs`: campo de entrada sellado `bearer,serviceKind,serviceId,conversationId,requestKey,body`; token verificado, concesión de sesión y rol exclusivo independiente, rate gate inyectado; parámetro `_actor` siempre derivado del token. Valida exactamente el ACK durable de Cliente B, no permite inventar estado entregado.
- Node `g53-passenger-chat-send-qa.test.mjs`: verificación negativa de JWT, PII/teléfono/correo/enlace/HTML, suplantación, permisos, rate limit, revocación, SQL errores y ACK falsos o contaminados.
- `g53-passenger-chat-send-openapi-contract.test.mjs`: contrato OpenAPI versión `1.0.0-g53`; ruta futura POST `/v1/staging/chat/services/{serviceKind}/{serviceId}/conversations/{conversationId}/messages`, explícitamente `x-qore-runtime-wired:false`; no se montó HTTP.
- `g53-passenger-chat-send-concurrency-ci.py`: dos conexiones independientes PostgreSQL compiten con el mismo `requestKey`; deben devolver mismo ACK y una sola fila/version. Revocación G42 espera lock y prohíbe incluso replay después.
- CI `.github/workflows/mobility-g4-postgres-disposable.yml`: instalaciones G50→G51→G52→G53 en PG16 sintético, assert G53 y carrera multiconexión.

## Garantías y límites

- Una llave idempotente pertenece a `(conversationId,senderId,requestKey)`; si el cuerpo cambia devuelve error G5009, si no cambia, no crea filas, no sube revisión y recupera el mismo ACK.
- En reasignación de Driver se rota el `conversationId` y nadie puede usar el anterior, ni para releer un ACK. En servicio terminal no hay nuevos envíos. Una sesión revocada no autoriza siquiera reintento idempotente.
- El ACK `revision` es la versión **original del mensaje**. No se afirma que el mensaje haya sido leído por el Driver ni entregado a dispositivo: `serverStored` significa exclusivamente persistencia PostgreSQL.
- Las rutas y RPCs `*_owner_qa` siguen inaccesibles para `anon`, `authenticated`, `service_role` y el delegado G48. La firma de JWT real, emisor de identidad SQL mínimo privilegio y transporte HTTPS aún no están integrados.
- No hay prueba E2E de Cliente/Driver reales ni notificación push. `apps/movete-cliente` conserva su gate OFF. El Driver requiere autorización separada sin conceder privilegio Passenger.

## Próximas etapas

1. Integrar verificación real de issuer/audience/JWKS y fuentes IAM, sesión/rol y conexión de BD con permisos mínimos G49, aislada de acceso owner-only; require aprobación para credenciales/infra externa.
2. Ensayar verdaderamente Cliente→Node→PostgreSQL→Driver, roles, revocación, pérdida de red, recuperación exacta requestKey y transportes privados; no simularlo como conexión real.
3. Antispam persistente con cuotas por cuenta/hilo, replay condicionado, auditoría sin exponer cuerpo; retención, borrado legal y push genérico.
4. Gate y gestión de incidentes reales, seguridad vial, pruebas de teléfono y aprobación explícita del Owner antes de producción.

**Nota:** pruebas CI verdes certifican solo alcance QA disposable; producción de Movete Fácil sigue deshabilitada.

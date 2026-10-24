# QORE Mobile — G51 / A32 · Bandeja privada de chat y cursores verificables

**Corte:** 23 de octubre de 2026, Paraguay. **Implementación solo en la rama A PR #7 DRAFT**, para PostgreSQL descartable y validación Node QA. No existe servidor HTTPS, mensajería en dispositivos reales, proveedor de sesión conectado al emisor ni despliegue.

## Objetivo y alcance

Completar la dependencia B R10–R13 de **bandeja de conversaciones privada** (no la bandeja de ofertas) respetando exactamente su contrato: `ownerId, generatedAt, expiresAt, revision, items, nextCursor, productionEnabled`; cada item exige `conversationId, serviceId, serviceKind, state, assignmentVerified, counterpartRole, revision, unreadCount, updatedAt, canSend`.

La interfaz B ya dispone de lógica local de control de caché y caducidad; el backend no se inventa un HTTP operativo. Todas las rutas del contrato permanecen `x-qore-runtime-wired: false`.

## Archivos construidos

- `apps/mobility-expo/docs/backend/staging_only/G51_CHAT_INBOX_MONOTONIC_POSTGRES_CI_ONLY.sql`: actividad append-only por hilo, por mensaje y por lectura; recibos `through_seq` monótonos; inbox exclusivamente Passenger con G42 bloqueada en la transacción, rol único y reconsulta de asignación vigente G50. No hay acceso directo mediante `service_role`, `anon`, `authenticated` ni delegado G48.
- `G51_CHAT_INBOX_MONOTONIC_ASSERT_POSTGRES_CI_ONLY.sql`: fixtures sintéticos 205 conversaciones, cursor keyset en tres páginas (100 + 100 + 5), mensajes ajenos, contadores de no leídos, recibo que no retrocede y rechazo de lectura futura; revision de DB rechaza cursor viejo (G5109); revocación y cambio de Driver.
- `apps/mobility-expo/server/g51-chat-inbox-qa.mjs`: HMAC-SHA256 sobre payload compacto. Cursor opaco ligado a subject, sessionId, emisión JWT, revisión de BD, posición `updatedAt DESC, conversationId DESC` y caducidad. Verificación de firma con `timingSafeEqual`. Clave inyectada fuera del código, al menos 32 bytes; no hay claves dentro de repositorio. Nunca confiar en `ownerId` ni `role` del navegador.
- `g51-chat-inbox-qa.test.mjs`: actor cruzado, cambio de sesión, TTL, firma falsa, revisión incorrecta, DTO contaminado y rol duplicado.
- `g51-chat-inbox-openapi-contract.test.mjs`: compatibilidad contractual con B y verificación de guardas no-LIVE.
- `apps/mobility-expo/docs/backend/openapi/movete-facil-staging.openapi.json` versión `1.0.0-g51`: GET `/v1/staging/chat/conversations` y POST `/v1/staging/chat/conversations/{conversationId}/read-receipt`, ambas futuras/no montadas.
- CI: `.github/workflows/mobility-g4-postgres-disposable.yml` instala G51 **después** del ensayo real de dos conexiones G50. No hay writes remotos.

## Autoridad y riesgos

1. `assignmentVerified:true` se calcula solo cuando el origen G3/G5/G6 confirma conductor/repartidor actual y servicio activo; una conversación obsoleta deja de salir en inbox.
2. `unreadCount` proviene de mensajes persistidos posteriores al `through_seq` propio. La marca nunca puede exceder un mensaje realmente persistido y nunca retrocede.
3. `revision` es el máximo evento monotónico de la cadena; nueva actividad revoca la navegación con revisión anterior, exigiendo refresco. El cursor no tiene acceso al historial completo por sí mismo.
4. `limit=100` es máximo POR PÁGINA; 205 filas prueban lectura total sin límite global y cursor estable. No inferir que hay solo 100 clientes.
5. Operaciones usan `mobility_stage_g42_lock_session` dentro de PG, jamás confiar solo en una validación HTTP separada.
6. Contratos G50 y G51 no son socket/realtime, cifrado de extremo a extremo, push físico ni consentimiento para usar datos de producción.

## Dependencias abiertas

- G49 JWT/JWKS/issuer/audience + IAM de emisión de capability **con proveedor verdadero**, confirmado por Owner antes de credenciales/servicio externo.
- API HTTPS con permisos mínimos; jamás desplegar `*_owner_qa` o emisor owner-only en un host real.
- Cursor de **historial de mensajes** firmado (G50 aún usa `after` numérico), no confundir con cursor firmado del inbox G51.
- Controles de abuso/rate limiting distribuido, reporte/bloqueo, retención/purga con política legal Paraguay, trazas auditables sin bodies, anti-spam y seguridad de conductor en movimiento.
- Notificaciones push genéricas y E2E Cliente/Driver/Admin Android/iOS con reasignación de Driver y recuperación tras cortes reales.
- Si la asignación cambia en DB, la lectura la revalida; todavía debe integrarse una invalidación proactiva de la revisión de inbox con cambios de fuente sin que se abra el hilo.

**Gobernanza:** ningún merge, LIVE, despliegue, banco, SQL remoto, datos reales ni cambios en las carpetas del Arquitecto B.

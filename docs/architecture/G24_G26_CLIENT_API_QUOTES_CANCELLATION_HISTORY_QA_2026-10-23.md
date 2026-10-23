# Movete Fácil — Arquitecto A G24–G26 (23/10/2026)
**Propósito:** coordinar contratos servidor con el Arquitecto B sin editar `apps/movete-cliente/**` ni `apps/movete-admin/**`. Fuentes de verdad: PR #7 A, PR #8 B e issue #9. **QA sintético, solo loopback `127.0.0.1`, sin deploy.**

## G24: cotización Gs originada exclusivamente en servidor
- `POST /v1/staging/fares/quote`, body existente `requestKey,fareMode,subjectKind,subjectId`, sin monto/distancia/costo enviados por cliente.
- Respuesta compatible con `inspectServerQuote` del Cliente B: `ownerId,quoteId,amountGs,fareMode,subjectKind,subjectId,expiresAt` (epoch ms), `fareVersion,routingVerified`, además de `quote` y flags QA legado.
- El backend G7 verifica el actor Auth confirmado, rol Passenger, límites, ruteo con tráfico, reglas persistidas, identidad/sujeto/modo, monto Gs íntegro y caducidad posterior a reloj de servidor y no mayor a 1 h. Retorno **409** para recibo inviable. No hay precio ni impuesto comercial aprobado; la ruta por sí sola no habilita PSP.
- `RIDE` solo `AUTO`: pasajeros MOTO siguen bloqueados. Carga MOTO es servicio distinto sujeto a gates de elegibilidad.
- SQL G7/RLS se mantienen bajo control de A. Ni un importe de prueba es tarifa de lanzamiento.

## G25: cancelación de viaje propio
- `POST /v1/staging/rider/trips/{tripId}/cancel`, body exactamente `{"requestKey":"uuid"}`. Identidad deriva del JWT, nunca del cuerpo. Rol Passenger exclusivo.
- Reutiliza `mobility_stage_auto_demo_transition` con `event=cancel` y `eventKey=requestKey` desde repositorio PostgreSQL de G3. El estado persistido, propiedad y replay son verificados por SQL; respuesta expone recibo de evento únicamente.
- Errores 400/401/403/409/429/503. Ninguna operación de refund/fee real o simulada se infiere del acto de cancelar. Política de cobro/reembolso sigue pendiente.
- Backend no expone este endpoint desde HTTPS público: solo QA loopback.

## G26: historial privado de Cliente — primera página
- `GET /v1/staging/rider/history` bajo JWT Passenger, sin parámetros de usuario ni query pública.
- Lee sólo columnas `id,<owner>,status,revision,created_at` de `mobility_stage_auto_demo_trips`, `mobility_stage_deliveries` y `mobility_stage_merchant_orders` usando `service_role` **exclusivo servidor**, con `eq(owner,user.id)` y validación de propietario en la respuesta. El navegador nunca recibe `service_role`.
- Formato mínimo exacto para `projectClientHistory` de B: `ownerId,generatedAt,expiresAt,items,nextCursor:null`; elementos `serviceId,kind,status,createdAt,revision`. TTL 60 segundos. No PII, rutas, matrículas, monto ni documento.
- **Limitación explícita G26.0:** máximo 50 registros en total; se cargan 51 por cada fuente. Si faltan tablas/permisos, hay error o existen >50 en conjunto, se emite 503 sin lista parcial. No cursor ni histórico profundo todavía. Se requiere G26.1 paginación keyset autenticada, snapshots coherentes, índices y SQL PostgreSQL real antes de completar historia comercial.
- En PostgreSQL real se debe auditar cada `SELECT`, RLS/restricciones de `service_role` e índices en `passenger_id/sender_id/buyer_id,created_at,id`. La QA existente de G3/G5/G6 usa instalaciones desechables separadas; **no equivale** a una migración integral en Supabase remoto.

## Evidencia de pruebas
- `g7-finance-gateway.test.mjs` + `g4-staging-runtime.test.mjs`: recibos fuente servidor, TTL, MOTO pasajeros denegado.
- `g4-trip-command-gateway.test.mjs` + `g4-loopback-http-transport.test.mjs`: autorización, rechazo de datos de cobro y transiciones seguras.
- `g26-rider-history-gateway.test.mjs`, `g26-rider-history-repository.test.mjs`, `g26-rider-history-loopback.test.mjs`: consultas privadas por actor, sanitización, límite, ausencia de fugas y HTTP local.
- `g11-openapi-contract.test.mjs` certifica presencia y forma de los 3 contratos. Todos los tests usan identidad y datos SINTÉTICOS; concluir `SUCCESS` únicamente al verificar los workflows del HEAD exacto.

## Próximos trabajos de A (sin tocar carpetas B)
1. G26.1: paginación keyset, cursor firmado/contexto de dueño, límite 50, consistencia y múltiples tablas sin omisiones.
2. Contratos Auth Passenger/Admin/Owner y MFA real en servidor, DTO KYC/zonas/incidentes y finanzas Owner, pruebas RLS no vacías.
3. Desplegar solamente STAGING bajo autorización y HTTPS/pinned origin; conectar SDK Auth sin credenciales por GitHub.
4. Validar sesión, privacidad, cotización y cancelación en dos apps físicas; observar race, offline, GPS y red.
5. Mantener código B separado y issue #9 abierto hasta fin de dependencias.

**Prohibido:** MERGE, LIVE, pagos reales, PSP, KYC real, push real, VPS, SQL remoto, sincronización automática de ramas o copiar archivos del Arquitecto B.

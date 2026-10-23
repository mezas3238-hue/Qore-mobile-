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

## G26.1: historial privado de Cliente — **TODOS LOS REGISTROS, SIN TOPE GLOBAL**
- `GET /v1/staging/rider/history` bajo JWT Passenger; no acepta parámetros de identidad ni query arbitraria.
- Primera página sin encabezado adicional. En las sucesivas, enviar exactamente `X-Qore-History-Cursor: <nextCursor>` usando el cursor devuelto por el servidor. Repetir hasta `nextCursor:null`. El tamaño de cada respuesta es de 0–50 elementos **solo para transporte; no hay máximo acumulado**. Un pasajero con 1.200 operaciones recibe 24 páginas, no un rechazo 503 ni una historia truncada.
- El cursor HMAC-SHA256 es opaco y asociado al JWT verificado; no lo puede fabricar ni usar otra cuenta. Lleva posición keyset `(created_at,id,kind)` y una fecha de corte del servidor. Caduca a los 10 minutos de inactividad; cada petición válida renueva el plazo. Cursor inválido/corrupto/caducado => 400 y no se consulta SQL.
- Datos exclusivamente propios consultados con `.eq(passenger_id|sender_id|buyer_id,user.id)` de `mobility_stage_auto_demo_trips`, `mobility_stage_deliveries`, `mobility_stage_merchant_orders`. Nunca se envía service key a las apps. Orden estable descendente por fecha, ID y tipo de servicio. Consultas keyset con `.lte(created_at,anchor)` y comparación `created_at,id`, sin `OFFSET` ni traer toda la tabla a memoria. Por página, máximo 51 filas por origen, para determinar si hay continuación.
- DTO compatible con `projectClientHistory` del Arquitecto B: `ownerId,generatedAt,expiresAt,items,nextCursor`; elementos `serviceId,kind,status,createdAt,revision`. TTL de caché 60 s. Sin PII, ubicación, rutas, matrículas, nombre de conductor, montos ni documentos.
- Si faltan tablas, hay errores SQL, identidad inválida o datos inconsistentes => 503. **Nunca se devuelve una lista parcial como si fuera todo el historial.**
- Evidencia automatizada: `g26-rider-history-repository.test.mjs` recupera **1.200 operaciones por 24 páginas**, sin omisión ni duplicación, además de pruebas de firma/actor/vencimiento/HTTP local. Estas son pruebas sintéticas; no prueban aún latencia de tablas reales con millones de registros.
- **G26.2 implementado en CI PostgreSQL real (descartable):** nuevo archivo `G26_HISTORY_INDEXES_POSTGRES_CI_ONLY.sql` crea tres índices propios `(passenger_id|sender_id|buyer_id,created_at DESC,id DESC) INCLUDE(status,revision)`. `G26_HISTORY_UNBOUNDED_ASSERT_POSTGRES_CI_ONLY.sql` instala 1.200 registros sintéticos entre G3/G5/G6, recorre las 24 páginas keyset, prohíbe duplicación de UUID, verifica permisos INSERT bloqueados y RLS para la cuenta ajena y propia, y evalúa mediante `EXPLAIN (FORMAT JSON)` que los tres índices sean utilizables. Se incorpora al workflow `mobility-g4-postgres-disposable.yml`, en `qore_disposable_chain` y `localhost` solamente; no es migración productiva.
- **Evidencia:** SQL real #194 SUCCESS: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39925294471 . SQL real con validación `EXPLAIN` #195: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39925580301 . No equiparar estas ejecuciones con millones de filas o staging remoto.
- **Pendientes de integración:** la app Cliente B debe recorrer automáticamente `nextCursor` y acumular todas las páginas. Su regex inicial `CURSOR=/^[A-Za-z0-9_-]{1,200}$/` **no acepta** el cursor HMAC `v1.<carga>.<firma>` del backend A; Arquitecto B debe corregirlo exclusivamente en su carpeta (issue #9). No hay tope de historia, pero sí páginas pequeñas para mantener memoria/red bajo control.
- **Pendientes de producción:** volumetría alta (cientos de miles/millones), índices/planes y política de snapshots consistentes bajo escrituras concurrentes; RLS con cuentas reales y JWT/Supabase autorizados, sin SQL remoto por ahora.

## Evidencia de pruebas
- `g7-finance-gateway.test.mjs` + `g4-staging-runtime.test.mjs`: recibos fuente servidor, TTL, MOTO pasajeros denegado.
- `g4-trip-command-gateway.test.mjs` + `g4-loopback-http-transport.test.mjs`: autorización, rechazo de datos de cobro y transiciones seguras.
- `g26-rider-history-gateway.test.mjs`, `g26-rider-history-repository.test.mjs`, `g26-rider-history-loopback.test.mjs`: consultas privadas por actor, sanitización, límite, ausencia de fugas y HTTP local.
- `g11-openapi-contract.test.mjs` certifica presencia y forma de los 3 contratos. Todos los tests usan identidad y datos SINTÉTICOS; concluir `SUCCESS` únicamente al verificar los workflows del HEAD exacto.

## Próximos trabajos de A (sin tocar carpetas B)
1. G26.3: ensayo masivo de rendimiento/concurrencia, cursores ante escrituras y certificación Auth/JWT remoto bajo autorización; G26.1 no tiene límite total.
2. Contratos Auth Passenger/Admin/Owner y MFA real en servidor, DTO KYC/zonas/incidentes y finanzas Owner, pruebas RLS no vacías.
3. Desplegar solamente STAGING bajo autorización y HTTPS/pinned origin; conectar SDK Auth sin credenciales por GitHub.
4. Validar sesión, privacidad, cotización y cancelación en dos apps físicas; observar race, offline, GPS y red.
5. Mantener código B separado y issue #9 abierto hasta fin de dependencias.

**Prohibido:** MERGE, LIVE, pagos reales, PSP, KYC real, push real, VPS, SQL remoto, sincronización automática de ramas o copiar archivos del Arquitecto B.

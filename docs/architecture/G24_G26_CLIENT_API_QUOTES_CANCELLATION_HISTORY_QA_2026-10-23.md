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

## G26.3 — QA avanzado sin límite global (23 oct 2026)
- **Integración HTTP completa, no mock de respuestas:** `g26-rider-history-paginated-http.test.mjs` atraviesa servidor loopback real, verificación JWT sintética, autorización, repositorio SQL simulado y 24 cursores HMAC consecutivos. Recupera **1.200 registros sin duplicados** y verifica que una cuenta ajena no pueda usar el cursor de otra, que la cabecera `Cache-Control` no exponga datos y que registros nuevos posteriores a la fecha ancla no desordenen una lectura iniciada. QA Node SUCCESS en el commit `a8624d713f2a7df428319d1a45c156545e74958c`.
- **PostgreSQL real desechable, volumen mayor:** `G26_HISTORY_LARGE_VOLUME_POSTGRES_CI_ONLY.sql` inserta 30.000 operaciones sintéticas adicionales sobre 1.200 previas, mantiene el esquema G3/G5/G6 e índices y recorre las 3 tablas por orden keyset. PostgreSQL 16 confirmó el NOTICE literal: `G26.3 POSTGRES: 31200 owned historic rows / 624 pages / 0 duplicates`. No existen topes globales de histórico, solo bloques pequeños por solicitud. CI run #200 SUCCESS: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39931735547 .
- **Verificación total del código G26.3:** STAGING Node #388 SUCCESS, Expo #936 SUCCESS y aislamiento de dos aplicaciones #291 SUCCESS (mismo commit `650b0794b21ac0e65d721da34f3983d59272b554`).
- **Pendiente, sin reclamar certificación de producción:** el gateway HTTP del Cliente B todavía no incluye `riderHistory` GET ni cabecera `X-Qore-History-Cursor` (aunque B ya corrigió el regex `nextCursor`); se notificó en el issue #9. Continúan pendientes pruebas con millones de registros, escrituras retroactivas concurrentes, redes móviles reales, JWT/Auth de STAGING, SDK móvil y una política de retención/archivado aprobada.
- **Límite de consistencia conocido:** el cursor fija una fecha ancla y excluye inserciones nuevas con `created_at` posterior a ella. No constituye un snapshot transaccional persistente entre llamadas; inserciones retroactivas o ediciones de `created_at` deberán prohibirse/auditarse en la capa de persistencia y ensayarse antes de operación real.

## G26.4 — Integridad del origen histórico y escrituras concurrentes (23 oct 2026)

- **Migración aislada agregada en A, SIN habilitar remoto:** `G26_HISTORY_IMMUTABLE_ORIGIN_POSTGRES_CI_ONLY.sql` instala tres triggers `BEFORE INSERT OR UPDATE` en las tablas G3, G5 y G6. Para operaciones nuevas exige `created_at = transaction_timestamp()`, impidiendo a la capa normal de servicio crear viajes, envíos o pedidos retrodatados con un parámetro arbitrario. Para operaciones ya registradas prohíbe cambiar `id`, `request_key`, propietario (`passenger_id`, `sender_id` o `buyer_id`) y `created_at`. Permite cambios legítimos de `status`, `revision` y `changed_at`.
- **Verificación SQL adversarial sobre 31.200 registros sintéticos:** `G26_HISTORY_IMMUTABLE_ORIGIN_ASSERT_POSTGRES_CI_ONLY.sql` confirma que 12 intentos de modificar fecha/propietario/ID/clave y tres intentos de INSERT histórico retrodatado fallaron con el código del trigger; tres nuevas filas con fecha predeterminada del servidor y tres actualizaciones de ciclo de vida sí se admitieron. Todo se ejecutó en PostgreSQL 16 descartable, workflow #204 **SUCCESS**: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39932663942 .
- **Alcance correcto:** la política prohíbe backdating vía comandos ordinarios después de instalar el guard. No existe todavía una migración aprobada para Supabase remoto ni se garantiza snapshot transaccional entre páginas. Transacciones largas iniciadas antes de una página y confirmadas después requieren análisis adicional de visibilidad. Backfill histórico excepcional, eliminación legal y correcciones administrativas deberán usar un flujo independiente auditado y autorizado (nunca levantar el guard por defecto).
- **Cliente B:** integra las páginas con `X-Qore-History-Cursor`, su validación ya acepta puntos `v1.<payload>.<firma>`; el gateway HTTP aún requiere la operación `riderHistory`. No mezclar su código con la rama A.
- **Política de privacidad:** los documentos, los nombres, la localización, el precio individual y otros campos personales no forman parte del DTO del historial en esta fase. Retención y derechos de rectificación/eliminación necesitan evaluación jurídica específica antes de operación comercial.

## Evidencia de pruebas
- `g7-finance-gateway.test.mjs` + `g4-staging-runtime.test.mjs`: recibos fuente servidor, TTL, MOTO pasajeros denegado.
- `g4-trip-command-gateway.test.mjs` + `g4-loopback-http-transport.test.mjs`: autorización, rechazo de datos de cobro y transiciones seguras.
- `g26-rider-history-gateway.test.mjs`, `g26-rider-history-repository.test.mjs`, `g26-rider-history-loopback.test.mjs`: consultas privadas por actor, sanitización, límite, ausencia de fugas y HTTP local.
- `g11-openapi-contract.test.mjs` certifica presencia y forma de los 3 contratos. Todos los tests usan identidad y datos SINTÉTICOS; concluir `SUCCESS` únicamente al verificar los workflows del HEAD exacto.

## Próximos trabajos de A (sin tocar carpetas B)
1. G26.5: diseñar consistencia para transacciones no confirmadas, auditoría de backfill/retención y ensayo auténtico con Cliente B; el historial continúa sin límite global.
2. Contratos Auth Passenger/Admin/Owner y MFA real en servidor, DTO KYC/zonas/incidentes y finanzas Owner, pruebas RLS no vacías.
3. Desplegar solamente STAGING bajo autorización y HTTPS/pinned origin; conectar SDK Auth sin credenciales por GitHub.
4. Validar sesión, privacidad, cotización y cancelación en dos apps físicas; observar race, offline, GPS y red.
5. Mantener código B separado y issue #9 abierto hasta fin de dependencias.

**Prohibido:** MERGE, LIVE, pagos reales, PSP, KYC real, push real, VPS, SQL remoto, sincronización automática de ramas o copiar archivos del Arquitecto B.

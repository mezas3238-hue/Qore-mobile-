# QORE MOBILE / MOVETE FÁCIL — HANDOFF MAESTRO INTEGRAL DEL ARQUITECTO B (R1–R13)
## Transferencia de construcción: app Cliente + Admin Web | Trabajo terminado, trabajos pendientes, evidencias y ejecución continua
**Fecha del corte:** viernes 23 de octubre de 2026 · Paraguay · **Documento soberano de transferencia del Arquitecto B a un nuevo chat / Work**.

> **ORDEN DEL OWNER: CONTINUAR EL DESARROLLO SIN DETENERSE SALVO BLOQUEO REAL.** No reiniciar proyecto, no recapitular indefinidamente, no solicitar confirmación para cada mejora segura. Trabajar en bloques sucesivos **GitHub HEAD → inspección → implementar + tests → commit → CI → corregir → siguiente tarea**. Si la dependencia es ajena al ámbito B, informar a A por el issue #9 y continuar otro trabajo B. Nunca confundir un bloqueo de API con un bloqueo de todo el proyecto.

> **LÍMITES DEL OWNER:** NO MERGE / NO LIVE / NO DEPLOY / NO VPS / NO PSP o cobros reales / NO tiendas / NO SQL remoto / NO documentos personales reales / NO secrets / NO force-push o rebase unilateral. Requieren autorización explícita del Owner. QA y CI solo con datos sintéticos. Dos apps móviles distintas, más Admin Web; no mezclar con el trading.

---

# 0. LECTURA INMEDIATA PARA EL SIGUIENTE ARQUITECTO
- **Repositorio GitHub soberano:** [`mezas3238-hue/Qore-mobile-`](https://github.com/mezas3238-hue/Qore-mobile-). Atención: termina en guion `-`; **NO** es `qore-core` de trading.
- **Arquitecto B, tu área y PR:** [PR #8](https://github.com/mezas3238-hue/Qore-mobile-/pull/8), rama `feature/mobility-cliente-admin-parallel-20261022`, **DRAFT / OPEN**, base `feature/mobility-monorepo-isolated-20261016`.
- **HEAD B pre-handoff verificado:** `2b3ad882592300500c4bb88b81fe35ee6bf29fe9`. El commit que crea estos documentos cambiará el HEAD: al iniciar el nuevo chat, recuperar HEAD actual del PR #8.
- **Arquitecto A:** [PR #7](https://github.com/mezas3238-hue/Qore-mobile-/pull/7), rama `feature/mobility-monorepo-isolated-20261016`, DRAFT / OPEN, base `main`.
- **HEAD A último verificado:** `201a687abf68df13b4947296f230b53b2f361fd6`. Como A trabaja en paralelo, comprobarlo de nuevo al integrar.
- **Punto de coordinación técnico:** [issue #9](https://github.com/mezas3238-hue/Qore-mobile-/issues/9), OPEN; allí están DTOs, Auth, QA, chat y problemas que debe resolver A.
- **Handoff anterior completo:** [R13](./CONTINUIDAD_B_R13_CHAT_CONVERSATION_PIN_2026-10-23.md), complementado por R3 [maestro](./HANDOFF_MAESTRO_B_R3_CLIENTE_ADMIN_TOTAL_2026-10-23.md), el [histórico inicial](./HANDOFF_MAESTRO_INTEGRAL_ARQUITECTO_B_CLIENTE_ADMIN_CONTINUIDAD_2026-10-23.md) y los R4–R11.
- **Inventario completo auditable actualizado:** [ANEXO 213 commits y 214 archivos](./ANEXO_AUDITORIA_B_213_COMMITS_214_ARCHIVOS_2026-10-23.md), con cada SHA, título, ruta y cambio; NO perderlo.
- **CI pre-handoff confirmado del HEAD B:** 3/3 SUCCESS, Cliente **460/460 PASS**, Admin **185/185 PASS**, total **645/645 PASS**, TypeScript y export Expo web de ambos proyectos, Admin Vite build y boundaries SUCCESS.
- **Producción:** NO certificada, NO operativa. El frontend tiene flujos y adaptadores fail-closed, pero las integraciones backend, Auth real, operación en calle y tiendas quedan pendientes.

# 1. MANDATOS DE NEGOCIO, SEGURIDAD Y PRODUCTO
1. Movete Fácil es plataforma de movilidad y logística de Paraguay, ampliable por zonas, mejor experiencia que Bolt/Uber como **objetivo**, no como afirmación verificada.
2. **Dos aplicaciones independientes instalables:** `apps/movete-cliente/**` para pasajeros, remitentes y compradores; `apps/movete-driver/**` para conductores/repartidores. No unificar binarios, sesiones, rutas, paquetes ni credenciales.
3. `apps/movete-admin/**` es **panel WEB aparte**, no una app móvil ni un rol embebido en Cliente o Driver.
4. Servicios: pasajeros en AUTO, envíos AUTO/MOTO, entregas comerciales de restaurantes, supermercados, farmacias OTC y otros rubros habilitados. **MOTO pasajeros bloqueado** hasta normativa/seguros/municipio aprobados.
5. Diferenciar tarifa AUTO y MOTO/carga; los precios, descuentos, comisiones, impuestos, saldo, liquidación y precio final en **guaraníes/PYG** los define el servidor, no el cliente.
6. Activación por zonas ≠ disponibilidad, identidad KYC ≠ aprobación, catálogo ≠ stock/checkout real, cédula capturada ≠ conductor habilitado, notificación ≠ autorización.
7. Registros de personas, conductores, viajes, documentos, pedidos y conversaciones **sin tope global arbitrario de 50, 99 ni 100**. Los límites de páginas (50/100), lotes API o caché móvil son de rendimiento únicamente.
8. El repositorio único es GitHub; ningún resultado de test inventa trabajo pendiente ni prueba que una infraestructura remota esté montada.
9. Documentos KYC/seguros/licencias de conductores viven CENTRALMENTE en almacenamiento privado de A + Postgres/autorización, **no** como repositorio de archivos dentro de Driver o Cliente. Admin solo obtiene metadatos/evidencias autorizadas.
10. Seguridad transversal: autenticación real JWT, roles, MFA Admin, PostgreSQL RLS, URLs firmadas, privacidad PII, protección en movimiento, auditoría, antiabuso y dispositivos comprometidos antes de LIVE.
11. Lovable aportará **interfaz visual final** cuando la infraestructura esté preparada; no sustituye SQL/RLS/Auth, tarifario, dispatch, idempotencia, PSP, KYC o seguridad.
12. Los dos arquitectos trabajan simultáneamente, **pero nunca editan las rutas del otro**. Los PR deben permanecer DRAFT y aislados hasta autorización Owner.

# 2. MATRIZ DE PROPIEDAD (NO PISAR AL OTRO ARQUITECTO)
| Entidad | Arquitecto B — EDICIÓN PERMITIDA | Arquitecto A — EXCLUSIVO (B NO TOCAR) |
|---|---|---|
| Apps | `apps/movete-cliente/**`, `apps/movete-admin/**` | `apps/movete-driver/**`, `apps/mobility-expo/**` |
| Backend/DB | Adaptadores frontend internos B, sin cambiar contratos centrales | PostgreSQL/SQL, server Node, API/OpenAPI, Storage privado, Auth/JWT/RLS/MFA, tarifas, comisión, despacho, pagos, push |
| CI/infra | Ejecutar/leer workflows, documentar resultados | `.github/**`, `scripts/**`, configuraciones raíz, `packages/**`, `backend/**`, `database/**` |
| Documentos | `docs/architect-b/**` | `docs/handoff/**`, `docs/architecture/**`, documentos backend |
| Coordinación | Comentar [issue #9](https://github.com/mezas3238-hue/Qore-mobile-/issues/9) y PR #8 | Implementar contratos acordados y actualizar issue/PR #7 |

**Comprobación GitHub pre-handoff:** `PR #8 commits=213, changed_files=214` (106 Cliente, 45 Admin, 63 docs B); **0 archivos ajenos**. El árbol combinado de la rama también contiene archivos A heredados de su rama base; NO interpretarlos como trabajos B. Usar PR files o diff contra base correcta.

# 3. FOTO EXACTA DE GITHUB Y QA — 23 OCT 2026
| Indicador | Última evidencia |
|---|---|
| PR #8 B | DRAFT, OPEN, HEAD `2b3ad882592300500c4bb88b81fe35ee6bf29fe9`; 213 commits antes de este handoff |
| PR #7 A | DRAFT, OPEN, HEAD `201a687abf68df13b4947296f230b53b2f361fd6` |
| Backend A OpenAPI | `apps/mobility-expo/docs/backend/openapi/movete-facil-staging.openapi.json`, `1.0.0-g48`, **57 rutas** |
| Rutas chat/mensajes/conversations en A | **0** en el último OpenAPI consultado; **NO** confundir `driver/inbox` de ofertas con bandeja de mensajes |
| Cliente B | [CI #40032792799](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40032792799): **460 tests, 460 PASS, 0 FAIL**; TypeScript y export Expo Web SUCCESS |
| Driver en CI B | Job de chequeo de tipado/export separado SUCCESS; el código Driver NO se editó por B |
| Admin Web B | [CI #40032792758](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40032792758): **185/185 PASS**, TypeScript + Vite build SUCCESS |
| Aislamiento B | SUCCESS en #40032792799; apps separadas |
| Propiedad B | [CI #40032792790](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40032792790): SUCCESS |
| Total unit QA B | **645/645 PASS** |
| E2E Android/iOS, JWT real, PostgreSQL mensajes, PSP, dispatch calle, operador SOS | **NO certificados / NO operativos** |
| Pago real o LIVE | No habilitado, no autorizado |

**Atención:** un workflow verde prueba su alcance definido; NO certifica endpoints desplegados, OTP/login real, cobro, tiendas Android/iOS, seguridad legal, trazabilidad de pedidos reales o chat de dos teléfonos.

# 4. ESTRUCTURA TÉCNICA EXISTENTE — NO REHACER
## 4.1 Cliente Expo React Native
- Paquete `apps/movete-cliente`, `expo-router` y `src/ClientRuntime.tsx`, context por `createClientExperience()`.
- Binario independiente `com.movetefacil.cliente`; no se comparten pantallas/sesión Driver.
- Rutas confirmadas en `app/`: `index.tsx`, `viaje.tsx`, `envios.tsx`, `seguimiento.tsx`, `historial.tsx`, `comercios.tsx`, `cotizacion.tsx`, `pagos.tsx`, `soporte.tsx`, `cuenta.tsx`, `mensajes.tsx`, `conversaciones.tsx`, y `_layout.tsx`.
- `src/ClientUI.tsx` consolida controles/estados accesibles, tamaño táctil, semántica y feedback; `src/domain/client-experience.d.mts` declara snapshots y métodos.
- `ClientRuntimeProvider` por defecto NO configura Auth/API real: por seguridad permanece fail-closed mientras no exista infraestructura certificada.
- Comandos locales dentro de `apps/movete-cliente`: `npm install` (si necesario), `npm run check`, `npm run typecheck`, `npm test`, `npm start`; TypeScript/Expo web export ya verificados en GitHub Actions. **No afirmar APK/IPA.**

## 4.2 Admin Web React/TypeScript/Vite
- Paquete `apps/movete-admin`; `src/main.tsx`, `src/AdminRuntime.tsx`, `src/admin-experience.mjs` y `src/admin-experience.d.mts`.
- Módulos de autorización y sesión `admin-access.mjs`, `admin-session.mjs`.
- `admin-read-gateway.mjs`, `bounded-json-response.mjs` para HTTPS, JWT y lecturas con cuerpos limitados, manejo de Auth y tiempo de espera; **OFF por defecto**.
- `kyc-queue.mjs`, `kyc-page-view.mjs`, `review-draft.mjs`: proyección de expedientes y borradores de revisión, sin aprobar reales ni exponer documentos.
- `zone-overview.mjs`, `incidents-overview.mjs`, `incident-page-triage.mjs`, `incident-g41-flow.mjs`, `incident-g41-gateway.mjs`: zonas, incidentes, triaje seguro solo si A monta contrato Admin.
- `audit-feed.mjs`, `owner-finance.mjs`, `page-cursor.mjs`: auditoría, finanzas/Owner read-only, cursor y navegación sin cuota global.
- Comandos locales dentro `apps/movete-admin`: `npm install`, `npm run check`, `npm run build` (QA, NO deploy).
- El Admin no es un operador comercial real: no maneja credenciales service_role en navegador, no acciona emergencias, no modifica KYC ni monetización sin backend y permisos certificados.

# 5. INVENTARIO DE IMPLEMENTACIONES CLIENTE R1–R5 (YA CONSTRUIDO)
## 5.1 Seguridad, sesiones, operaciones e idempotencia
- `client-session.mjs`: identidad pasajero, estado efímero, borrado en logout/rotación JWT, prohibición de filtrar role Admin/Driver.
- `client-gateway.mjs`: transporte STAGING QA con Auth, contrato, respuestas, tiempo de espera y fallos cerrados.
- `client-request-preparation.mjs`, `client-mutations.mjs`, `secure-cancel-key.mjs`: preparar solicitudes sin enviarlas automáticamente, requestKey único, doble tap, reintentos tras timeout sin duplicar operación, rechazo de payload inválido.
- `bounded-http-response.mjs`, `response-bytes.mjs`: protección de JSON UTF-8/cuerpo parcial/sobre tamaño y aborts HTTP; evitar bombas de bytes y filtraciones.
- `capabilities.mjs`, `accessibility-policy.mjs`: capacidades autorizadas y controles de presentación segura.

## 5.2 Viajes y envíos
- `safe-auto-ui-harness.mjs`, `safe-delivery-ui-harness.mjs`, `delivery-form.mjs`: flujos QA de viaje AUTO y envío AUTO/MOTO, formulación segura, servicio elegido, sin despacho o cobro falso.
- `rider-status.mjs`, `rider-polling.mjs`, `ride-status-gateway.mjs`: consulta periódica server-authoritative con identidad pasajero, revisión monotónica, fallback sin GPS/ETA ante 401/403/red caída y purga al cambiar viaje/cuenta. UI no presume tracking real.
- `fare-quote-gateway.mjs`, `fare-quote-flow.mjs`, `quote-view.mjs`: lectura de cotización Gs/PYG con versión/revisión/TTL, precios no calculados arbitrariamente por Cliente.
- `ride-cancellation.mjs`: preparación/confirmación de cancelación por backend, idempotencia y expiración; no afirmar cancelado si no confirma servidor.
- `history-feed.mjs`, `client-history-gateway.mjs`, `history-auto-page.mjs`: historial por cursor con páginas ilimitadas del lado servidor, ventana limitada del dispositivo, scroll/navegación con protección de identidad y cursor.
- Pantallas de solicitud, seguimiento, historial, cotización, cuenta, pagos informativos y navegación bajo contrato (no LIVE).

## 5.3 Soporte, incidentes, seguridad
- `support-draft.mjs`, `support-draft-session.mjs`: borrador privado de soporte, entrada validada, limpieza por usuario/JWT y protección de privacidad.
- `client-incident-intent.mjs`, `incident-g40-gateway.mjs`, `incident-report-flow.mjs`: intención de reporte G40, recibos QA persistidos solo cuando backend sintético lo confirma, consulta de estado, TTL/revisión, idempotencia y 401/403; **NO SOS despachado**, ni operador avisado por la pantalla.
- UI `soporte.tsx` de información y formularios de incidentes solamente habilitados bajo gates.

## 5.4 Comercios, catálogo, carrito, pedido y G44–G45
- `commerce-draft.mjs`, `commerce-catalog-flow.mjs`, `commerce-catalog-pages.mjs`: carrito de memoria y catálogo por sucursal, productos, cantidad, precio referencial, stock **NO certificado**, paginación ilimitada y limpieza por cambio JWT/sucursal.
- `catalog-branch-lookup.mjs`, `g44-branch-directory.mjs`, `g44-buyer-contract.mjs`: directorio por municipio/tipo de envío y DTO Buyer estrictos, validación de asignaciones/branch/sujeto, filtros y cursor.
- `g44-buyer-http-gateway.mjs`: gateway de GET G44 con HTTPS pinned, bearer session-bound, tres gates `enabled/contractCertified/stagingRuntimeVerified`, cuerpo acotado y cancelación; no habilitarlo solo porque OpenAPI tenga una ruta.
- `catalog-staging-smoke.mjs`: tests de contrato con datos sintéticos, sin inventar URL API.
- `g45-order-qa-contract.mjs`: proyección de reserva/cancelación G45 QA idempotente con recibos sintéticos; **NO POST real de checkout ni PSP**.
- Pantalla `comercios.tsx`: sucursales y catálogo, carrito gated, sin cobrar, sin prometer stock real ni pedido confirmable.

# 6. INVENTARIO ADMIN R1–R5 (YA CONSTRUIDO)
- **Acceso:** roles Admin/MFA del lado frontend solo como gate; nunca confiar en esa señal para conceder acceso sin servidor.
- **KYC conductor:** listados/páginas, metadata, historial de revisión, borradores no definitivos, límites POR PÁGINA (p.ej. 50) y navegación por cursor; el almacenamiento documental real lo construye A.
- **Zonas:** lectura y estados geográficos, zona cubierta ≠ oferta garantizada; no activar ciudades automáticamente.
- **Incidentes:** colas paginadas, triaje y filtros G41; preferir filtro autoritativo **del servidor antes de paginar**; no presentar filtro local de página como triage global.
- **Auditoría:** feed sin alterar logs ni inventar acciones finales, prevención de leaks, revisión de cursores y offsets.
- **Finanzas Owner:** panel de proyección/read-only, sin fingir ingresos, liquidación, comisión ganada o pago PSP.
- **HTTP:** `incident-g41-gateway.mjs` y `admin-read-gateway.mjs` preinstalados, fallan cerrados; requieren staging, JWT de rol correcto, MFA AAL2, runtime verificado y endpoints.
- **Evidencias históricas de Admin:** `ADMIN_G41_GLOBAL_TRIAGE_ADAPTER`, `G29_KYC_EVIDENCE_G30_AUDIT_SCOPE_UI`, `G28_INCIDENTS_A05_121_PAGES_QA`, `ADMIN_BOUNDED_HTTP_STREAM`, `OWNER_DASHBOARD_FINANCE_RBAC` y demás docs en `docs/architect-b/`.
- **Pendiente:** integración administrativa real, listados seguros con JWT/RLS, visualización de documentos privados por URLs temporales, workflow de aceptación/rechazo con auditoría, geocercas verdaderas y operaciones comerciales tras autorización.

# 7. CHRONOLOGÍA B — R3→R5, CAMBIOS POST HISTÓRICO
- **R1/R2/R3 iniciales:** fundación Cliente y Admin, seguridad de sesiones, estados tracking, pantalla viaje/envíos, historial con cursor no acotado global, precios QA, Admin KYC, incidencias, finanzas, zonas, contratos STAGING no montados y seguridad HTTP. Ver 153 commits originales en anexo.
- **R3 hasta commit #153:** `515d9fdc8e4aa32f356cb96b768cd0feb6ee85bb`. Test histórico Cliente 313/Admin 180 en ese punto, superado por CI actual.
- **#154–#163:** reparación de condiciones de carrera Auth/catálogo, DTO Buyer estrictos, respuesta G40 malformada/sobredimensionada, abort de lecturas G41 y aislamiento de respuestas después de logout.
- **#164–#172 R4:** snapshot catálogo privado durante GET, navegación de sucursales G44 por municipio, selección de sucursal, protección de IDs; una CI atrapó validación UUID y fue corregida con commit `204081bc`.
- **#173–#177 R5:** gateway HTTPS G44 con JWT/timeout/body, pruebas de sesión, DTO de G45 reserva/cancelación solamente QA. Handoff `CONTINUIDAD_B_R5_G44_HTTP_G45_QA_2026-10-23.md`.
- **R6–R13:** chat Cliente ↔ Driver/delivery como dominio **preparado**, aún NO integrado con servidor A; detalle cronológico abajo y trazabilidad SHA en anexo.

# 8. MENSAJERÍA R6–R13 — ESTADO PRECISO, NO FINGIR OPERACIÓN
## 8.1 R6 — Motor de chat privado por servicio
- Commits `0eb69ca5`, `36cbb4e0`, `f4b49607`, `df31dd8f`, `6ad042c5`, `ed7bd630`, `3f237b5b`.
- `passenger-chat-flow.mjs` valida `RIDE/DELIVERY/MERCHANT_ORDER`, UUIDs, actor Passenger, rol counterpart Driver, asignación activa verificada, JWT privacy revision, conversación, TTL/revisión, páginas 100, texto 1–500, prohibición de teléfonos/correo/URL/bidi/control.
- POST solo mediante `sendMessage` inyectado, `requestKey` idempotente y ACK `serverStored:true`. Ante fallo ambiguo se conserva clave, no se envía otra nueva para el mismo intento.
- UI `app/mensajes.tsx` integrada en `ClientExperience`; el backend no existe, gates OFF por defecto.
- Fallo real detectado: invocación errónea de validador ACK `validMessage` corregida a `validateMessage`; keyboard dismiss/a11y corregido posteriormente.

## 8.2 R7 — Navegación e historial, privacidad TTL
- Commits `6eb3a3d`, `1a3390c`, `2f91cf9`, `1980f70`, `c568503`; `passenger-chat-navigation.mjs` liga historial propio activo con posible chat pero no le concede permiso servidor.
- Se añadió caché de mensajes LOCAL configurable (predeterminado 500, permitido 100–5000) manteniendo historial completo paginable EN SERVIDOR. No hay cuota global.
- Ante expiración de TTL, reintento pendiente primero revalida lectura/assignment en backend y conserva el mismo `requestKey`.

## 8.3 R8 — Revocación y hints sin texto privado
- `71fbe41b`: el chat cancela operaciones y purga estado cuando se revocan gates durante awaits.
- `7ad0f5ff`, `b5339855`: React remonta editor al cambiar servicio o privacy JWT; reparación de tipos nullable.
- `f63fe17b`, `f089b398`: `passenger-chat-push-hint.mjs`, solo aviso genérico sin cuerpo, nombre, teléfono o identidad remitente; antirreplay por revisión de servicio, TTL corto, purga por sesión; expone hints en Inicio bajo certificación. **NO push SO real**.
- Entrega R8 `caf191785c11`.

## 8.4 R9 — ACK durable, idempotencia, simulación dos actores
- `595a9a9b`: rechaza `messageId` reutilizado con body/role/createdAt/revision distintos, protege idempotencia legítima idéntica.
- `75524a62`: si ACK llega con permiso expirado, no marca entregado; retiene clave para revalidación y reintento, no duplica mensaje.
- `8cbf3b2f`: `passenger-chat-interop.test.mjs` QA en memoria con Passenger/Driver sintéticos, identidad cruzada, reasignación, caída después del commit, 640 mensajes sin límite global, privacidad.
- `356c8b7d`: handoff R9. No se ha creado chat backend con esos tests.

## 8.5 R10 — Bandeja de conversaciones Cliente
- `829304ba`: `passenger-chat-inbox.mjs`, DTO privado estricto, solo servicios ACTIVE, rol Passenger y assignment verified, TTL, cursor, ventanas RAM, anti-replay y 100 por página (NO global).
- `459637a2`: estado `chatInbox`, tipado `client-experience.d.mts`, UI Expo `app/conversaciones.tsx`, enlace desde inicio y apertura de servicio hacia `/mensajes`; limpieza en logout/JWT rotado.
- `04cc9542`: handoff R10. Por defecto OFF si A no suministra backend certificado.

## 8.6 R11 — Escala y consistencia del cursor
- `530e724f`: contador `unreadCount` admite cantidad alta hasta safe integer; etiqueta visual «99+» no es límite de mensajes.
- `2b816324`: rechaza página vacía con cursor que cause bucle y dos hilos ACTIVE contradictorios para un servicio.
- `6f33ef48`: valida orden estable `updatedAt DESC, conversationId DESC`, incluso después de liberar filas de la ventana; si reaparecen claves antiguas, purga. A debe respetar orden si adopta este DTO.
- `e3326ff7`: handoff R11.

## 8.7 R12 — Desconexiones y rollback de revisión
- `65c5955d`: caída de red conserva temporalmente la lista YA validada dentro del TTL, marca `stale`, UI **bloquea abrir chats y continuar paginando** hasta refrescar. 401/403, JWT distinto y TTL caducado limpian todo.
- `f1c9e936`: rechaza retroceso de revisión autoritativa; recuperación posterior reemplaza páginas sin mezclar sesiones. QA sintética R12.
- La bandeja NO ofrece conversaciones reales sin endpoint A.

## 8.8 R13 — Pin exacto a conversación, UI y revocación
- `00344220`: enlace desde inbox transporta `conversationId` exacto; `open({expectedConversationId})` exige que el servidor devuelva precisamente el mismo hilo. Rechaza reasignación/different thread, URL manipulada, bloqueo de send sin autorización, e invalida borrador al cambiar conversación del mismo envío.
- `407f093d`: limpiar hints al revocarse certificación; no reviven tras reactivar; UX avisa actualizar bandeja si el hilo cambió.
- `2b3ad882`: R13 documentado, CI 3/3 SUCCESS, Cliente 460/460, Admin 185/185.
- **Límite no negociable:** NINGUNO de R6–R13 prueba transferencia real Cliente ↔ Driver, almacenamiento PostgreSQL de mensajes, notificaciones Android/iOS, RLS, cifrado E2E ni producto listo. Solo protocolo/QA local preparado.

# 9. ERRORES RESUELTOS, PRUEBAS DE REGRESIÓN Y RIESGOS NO RESUELTOS
## 9.1 Errores cerrados mediante código y CI
1. Mezcla de cuentas o respuestas después de logout/JWT rotado → epochs/generation/cancel y no aplicar GET viejo.
2. Solicitudes duplicadas ante doble toque o timeout → requestKey idempotente y retry mismo body.
3. GPS/ETA/placa falsos ante fallo de red → limpiar vista, no decir LIVE.
4. Paginación que topaba a 50/100 totales → cursor múltiples páginas y ventana local, sin techo global.
5. Catálogo de sucursal vieja o DTO con PII/campos extra → validación estricta y aislamiento de branch.
6. Admin G41 retorno stale al logout → abort y cierre de permisos.
7. R6 ACK helper mal nombrado → fix `f4b49607` y regresión.
8. R4 UUID sucursal defectuoso → fix `204081bc`, CI revisada.
9. Formulario chat conserva draft entre servicios → React key privacidad y segundo pin exacto hilo.
10. Chat ACK reusa `messageId` con datos divergentes → error de colisión, purga.
11. ACK tardío con permiso expirado → no marcar entrega, reconciliar misma clave.
12. Avisos push con texto privado, destinatario ajeno o replay → proyección genérica validada y purga.
13. Límite falso `unreadCount<=99` → sin límite de datos, solo insignia 99+.
14. Cursor vacío/repetido, hilo doble, orden invertido o revisión rollback → reject+clear.
15. Redes intermitentes en inbox → conservar lista stale solo TTL/actor válidos, sin conceder chat.
16. Reasignación de Driver y mismo servicio → exigir `expectedConversationId` exacto o rechazar.

## 9.2 Riesgos críticos abiertos; nunca ocultarlos
1. **BACKEND CHAT NO EXISTE:** A OpenAPI G48 57 rutas, cero chat. Sin conversaciones reales ni Driver receptor.
2. **JWT/RLS en red real NO certificados:** las gates locales no impiden fraude si backend no impone permisos.
3. **Admin conectado a servicios reales NO certificado:** UI/mocks no habilitan KYC, auditoría o triaje real.
4. **Comercios y checkout no operativos:** G44/G45 QA no equivalen a orden final, stock confirmado o recibo comercial.
5. **GPS/ETA/dispatch reales NO certificados** y cobertura por zona no equivale a conductor disponible.
6. **Pagos/PSP/ledger/comisiones en LIVE** no autorizados ni auditados end-to-end.
7. **KYC personal y evidencias** requieren almacenamiento privado, accesos efímeros, cifrado, auditoría y retención legal a cargo de A.
8. **E2E en móviles Android e iOS reales** y pruebas de accesibilidad TalkBack/VoiceOver aún pendientes; Expo WEB export no sustituye instalación.
9. **Seguridad de chat** requiere bloqueo/reportes de abuso, límites por usuario, retención GDPR/legislación PY aplicable, prohibir entrada en movimiento, y política de notificación segura.
10. **Ambiente STAGING HTTPS montado** y e2e contra PostgreSQL con usuario real sintético NO comprobados por estos workflows.
11. **Backend puede seguir cambiando independientemente:** revalidar A HEAD/OpenAPI antes de escribir adapters, nunca copiar respuestas supuestas.
12. **Performance real / concurrencia / escalado / DR/backup** no certificados; no prometer capacidad infinita solo porque pagina.
13. **Coordinación contratos:** R13 `expectedConversationId` es frontend QA; A debe acordar DTO y criterio jurídico de asignación/reasignación.
14. **Alerta potencial en ajustes futuros:** `snapshot` de UI no sustituye una verificación server-side de permisos justo al abrir/escribir; ninguna navegación concede derecho de acceso.

# 10. PENDIENTES DE ARQUITECTO B — ORDEN EJECUTABLE SIN ESPERAR A A
### B-P0. Próximos cambios independientes — empezar aquí
- [ ] **B-P0-01:** comprobar PR8 HEAD y CI 3/3 del commit de este handoff. Corregir si algún workflow falla; no declarar SUCCESS antes de ver conclusión real.
- [ ] **B-P0-02:** revisar flujo completo `conversaciones` → `mensajes` con JWT rotado y `conversationId` del mismo servicio: dar pruebas adversariales con GET fuera de orden, retardo, directorio stale y cambio de Driver.
- [ ] **B-P0-03:** mejorar UX de error y recuperación offline del chat real: borrador no enviado, petición ambigua, clave idempotente y asistencia visible; impedir enviar nuevo mensaje mientras espera ACK. No persistir secretos ni PII.
- [ ] **B-P0-04:** auditar `passenger-chat-inbox.mjs` y `passenger-chat-flow.mjs` por límites de memoria, cursores crecientes, ciclos, revision mismatch, expiration y arrays malformados; cobertura fuzz sintética.
- [ ] **B-P0-05:** reforzar acceso desde `historial` y `seguimiento`: solo servicio propio ACTIVE, `assignmentVerified` emitido por servidor, sin inferir Driver por GPS.
- [ ] **B-P0-06:** asegurar que vista de bandeja stale/reauth no entregue accesibilidad engañosa. VoiceOver/TalkBack y estados `busy/disabled`, cuando haya entorno de prueba.
- [ ] **B-P0-07:** protección estricta de privacidad de hints ante `sessionRevision`, cambios de cuenta y revocación temporal. Nuevos datos solo tras evento nuevo verificado.
- [ ] **B-P0-08:** ejecutar suites QA exhaustivas en proyectos Cliente y Admin; no modificar scripts/CI global A; añadir pruebas de contrato cuando sea necesario en rutas B.

### B-P1. UX funcional y calidad mientras se espera A
- [ ] **B-P1-01:** mejorar formularios AUTO y DELIVERY con errores precisos, validación de accesibilidad y reintentos sin crear solicitud duplicada.
- [ ] **B-P1-02:** pulir estado de cotización/seguimiento con respuesta envejecida, valor de TTL y error recuperable, nunca presentar precio/GPS falso.
- [ ] **B-P1-03:** historia infinita con ventana móvil, pull-to-refresh, cursor inválido, owner switch, scroll estable y no bloqueo por volumen total de registros.
- [ ] **B-P1-04:** comercio: paginación sucursales+catálogo+carrito sin stock ni precio final ficticios, cambios de sucursal y cuenta, expiración, checkouts siempre OFF sin G45 real.
- [ ] **B-P1-05:** soporte/incidentes G40: QA de confirmaciones idempotentes, error 401/403, atraso, accesibilidad y no representar envío de ayuda real.
- [ ] **B-P1-06:** Admin Web: UX de colas KYC con paginación sin límite global, filtro por servidor y ninguna visualización de documento personal sin autorización.
- [ ] **B-P1-07:** Admin G41: diferencia entre triaje global por servidor vs filtro local de página, abort al logout, mutex, cursors tied to filter, errores.
- [ ] **B-P1-08:** Admin auditoría: no perder actor/contexto en cambio de JWT/MFA, filtro/página y descargas de datos privados.
- [ ] **B-P1-09:** Owner finance: métricas con fuente backend, períodos/moneda PYG, nunca inferir saldo, ingreso o comisión desde mocks.
- [ ] **B-P1-10:** documentar matriz de pantallas/estados de red/permiso, Copy de UX natural español paraguayo y navegabilidad sin tocar Driver.
- [ ] **B-P1-11:** pruebas de seguridad negativa para malformaciones de API, payloads de cientos/miles de registros, bytes/UTF-8, contenido inyectado y cursor replay.
- [ ] **B-P1-12:** revisar que la UI no muestre etiqueta demo engañosa ni prometa operación real no soportada; conservar fail-closed con mensajes claros.

### B-P2. Después de que A certifique los contratos
- [ ] **B-P2-01:** autenticar Cliente contra endpoint real de A, segregación roles/JWT y recuperación/revocación de sesión con usuario sintético.
- [ ] **B-P2-02:** conectar tarifas, solicitud AUTO/envío, estado/ETA/GPS mediante HTTPS STAGING y pruebas cross-user.
- [ ] **B-P2-03:** conectar historial y cancelación reales con consistencia de cursor, mutación idempotente y prueba DB.
- [ ] **B-P2-04:** conectar comercio G44/G45 según contrato backend autorizado; no activar pagos sin PSP aprobado.
- [ ] **B-P2-05:** conectar chat inbox GET, messages GET/POST, refresh de permiso, key idempotente y pruebas reales Cliente/Driver; NO activar por mero OpenAPI.
- [ ] **B-P2-06:** activar notificaciones nativas genéricas solo después de que A certifique push/privacidad y aprobación Owner para pruebas.
- [ ] **B-P2-07:** integrar Admin MFA/RLS y datos de KYC/zonas/incidentes/finanzas; no poner service_role en navegador.
- [ ] **B-P2-08:** E2E multiusuario sintético (2 pasajeros, 2 conductores, 1 Admin) con revocación, carrera y notificaciones.
- [ ] **B-P2-09:** certificación nativa Android/iOS y accesibilidad física, push, redes 2G/4G/offline/latencia, permisos GPS y biometría según mandato.
- [ ] **B-P2-10:** UI definitiva con Lovable bajo contratos cerrados; QA visual y seguridad; Owner autoriza cualquier publicación/merge/tiendas por separado.

# 11. BLOQUEOS Y ENTREGABLES DEL ARQUITECTO A — SOLICITAR POR ISSUE #9
| Prioridad | Debe construir y certificar A | Criterio de desbloqueo para B |
|---|---|---|
| A-P0 Auth | JWT Passenger/Driver/Admin, sesión/revocación, Admin MFA AAL2, scopes y roles servidor | STAGING HTTPS accesible con datos sintéticos, 401/403 y protección RLS verificadas |
| A-P0 Chat | Postgres conversations/messages, assignment activa por cada RIDE/DELIVERY/MERCHANT_ORDER, cursor HMAC, idempotencia durable, rate-limit y retención | GET inbox + GET mensajes + POST idempotente con ACK serverStored, revisión/TTL, OpenAPI versionado |
| A-P0 Driver chat | Inbox mensajes y respuesta en `apps/movete-driver`, prohibición de Driver anterior tras reassign | E2E dos binarios y actores sintéticos, no solo oferta driver/inbox |
| A-P0 KYC | Almacenamiento central privado, expiración, documentos legales vehículo/conductor, permisos reviewer | Metadatos y acceso temporal autorizados, workflow de revisión persistido con auditoría |
| A-P0 Tarifas | Precios PYG AUTO/MOTO entrega + cobertura por zonas/vehículos, comisiones, expiración y concurrencia | Cotización autoritativa y negativo si zona sin disponibilidad |
| A-P0 dispatch/GPS | Asignación exclusiva, concurrencia, posición GPS consentida y caducidad, transición estados, cancelación | Dos choferes compiten, una sola asignación, revocación consistente |
| A-P1 Commerce | Catálogos comerciantes, stock/eligibilidad, reservas G45 y recibos con DB y controles | DTO Buyer G44/G45 montado y pruebas cruzadas con vendedor |
| A-P1 Admin | JWT/MFA RLS, queue KYC, evidencias, G41 triaje global, zonas, auditoría | Endpoint real con filtros server-side, cursor firmado, prueba Admin equivocado |
| A-P1 Seguridad | Push genérico, SOS/incident routing a operador, moderación y antiabuso | Runtime real, consentimiento, políticas de log, pruebas negativas |
| A-P2 PSP y operaciones | Ledger, conciliación, tributación, reembolsos, seguridad PSP | Evaluación legal, financiera, Owner autoriza; no desbloquear por tests unitarios |
| A-P2 Infra | STAGING real, monitoreo, backup, secretos, CI, empaquetado, escalabilidad | Gate de release con seguridad, load testing y reporte E2E; LIVE solo por Owner |

**Contrato Chat pendiente propuesto B (NO API publicada):**
- `readInbox({cursor,subject,sessionRevision})`: backend autentica actor real desde JWT y solo devuelve `ownerId,generatedAt,expiresAt,revision,items,nextCursor,productionEnabled:false`, con filas `conversationId,serviceId,serviceKind,state,assignmentVerified,counterpartRole,revision,unreadCount,updatedAt,canSend`. Sin teléfonos, nombres ni body preview. Orden `updatedAt DESC, conversationId DESC` si A adopta propuesta.
- `readMessages({serviceId,serviceKind,cursor,subject,sessionRevision})`: conversación inmutable por servicio/asignación, actor autorizado, páginas de hasta 100, revision monotónica, expiración, `messages[{messageId,senderRole,body,createdAt,revision}]`, ningún Dto extra PII.
- `sendMessage({conversationId,serviceId,serviceKind,body,requestKey,subject,sessionRevision})`: servidor ignora subject autoafirmado si no corresponde al JWT, verifica assignment en cada request, guarda idempotente `(conversationId,actorId,requestKey)` y devuelve ACK duradero con `serverStored:true`.
- **Reasignación** de Driver debe invalidar conversación vieja y su acceso, NO reutilizar el `conversationId` para nuevo conductor. Validar también entrega MOTO y órdenes MERCHANT_ORDER.
- HTTP status, cursor firmado, expiración, revocación, actor mismatch, JWT rotado, notificación, reten­ción, reportes de abuso deben documentarse en OpenAPI A. Si contrato cambia, adaptar B tras evidencia y pruebas; no inventar integración.
- Pruebas de aceptación de B ya útiles: `passenger-chat-interop.test.mjs`, `passenger-chat-flow.test.mjs`, `passenger-chat-inbox.test.mjs`, `passenger-chat-push-hint.test.mjs`, además de `client-experience.test.mjs`.

# 12. CERTIFICACIÓN COMPLETA ANTES DE USUARIOS REALES
1. **QA local de B:** Node tests 460/460 Cliente y 185/185 Admin, TypeScript, web exports y separación; LOGRADO a este corte.
2. **Contratos backend reales:** STAGING Node/PostgreSQL, autenticación JWT/RLS, APIs Chat/Buyer/Admin realmente montadas con hosts HTTPS, E2E; NO logrado por B.
3. **Dos binarios nativos:** build Android/iOS separados, instalación física/emulador, sesión, permisos GPS, push y privacidad; PENDIENTE.
4. **Negocio/regulador:** licencia, seguros de autos/motos, KYC legal, tratamiento de datos PY, políticas de emergencias, PSP y tributación; PENDIENTE autorización/evidencia.
5. **Concurrencia/escala:** usuarios y registros sin cuotas globales arbitrarias, migración PG, índices, cursor robusto, carga pico, rate limits y backup; PENDIENTE prueba real.
6. **Seguridad:** pentest, OWASP Mobile/API, gestión secretos, revisión SAST/SCA, device theft, MFA, RLS, auditoría y retención; PENDIENTE.
7. **Go/no-go Owner:** solo después de evidencias, autorizaciones y plan de rollback. Los PR siguen DRAFT hasta mandato.

# 13. CÓMO DEBE TRABAJAR EL SUCESOR (PROTOCOLO OPERATIVO REPRODUCIBLE)
1. Abrir PR #8, PR #7, issue #9 y **este handoff**. Leer el índice de 213 commits; NO rehacer archivos existentes ni inventar estado con memoria antigua.
2. Leer `head.sha`, `head.ref`, `base.ref`, `draft` desde GitHub, y comparar contra los últimos SHA documentados. Si A avanzó, inspeccionar solo contrato/impacto. No traer sus archivos a rama B manualmente.
3. Seleccionar una tarea B-P0 no bloqueada. Identificar módulos/contratos/test existentes antes de editar; no duplicar una función ya existente.
4. Crear un cambio pequeño y coherente en `apps/movete-cliente/**` o `apps/movete-admin/**`, con pruebas negativas y privacidad. Añadir tipos .d.mts/TSX cuando aplique.
5. Commit solo sobre **current B HEAD**, con commit parent_sha correcto y actualización no forzada con expected_sha; si falla por carrera, refrescar y recomponer cambios.
6. Abrir Actions de ese SHA, no de otro anterior. Comprobar tres workflows obligatorios: `Movete Facil Architect B ownership boundary`, `Movete Facil Admin web QA`, `Movete Facil two app isolation`; y jobs de ambas apps Expo.
7. Si falla CI, leer el job/log real y reparar. Registrar el error detectado y su corrección; no esconderlo.
8. Si passes, conservar link permanente de commit+workflow, actualizar docs B y/o PR #8 con los resultados. Solo decir 3/3 SUCCESS al comprobar status completed/conclusion success.
9. Si falta Auth/endpoint, escribir contrato, request/response, actor, JWT, permisos, TTL, página, errores y negative tests **en issue #9**; A lo implementa. Continuar inmediatamente con otro módulo B.
10. No declarar LIVE ni usar dinero/PII. No llamar Worker/Traders ni mover proyecto a qore-core. Mantener ambas apps independientes.
11. Antes de cambiar chat, verificar que no quede mensaje pendiente idempotente; si la respuesta de servidor es ambigua no generar nueva key para el mismo intento.
12. Cada nuevo handoff debe ser incremental, con SHA actual, archivos, prueba exacta, riesgos, pendientes y siguiente comando; este documento es la fuente de continuidad y no debe sobrescribirse sin respaldo.

### Ejecución local (si tiene checkout con dependencias)
```bash
cd apps/movete-cliente
npm install
npm run check
# Expo preview local no es LIVE ni distribución:
npm start
```
```bash
cd apps/movete-admin
npm install
npm run check
npm run build
```
- No modificar lockfiles de raíz/proyecto A. Si no hay terminal local, revisar GitHub Actions y usar commits/QA remotos de la rama B; no afirmar comandos locales ejecutados si no lo fueron.
- Ejemplo de verificación API Github: `GET /repos/mezas3238-hue/Qore-mobile-/pulls/8` para `head.sha`; `GET /repos/.../actions/runs?head_sha=<SHA>`; jobs/logs por run.
- Continuidad: **un verdadero bloqueo** es Auth/RLS/control legal/endpoint inexistente que impide integración; no lo son UI, type safety, fuzz, accesibilidad, test harness ni documentación B. No detenerse por los segundos/minutos que consume CI: cambiar a una tarea B independiente hasta tener resultado.

# 14. GUION PARA COPIAR EN EL NUEVO CHAT
> Sos el siguiente **Arquitecto B de QORE Mobile / Movete Fácil**. Continuá el desarrollo SIN DETENERTE salvo bloqueo real. Fuente soberana GitHub `mezas3238-hue/Qore-mobile-`, PR B #8 DRAFT, rama `feature/mobility-cliente-admin-parallel-20261022`, base PR A #7. **Primero obtené SHA HEAD actuales**, consultá este `HANDOFF_MAESTRO_ARQUITECTO_B_R1_R13_TOTAL_Y_CONTINUIDAD_2026-10-23.md`, el anexo auditable 213 commits/214 archivos, R3 y R13, issue #9 y CI. Tu edición EXCLUSIVA: `apps/movete-cliente/**`, `apps/movete-admin/**`, `docs/architect-b/**`; NO Driver, backend, SQL, OpenAPI, root ni CI A. Cliente y Driver son dos apps móviles separadas, Admin una web. Último corte pre-handoff: B `2b3ad882592300500c4bb88b81fe35ee6bf29fe9`, Cliente **460/460**, Admin **185/185**, 3/3 workflows SUCCESS; A `201a687a`, OpenAPI G48 57 rutas, **sin chat**. Implementá siguiente B-P0 útil, agregá tests, commit no forzado y verificá CI, corregí hasta verde y seguí. Si falta backend, especificá dependencia en issue #9 y pasá a otro trabajo B. No inventes que chat/GPS/PSP/servicios están LIVE: todo está en QA con gates OFF. **NO MERGE / NO LIVE / NO DEPLOY / NO pagos reales / NO PII real** sin Owner. Debés entregar enlaces de GitHub verificables y avanzar de manera continua.

# 15. DOCUMENTOS DE REFERENCIA Y MAPA DE LECTURA
- `docs/handoff/DIVISION_TRABAJO_DOS_ARQUITECTOS_MOVETE_FACIL_2026-10-22.md` — norma de propiedad A/B (A escribe este archivo, B no).
- `docs/architect-b/HANDOFF_MAESTRO_INTEGRAL_ARQUITECTO_B_CLIENTE_ADMIN_CONTINUIDAD_2026-10-23.md` — histórico de 545 líneas Cliente/Admin.
- `docs/architect-b/HANDOFF_MAESTRO_B_CIERRE_Y_CONTINUIDAD_2026-10-23.md` — transición inicial.
- `docs/architect-b/HANDOFF_MAESTRO_B_R2_CLIENTE_ADMIN_CONTINUIDAD_2026-10-23.md` — R2.
- `docs/architect-b/HANDOFF_MAESTRO_B_R3_CLIENTE_ADMIN_TOTAL_2026-10-23.md` — R3 y QA 313/180 histórica.
- `docs/architect-b/HANDOFF_R3_ANEXO_153_COMMITS_2026-10-23.md` — primer inventario 153 commits.
- `docs/architect-b/CONTINUIDAD_B_R4_G44_BUYER_BRANCHES_2026-10-23.md` — directorio.
- `docs/architect-b/CONTINUIDAD_B_R5_G44_HTTP_G45_QA_2026-10-23.md` — HTTP catálogo y G45.
- `docs/architect-b/CHAT_CLIENTE_DRIVER_DELIVERY_R6_2026-10-23.md` — mensajería inicial.
- `docs/architect-b/CHAT_CLIENTE_DRIVER_R7_SEGURIDAD_RECONEXION_2026-10-23.md` — seguridad mensajes.
- `docs/architect-b/CONTINUIDAD_B_R8_CHAT_PUSH_REVOCACION_2026-10-23.md` — hints y revocación.
- `docs/architect-b/CONTINUIDAD_B_R9_CHAT_ACK_INTEROP_2026-10-23.md` — ACK + prueba sintética.
- `docs/architect-b/CONTINUIDAD_B_R10_BANDEJA_CHAT_2026-10-23.md` — inbox Cliente.
- `docs/architect-b/CONTINUIDAD_B_R11_CHAT_INBOX_COUNTS_ORDER_2026-10-23.md` — contador/cursor estable.
- `docs/architect-b/CONTINUIDAD_B_R13_CHAT_CONVERSATION_PIN_2026-10-23.md` — R13 y R12 histórico sin doc propio.
- **NUEVO:** `docs/architect-b/ANEXO_AUDITORIA_B_213_COMMITS_214_ARCHIVOS_2026-10-23.md` — auditoría integral de todos los trabajos B al corte.
- R12 está certificado en los commits `65c5955d` y `f1c9e936` y comentarios PR #8; no inventar un handoff R12 separado.
- [PR #8](https://github.com/mezas3238-hue/Qore-mobile-/pull/8) — implementación B / CI; [PR #7](https://github.com/mezas3238-hue/Qore-mobile-/pull/7) — backend/Driver A; [issue #9](https://github.com/mezas3238-hue/Qore-mobile-/issues/9) — coordinación.

---

**VEREDICTO DE TRANSFERENCIA:** el Arquitecto B completó una base extensa de Cliente Expo y Admin Web con **645 tests unitarios de QA en verde**, 213 commits y 214 rutas cambiadas al corte; R6–R13 añadieron mensajería privada y bandeja endurecidas en pruebas. **NO están terminadas las dos apps para operar en calle**, falta integración segura con el backend A y nativos/release, según la matriz. El siguiente arquitecto debe tomar el **HEAD real** y continuar implementando B-P0/B-P1 sin pausas salvo bloqueo técnico real. **FIN HANDOFF MAESTRO DEL ARQUITECTO B.**

# QORE MOBILE / MOVETE FÁCIL — HANDOFF MAESTRO INTEGRAL G0–G26.4
## Continuidad de Arquitecto A · coordinación con Arquitecto B · fecha de corte: 23/10/2026

**Naturaleza:** ACTA DE TRANSFERENCIA, inventario de lo construido, evidencia de lo ensayado, errores, restricciones y plan inmediato. **No** autoriza merge, despliegue o operación comercial. GitHub —no recuerdos del chat— constituye la fuente soberana.

### Resumen ejecutivo de la transferencia

- **Producto:** Movete Fácil para Paraguay, autos de pasajeros, reparto/carga en moto, envíos particulares y entregas comerciales; expansión por zonas. Sistema competitivo frente a Bolt/Uber sin afirmar precios no verificados.
- **A = Backend compartido y Driver.** Rama `feature/mobility-monorepo-isolated-20261016`, [PR #7](https://github.com/mezas3238-hue/Qore-mobile-/pull/7), **ABIERTO DRAFT**. Último HEAD comprobado antes de escribir este acta: `95986b58db110e4fbfd7d364c83ab61935f83c00`. **4/4 CI SUCCESS en ese HEAD**.
- **B = Cliente móvil y Admin web.** Rama `feature/mobility-cliente-admin-parallel-20261022`, [PR #8](https://github.com/mezas3238-hue/Qore-mobile-/pull/8), **ABIERTO DRAFT**, base rama A. Último HEAD comprobado: `692ffc888cf5279f23fd773f5312a07d0d91a3de`. CI de Admin, boundary y aislamiento SUCCESS. Verificar cambios posteriores, B trabaja en paralelo.
- **Repositorio ÚNICO:** https://github.com/mezas3238-hue/Qore-mobile- (respetar el guion final). No trabajar en `qore-core` ni confundir `main` con las ramas de construcción.
- **Punto de coordinación A↔B:** [issue #9](https://github.com/mezas3238-hue/Qore-mobile-/issues/9), abierto.
- **Situación del producto:** infraestructura considerable en QA (G0–G26.4) y dos apps móviles separadas, **PERO no hay STAGING HTTPS/JWT/Storage/GPS/PSP reales integrados y certificados ni E2E físico**. CI verde ≠ app terminada ni servicio comercial.
- **Orden del Owner:** el arquitecto sucesor debe **ejecutar sin detenerse a cada rato**. Leer, implementar, probar, corregir, hacer commit, documentar y continuar a la siguiente tarea independiente. Interrumpir solo ante **bloqueo real** (permiso/acceso, peligro de seguridad/legalidad, cambios LIVE, conflicto de propiedad que impida avanzar, dato crítico imposible de obtener).

---

# 1. Mandato soberano, servicios y prohibiciones

## 1.1 Producto aprobado

1. `Movete Fácil Driver`: **primera app móvil independiente**, para conductores/repartidores; onboarding, vehículos, expediente documental privado, disponibilidad GPS consentida, ofertas privadas, decisiones idempotentes, viaje/custodia, ganancias y soporte.
2. `Movete Fácil Cliente`: **segunda app móvil independiente**, para pasajeros y solicitantes de envíos/compras; viajes en AUTO, envíos personales, comercios, seguimiento, historial ilimitado, tarifas y soporte.
3. `Movete Fácil Admin`: **panel WEB independiente**, no es una tercera app móvil. Consola para operadores Admin (KYC, zonas, incidentes y auditoría); vista financiera de Owner con permiso distinto, sin atribuir automáticamente KYC al Owner.
4. **Backend compartido**: identidad/JWT/RBAC/RLS, PostgreSQL, documentos, despacho/aceptación exclusiva, cotización Gs de servidor, seguridad, auditoría, zonas, envíos, comercio, pagos SIMULADOS en QA.
5. **Motos:** carga autorizable por tipo de servicio y requisitos; **pasajeros en MOTO permanecen BLOQUEADOS** hasta aprobación legal/seguro/municipio por servicio. Farmacias: **OTC** y solo categorías legalmente admitidas.
6. **Economía:** tarifas AUTO y MOTO distintas; precios, comisiones y ganancia del conductor se calculan/verifican en el servidor. Ninguna hipótesis de porcentaje ni cotización sintética es tarifa comercial aprobada.
7. **Cobertura por zona NO es disponibilidad real**: distinguir zona activada, conductores elegibles, conductores conectados, ETA y seguridad.
8. Lovable, cuando proceda y haya autorización: **interfaz visual solamente**. No reemplaza backend, Auth, RLS, KYC, motor tarifario ni control legal.

## 1.2 Restricciones ABSOLUTAS

**NO MERGE, NO LIVE, NO deploy público, NO producción, NO VPS, NO PSP/pagos reales, NO envío de push real, NO SQL remoto, NO identidades/documentos reales y NO lanzamiento en tiendas** sin autorización expresa del Owner. Mantener PR #7 y #8 DRAFT, flags LIVE falsos, fixtures sintéticos y secretos fuera del código. Evitar cambios en servicios reales aunque los scripts lleven nombres `staging`. 

El G1 histórico contiene documentación de un lockdown remoto previo aplicado el 16/10; **no reinterpretarlo como autorización para ejecutar las nuevas migraciones G26 ni para operar ese proyecto**. El modelo G0–G26 que aquí se continúa está probado principalmente en PostgreSQL desechable y Node HTTP `127.0.0.1`.

---

# 2. Propiedad exacta de las carpetas: DOS arquitectos sin pisarse

| Propietario | Edita exclusivamente | NO edita |
|---|---|---|
| **Arquitecto A (este handoff)** | `apps/movete-driver/**`; `apps/mobility-expo/**`; eventual `backend/**`/`database/**`/`packages/**`; `.github/**`; `scripts/**`; raíz; `docs/architecture/**`; `docs/handoff/**`; API/SQL/OpenAPI/CI transversal | `apps/movete-cliente/**`, `apps/movete-admin/**`, `docs/architect-b/**` |
| **Arquitecto B (paralelo)** | `apps/movete-cliente/**`; `apps/movete-admin/**`; `docs/architect-b/**` | Backend, Driver, SQL, OpenAPI central, CI, raíz y carpetas A |

- PR #8 tiene como **base la rama A**, no `main`; puede divergir. Verificar SHAs y las diferencias reales antes de cualquier propuesta de integración. **NO realizar rebase, merge, cherry-pick ni sobrescritura cruzada** por iniciativa propia.
- El workflow `.github/workflows/movete-architect-b-boundary.yml` verifica que B no altere rutas de A. Arquitecto A puede LEER la rama B y comunicar cambios mediante issue #9; no editarla.
- Los contratos compartidos son responsabilidad única de A; B adapta sus gateways/pantallas, no modifica seguridad del servidor.
- Todo cambio debe incluir commit, SHA completo, pruebas/run ID, carpeta afectada, problema/resolución y siguiente tarea.

---

# 3. Estado exacto verificado en GitHub antes de publicar este handoff

## 3.1 Arquitecto A

- Rama: `feature/mobility-monorepo-isolated-20261016`.
- HEAD anterior a esta documentación: `95986b58db110e4fbfd7d364c83ab61935f83c00`, PR #7 DRAFT, no fusionado.
- **CUATRO workflows del mismo SHA terminaron SUCCESS:**

| Workflow | Ejecución verificada | Resultado |
|---|---|---|
| PostgreSQL disposable G4/G26 | [#205](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39932880642) | SUCCESS |
| STAGING Node contracts | [#393](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39932880669) | SUCCESS |
| Expo isolated CI | [#943](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39932880656) | SUCCESS |
| Dos aplicaciones / aislamiento | [#303](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39932880681) | SUCCESS |

**OJO:** publicar este documento crea un nuevo commit HEAD. Los éxitos arriba corresponden al SHA `95986b58...`. Consultar CI por el **nuevo HEAD** y NO copiar estados previos como si fueran de él.

## 3.2 Arquitecto B

- Rama: `feature/mobility-cliente-admin-parallel-20261022`.
- HEAD comprobado: `692ffc888cf5279f23fd773f5312a07d0d91a3de`, PR #8 DRAFT, no fusionado.
- Workflows asociados a ese HEAD: Admin Web QA run [#39932418929](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39932418929) SUCCESS; Admin Web QA [#39932341588](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39932341588) SUCCESS; ownership boundary [#39932341605](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39932341605) SUCCESS; dos apps/aislamiento [#39932341596](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39932341596) SUCCESS.
- CI Admin dedicado **YA EXISTE** en `.github/workflows/movete-admin-web-qa.yml`. ¡No repetir A02 antigua! Al inicio falló por dependencias React y validadores; B los corrigió, y las ejecuciones posteriores de check/TypeScript/Vite fueron verdes.
- Como B continúa autónomamente, leer su SHA/CI más reciente al iniciar. No inferir cantidad de tests de una ejecución antigua: las baterías B han crecido (Cliente 131; Admin 109 en runs de octubre), pero comprobar las del HEAD actual.

---

# 4. Arquitectura de carpetas y significado de los módulos

```text
Qore-mobile-/
├── apps/
│   ├── movete-driver/          # EXPO DRIVER, solo A, instalable final previsto
│   ├── movete-cliente/         # EXPO CLIENTE, solo B, instalable final previsto
│   ├── movete-admin/           # REACT / VITE WEB ADMIN, solo B
│   └── mobility-expo/         # LABORATORIO HISTÓRICO Y BACKEND LOCAL, solo A
│       ├── server/            # Gateways Node, adapters, pruebas unitarias/HTTP
│       ├── docs/backend/staging_only/
│       │   └── G0...G26 SQL CI DESCARTABLE: NUNCA ejecutar remoto
│       └── docs/backend/openapi/movete-facil-staging.openapi.json
├── docs/
│   ├── handoff/               # Transferencias / división A-B, solo A
│   ├── architecture/          # Contratos/decisiones técnicas, solo A
│   └── architect-b/           # Handoffs y resultados B, solo B
└── .github/workflows/        # CI, solo A
```

- `apps/mobility-expo` conserva legado/demo que mezcla conceptos; no distribuirlo como sustituto de los dos binarios separados ni asumir que su backend es accesible por HTTPS.
- Identidades móviles separadas en configs Expo: `com.movetefacil.driver` y `com.movetefacil.cliente` (verificar al compilar); no generar una sola app con selector de rol.
- SQL de la cadena integral en workflow PostgreSQL usa solo `PGHOST=localhost`, DB `qore_disposable_chain` y `PGAPPNAME=qore_ci_disposable_chain`. Una segunda DB `qore_disposable` ejercita push/concurrencia.
- Workflow Node verifica interfaces/seguridad/gateways, PostgreSQL 16 comprueba RLS, carreras, índices y reglas, CI Expo comprueba typecheck/tests/web export; **ninguno prueba por sí solo APK/IPA, GPS callejero, recepción push real, archivos privados reales o cobranzas**.

---

# 5. TODO EL TRABAJO PREVIO G0–G22 (recibido y preservado)

Esta sección consolida el acta soberana original:
`docs/handoff/HANDOFF_MAESTRO_INTEGRAL_QORE_MOBILE_DOS_ARQUITECTOS_G0_G22_2026-10-22.md` (442 líneas, 22/10/2026). NO eliminarla; contiene cronología y archivos por bloque.

| Fase | Trabajo de A hecho / ensayado | Límite real |
|---|---|---|
| **G0** | Monorepo aislado, proyectos Expo separados Driver/Cliente, scripts de aislamiento/identidades, PRs DRAFT y control de CI. | Sin apps certificadas físicamente. |
| **G1** | Modelos Auth/RBAC/RLS, scaffolding Auth sintético, guardia de llaves publicables, lockdown histórico de RPC peligrosas y bucket privado documentado. | Auth JWT/STAGING multiusuario de dispositivo aún no certificado; no reabrir RPC del proyecto anterior. |
| **G2** | Inventario, cumplimiento, licencias/seguros/inspección/cascos/municipios por AUTO/MOTO, elegibilidad estricta por tipo. | MOTO pasajeros bloqueada; documentos y aprobaciones reales pendientes. |
| **G3** | Solicitar/transicionar viajes AUTO en PostgreSQL, clave idempotente, un viaje activo/conductor, asignación atómica, snapshot de identidad/estado. | Sin viajes reales, cobros reales o despacho físico. |
| **G4** | Ofertas privadas AUTO, TTL/aceptación exclusiva, outbox, backend HTTP loopback, proyección estado Driver/Passenger, barreras JWT y seguimiento GPS/ETA condicionales. | No proveedor GPS/ETA/push real ni servicio HTTPS remoto. |
| **G5** | Envíos particulares AUTO/MOTO, validación carga/categoría OTC, eventos custodia, aceptar/recoger/entregar, evidencia y privacidad. | E2E de entrega real, red y regulaciones pendientes. |
| **G6** | Comercios/catálogo/stock/pedidos/sucursales, vínculo con repartos, operaciones atómicas sintéticas. | Comercios y stock reales autorizados pendientes. |
| **G7** | Tarifas Gs versionadas desde servidor con ruta/tráfico inyectado y pagos SIMULADOS/ledger coherente, recibos y contratos. | Tasas, comisiones, impuestos, PSP y reembolsos reales pendientes. |
| **G8** | SOS/incidentes/suspensiones/operaciones y auditoría simulados, límites RBAC. | SOS real y soporte de emergencia no operativos. |
| **G9** | Gestión de comercios, sucursales, aprobaciones, catálogo y roles. | Operadores reales y controles administrativos pendientes. |
| **G10** | Ofertas privadas de delivery, conductor/courier elegible, una sola aceptación; pruebas PostgreSQL. | Proveedor push/dispositivo pendientes. |
| **G11** | Catálogo OpenAPI localhost, contratos iniciales, validador de referencias/schema y errores. | La definición de URL no es despliegue; Auth/Admin siguen incompletos. |
| **G12** | Delivery push, claim/ACK/expiración, sesiones independientes, prevención de doble entrega a worker. | ACK proveedor no significa recibo en teléfono. |
| **G13** | Fencing por lease/claim para trabajadores push, colisiones y recuperación; PostgreSQL real descartable. | Monitorización y provider real pendientes. |
| **G14** | Prueba dos repartidores aceptando una misma entrega, un ganador, rechazo de carrera. | Cobertura E2E real pendiente. |
| **G15** | Polling privado courier cuando push no llega, seguridad de dueño y TTL. | Recepción real de dispositivo pendiente. |
| **G16** | Bandeja privada de ofertas AUTO + DELIVERY en Driver, política de latencia, rol, expiración y fallback. | No hay login/device real conectado. |
| **G17** | Registro documental privado (manifest, hash, MIME, tamaño) y revisiones Admin auditables, permisos/ownership e inmutabilidad. | **No guarda bytes en DB; Storage y URL privada reales no conectados.** |
| **G18** | Onboarding con rol exclusivamente Driver y transición de rol atómica, verificación de estado. | Flujo real de registro y KYC no certificado. |
| **G19** | Observador de Storage externo: metadata/version fencing, lectura bytes reales inyectada, SHA-256, magic/MIME, antivirus, revisión postescaneo. | **Bloqueo real de integración**: falta proveedor Storage versionado + escáner real; fake tests NO demuestran malware-free. |
| **G20** | Solo licencia más reciente y su revisión aprobada permiten preflight/despacho; vence, revoca y protege ofertas AUTO/delivery. | Otras categorías documentales, permisos/seguro regional y Auth real pendientes. |
| **G21** | Workspace Driver con pantallas/documentos/ofertas/ganancias coordinados en proyecto propio. | No es operación real ni prueba en móvil; componentes siguen cerrados por configuración. |
| **G22** | Puente a SDK de sesión Auth, validación doble, limpieza de cambios de cuenta, sesión tardía/rotación. | Composición Driver predeterminada `authAdapter=null`/`apiOrigin=null`, intencional; falta SDK y STAGING autorizado. |

**Docs históricos recomendados A**: `docs/architecture/G16_DRIVER_PRIVATE_INBOX_AND_SESSION_QA_2026-10-22.md`, `G17_G18_DRIVER_IDENTITY_AND_PRIVATE_KYC_2026-10-22.md`, `G19_PRIVATE_DRIVER_STORAGE_OBSERVATION_2026-10-22.md`, `G20_CURRENT_LICENSE_KYC_ACCEPTANCE_FENCE_2026-10-22.md`, `G21_G22_DRIVER_SESSION_UI_AUTH_BRIDGE_2026-10-22.md`, `docs/architecture/MOVETE_TWO_MOBILE_APPS_2026-10-22.md`; handoffs G12 y tarifas en `apps/mobility-expo/docs/handoff/**`.

---

# 6. TRABAJO HECHO EN ESTA CONTINUIDAD — G23–G26.4 (Arquitecto A)

## 6.1 G23: CI autónoma de Admin Web (sin editar B)

- Archivo nuevo A `.github/workflows/movete-admin-web-qa.yml`, commit `4f38a77eb894cd04763ae10f98709c3e42584929`. PR hacia base A + cambios Admin, checkout seguro PR HEAD B, Node 22, instalación aislada, `npm run check` y `npm run build`, validación `dist/index.html`. Sin secretos ni deployment.
- Hallazgo inicial: dependencias incompatibles `@types/react`/`@types/react-dom`, luego 32/79 tests Admin con errores de rol/DTO. Se documentaron en issue #9, B corrigió en archivos propios, **sin usar `--force` ni omitir pruebas**.
- Admin CI B pasó (ejemplo [#39893653452](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39893653452), 79/79 y build). Las baterías posteriores llegaron a 109 tests en evidencia B. **El bloqueo histórico “no existe Admin CI” está RESUELTO; no duplicar el workflow.**

## 6.2 G23 Rider Status DTO compatible con Cliente

- `apps/mobility-expo/server/g4-rider-status-gateway.mjs`, commit `d55a7d395c30e76c1b02b806dfd6dea4a06f4b63`.
- Tests adversariales `g4-rider-status-gateway.test.mjs`, commit `2a87d6216d42fb41e722eb3482509934f68a36d0`.
- OpenAPI tipado `RiderStatusV1` y legado conservado, commit `913ce0d65db8e92a8165a64926456bf4f4957f75`.
- GET `/v1/staging/rider/trips/{tripId}/status`: actor desde JWT Passenger, ID de viaje/propiedad, revisión monotónica, estado, `assignmentPersisted`, Driver/vehículo solo si persistidos/verificados, ETA/ubicación solo con consentimiento/ruta/frescura, sin fuga al cerrar o a otro usuario. `accepted` se proyecta como `assigned` para B; estado legado sigue disponible.
- Verificaciones del commit de API: Node #317, Expo #857, PostgreSQL #158, aislamiento #211 SUCCESS (runs comunicados en issue #9). **No prueba GPS real ni app conectada.**

## 6.3 G24: cotización firme del servidor en guaraníes

- `apps/mobility-expo/server/g7-finance-gateway.mjs` + tests `g7-finance-gateway.test.mjs` y reloj inyectado en `g4-staging-runtime.mjs`.
- DTO `ServerPricedQuoteV1` tipado en OpenAPI: `ownerId,quoteId,amountGs,fareMode,subjectKind,subjectId,expiresAt` epoch ms, `fareVersion,routingVerified` más legado `quote`. Sujeto/owner JWT y recibo server-priced verificado, TTL válido, monto positivo y reglas versionadas.
- Restricción `subjectKind=RIDE` permite AUTO; **MOTO pasajeros rechazados**, no extrapolar a prohibición de cargas MOTO autorizables.
- Rechaza recibos alterados/monto inválido/expiry/owner equivocado, sin precio propio del móvil. Corrección de fixture/reloj de pruebas: no usar reloj real contra fixture anclado. Test/contrato en CI A, con evidencias en issue #9.
- NO habilita tarifas ni cobros comerciales.

## 6.4 G25: cancelación privada e idempotente

- `POST /v1/staging/rider/trips/{tripId}/cancel`. Cuerpo **EXACTO** `{ "requestKey": "<uuid>" }`, rol Passenger, actor derivado del JWT. Reutiliza transición atómica existente G3 (`event=cancel`, `eventKey=requestKey`) y chequeo de dueño/estado en repositorio.
- Archivos A: `g4-trip-command-gateway.mjs`, `g4-loopback-http-transport.mjs` y tests respectivos; OpenAPI `RideCancellationV1`/`RideCancellationReceiptV1`.
- 400 body, 401 sin JWT, 403 rol equivocado, 409 conflicto/estado, 429 limitador, 503 dependencia; body nunca decide `feeGs` ni `refund`.
- **NO implica reembolso/cargo real** ni UI Cliente LIVE. B tiene módulo QA `ride-cancellation.mjs` y coordinador con antirreplay (sección 7).

## 6.5 G26.0 inicial: identificación del error de diseño

- Primer diseño leía solamente primeras 50 filas y **rechazaba historias mayores**. El Owner lo RECHAZÓ explícitamente. **Este diseño ya fue sustituido y NO debe volver a implementarse.**
- Mandato firme: **TODOS los registros históricos, SIN TOPE GLOBAL**. El número 50 SOLO es tamaño de cada página/paquete HTTP, jamás límite de total de usuarios, conductores, viajes, envíos, pedidos o historia.
- Solución de A: keyset (no OFFSET) y HMAC atado al propietario + fecha ancla + cursor hasta `nextCursor=null`. UI B usa virtualización.

## 6.6 G26.1: endpoint historial privado ilimitado en páginas

- `GET /v1/staging/rider/history`, primera página sin cabecera. Continuación: `X-Qore-History-Cursor: v1.<payload>.<HMAC>`, NUNCA query del propietario ni cursor inventado por app.
- `g26-rider-history-gateway.mjs`: JWT confirmado, rol Passenger, limitador, cursor HMAC-SHA256 de servidor y vinculado al sujeto/proyecto, denegación 400 cursor manipulado/expirado/otro usuario, 401/403/429/503 según dependencia. La ventana firmada es 10 minutos renovables por página; cache de respuesta 60 s.
- `g26-rider-history-repository.mjs`: owner SQL en **tres orígenes** (`passenger_id` trips, `sender_id` delivery, `buyer_id` merchant orders). Lee solo `id,owner,status,revision,created_at`, orden por `created_at DESC,id DESC,kind DESC`. Consulta máximo **51 por origen** para generar páginas de máximo 50, sin techo de historia. Validaciones de PII/estado, no devuelve dueño ajeno ni tabla incompleta como si fuera historia completa.
- DTO `RiderOwnHistoryV1`: `ownerId,generatedAt,expiresAt,items,nextCursor:string|null`; item `serviceId,kind,status,createdAt,revision`, ningún nombre/GPS/placa/importe/documentos.
- `g26-rider-history-repository.test.mjs`: **1.200 registros, 24 páginas**, sin duplicados ni pérdidas. `g26-rider-history-gateway.test.mjs` cubre HMAC, sesión cruzada, TTL, cursor alterado, rol y negación. `g26-rider-history-loopback.test.mjs` prueba HTTP local real. El viejo límite 50 quedó eliminado del contrato.
- Commits principales: `24a24c1b6134bfaf7153ce37ae8313d275954d53` (keyset), `4ae887fab46903c9875d06876edfeb5b0485253b` (HMAC), `621b26c8e902917a406b12ca9c74fd4727892bf3` (cursor compacto 200 chars), `474a95d7c342ff943b056e97f9428b47f82cbc0e` (UUID seguro), `a39912d42cd852c5d54dfb540c146ba324c3cebe` (docs y 4/4 QA).

## 6.7 G26.2: índice y RLS con PostgreSQL REAL DESECHABLE

- SQL: `G26_HISTORY_INDEXES_POSTGRES_CI_ONLY.sql` crea tres índices DESC de propietario+fecha+ID, `INCLUDE(status,revision)`. Guardias DB `qore_disposable_chain` y `qore_ci_disposable_chain` impiden aplicar casualmente fuera de CI.
- `G26_HISTORY_UNBOUNDED_ASSERT_POSTGRES_CI_ONLY.sql`: siembra 400×3 filas sintéticas con FKs/constraints reales G3/G5/G6, verifica **1.200/24 páginas**, RLS real de cuenta propia y ajena, clientes `authenticated` sin INSERT, y planes `EXPLAIN` usando índices.
- Pipeline extendido `.github/workflows/mobility-g4-postgres-disposable.yml` para instalar G6 en cadena y ejecutar G26; success #196 y [#195](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39925580301) para validación de índice.

## 6.8 G26.3: integración HTTP completa y estrés 31.200 operaciones

- `g26-rider-history-paginated-http.test.mjs`: pruebas **HTTP loopback real** con 24 GETs, adapter SQL sintético, JWT simulado, HMAC firmado, owner sin fuga, cache `no-store` y registros nuevos después del ancla. La primera expectativa de contador de queries era errónea (75 reales = 24×3 + cuenta de control×3, no 27); corregida en commit `a8624d713f2a7df428319d1a45c156545e74958c` y pasó 4/4 CI.
- `G26_HISTORY_LARGE_VOLUME_POSTGRES_CI_ONLY.sql`: añade **30.000 filas** a las 1.200 previas, 10.000 por clase, y recorre el historial real PostgreSQL 16. Log verificado: **“31200 owned historic rows / 624 pages / 0 duplicates”**.
- Evidencia [PostgreSQL #200](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39931735547), [Node #388](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39931735478), [Expo #936](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39931735748), [aislamiento #291](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39931735626), **4/4 SUCCESS en commit `650b0794b21ac0e65d721da34f3983d59272b554`**.
- Esto **NO** significa millones de filas medidas, dispositivo físico ni API desplegada. No prometer throughput/SLA sin benchmark medido.

## 6.9 G26.4: inmutabilidad histórico, bloqueos ante backdating

- SQL `G26_HISTORY_IMMUTABLE_ORIGIN_POSTGRES_CI_ONLY.sql` y `G26_HISTORY_IMMUTABLE_ORIGIN_ASSERT_POSTGRES_CI_ONLY.sql`. PostgreSQL **DESCARTABLE** únicamente.
- Tres triggers BEFORE INSERT/UPDATE rechazan falsificar `created_at` diferente de `transaction_timestamp()` en filas nuevas; rechazan editar `id`, `request_key`, propietario (`passenger_id/sender_id/buyer_id`) y `created_at` de filas existentes. Permiten `revision`, `changed_at` y operaciones legítimas del ciclo.
- Error SQLSTATE `G2601` para ataques. Prueba real tras 31.200 filas: **12 intentos UPDATE prohibidos rechazados, 3 INSERT retrodatados rechazados y 3 INSERT legítimos más actualizaciones de estado aprobados**.
- [PostgreSQL #204](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39932663942) SUCCESS, y último HEAD anterior a esta transferencia `95986b58db110e4fbfd7d364c83ab61935f83c00`: **PostgreSQL #205**, **Node #393**, **Expo #943**, **aislamiento #303** todos SUCCESS (tabla sección 3).
- Doc detallado y actualizado: `docs/architecture/G24_G26_CLIENT_API_QUOTES_CANCELLATION_HISTORY_QA_2026-10-23.md`.
- **Limitación técnica importante MVCC:** cursor anclado por `created_at` no es snapshot transaccional persistente. Una transacción iniciada antes del ancla y confirmada después de que se lea la primera página puede volverse visible durante páginas siguientes. El guard de origen reduce backdating por nuevas escrituras, pero **NO resuelve por sí solo commits tardíos** ni reglas de retención/borrado. Prioridad G26.5.

---

# 7. TRABAJO DEL ARQUITECTO B VERIFICADO (SOLO OBSERVACIÓN, NO EDITAR)

Leer `docs/architect-b/STATUS_Y_CONTRATOS.md` y sus handoffs recientes en **rama B**. B tiene CI separado y trabaja autónomamente.

### Cliente (B01–B10)

- Producto Expo `apps/movete-cliente/**` distinto de Driver, navegación propia viaje AUTO, envíos/comercio, carrito, cotización, estado, GPS/ETA con frescura, historial, pago **simulado** y soporte de QA.
- HTTPS pinning, JWT inyectado sin persistir, controles de rol Passenger, caducidad, logout y cambio de cuenta; adapters `enabled=false` o `contractCertified=false` en ausencia de servicio STAGING auditado.
- Reductor de viaje, revisión monotónica, rechazo de ubicaciones/driver antes de asignación, polling y limpieza en respuesta antigua.
- `history-feed.mjs`: cursor `v1.<base64url>.<HMAC>` validado y store acumulativo. **IMPORTANTE CORRECCIÓN DE INFORMACIÓN ANTIGUA:** B **SÍ creó** `apps/movete-cliente/src/domain/client-history-gateway.mjs`, separado del genérico `client-gateway.mjs`. Se verificó el archivo: envía `GET /v1/staging/rider/history` y cabecera opcional `X-Qore-History-Cursor`, bloquea redirecciones/cookies, requiere HTTPS pinned, rol y JWT, controla tamaño/JSON/TTL, sesión tardía y 400 de cursor vencido. No hay que duplicar `riderHistory` en `client-gateway.mjs` obligatoriamente; las notas antiguas de issue #9 que decían “no existe gateway historia B” quedaron **SUPERADAS** por este módulo. Lo que sí falta es **habilitarlo/certificarlo contra servidor STAGING aprobado y móvil físico**.
- `client-experience` con `loadHistoryPage`, acumulación, reinicio por cursor vencido y UI de `historial.tsx` con FlatList y “Cargar más”. Prueba B con 5.000 filas/100 páginas y otras 120 páginas sintéticas; el objetivo sigue siendo TODO el histórico, sin límite global.
- `ride-cancellation.mjs` + coordinador de cancelación Cliente por `POST /v1/staging/rider/trips/{tripId}/cancel`, `requestKey` idempotente, sin estado optimista ni reembolso inventado. Gate por defecto apagado, botón final/UUID del SO/E2E pendiente.
- Handoffs B: `docs/architect-b/HISTORIAL_CLIENTE_OPENAPI_G11_2026-10-23.md` y `docs/architect-b/CANCELACION_CLIENTE_QA_SEGURIDAD_2026-10-23.md`.
- Evidencia B [Cliente/Driver #39932010765](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39932010765) SUCCESS, 131/131 pruebas Cliente en aquel commit; revisar el HEAD posterior.

### Admin WEB (B11–B13)

- Proyecto `apps/movete-admin/**` React/TypeScript/Vite autónomo. KYC, zonas, incidentes/SOS de QA, auditoría, métricas y finanzas Owner (sin saldos ficticios). No almacena documentos o llave privilegiada en el navegador.
- Gateway de lectura Admin propuesto `admin-read-gateway.mjs`, MFA/rol y sesión posterior, HTTPS pinning, sin redirección ni cookies; cinco operaciones de datos proyectadas y botones “Actualizar”; **bloqueado por defecto** hasta endpoint backend/MFA realmente certificado.
- Paginación por cursor para KYC/zonas/incidentes/auditoría, controles no limitan total de registros.
- Workflow A `movete-admin-web-qa.yml` actualmente verde; ejemplo [Admin #39932010585](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39932010585), 109/109, pero no implica autenticación ni KYC real.
- Handoffs B `docs/architect-b/PAGINACION_SIN_LIMITE_REGISTROS_2026-10-23.md`, `docs/architect-b/ADMIN_READ_GATEWAY_QA_2026-10-23.md`, `docs/architect-b/STATUS_Y_CONTRATOS.md`.
- B12 Lovable UI definitivo **PENDIENTE**; B13 certificación con navegador/dispositivos y backend autorizado **PENDIENTE**.

---

# 8. MATRIZ COMPLETA DE PROBLEMAS Y RIESGOS (históricos + nuevos)

| ID | Problema observado | Situación / acción para sucesor |
|---|---|---|
| P01 | Demo `mobility-expo` mezclaba roles | Dos apps finales separadas; **no distribuir demo**. |
| P02 | Se confundía ACK de push con recepción por dispositivo | G12/G13 usan fencing y ACK; device receipt real pendiente. |
| P03 | Dos workers/couriers podían ganar una oferta | G12–G14 contención PostgreSQL, un ganador, tests; carga real pendiente. |
| P04 | Pérdida de ofertas sin polling | G15/G16 fallback privado implementado en QA; dispositivo real pendiente. |
| P05 | Fixtures de roles iniciales mezclaban passenger/Driver | G18 rol exclusivo y tests; JWT real aún pendiente. |
| P06 | KYC podría confiar en metadata móvil | G19 observa Storage/version/hash/escaneo desde servidor, pero proveedores reales faltan. |
| P07 | Licencia vieja aprobada pese a nueva pendiente/rechazada | G20 exige revisión de última licencia. |
| P08 | Fixture duplicaba pasajero por trigger | Corregido históricamente; no repetir. |
| P09 | Un Driver sintético tenía viaje activo previo | CI cierra/cancela con invariant one-active-driver; sin borrar restricciones. |
| P10 | UUID incompleto 8-4-4-12 en G20/G26 | Corregido a 8-4-4-4-12; mantener tests adversariales. |
| P11 | Respuesta tardía podría filtrar datos de cuenta anterior | G21/G22 y B limpian por revisión sesión; probar físico. |
| P12 | API STAGING HTTPS no desplegada/configurada | **Bloqueo real de integración**; avanzar en contratos/tests sintéticos, solicitar permiso del Owner para desplegar STAGING. |
| P13 | OpenAPI/roles de Admin/Owner incompletos | Issue #9 abierto; Auth/MFA/RBAC y DTOs servidor PRIORIDAD P0. |
| P14 | PR B diverge de PR A | No hacer merge/rebase; contratos vía issue #9; boundary verde. |
| P15 | No existía job CI Admin | **RESUELTO** G23, Admin CI ya verde. |
| P16 | Comisiones 10/15/12% y Gs en escenarios | NO aprobación productiva. Investigar zonas, costos, competencia y validación del Owner. |
| P17 | MOTO pasajeros/farmacia restringidos por seguro/ley | Mantener bloqueos y revisión legal por municipio y categoría. |
| P18 | Web export no certifica APK/IPA/GPS/batería/señal | E2E en Android/iOS físicos pendiente. |
| P19 | Admin sin URL de documento privado ni política de retención | Diseñar acceso efímero, motivo, auditoría, borrado y consentimiento. |
| P20 | SOS/soporte UI parece operativo aunque es DEMO | Etiquetar no LIVE hasta protocolos/humanos/proveedores. |
| P21 | Una licencia revisada no completa KYC vehículo/seguro | G20 solo es una condición, resto por definir. |
| P22 | Driver sin Auth ni botón de aceptación real | Correctamente bloqueado, completar solo al certificar sesión STAGING. |
| P23 | Admin primero falló `ERESOLVE` y 32/79 tests | Corregido en B, gate G23 verde; no saltar tests. |
| P24 | Cotizaciones G24 inicialmente comparaban reloj fijo con real | Runtime recibe reloj inyectado; tests reparados y CI verde. |
| P25 | Primer historial rechazaba >50 en total | **RECHAZADO por Owner y REEMPLAZADO**. Nunca volver al límite global, solo 50 por paquete. |
| P26 | Regex HMAC Cliente no aceptaba puntos | **RESUELTO por B** en `history-feed.mjs` y `client-history-gateway.mjs`; no reabrirlo. |
| P27 | Notas de issue decían que B carecía de gateway historial | **OBSOLETO**; gateway independiente existe. Falta E2E servidor autorizado, no implementar duplicado. |
| P28 | Node G26 keyset tenía UUID 8-4-4-12 | Corregido en A; CI posterior verde. |
| P29 | Test HTTP contaba 27 consultas en vez de 75 | Fixture corregido; suite real HTTP aprobada. |
| P30 | Historia puede mutar owner/fecha y romper cursor | G26.4 triggers bloquean mutaciones comunes en SQL desechable; no remoto. |
| P31 | Snapshot anclado `created_at` frente a transacciones que confirman tarde | **PENDIENTE G26.5**, pruebas MVCC multicona y definir semántica (snapshot vs eventual/re-sync). |
| P32 | HMAC de cursor reutiliza material privado del servidor (`serviceKey` inyectada) | Separar secreto de firma dedicado/rotación y revisión criptográfica STAGING; no colocarlo en GitHub ni app. |
| P33 | Fechas UTC con microsegundos y límite de cursor 200 chars | QA pasó 1.200 y 31.200; ampliar casos horarios/timestamps ties/rotación, sin inferir garantía universal. |
| P34 | En B gateway historia está deshabilitado hasta contrato de servidor | Correcto. No activarlo con mocks en ambiente público; cerrar integración Auth real autorizada. |
| P35 | Seguridad jurídica de históricos vs eliminación/rectificación | Política de retención/audit trail, export, borrado legal y consentimiento pendientes. |
| P36 | Escala medida aún es 31.200, no millones | Plan de carga con cientos de miles/millones y latencia/índices/costos, según recursos. |

---

# 9. TODO LO QUE FALTA — ROADMAP PRIORIZADO, EJECUTABLE, SIN DETENCIONES

## P0: siguiente Arquitecto A arranca YA (solo rutas A)

**A01 — Retomar sin perder contexto.** Leer este handoff, el G0–G22 y división A/B. Reconsultar GitHub PR #7/#8, latest HEAD, workflows de HEAD, issue #9 y código vigente; no guiarse por SHAs de ayer. Leer `docs/architecture/G24_G26_CLIENT_API_QUOTES_CANCELLATION_HISTORY_QA_2026-10-23.md` y tests G26. No crear PR alternativo ni reescribir trabajo ya verde.

**A02 — G26.5 consistencia MVCC/cursores y pruebas adversariales.** Es PRIORIDAD DIRECTA de la entrega: escribir test real PostgreSQL con dos sesiones, una transacción INSERT que inicia antes del GET inicial y confirma después, y observar el historial cuando avanza el cursor. Documentar si se usa consistencia eventual con relectura/refresco o snapshot persistente por sesión. No prometer snapshot fuerte si no puede sostenerse. Probar filas con mismos tiempos/IDs entre tablas, cambio de estado entre páginas, repetición de cursor, token rotado/revocado, HMAC distinto y expiraciones. Mantener histórica sin tope. No relajar índices, permisos o guardas al resolver.

**A03 — Gestión de secretos HMAC separada.** Diseñar keyring/rotación de cursor con clave independiente de `service_role`, referenciada por secret manager y variable sólo servidor; cursor versionado, rechazo por firma/titular/proyecto y caducidad. Revisar tamaño <=200, operación con dos releases y observabilidad sin registrar token en claro. Simular sin secretos reales.

**A04 — Auth Passenger/Driver/Admin/Owner E2E STAGING (previo diseño/QA).** Completar contratos OpenAPI de sesión/roles con 401/403/429/503, revocación, MFA **backend** para Admin/Owner, separación Owner-finanzas y Admin-KYC, TTL, logout y re-login; escribir tests del backend contra JWT sintéticos adversariales y RLS. No habilitar gateway real hasta autorización, infraestructura HTTPS y cuentas STAGING ficticias.

**A05 — Contratos Backend Admin y Owner de issue #9.** Endpoints autorizados para cola/detalle KYC mínimos, URL temporal versionada con motivo/TTL/acceso auditado, revisión idempotente, zonas activas/cobertura, incidentes, suspensiones, auditoría y finanzas del Owner (bruto, comisiones, payout, reembolsos, costos/neto de ledger real SIMULADO). DTO estrictos, paginación infinita, filtrado server-side y negativa cruzada entre roles. No cifras inventadas.

**A06 — Cerrar resto de APIs Cliente pendientes.** Catálogo/stock real de QA por sucursal/zona, solicitud de pedido/receipt, historial de cobros sólo propios, estados/cancelación de deliveries/orders, incidentes/soporte, mock de pago seguro. Dejar contratos a B en issue #9, con SHAs, ejemplos, errores y versionado OpenAPI. Respetar lo ya aportado por B (gateway historia/cancel), no duplicar.

**A07 — Integración no invasiva con B.** Revisar `client-history-gateway.mjs` y `client-experience` desde rama B, comparar OpenAPI de A sin copiar carpetas. Abrir comentarios de discrepancias, no corregir código de B. Revalidar `Movete Facil Admin web QA` y `Architect B ownership boundary` de HEAD B. No hacer merge cruzado.

## P1: infraestructura completa de Driver / backend STAGING

**A08 — STAGING seguro con permiso Owner**. Preparar plan de entornos dev/staging/prod separados, DNS/HTTPS, JWT issuer/audience/revocación, configuraciones/secretos, RLS, fixtures sintéticos, rollback, auditoría, límites de costos. **Solo desplegar si el Owner autoriza.** Hasta entonces crear config template, tests y runbooks locales.

**A09 — Conectar Driver Auth/SDK y flujo KYC.** Implementar adaptador real SDK en `apps/movete-driver/**` bajo entorno STAGING autorizado, almacenamiento seguro de tokens, rotação/expiración, rollback de cuenta, MFA donde corresponda y transición exclusiva Driver; onboarding pendiente/rechazado/aprobado. Integrar G21/G22 sin activar si no hay proveedor confiable.

**A10 — Storage privado G19+G17.** Proveedor de almacenamiento versionado con metadata real, scan antivirus actualizado, hash bytes, cuarentena, MIME/magic, límites 5 MiB, URL administrativa temporal auditada, prueba de cambio de objeto concurrente, borrado/retención. No autoaprobar documentos por subida.

**A11 — Completar elegibilidad vehículo/documentos G2/G20.** Licencia vigente revisada, cédula/seguro/inspección/autorizaciones/propiedad/municipio, permiso de carga MOTO separado, revocación mientras oferta/servicio, costo/limitaciones. Pruebas de estado antes y durante aceptación.

**A12 — Driver funcional en dos sentidos.** Ofertas privativas y aceptación/rechazo real STAGING, GPS consentido, distancia, mapas/rutas/ETA, entrega por OTP/POF autorizado, pruebas offline/reintentos y ledger sintético de ganancias, sin filtro falso de Driver “disponible”.

**A13 — Geozonas y despacho por demanda.** Zonas y activación gradual, selección/ranking de conductores elegibles, frescura y permisos GPS, race de aceptación, expiración/reasignación, ETA calculado con proveedor de rutas y costo competitivo, cobertura vs disponibilidad. Separar autos de carga MOTO.

## P2: legal, finanzas, robustez y lanzamiento (NO autorizar por inferencia)

**A14 — Modelo económico completo:** estudio Bolt/Uber tarifas reales locales por modalidad y zona (fuentes/datos actuales, no asumir porcentajes), simulaciones Gs, costo mapas/hosting/PSP/soporte, margen de conductor y plataforma, impuestos, descuentos, reembolsos y disputa. Aprobación Owner antes de porcentajes productivos.

**A15 — Seguridad/operación:** SOS con protocolo humano real, incidentes/suspensiones, soporte, antifraude, DPA/retención de documentación, derecho a borrar/exportar histórico, backups/restore, monitoreo de tiempos, SLO y capacidad de escalar con costos.

**A16 — Certificación integral:** dos APK/IPA separadas/firmadas en dispositivos Android/iOS, Admin en navegador, flujo Cliente→server→Driver→estado Cliente→Admin, push real vs polling, GPS foreground/background, zona fuera de cobertura, datos corruptos, token revocado, latencia/costo, batería, mala señal y errores idempotentes. Condiciones legales revisadas.

**A17 — Lovable solo UI final y publicación bajo orden del Owner.** Backend y contratos probados antes de entregar UI; no mover lógica de roles, precios o KYC a Lovable. Ensayo STAGING y rollback, CHECKLIST formal GO/NO-GO y aprobación explícita Owner. Por defecto conservar DRAFT/NO LIVE.

### Trabajo paralelo exclusivo del Arquitecto B (solo para coordinar)

- Completar las conexiones de Cliente al backend real STAGING autorizado a través de sus gateways ya existentes (`client-history-gateway.mjs` y `ride-cancellation.mjs` incluidos), preservando apps separadas. Pruebas de historia con muchas páginas, cambio de cuenta, expiración, red mala, UI real.
- Integrar Admin/Owner WEB contra Auth/MFA real del backend A, RBAC por acción, KYC/zonas/finanzas con datos autorizados sin PII lateral.
- Terminar visual UI Lovable SOLO después de contratos/infraestructura listos; B12–B13 E2E de navegador y Cliente, QA, documentación y PR #8 DRAFT. NO asumir que las pantallas sintéticas significan operación funcional.

---

# 10. Definición de terminación por bloque y por producto

Un módulo solo se considera **implementado en QA** si: cambios verificados en SHA de su propietario; tests relevantes ejecutados; los workflows **de ese mismo HEAD** concluyen SUCCESS; negativas 400/401/403/409/429/503 necesarias; no secrets ni PII; docs/issue actualizado; cambios reversibles; no infracción de propiedad A/B.

**No se puede afirmar “la app funciona al 100%”** si falta cualquiera de estos hitos: Auth JWT/RLS real, GPS/ETA y rutas reales con privacidad, KYC Storage/escáner real, despacho/aceptación atómica con apps físicas, backend HTTPS seguro con datos STAGING, Admin/Owner MFA, errores/reconexión, PSP/retención/regulación, ejecución en dos apps separadas, operación/soporte humana y autorización de LIVE.

Matriz de realidad al corte:

| Capa | Estado |
|---|---|
| CI/GitHub y apps independientes | Implementado, CI en verde; móviles físicos NO certificados. |
| Driver | Composición/validaciones de QA; Auth, KYC real, GPS, ofertas de dispositivo pendientes. |
| Cliente | UX y gateways de QA, incluyendo historial y cancelación; API remoto STAGING/phone E2E pendientes. |
| Admin/Owner Web | Proyecto/build/tests verdes; backend real/MFA/KYC/finanzas por rol pendientes. |
| Backend G0–G26.4 | Modelos/tests HTTP y PostgreSQL desechable; no LIVE ni app-servicio desplegado. |
| Historial ilimitado | Keyset/HMAC/índices, 31.200/624 + SQL inmutabilidad CI; MVCC/retención y E2E remotos pendientes. |
| Economía, legal, push, soporte | Parcial/simulado, no habilitado comercialmente. |
| Lovable visual final, deploy y tiendas | Pendiente de certificación y autorización. |

---

# 11. Protocolo “trabajar sin detenerse” del siguiente arquitecto

1. **Inicio automático:** leer GitHub (no repetir preguntas ya contestadas), este handoff, issue #9, PRs, últimos SHAs, docs G24–G26. No pedir permiso para cada commit de QA en rama A.
2. Escoger A02/G26.5 primero; abrir fuente y pruebas G26, escribir código/SQL **solo descartable**, ampliar adversariales, commits pequeños. Si esa investigación queda bloqueada por una dependencia real, pasar a A03/A04/A05 mientras se documenta.
3. Ejecutar **todos** los tests relevantes en GitHub Actions; usar logs, corregir fallos y volver a correr por nuevo SHA. No declarar verde una ejecución pendiente. No remover asserts ni usar `--force` para aparentar éxito.
4. Documentar resultado concreto: commit, rutas alteradas, tests y URL run, razón de diseño, nueva deuda técnica/seguridad y próximo paso. Actualizar issue #9 solo cuando B necesita DTO/cambio/aviso.
5. Continuar con A03, A04, A05… hasta completar el plan técnicamente posible, sin parar por detalles menores; NUNCA prometer ejecución en background o fingir despliegue inexistente.
6. **Bloqueo REAL:** falta de autorización para HTTPS STAGING / secretos / proveedores Storage real / PSP / leyes MOTO-farmacia / conflicto de ownership. NO saltarse ese gate: describir dependencia y seguir con tareas QA independientes. Elevar al Owner únicamente decisiones externas indispensables.
7. No mezclar trading QORE Core, VPS u otros proyectos. Owner requiere entregar infraestructura y luego interfaz Lovable, no confundir el trabajo de UI con backend finalizado.
8. Al cerrar chat, publicar handoff actualizado en `docs/handoff/**` con continuidad y estado soberano para próximo arquitecto.

### Comprobación orientativa local (sin ejecutar SQL contra servidores remotos)

```bash
# GitHub / rama A: usar exactamente el HEAD que se va a certificar
git fetch origin
git switch feature/mobility-monorepo-isolated-20261016

cd apps/mobility-expo
node --test server/*.test.mjs
npm run check

# Solo el job GitHub con PostgreSQL 16 DESCARTABLE instala SQL G0–G26.
# Nunca apuntar psql a una DB externa o de producción.
```

Para la rama B, el B verifica sus propios proyectos en su propia rama:

```bash
cd apps/movete-cliente
npm run check
# Según scripts de package.json del HEAD B, correr typecheck/test/export.

cd ../movete-admin
npm run check
npm run build
```

---

# 12. Referencias soberanas y enlaces operativos

- [Repositorio QORE Mobile](https://github.com/mezas3238-hue/Qore-mobile-).
- [PR #7 — Arquitecto A, DRAFT](https://github.com/mezas3238-hue/Qore-mobile-/pull/7).
- [PR #8 — Arquitecto B, DRAFT](https://github.com/mezas3238-hue/Qore-mobile-/pull/8).
- [Issue #9 — Contratos A↔B](https://github.com/mezas3238-hue/Qore-mobile-/issues/9).
- Documento original G0–G22: `docs/handoff/HANDOFF_MAESTRO_INTEGRAL_QORE_MOBILE_DOS_ARQUITECTOS_G0_G22_2026-10-22.md`.
- División inequívoca de carpetas: `docs/handoff/DIVISION_TRABAJO_DOS_ARQUITECTOS_MOVETE_FACIL_2026-10-22.md`.
- Reporte A G24–G26: `docs/architecture/G24_G26_CLIENT_API_QUOTES_CANCELLATION_HISTORY_QA_2026-10-23.md`.
- API A: `apps/mobility-expo/docs/backend/openapi/movete-facil-staging.openapi.json`.
- B status: `docs/architect-b/STATUS_Y_CONTRATOS.md` **solo rama B**.
- B historial: `docs/architect-b/HISTORIAL_CLIENTE_OPENAPI_G11_2026-10-23.md` **solo B**.
- B cancelación: `docs/architect-b/CANCELACION_CLIENTE_QA_SEGURIDAD_2026-10-23.md` **solo B**.
- CI verificado en HEAD A previo: PostgreSQL #205, Node #393, Expo #943, aislamiento #303, todos SUCCESS.
- CI B HEAD previo: Admin #39932418929, boundary #39932341605, aislamiento #39932341596, todos SUCCESS.
- **Tras publicar este handoff:** nuevo SHA HEAD A; revalidar automáticamente checks por nuevo SHA (pueden ser pendientes, no atribuirles éxitos anteriores).

---

# 13. INSTRUCCIÓN COMPLETA LISTA PARA PEGAR AL NUEVO CHAT

> Actúa como el siguiente **ARQUITECTO A** de **QORE Mobile / Movete Fácil**, continuando el trabajo existente, SIN REINICIAR. GitHub soberano `mezas3238-hue/Qore-mobile-`. Abre ahora `docs/handoff/HANDOFF_MAESTRO_ARQUITECTO_A_G0_G26_4_CONTINUIDAD_2026-10-23.md` en rama `feature/mobility-monorepo-isolated-20261016`, PR #7 DRAFT, y también el handoff original G0–G22, división A/B, issue #9 y el reporte G24–G26. El Arquitecto B conserva su rama `feature/mobility-cliente-admin-parallel-20261022`, PR #8 DRAFT, y es propietario de `apps/movete-cliente/**`, `apps/movete-admin/**` y `docs/architect-b/**`; **NO TOQUES ESAS CARPETAS**. Tú editas únicamente backend/Driver/SQL/OpenAPI/CI/docs A. Verifica los SHAs/CI vigentes y empieza de INMEDIATO por **G26.5 consistencia MVCC/cursores e integridad histórica**, y sigue con seguridad HMAC dedicada, Auth JWT/RBAC/MFA, endpoints Admin/Owner, KYC/Storage y Driver, tests adversariales y CI PostgreSQL descartable. El histórico de pasajeros admite **TODOS LOS REGISTROS SIN TOPE GLOBAL**, 50 por página interna con `nextCursor` hasta null. B YA TIENE `client-history-gateway.mjs` para HTTP firmado, así que NO lo dupliques en A ni asumas que falta por no figurar en el gateway genérico. Mantén NO MERGE / NO LIVE / NO despliegue / NO SQL remoto / NO usuarios ni pagos reales / NO VPS. Publica commits verificables, diagnostica errores y reejecuta CI hasta verde, actualiza issue #9 si hay cambios de contrato y continúa por el roadmap sin paradas innecesarias. **SOLO DETENTE POR BLOQUEO REAL DE SEGURIDAD, PERMISOS, LEGAL O ACCESO, y mientras tanto avanza otra tarea QA independiente**. No confundas CI verde ni interfaz Lovable con app certificada en teléfonos o con producción.

# FIN — HANDOFF MAESTRO G0–G26.4 · continuidad operacional, sin autorización LIVE

# QORE MOBILE · MOVETE FÁCIL
# HANDOFF MAESTRO INTEGRAL — ARQUITECTO B · B01–B31 + R1–R62
## Transferencia ejecutiva, técnica, histórica y operativa para un NUEVO CHAT

**Fecha del corte:** 24 de octubre de 2026 (Paraguay). **Siguiente responsable:** Arquitecto B — app Cliente Expo y Admin Web. **Mandato Owner:** CONTINUAR EL DESARROLLO HASTA TERMINAR TODAS LAS FUNCIONES Y CERTIFICARLAS, SIN DETENERSE A MENOS QUE EXISTA UN BLOQUEO REAL.

> **ESTO ES UN HANDOFF EJECUTABLE, NO UNA SOLICITUD DE PLANIFICACIÓN.** El sucesor debe entrar en GitHub, leer PR #8 y HEAD de A, implementar la siguiente función propia B, añadir pruebas adversariales, hacer commit, ejecutar CI, corregir y avanzar. No reiniciar arquitectura, no esperar indefinidamente por A, no repetir preguntas ya resueltas y no llamar «app completa» a una colección de pruebas sintéticas. Si falta contrato A, registrar impedimento en issue #9 y cambiar inmediatamente a otro frente B desbloqueado.

---

## 00. LEER PRIMERO — 18 VERDADES NO NEGOCIABLES

1. **Repositorio soberano:** [mezas3238-hue/Qore-mobile-](https://github.com/mezas3238-hue/Qore-mobile-) — **incluye guion final**. No es `qore-core` de trading.
2. **Rama exclusiva B:** `feature/mobility-cliente-admin-parallel-20261022`. [PR #8](https://github.com/mezas3238-hue/Qore-mobile-/pull/8) **OPEN DRAFT**, base rama A `feature/mobility-monorepo-isolated-20261016`, **no main**.
3. **Rama A:** `feature/mobility-monorepo-isolated-20261016`. [PR #7](https://github.com/mezas3238-hue/Qore-mobile-/pull/7) **OPEN DRAFT**, base main. Arquitecto A trabaja simultáneamente en Driver/Node/PostgreSQL.
4. **HEAD B ANTES de iniciar este handoff:** `19149c7ca3ebeec4f3fe807778a715e0d15b867f` (R62). El **anexo de inventario** ya creó el commit `9c912bb58663e073c5503e9188603554f45f7598`. Este maestro generará **otro SHA nuevo**: el siguiente arquitecto debe recuperar HEAD B por GitHub; jamás programar contra estos SHAs estáticos.
5. **HEAD A al último corte verificado:** `4232ff32a7432a7a8006ebd4dbfb018c9e9ab62f` (G66). A puede avanzar mientras B trabaja: **revalidar HEAD, rutas y CI** antes de integrar.
6. **CI R62 B mismo SHA `19149c7c...`: 3/3 SUCCESS** — B ownership [#40112229613](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40112229613), Admin QA [#40112229928](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40112229928), two-app isolation [#40112229606](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40112229606) con Cliente+Driver tests, TypeScript y **Expo WEB export**. WEB export **NO** es APK/AAB/IPA ni ensayos físicos.
7. **CI G66 A mismo SHA `4232ff32...`: 4/4 SUCCESS** — PostgreSQL16 disposable [#40110756956](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40110756956), Node STAGING [#40110756960](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40110756960), Expo [#40110756975](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40110756975), aislamiento [#40110756939](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40110756939). Los checks pertenecen a sus SHAs; no suponer integración del último A en el HEAD B hasta verificar.
8. **Inventario PR #8 PRE-handoff:** **343 rutas modificadas** (13 Cliente app, 157 Cliente domain, 6 Cliente otros, 53 Admin Web, 114 documentos B), congeladas por [anexo auditado](./ANEXO_INVENTARIO_MAESTRO_B_R1_R62_CORTE_2026-10-24.md). Son archivos **cambiados en PR**, no todos los del repo. Este handoff y el anexo aumentan el conteo.
9. **Certificación REAL:** la matriz A [G61](../architecture/MOVETE_FACIL_LAUNCH_GATES_2026-10-24.json), revisada en HEAD A, permanece **17 P0: 15 BLOCKED + 2 QA_ONLY + 0 certificados; lanzamiento NO_GO**.
10. **Registro R60 B:** [matriz verificable](./CERTIFICACION_INTEGRAL_R60_MATRIZ_VERIFICABLE_2026-10-24.json) contempla 17 gates y 20 circuitos end-to-end; **0 de 20 certificados funcionalmente**. La herramienta R60 fue certificada **como código QA**, no como autoridad de GO.
11. **GitHub es fuente de verdad** para commits, PR, archivos, issues, evidencia y decisiones. Puntos coordinadores [issue #9](https://github.com/mezas3238-hue/Qore-mobile-/issues/9) (contratos A↔B) y [#11](https://github.com/mezas3238-hue/Qore-mobile-/issues/11) (Cliente, referencias competitivas y progreso B). Benchmarks [#10 Driver](https://github.com/mezas3238-hue/Qore-mobile-/issues/10) y [#12 Uber Cliente](https://github.com/mezas3238-hue/Qore-mobile-/issues/12).
12. **B SOLO edita** `apps/movete-cliente/**`, `apps/movete-admin/**`, `docs/architect-b/**`. A SOLO edita Driver, backend, SQL, OpenAPI, infra/workflows, etc. NO «arreglar» un fallo de Driver desde rama B.
13. **NO MERGE, NO LIVE, NO DEPLOY, NO VPS, NO PSP/pagos reales, NO publicación en tiendas, NO credenciales/PII reales, NO SQL remoto sin aprobación Owner.** «Avanza» autoriza desarrollo seguro y QA sintética, NO operación comercial.
14. **Dos apps móviles independientes:** Cliente para pasajero/comprador/remitente; Driver para conductor/repartidor. Admin Web es tercera superficie independiente. NO juntar binarios, pantallas privadas ni identidad de roles.
15. **Servicios:** pasajero AUTO; carga por AUTO y MOTO; envío particular y comercios (supermercado, farmacia permitida OTC, restaurante). **MOTO pasajeros NO autorizada**. No copiar marca/diseño exacto de Bolt/Uber/PedidosYa; referencias solo de función.
16. **Cobertura ≠ disponibilidad**, borrador ≠ booking, cotización local ≠ tarifa final, ACK QA ≠ transacción comercial, `proofRef` UUID ≠ entrega probada, «sin respuesta» ≠ solicitud inexistente; Gs/PYG siempre con pricing contractual de A.
17. **No tope global 50 registros:** páginas 50/100 y ventanas RAM acotadas, sin limitar cantidad total de conductores/pedidos/clientes/historial.
18. **Lovable solo interfaz visual definitiva** cuando backend/funciones estén completos y certificados; no sustituye Auth, Node, PostgreSQL/RLS, mapas, PSP, Driver o cumplimiento legal.

---

## 01. MANDATO DEL OWNER Y DEFINICIÓN HONESTA DE «TERMINADA»

Owner exige completar la aplicación para probar **todas** las funciones y certificar sin ambigüedades. Entregable final: funcionalidad instalada en teléfonos (dos apps separadas) y backoffice web, con cuenta/servidor autorizado, flujo auténtico, fallas probadas, trazabilidad, rendimiento, accesibilidad, privacidad y operación. Cada módulo pasa por niveles:

- **IMPLEMENTADO_LOCAL:** código y vistas existen, sin transporte real acreditado.
- **QA_CERTIFIED:** pruebas Node/TS/CI, contratos simulados o PostgreSQL efímero aprobados en un SHA exacto.
- **STAGING_E2E_CERTIFIED:** misma transacción real, dos roles autorizados y DB duradera compartida accesible por HTTPS con datos sintéticos, problemas de red/roles/fallas incluidos.
- **NATIVE_CERTIFIED:** APK/AAB/IPA firmados, dispositivos Android/iOS, permisos de GPS, batería, push, reconexión, seguridad/UX, trazas independientes.
- **COMMERCIAL_GO:** TODOS los gates obligatorios + legales/PSP/operación + aprobación explícita Owner + acto separado de despliegue. **Hoy NO_GO**.

Nunca usar un único `SUCCESS` de GitHub para afirmar que una etapa funcional real ha sido finalizada.

---

## 02. PROPIEDAD DE RUTAS Y PROCEDIMIENTO DE EDICIÓN

| Área | B puede escribir | B puede leer, NO escribir |
|---|---|---|
| Cliente | `apps/movete-cliente/**` | `apps/movete-driver/**` |
| Admin | `apps/movete-admin/**` | APIs, SQL, migraciones |
| Handoff B | `docs/architect-b/**` | `docs/architecture/**`, `docs/handoff/**` A |
| Servicios comunes | SOLO adaptadores del consumidor B | `apps/mobility-expo/**`, Node, Postgres, Auth/JWT/JWKS, dispatch, fares, PSP |
| Root/CI | Solo seguimiento | `.github/**`, workspaces/root, workflows |

**Método GitHub:** `get_pr_info` PR #7/#8 → `fetch_file` contra rama B/A → preparar cambio en dominio B + pruebas .test.mjs + tipos .d.mts + UI cuando corresponda → `create_file` / `update_file` con el **SHA de blob actual** y `branch:B` explícita → revisar 3 workflows del **SHA FINAL** → si fallan buscar job y logs, corregir → documentar SHA y conclusión en issue #11, dependencia A en issue #9 → siguiente bloque. No force push, rebase ni cambios unilaterales de PR. **Un PR no es un branch fusionado**, y B basado en rama A puede estar desfasado respecto del HEAD de A.

---

## 03. ÁRBOL DE DOCUMENTACIÓN OBLIGATORIA: LEER SIN RECONSTRUIR HISTORIA

1. [Maestro B01–B31 + R1–R13](./HANDOFF_MAESTRO_ARQUITECTO_B_R1_R13_TOTAL_Y_CONTINUIDAD_2026-10-23.md) (342 líneas y referencias de histórico B).
2. [Maestro R1–R33 y G55](./HANDOFF_MAESTRO_INTEGRAL_B_R1_R33_G55_CONTINUIDAD_AUTONOMA_2026-10-24.md) (432 líneas; detalles paso a paso de chat e integración).
3. [Maestro R1–R43](./HANDOFF_MAESTRO_INTEGRAL_B_R1_R43_CONTINUIDAD_AUTONOMA_2026-10-24.md) y [Anexo R43](./ANEXO_INVENTARIO_MAESTRO_B_R43_2026-10-24.md).
4. [Anexo completo PR #8 PRE-handoff R62: 343 rutas](./ANEXO_INVENTARIO_MAESTRO_B_R1_R62_CORTE_2026-10-24.md), preserva rutas test/tipos/docs.
5. [Matriz 17 P0/20 flujos R60](./CERTIFICACION_INTEGRAL_R60_MATRIZ_VERIFICABLE_2026-10-24.json), [Acta R60](./HANDOFF_R60_CERTIFICACION_TOTAL_SIN_AMBIGUEDADES_2026-10-24.md) y [snapshot soberano de G61 de A](./FUENTE_A_G61_CERTIFICACION_PINNED_2026-10-24.json). **El snapshot no reemplaza consultar el último HEAD A**.
6. [Handoff Arquitecto A G66](../architecture/G66_DRIVER_DELIVERY_CUSTODY_VERIFIED_PROOF_STAGING_2026-10-24.md); G65 ciclo AUTO [documento A](../architecture/G65_DRIVER_AUTO_TRIP_LIFECYCLE_CROSS_APP_STAGING_QA_2026-10-24.md) y OpenAPI A en `apps/mobility-expo/docs/backend/openapi/movete-facil-staging.openapi.json`.
7. Issues [#9](https://github.com/mezas3238-hue/Qore-mobile-/issues/9), [#11](https://github.com/mezas3238-hue/Qore-mobile-/issues/11), PR [#7](https://github.com/mezas3238-hue/Qore-mobile-/pull/7) y [#8](https://github.com/mezas3238-hue/Qore-mobile-/pull/8), antes de cualquier código.

Todos los docs anteriores se conservan, no borrarlos ni sobrescribirlos: allí están los ensayos, errores y análisis de cada corte R1–R62.

---

## 04. HISTORIAL IMPLEMENTADO — LEGADO B01–B31 Y PRIMEROS R1–R33

### 04.1 Fundamentos Cliente B01–B31
- **Expo independiente**: `apps/movete-cliente/app/_layout.tsx`; pantallas `index.tsx`, `viaje.tsx`, `envios.tsx`, `seguimiento.tsx`, `historial.tsx`, `comercios.tsx`, `cotizacion.tsx`, `pagos.tsx`, `soporte.tsx`, `cuenta.tsx`, `mensajes.tsx` y `conversaciones.tsx`.
- **Runtime y sesión**: `src/ClientRuntime.tsx`, `src/ClientUI.tsx`, `domain/client-experience.mjs/.d.mts` y `client-session.mjs`. JWT Passenger exclusivo, revisión `privateViewRevision`, sesiones en memoria, limpieza al logout/cambio/rotación, protección contra respuestas tardías; sin IdP real por defecto.
- **Pasarela y red**: `client-gateway.mjs`, `bounded-http-response.mjs`, `response-bytes.mjs`, gateways específicos: pin HTTPS, `AbortController`, plazos, tamaño UTF-8, no redirects, JSON/DTO estricto, sin leaks de bearer. Todas las conexiones productivas en default OFF.
- **Viajes AUTO**: `client-route-editor.mjs`, `client-request-preparation.mjs`, `client-mutations.mjs`, `safe-auto-ui-harness.mjs`; borrador local, validación, requestKey UUID, idempotencia, distinción preparación/envío/respuesta. El Cliente NO inventa tarifa, ETA, disponibilidad, conductor ni comprobante.
- **Tarifa en Gs**: `quote-view.mjs`, `fare-quote-gateway.mjs`, `fare-quote-flow.mjs`, pantalla `cotizacion.tsx`; precio versionado/TTL sujeto al servidor y permisos; no aplicar tarifa de otro actor.
- **Estado/GPS/cancelación**: `rider-status.mjs`, `ride-status-gateway.mjs`, `rider-polling.mjs`, `ride-cancellation.mjs`, `secure-cancel-key.mjs`, `seguimiento.tsx`; lectura de viaje propio, limpieza GPS antiguo, cancelación consentida con clave inmutable y reevaluación del GET autoritativo.
- **Envíos AUTO/MOTO de carga**: `delivery-form.mjs`, `safe-delivery-ui-harness.mjs`, `envios.tsx`; categorías legales, peso/dimensiones, restricciones, diferencia vehículo; sin MOTO pasajeros.
- **Historial ilimitado total**: `history-feed.mjs`, `client-history-gateway.mjs`, `history-auto-page.mjs`, `historial.tsx`; paginación por cursor, lectura own-user, expiración, ventana local RAM, sin tope global 50.
- **Comercios**: `commerce-draft.mjs`, `commerce-catalog-flow.mjs`, `commerce-catalog-pages.mjs`, `catalog-branch-lookup.mjs`, `g44-branch-directory.mjs`, `g44-buyer-contract.mjs`, `g44-buyer-http-gateway.mjs`, `g45-order-qa-contract.mjs`, `comercios.tsx`. Catálogo/sucursal versionados, stock mostrado como reportado, carrito privado, protección TTL, sustituciones, validación precio y checkout **NO activado**.
- **Soporte/seguridad**: `support-draft.mjs`, `support-draft-session.mjs`, `incident-g40-gateway.mjs`, `incident-report-flow.mjs`, `client-incident-intent.mjs` y `soporte.tsx`; reportes/incidentes QA, anti-replay, borrador privado, sin afirmar agente/SOS real.
- **Chat**: `passenger-chat-flow.mjs`, `passenger-chat-inbox.mjs`, `passenger-chat-navigation.mjs`, `passenger-chat-push-hint.mjs`, G51/G52/G53/G55 gateways, `mensajes.tsx` y `conversaciones.tsx`. Solo Driver asignado, mensajes mínimos, idempotencia, ACK ambiguo no duplicar, revocación, cursores/paginación, sin compartir teléfono por defecto.
- **Accesibilidad**: `accessibility-policy.mjs`, controles habilitado/deshabilitado, mensajes TalkBack, modo simple, validación de paneles privados.

### 04.2 Fundamentos Admin B01–B31
- `apps/movete-admin/src/AdminRuntime.tsx`, `admin-experience.mjs/.d.mts`, `admin-session.mjs`, `admin-access.mjs`, `main.tsx`, `styles.css`. Admin Web aislado, roles RBAC/MFA contractual, acceso negado sin proveedor autorizado.
- **KYC**: `kyc-queue.mjs`, `kyc-page-view.mjs`, `review-draft.mjs`; lectura de cola/estado y borradores de revisión. Documentación sensible solo en DB/storage privados de A, no embebida en app.
- **Auditoría/zonas/comisiones**: `audit-feed.mjs`, `zone-overview.mjs`, `owner-finance.mjs`; diferencia cobertura/disponibilidad, permisos y ledger desde servidor, no cobros simulados como hechos.
- **Incidentes/soporte**: `incident-g41-gateway.mjs`, `incident-g41-flow.mjs`, `incident-page-triage.mjs`, `incidents-overview.mjs`, `merchant-case-page.mjs`, `merchant-case-query-flow.mjs`.
- **Red paginada segura**: `admin-read-gateway.mjs`, `bounded-json-response.mjs`, `page-cursor.mjs`, no exponer PII, límite de memoria por página, no limitar cantidad global de registros, cortes por actor/rol y TTL.

### 04.3 Etapas R1–R33 — principales entregas documentadas
- **R1–R5 (primeros cortes B, G44/G45)**: continuidad Cliente/Admin, directorio de sucursales por municipio y tipo de entrega, adaptador HTTP autorizado solo QA, contratos de catálogo/comercio y seguridad en catálogo/paginación. Consultar [maestro R13](./HANDOFF_MAESTRO_ARQUITECTO_B_R1_R13_TOTAL_Y_CONTINUIDAD_2026-10-23.md), [R4](./CONTINUIDAD_B_R4_G44_BUYER_BRANCHES_2026-10-23.md) y [R5](./CONTINUIDAD_B_R5_G44_HTTP_G45_QA_2026-10-23.md).
- **R6** mensajería Cliente↔Driver/repartidor según servicio activo y elegibilidad, [detalle](./CHAT_CLIENTE_DRIVER_DELIVERY_R6_2026-10-23.md).
- **R7–R9** separación de conversaciones/seguridad de reconexión, avisos push privados/revocación y ACK interoperable. Docs `CONTINUIDAD_B_R8_CHAT_PUSH_REVOCACION...`, `R9_CHAT_ACK_INTEROP...`.
- **R10–R13** bandeja de conversaciones, orden/contadores, enlace propio y pin de `conversationId`; evitar abrir hilos de otra asignación.
- **R14–R17** TTL, cursor/frescura, reasignación, JWT girado, revisión de ACK/cursores y defensa contra estados de lectura obsoletos.
- **R18–R20** privacidad en listas e identidad, paginación que no filtra cuerpos a la bandeja.
- **R21–R22** metadatos privados y orden estable de chat, sin correlaciones falsas.
- **R23–R24** borradores locales ligados a conversación asignada, recuperación de mensaje pendiente sin reenvío inseguro.
- **R25–R27** G51 inbox por HTTPS de STAGING opt-in, defensas de certificados/HTTP/paginación.
- **R28–R30** G52 historial de mensajes read-only con pin HTTPS, actor/revisión y TTL.
- **R31–R33** G53 POST mensaje idempotente, G51 recepción sin ACK falso, G54 revocación cruzada al cambiar asignación. Todas fueron **QA**; no convierten chat en servicio físico.
- Los detalles exactos de cada commit/test/documento están en el [handoff R1–R33](./HANDOFF_MAESTRO_INTEGRAL_B_R1_R33_G55_CONTINUIDAD_AUTONOMA_2026-10-24.md) y anexos. No inferir que los códigos R1–R33 representen versiones publicadas.

---

## 05. HISTORIAL R34–R50 — AVANCES DE UI, COMERCIOS, CHAT Y ADMIN

| Etapa | Qué quedó implementado y/o corregido | Documento de evidencia |
|---|---|---|
| **R34** | G55 marcador de lectura y referencia a movilidad; sin ACK automático ni mensaje leído sin contrato. | [R34](./CONTINUIDAD_B_R34_G55_MARKER_Y_REFERENCIA_MOVILIDAD_2026-10-24.md) |
| **R35** | Editor QA de rutas y paradas, validaciones; sin cálculo real de rutas/ETA. | [R35](./CONTINUIDAD_B_R35_EDITOR_RUTA_PARADAS_QA_2026-10-24.md) |
| **R36** | Modo simple y accesibilidad del Cliente. | [R36](./CONTINUIDAD_B_R36_MODO_SIMPLE_ACCESIBLE_2026-10-24.md) |
| **R37** | Referencia funcional de tienda multirrubro y pedidos; diseño independiente. | [R37](./CONTINUIDAD_B_R37_TIENDA_MULTIRRUBRO_PEDIDOS_REFERENCIA_2026-10-24.md) |
| **R38** | Revisión local certificada del carrito sin inventar checkout. | [R38](./CONTINUIDAD_B_R38_REVISION_CARRITO_CERTIFICADA_LOCAL_2026-10-24.md) |
| **R39** | Preferencias de sustituciones del comprador, sin modificar stock de servidor. | [R39](./CONTINUIDAD_B_R39_PREFERENCIAS_SUSTITUCIONES_2026-10-24.md) |
| **R40** | Ayuda y flujo de pedidos comerciales. | [R40](./CONTINUIDAD_B_R40_ASISTENCIA_PEDIDOS_COMERCIALES_2026-10-24.md) |
| **R41** | Estados/TTL de incidentes G40 QA y frescura de respuestas. | [R41](./CONTINUIDAD_B_R41_ESTADOS_INCIDENTES_QA_FRESHNESS_2026-10-24.md) |
| **R42** | Preferencia de contacto a comercios y soporte bajo autorización separada. | [R42](./CONTINUIDAD_B_R42_PREFERENCIA_CONTACTO_COMERCIOS_SOPORTE_2026-10-24.md) |
| **R43** | Bandeja de casos comerciales para Admin, alcance por permisos. | [R43](./CONTINUIDAD_B_R43_BANDEJA_CASOS_COMERCIALES_ADMIN_2026-10-24.md) |
| **R44** | Coordinador de consultas a casos comerciales en QA. | [R44](./CONTINUIDAD_B_R44_COORDINADOR_CONSULTA_CASOS_COMERCIALES_QA_2026-10-24.md) |
| **R45** | Navegación y accesibilidad de Admin Web. | [R45](./CONTINUIDAD_B_R45_ACCESIBILIDAD_NAVEGACION_ADMIN_WEB_2026-10-24.md) |
| **R46** | Barreras a lecturas de comercios caducadas/de otra sesión. | [R46](./CONTINUIDAD_B_R46_FENCE_LECTURAS_COMERCIOS_QA_2026-10-24.md) |
| **R47** | TTL del catálogo y presentación local tras vencimiento. | [R47](./CONTINUIDAD_B_R47_CADUCIDAD_CATALOGO_UI_2026-10-24.md) |
| **R48** | TTL de directorio de sucursales G44 y protección de acciones caducadas. | [R48](./CONTINUIDAD_B_R48_TTL_DIRECTORIO_SUCURSALES_G44_2026-10-24.md) |
| **R49** | Guardas del carrito local de comercios ante cambios de datos/actor. | [R49](./CONTINUIDAD_B_R49_GUARDAS_CARRITO_LOCAL_COMERCIOS_2026-10-24.md) |
| **R50** | Validación de selección de sucursal y ruta, tipos canónicos; no confundir directorio con comercio habilitado. | [R50](./CONTINUIDAD_B_R50_VALIDACION_SELECCION_SUCURSALES_2026-10-24.md) |

El [maestro R43](./HANDOFF_MAESTRO_INTEGRAL_B_R1_R43_CONTINUIDAD_AUTONOMA_2026-10-24.md) detalla el histórico previo. Cada archivo `CONTINUIDAD_B_Rxx_...` aporta contexto de pruebas y problemas corregidos.

---

## 06. HISTORIAL DETALLADO R51–R62 — ÚLTIMOS CAMBIOS DE ESTE CHAT

Estos 12 cortes añadieron **147 pruebas nuevas según documentación por etapa**; cifra de casos nuevos, no equivalencia de certificación funcional, sin reemplazar la suma real del CI de HEAD. En la ejecución se corrigieron regresiones de fixtures, sintaxis y tipos antes de cerrar commits; NO copiar errores antiguos si el HEAD ya está verde.

### R51 — Accesibilidad en catálogo de comercios
- `commerce-accessible-summary.mjs/.d.mts/.test.mjs`, 12 tests.
- `app/comercios.tsx`: resumen accesible, precio Gs y stock reportado; no pago ni reserva de inventario; sin PII reflejada.
- Commit con CI 3/3: `9bb802432e6016d328a3342292a6953712e25506`.
- [Documento R51](./CONTINUIDAD_B_R51_ACCESIBILIDAD_COMERCIOS_QA_2026-10-24.md).

### R52 — No editar un envío mientras mutación pendiente o incierta
- `delivery-draft-ui-policy.mjs/.d.mts/.test.mjs`, 10 tests.
- `app/envios.tsx`: bloquear formularios durante `ready/in_flight/retryable/acknowledged/failed` u operación ajena; solo descartar draft preparado propio antes de enviar.
- Commit `572a973fb114cc23f0ee40070d57a0759ba3e35d`, 3/3 SUCCESS.
- [Documento R52](./CONTINUIDAD_B_R52_EDICION_SEGURA_ENVIOS_ACCESIBLE_2026-10-24.md).

### R53 — Formulario viaje: política de bloqueo y paradas
- `ride-draft-ui-policy.mjs/.d.mts/.test.mjs`, 12 tests.
- `app/viaje.tsx`: origen, destino, vehículo protegidos con regla fail-closed; paradas adicionales sin contrato server quedan no enviables.
- Commit `63e4f63dc1f9dea6ac41a71905d6269bba71767f`, 3/3 SUCCESS.
- [Documento R53](./CONTINUIDAD_B_R53_BORRADOR_VIAJE_BLOQUEO_EDICION_2026-10-24.md).

### R54 — Seguimiento y cancelación: sesión y estado actual
- `tracking-cancellation-ui-guard.mjs/.d.mts/.test.mjs`, 12 tests.
- `app/seguimiento.tsx`: comparar `client.snapshot()` justo al pulsar preparar/enviar/reintentar; misma cuenta/JWT/estado/revisión y `requestKey`; no confirmar reembolso con botón. El test-helper `undefined` fue corregido sin aflojar guard.
- Commit certificado `7d6f2e4cee6d3494524d999191210ac30ef3d4bb`, 3/3 SUCCESS.
- [Documento R54](./CONTINUIDAD_B_R54_CANCELACION_SEGUIMIENTO_ESTADO_VIGENTE_2026-10-24.md).

### R55 — Composición chat Cliente G51/G52/G53 por STAGING HTTPS
- `passenger-chat-staging-composition.mjs/.d.mts/.test.mjs`, 12 tests.
- Composición opt-in único origen HTTPS, verificación independiente Passenger, bandeja/historial/envío y ACK persistido sintético; default OFF.
- Fijo UUID canónico cinco grupos; primer corte falló tests antes de corregirlo. Commit final `77006f69e5d93f959b0c9cb775d937c6fdb8d4a9`: Cliente/Admin/ownership verdes pero aislamiento integrado falló por un TS del Driver A contemporáneo; se comunicó. A lo reparó posteriormente; NO atribuir R55 individual 3/3 falsamente.
- [Documento R55](./CONTINUIDAD_B_R55_COMPOSICION_STAGING_HTTPS_CHAT_CLIENTE_G61_2026-10-24.md).

### R56 — Envíos y viajes: POST STAGING con recibo QA estricto
- `passenger-booking-staging-gateway.mjs/.d.mts/.test.mjs`; 15 tests.
- `client-experience.mjs/.d.mts`: `bookingHttpOptions` opt-in.
- `client-mutations.mjs`: `expectedSubject` obligatorio antes de POST junto con revisión Passenger/clave, nunca convertir HTTP 201 genérico en viaje o envío registrado. Se corrigió fallo adversarial de titularidad sin cambiar roles.
- Commit final `5101bfe4046d9d7892cffe0e7a1b3959596d4c15`, 3/3 SUCCESS.
- DTO QA B candidato aún **NO certificado por servidor A**; no activar default.
- [Documento R56](./CONTINUIDAD_B_R56_CIRCUITO_BOOKING_HTTPS_STAGING_RECIBOS_2026-10-24.md).

### R57 — No duplicar POST después de resultado desconocido
- 8 tests en gateway de booking. `client-mutations.mjs`: para viaje/envío de booking opt-in, timeout, 409 o ACK incierto pasan a `failed` bloqueado; `retry()` no repite POST ni crea nueva key.
- `reconcileBooking()` solo lectura, usando callback `reconciliationRead` y certificación independiente OFF; no inventar URL. ACK QA válido puede reconciliar original, 404 no implica «nunca existió».
- Commit `3d148b90eddb889844f5fbba00b9b0671e2fbb02`, 3/3 SUCCESS.
- [Documento R57](./CONTINUIDAD_B_R57_RECONCILIACION_RESERVAS_POST_INCIERTO_2026-10-24.md).

### R58 — UX transparente de reserva incierta en Viajes/Envíos
- `booking-recovery-ui.mjs/.d.mts/.test.mjs`, `src/BookingRecoveryPanel.tsx`, 12 tests de proyector + 3 integrados = 15.
- Panel «estado de solicitud anterior», botón **solo si** GET reconcile certificado y misma cuenta/revisión/key; nunca reenviar POST. Corregidas coma de objeto y helper default de test.
- Commit `694374dedcff90b6c5ed725233276b6ad6fd0d36`: Cliente/Admin/ownership PASS; aislamiento integrado falló por 7 tests Driver G63 de A. **A resolvió G63 en `c12c3daa5844c19cc76da2d4d569a056f5d1b4f5`**; validación conjunta PASS en R59.
- [Documento R58](./CONTINUIDAD_B_R58_ESTADO_RESERVA_INCIERTA_Y_CONSULTA_QA_2026-10-24.md).

### R59 — Saneamiento de respuestas y desbloqueo Driver G63
- `client-mutations.mjs`: códigos de error desconocidos, PII, HTML, JWT o texto malicioso se traducen a códigos de protocolo seguros antes de snapshot; mutación incierta permanece bloqueada. 5 tests.
- `docs/architect-b/CONTINUIDAD_B_R59_...`: matriz de dependencias y evidencias.
- Commit `a631eb8444370f1fafaf8773778ac40505c60f18`, 3/3 SUCCESS; confirma reparación de integración con G63.
- [Documento R59](./CONTINUIDAD_B_R59_SANEAMIENTO_ERRORES_Y_MATRIZ_BLOQUEOS_2026-10-24.md).

### R60 — Matriz íntegra de certificación sin ambigüedad
- `apps/movete-admin/src/release-certification.mjs/.test.mjs`: 17 pruebas de integridad, evita autocertificar sin pruebas, rechaza CI web como ensayo Android/iOS, exige source A y auditor externo. **No emite GO**.
- `CERTIFICACION_INTEGRAL_R60_MATRIZ_VERIFICABLE_2026-10-24.json`: 17 requisitos P0 y 20 circuitos funcionales, estado oficial NO_GO; snapshot [FUENTE_A_G61](./FUENTE_A_G61_CERTIFICACION_PINNED_2026-10-24.json), NO sustituye HEAD vivo de A.
- Primer corte falló test por archivo A ausente en la rama B; se creó copia pinneada. Commit final `769f77888a19f89fdb9de143f863500ed7d7752e`, 3/3 SUCCESS.
- [Acta R60](./HANDOFF_R60_CERTIFICACION_TOTAL_SIN_AMBIGUEDADES_2026-10-24.md).

### R61 — Cliente status G11 vs Driver G65
- `ride-status-gateway.mjs`: `state` Passenger debe corresponder exactamente a `event.status` y `event.serverRevision===revision`. Prohíbe GPS/historial anidado sin asignación y consentimiento.
- `rider-polling.mjs`: error HTTP saneado, revisión de servidor antigua NO refresca reloj, purga GPS/ETA. Tests 4+3+6 = 13, más actualización de un test previo.
- `r61-passenger-g65-lifecycle-contract.test.mjs`: búsqueda→asignado→llegada→inicia→completa, cancelación, actor cruzado, secuencia inválida, sin GPS ficticio.
- Commit `9892f3b3fe15e2489affb5e14c9c4172d2e78db3`, 3/3 SUCCESS.
- [Documento R61](./CONTINUIDAD_B_R61_CONTRATO_LIFECYCLE_CLIENTE_G65_2026-10-24.md).

### R62 — Cliente remitente y custodia de envíos G66
- `sender-custody-flow.mjs/.d.mts/.test.mjs`: 13 tests; **sender GET separado de courier GET Driver**; estados `requested/accepted/picked_up/delivered/disputed/returned/cancelled`, proofVerified únicamente del servidor, consentimiento/rol/TTL, no PII ni GPS ni `proofRef`. OFF por defecto.
- `client-experience.mjs/.d.mts`: `senderCustodyOptions`, `readOwnDeliveryCustody`, solo servicio tipo DELIVERY **existente en historial propio válido**, JWT Passenger y revisión actual; logout purga.
- `app/historial.tsx`: botón de consulta de custodia solo bajo autorización; nunca «Entregado comercial» por un fixture QA.
- 3 tests integrados adicionales: **16 tests** de R62. Commit último corte de código `19149c7ca3ebeec4f3fe807778a715e0d15b867f`, **3/3 SUCCESS**.
- [Documento R62](./CONTINUIDAD_B_R62_ESTADO_ENVIO_Y_PRUEBA_CUSTODIA_G66_2026-10-24.md).

### Registro de errores importantes corregidos (no reincidir)
- **G63 Driver** 7 tests ofrecían `uncertain` en lugar de `confirmed` en A: A corrigió y R59 integró, no copiar parche B en archivos A.
- **TS Driver G60/G61** (`DriverApplicationProviders.tsx`) por firma `serviceKind:string` vs unión de literales: asunto A; corregido en sucesivos cortes, confirmar HEAD actual.
- **Helpers con argumentos default en tests R54/R58:** un `undefined` explícito se sustituía por snapshot válido; probar función real directamente.
- **R55 UUID regexp** necesitaba 5 grupos, no 4; test error resuelto.
- **R56 autorización** necesitaba `expectedSubject` Passenger ANTES de HTTP; test directo de cross-account.
- **R57 retry** en reserva no puede ser POST ciego tras ACK perdido; esperar GET por key certificado.
- **R58 coma JSX/objeto** en `client-experience`; corregido antes de último PASS.
- **R60 espejo G61**: usar snapshot pinneado de A, pero revalidar fuente viva antes de GO.
- **R61 estado/evento/revisión**: no aceptar estado `assigned` y evento `completed` del mismo POST.
- **R62 proofRef**: un UUID aportado por móvil NO es comprobante independiente; nunca mostrar `delivered` como verificado desde dato no autorizado.

---

## 07. ESTADO TÉCNICO DE A Y CONTRATOS QUE FALTAN PARA USO REAL

**A G65**: ciclo AUTO Driver privado `accepted→arrive→arriving→pickup→in_progress→complete→completed` con lecturas GET privadas Driver, POST eventos idempotentes y protección de COMMIT incierto, Node synthetic + CI. No está habilitado por defecto ni montado en HTTPS público. `runtime=null` sin aprobación.
**A G66**: custodia AUTO/MOTO, pickup/deliver/return, status Driver privado y proof verificada por autoridad independiente sintética, en rama A `4232ff32...`. Sin servicio real de almacenamiento cifrado/retención de comprobantes; G67 siguiente alcance de A.
**B Cliente R61/R62**: DTO Passenger G11 y DTO futuro propio de remitente, nunca utilizar endpoints privados de Driver. Seguimiento y custodia son **consumidores con gates OFF**.
**A G61**: 17 requisitos P0, NO_GO, 15 blocked y 2 qa-only: PostgreSQL16 disposable y chat transporte QA. El último archivo real no cambia estado por aparecer más commits sin auditoría.

**Contratos exigidos a A en issue #9**:
1. IdP real con Auth Passenger/Driver/Admin, sesiones/JWKS, roles exclusivos, revocación, TTL y pruebas de denegación server-side.
2. DNS y endpoint HTTPS **STAGING móvil aprobado por Owner**, certificado TLS, orígenes fijados, sin `localhost`, credenciales fuera Git y separación dev/staging/prod.
3. PostgreSQL duradero con migraciones, RLS owner scopes, backup/restore y pruebas concurrentes en la MISMA fila.
4. OpenAPI tipado de `POST /v1/staging/rider/trips/request` y `POST /v1/staging/sender/deliveries/request`: ACK con `requestKey`, dueño, serviceId, revision persistida; GET de **reconciliación por requestKey y JWT dueño**. Un 201 genérico no permite desbloquear nuevo POST.
5. Despacho Driver atómico: oferta elegible, rechazo/aceptación única, eventos G65 de inicio/finalización y **GET Passenger own-trip** coherente con los eventos reales en DB.
6. GET de **custodia para SENDER/Passenger propio** diferente del GET privado de courier G66, con `sender_id=JWT.subject` desde SQL y `proofVerified` comprobado independientemente por G67; nunca enviar `proofRef` o teléfono a Cliente.
7. Chat G51/G52/G53/G55 autenticado entre **dos usuarios asignados al mismo servicio**, entrega/postcommit/lectura/Push, secuencia monotónica y revocación de acceso al reasignar.
8. Comercios, reservas de stock, precios reales Gs, caja/PSP, conciliaciones y pedidos; Admin KYC/auditoría/soporte, SOS y control de zonas.
9. Evidencia de **E2E entre dos dispositivos con datos sintéticos**, permisos, recuperación de red, GPS/ETA consentidos, alertas/logging no sensibles; builds firmados y soporte real bajo política.
10. Cuadrar y versionar contratos con hashes: no activar `contractCertified` ni `stagingRuntimeVerified` en B solo porque aparecen en un documento.

**Solo Owner decide** proveedor, recursos de infraestructura, PSP, dinero y autorización de despliegue. Mientras no estén aprobados, no crear gastos, no desplegar ni inventar datos reales.

---

## 08. LOS 17 REQUISITOS P0 SIN CERTIFICACIÓN COMERCIAL

**Fuente:** `docs/architecture/MOVETE_FACIL_LAUNCH_GATES_2026-10-24.json`, HEAD A observado G66. **Mantener nombres exactos.**

| Nº | Gate fuente | Responsable fuente | Estado al corte | Evidencia crítica pendiente |
|---:|---|---|---|---|
| 01 | `IDP_BACKEND_AUTH` | A | BLOCKED | IdP/JWKS, JWT roles verificados/revocación |
| 02 | `HTTPS_BACKEND` | A | BLOCKED | HTTPS real desde dispositivos autorizados |
| 03 | `POSTGRES_PERSISTENCE` | A | QA_ONLY | DB remota duradera, backup y restore |
| 04 | `DRIVER_ONBOARDING` | A | BLOCKED | Alta/login/KYC/documentos Driver reales |
| 05 | `DRIVER_LIVE_TRIPS` | A | BLOCKED | Despacho y viaje completo en móviles |
| 06 | `CLIENT_LIVE_BOOKINGS` | B | BLOCKED | Booking y conciliación reales Cliente |
| 07 | `PAYMENT_SETTLEMENT` | A/B | BLOCKED | PSP, ledger, cobro/retorno/settlement |
| 08 | `PRIVACY_KYC` | A/B | BLOCKED | permisos, cifrado, retención y auditoría |
| 09 | `EMERGENCY_SAFETY` | A/B | BLOCKED | SOS con operador/protocolo ensayado |
| 10 | `MAPS_GPS_DEVICE` | A/B | BLOCKED | GPS/timing/permisos físicos Android/iOS |
| 11 | `DELIVERY_MERCHANTS` | A/B | BLOCKED | stock/pedidos/custodia/envío E2E |
| 12 | `CHAT_PHYSICAL` | A/B | QA_ONLY | mensajes + push reales en dos teléfonos |
| 13 | `ADMIN_OPERATIONS` | B | BLOCKED | Admin HTTPS/RBAC y operaciones aceptadas |
| 14 | `NATIVE_RELEASES` | A/B | BLOCKED | APK/AAB/IPA firmados y aprobados |
| 15 | `LEGAL_COMPLIANCE` | Owner | BLOCKED | normas, seguros, permisos Paraguay |
| 16 | `OPS_24_7_MONITORING` | Owner/A/B | BLOCKED | soporte/alertas/guardias/rollback |
| 17 | `PROD_GO_NOGO` | Owner | BLOCKED | acta explícita GO tras 16 previos |

**REGLA:** ningún gate pasa a CERTIFIED con solo tests sintéticos, copias de archivos o cambios de booleano. R60 `release-certification.mjs` valida metadatos de evidencia; la **autenticidad** necesita auditor externo de logs/actas/dispositivos y decisión Owner. El JSON B de R60 tiene snapshot de A y puede envejecer: releer HEAD A.

---

## 09. LOS 20 RECORRIDOS FUNCIONALES R60 A TERMINAR Y CERTIFICAR

| Recorrido | Criterio principal para cierre end-to-end |
|---|---|
| `AUTH_PASSENGER` | Login propio, revocación, roles, restauración en móvil, logout efectivo |
| `AUTH_DRIVER_KYC` | Alta conductor, documentos privados, revisión Admin, aprobación/rechazo |
| `FARE_QUOTE_GS` | Precio/tarifa efectiva Gs, tiempo y ruta exacta, categoría y caducidad |
| `AUTO_BOOKING` | Una petición idempotente, recibo persistido y GET reconcile después de timeout |
| `DRIVER_DISPATCH` | Ofertas atómicas, elegibilidad, un solo conductor asignado |
| `GPS_TRACKING` | GPS real consentido, offline, anti-spoof, revocación y ETA |
| `TRIP_COMPLETION_CANCELLATION` | Llegada, inicio, fin/cancelación, costo, historial, idempotencia |
| `MOTO_CARGO_DELIVERY` | Carga moto, aceptación courier, pickup, entrega con prueba |
| `AUTO_CARGO_DELIVERY` | Carga auto, aceptación, custodia, prueba/estado e incidencias |
| `SUPERMARKET_ORDER` | catálogo, stock transaccional, pedido, sustitución, despacho y cobro |
| `PHARMACY_OTC_ORDER` | catálogo permitido OTC y evidencia legal/entrega |
| `RESTAURANT_ORDER` | acepta/prepara/envía/entrega/reembolsa sin duplicación |
| `CUSTOMER_DRIVER_CHAT` | mismo servicio asignado, entrega real, lectura/push, privacidad |
| `PAYMENTS_REFUNDS` | PSP transaccional, charge/capture/refund/ledger exactos |
| `COMMISSIONS_PAYOUTS` | políticas Gs, comisiones autos/motos/comercios, liquidaciones conciliadas |
| `ADMIN_KYC_ZONES` | permisos mínimos, expedientes, zonas, disponibilidad y auditoría |
| `EMERGENCY_RESPONSE` | SOS físico, recepción y actuación del operador, tiempos |
| `DATA_PRIVACY` | cifrado, retención, supresión, logs sin PII, acceso por roles |
| `SIGNED_NATIVE_RELEASES` | apps independientes instaladas y firmadas Android/iOS |
| `ZONE_ACTIVATION_SUPPORT` | zonas habilitadas, soporte, telemetría, rollback y Owner GO |

Los 20 figuran hoy `BLOCKED` en el inventario R60 por ausencia de evidencia completa. Ello **NO** significa que no haya código QA de alguno. Todos tienen criterios `requiredGates` y `requiredEvidence` detallados en [JSON R60](./CERTIFICACION_INTEGRAL_R60_MATRIZ_VERIFICABLE_2026-10-24.json).

---

## 10. ROADMAP EJECUTABLE R63→LANZAMIENTO — ORDEN POR DEPENDENCIA, NO POR ESTÉTICA

### R63 P0, PRÓXIMA TAREA DIRECTA DE B
1. **Leer HEAD A más reciente**; comprobar si G67 agregó registro privado de pruebas, GET sender-owner o contratos OpenAPI. Si existen, extraer esquema y hash exacto; si no, dejar constancia de dependencia y continuar trabajo B desbloqueado.
2. **Integración sender custody Cliente R62**: asegurar vista de historial con estado propio GET real **solo cuando** A provea y certifique contrato+HTTPS; validar `ownerId`, `deliveryId`, revisión monotónica, pruebas registradas y revocación sin pantalla falsa.
3. **Refuerzo de sujeción al historial propio**: al caducar página o al rotar JWT, ocultar custodia previamente validada; rechazar estado más viejo y corrida de lectura concurrente. Agregar tests adversariales de cambio de cuenta, TTL y entrega cruzada; reutilizar `sender-custody-flow.mjs` y `ClientExperience`, no duplicar módulos.
4. **Cerrar Admin Web R63 si sender GET no existe**: revisar `merchant-case-query-flow` y KYC/Admin para robustecer estado incierto, RBAC, auditoría y firma de resultado; contrato OFF si falta A. Elegir la mejora más P0 que dependa solo de archivos B.
5. Escribir código+tpo+test+doc, commit y **3 workflows SUCCESS del MISMO SHA**, comentar issue #11. No terminar el turno en recomendaciones sin código si hay trabajo B autónomo realizable.

### Fase 2 P0 — Autenticación, booking y Auto E2E
- A entrega IdP/JWKS/HTTPS/SQL/receipt GET reconcile. B cablea `passenger-booking-staging-gateway.mjs`, `client-experience.mjs`, `booking-recovery-ui.mjs` y UI real de viaje.
- Verificar en DB transacción POST una sola vez; POST que COMMIT pero pierde ACK se recupera con GET por misma key, sin segundo POST, con actor y revisión correctos.
- A/Driver G65: oferta única→aceptar→llegada→inicio→fin. B GET Passenger G11 registra estados/revisión, jamás GPS ficticio; cobro y seguridad solo en caso de certificación A.
- Test E2E sintético en HTTPS STAGING compartido + dos dispositivos autorizados, pruebas roles ajenos/duplicados, asignación doble y reconnect.

### Fase 3 P0 — Envíos y comercios completos
- Driver G66/G67 almacena prueba independiente en Storage privado y verifica firma; B lee custodia propia sin `proofRef` privado.
- Supermercados: alta comercio, catálogo/stock, sustituciones y checkout con stock reservado SQL, repartidor, cobro/reembolso.
- Farmacia OTC y restaurante: permisos/normativa, estados de preparación/entrega, custodia y evidencia.
- Mensajería vinculada a asignación, push y unread/ACK read con prueba física; sin compartir teléfono.
- Documentación conductores, KYC y comisiones/PSP en Admin con permisos; sin sobreprometer pagos.

### Fase 4 P0 — Lanzamiento y certificación completa
- Dispositivos Android/iOS: permisos, GPS, cámara KYC/proof, notificaciones push, background/foreground, accesibilidad, batería, desconexión y almacenamiento.
- Auditoría seguridad (JWT, ACL/RLS, fuga PII, rate limiting, antifraude, revocación), backups/recovery, SSRF/respuestas HTTP acotadas y anti doble cargo.
- PSP/ledger de PYG, conciliación y reglas de comisiones aprobadas; seguro/normas/contratos Paraguay y soporte SOS/operadores.
- Pruebas nativas firmadas AAB/IPA y ensayos supervisados de todos los circuitos, evidencias independientes por gate; Owner revisa riesgos/costos y emite GO separado; solo después aprobar merge, deploy y Lovable UI definitiva.

---

## 11. PLAN PARA CONTINUAR SIN DETENERSE (EL PRÓXIMO CHAT)

**Bucle autónomo obligatorio:**
1. `get_pr_info(7,8)`; consultar últimas Actions por HEAD exacto. Si hay **FAIL** en B, reparar B antes de sumar cambios; si hay FAIL en A, documentar log/archivo concreto en issue #9, seguir área B.
2. Abrir este handoff + anexo, R62, R60, G66/G67 de A y OpenAPI. Identificar el **P0 desbloqueado más cercano a un circuito funcional completo**, no micro-UX.
3. Implementar en **B-only** con guardas estrictas, tipos y pruebas negativas (cross-role/cross-account, ACK incierto, timeout, expiración, edición concurrente, privacidad). Usar datos sintéticos y flags OFF hasta contrato firmado.
4. Cometer en rama B DRAFT con SHA verificable; leer Actions 3/3 del mismo SHA y jobs si falla; corregir, nunca declarar éxito anticipado.
5. Publicar documentación compacta de corrección, cobertura y pendientes; comentar issue #11 y en #9 lo que debe implementar A; empezar siguiente tarea inmediatamente. **NO pedir «¿avanzo?» por cada etapa**.
6. Cuando se detecte un bloqueo **REAL** (falta de autorización de pagos/IdP/host, credenciales o contrato A necesario sin alternativa autónoma), precisar dependencia única y dueño; continuar los otros frentes B. Preguntar Owner solo si la decisión requiere consentimiento/costo/producción no autorizado.
7. Mantener semáforo por función **BLOCKED/QA_ONLY/STAGING_E2E/NATIVE/CERTIFIED**, distinguir código de ejecución real; no afirmar que es «100% terminada» mientras falta un gate obligatorio.
8. No usar mensajes de progreso que sustituyan entrega concreta; cada respuesta al Owner debe ofrecer implementación/commit+pruebas y qué se desbloqueó.

**Comandos/conector GitHub típicos** (usar nombres reales expuestos en herramientas del chat nuevo):
- `get_pr_info({repository_full_name:"mezas3238-hue/Qore-mobile-",pr_number:8})`.
- `fetch_file({repository_full_name, path, ref:"feature/mobility-cliente-admin-parallel-20261022"})`.
- `update_file({repository_full_name, path, sha:<blob SHA actual>, content, branch:"feature/mobility-cliente-admin-parallel-20261022", message})`.
- `create_file({repository_full_name,path,content,branch,message})`.
- `fetch_commit_workflow_runs({repo_full_name,commit_sha:<HEAD exacto>})`; `fetch_workflow_run_jobs` y `fetch_workflow_job_logs` en fallas.
- `list_pr_changed_filenames({repo_full_name,pr_number:8})` para refresh del inventario; el anexo de este handoff conserva el corte previo R62.

**Criterio de bloqueo real**: imposibilidad de continuar una función P0 con seguridad sin contrato/rol/certificado/orden externa; no son bloqueos normales un workflow que tarda, una prueba que falla, ausencia de un fixture o falta de curiosidad. Dejar un ticket preciso y cambiar de tarea B mientras A trabaja.

---

## 12. INSTRUCCIÓN QUE EL OWNER PUEDE PEGAR EN EL NUEVO CHAT

> Sos el siguiente Arquitecto B de **QORE Mobile / Movete Fácil**. Seguí ejecutando el desarrollo de Cliente Expo y Admin Web **desde el Handoff Maestro B01–B31 + R1–R62 de 2026-10-24 y el anexo auditado de 343 archivos**, publicados en `docs/architect-b/` del repo `mezas3238-hue/Qore-mobile-`. Tu rama exclusiva es `feature/mobility-cliente-admin-parallel-20261022` (PR #8 DRAFT, base rama A); A trabaja en PR #7 y solo A edita Driver/backend. **No recomiences ni te detengas salvo bloqueo real.** Primero verificá HEAD de ambos PR y CI, leé R62/G66/G67/issue #9 y ejecutá R63 para acercar Cliente↔Driver/entrega↔Admin a un circuito funcional terminado. Por cada paso: **código, pruebas, commit, CI y corrección**, con trazabilidad. Si depende de API A, coordiná issue #9 y avanzá a otro P0 B. Todos los 17 gates y 20 flujos deben terminar certificados **de verdad**; CI sintético no equivale a uso real. **No merge, LIVE, deploy, VPS, PSP, credenciales, PII ni publicación sin orden explícita Owner.** Dos apps independientes, envíos AUTO/MOTO, pasajero AUTO, comercios, mensajería y tarifas Gs. Lovable solo UI final. Seguí trabajando sin pedir permiso por cada cambio seguro.

---

## 13. CONTROL DE CORTE Y FIRMA DE TRANSFERENCIA

- **Estado antes del handoff:** B R62 `19149c7ca3ebeec4f3fe807778a715e0d15b867f` 3/3 SUCCESS; A G66 `4232ff32a7432a7a8006ebd4dbfb018c9e9ab62f` 4/4 SUCCESS.
- **Anexo publicado:** `9c912bb58663e073c5503e9188603554f45f7598`, [inventario 343 rutas](./ANEXO_INVENTARIO_MAESTRO_B_R1_R62_CORTE_2026-10-24.md). Este maestro actualizará HEAD y CI.
- **Sin merge ni despliegue**; PR #7/#8 abiertos DRAFT; **NO_GO comercial** 17 P0 y 20 flujos sin certificación funcional integral.
- **Objetivo siguiente:** R63 B y cierre E2E de circuitos completos, sin falsas garantías, con autonomía en tareas B.
- **Lectura obligatoria del sucesor:** comprobar los SHAs finales al iniciar nuevo chat; el futuro puede superar este documento por commits de A/B, por eso no tratar este snapshot como HEAD perpetuo.

**FIN DEL HANDOFF MAESTRO R1–R62. CONTINUAR.**

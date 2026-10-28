# QORE MOBILE / MOVETE FÁCIL — HANDOFF MAESTRO EJECUTIVO A+B+C+D
## Corte certificado: 28 OCTUBRE 2026 · G142 · GitHub primero · PRÓXIMO CHAT: EJECUTAR, NO REHACER PLANES

> **ORDEN DIRECTA DEL OWNER.** Terminar las cuatro piezas (Backend A, Cliente B, Driver C, Admin D) y los CINCO servicios en una versión integrada que funcione extremo a extremo. Trabajar PRIMERO y exclusivamente en GitHub; luego, y **solo con una nueva autorización expresa**, preparar Render y Supabase. No más series de tests aislados, handoffs repetidos, PR/commits ornamentales, afirmaciones de "app terminada" sin viaje completo, ni demoras por preguntas ya respondidas. Los commits son soporte de implementación, **no el resultado**. No publicar APK como producto final: futuro Play Store + App Store. **Este documento es un arranque de ejecución y una fuente de continuidad; NO solicitar otro handoff.**

### 0. MANDATO INMEDIATO AL PRÓXIMO ARQUITECTO
- ACTUAR como **arquitecto ejecutivo integrador A+B+C+D**, asumir responsabilidad de cerrar el producto. Buscar el HEAD ACTUAL de la rama integrada antes de editar; esta fecha y SHA son un corte, NO una suposición de inmovilidad.
- No rehacer módulos certificados: continuar sobre el código real existente. Leer los puntos de entrada del §3, abrir el workflow de PostgreSQL y ejecutar el **primer P0 desbloqueable** de §6–§11 inmediatamente.
- Solo trabajar en `mezas3238-hue/Qore-mobile-`, rama `integration/qore-mobile-e2e-four-apps-20261027` para resolver el E2E. Proteger el ref con `expected_sha`, pues otros arquitectos pueden editar en paralelo.
- Mantener **sin merge de PRs originales, sin LIVE, sin deploy, sin cobro, sin permisos legales falsos**. No modificar Render/Supabase, no crear proyectos, no consumir servicios de pago sin orden.
- **Objetivo medible**: Cliente origina una nueva operación, A guarda quote/consent/booking, C recibe y cumple una oferta legal y segura, B ve estados y cierre, D consulta la MISMA operación y el ledger. Repetir para AUTO_RIDE, MOTO_RIDE, DELIVERY_AUTO, DELIVERY_MOTO, COMMERCE. Sin sustitución de trayectos ni uso de fixtures anteriores para simular continuidad.
- Ante una dependencia legal o de proveedor verdaderamente no disponible: señalar `EXTERNAL_BLOCKED` con requisito verificable, **sin bajar gates**; terminar los otros componentes y continuar otro P0. No confundir ingeniería GitHub con viajes comerciales reales.

### 1. IDENTIDAD DEL PROYECTO, REGLAS DEL OWNER
- Marca: **Movete Fácil / QORE Mobile**; Paraguay primero, guaraníes enteros PYG / Gs. Diseño multi-país/municipio/moneda preparado, sin autorizar territorios nuevos.
- Arquitectura: A Backend HTTP + PostgreSQL + proveedores; B App Cliente Expo; C App Driver Expo; D Owner/Admin Web.
- Tipo comercial explícito por elección del cliente:
  1. `AUTO_RIDE`: pasajero en automóvil.
  2. `MOTO_RIDE`: pasajero en moto; **NO** es envío.
  3. `DELIVERY_AUTO`: paquete por automóvil (algunos módulos antiguos usan `AUTO_DELIVERY`, verificar traducción en borde).
  4. `DELIVERY_MOTO`: paquete por motocicleta (algunos módulos usan `MOTO_DELIVERY`).
  5. `COMMERCE`: compras en supermercado, farmacia, restaurante y otros, con fulfillment y repartidor cuando corresponda.
- **NO** cambiar el vehículo solicitado sin consentimiento; evitar contaminación entre permisos MOTO pasajeros y MOTO carga; no inventar cobertura ni tarifas.
- Owner configura comisiones de TODAS las verticales desde D Admin, con independencia por servicio y futuro desglose COMMERCE por rubro/tienda/zona. AUTO_RIDE nominal inicial 15 %; MOTO_RIDE nominal inicial 12 %; **subsidio pasajero fijo del 10 % independiente de la comisión**. Para envíos y comercios 0–30 % configurable según G136, sin inventar un porcentaje fijo por tienda. Cargos históricos inmóviles al cambiar tarifas.
- Experiencia móvil comparable en funciones esenciales a Uber/Bolt, pero la excelencia de infraestructura **debe demostrarse** con fiabilidad, seguridad, accesibilidad y operación real, no proclamarse por analogía.
- Credencial `GEOAPIFY_API_KEY` ya se encuentra en GitHub Secrets según evidencia Owner y G129. No imprimir ni trasladar secretos a browser. Geoapify `drive` no representa permiso municipal para motos ni verificación de seguro.

### 2. CORTE DE GITHUB VERIFICADO A 28/10/2026
- Repo: https://github.com/mezas3238-hue/Qore-mobile-
- Branch único: `integration/qore-mobile-e2e-four-apps-20261027`
- **HEAD integrado exacto**: `55f5db225206646ab9c96006dcd69bb159569c4f`
- Commit: https://github.com/mezas3238-hue/Qore-mobile-/commit/55f5db225206646ab9c96006dcd69bb159569c4f
- **Build A+B+C+D SUCCESS, mismo SHA:** https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40725007253
- **PostgreSQL16 descartable + HTTP + E2E + sql-concurrency SUCCESS, mismo SHA:** https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40725007333
- GitHub CI tiene cientos de verificaciones. Este verde **NO demuestra** soporte real de GPS, autorización legal, MFA externo conectado, PSP, celular físico, publicación Store, producción ni un viaje nuevo con Driver legal aceptando.
- Predecesor útil G138 AUTO Admin trace: `2a99d82f1f022923859dcd87e37bfdf53d967a11`; CI completo SUCCESS (https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40693362831).
- Última mejora G142 MOTO Admin trace de B→A→D, SQL misma reserva y ledger: `55f5db2`; hubo primera corrida fallida por usuario Admin sintético con rol de pasajero, **corregido sin debilitar RBAC**, segunda corrida verde. No reabrir el bug.
- A+B/C/D ramas PR de origen históricas separadas: A PR #7/issue #15, B PR #8/issue #16, C PR #19/issue #17, D PR #20/issue #18; verificar al retomar. **No asumir merges**.
- Documentos históricos: `docs/handoff/HANDOFF_MAESTRO_FINAL_A_B_C_D_GITHUB_PRIMERO_E2E_PENDIENTES_2026-10-28.md`, `docs/handoff/HANDOFF_MAESTRO_FINAL_QORE_MOBILE_ABCD_GITHUB_E2E_2026-10-28.md`, `docs/handoff/G131_INTEGRACION_GITHUB_SIN_RENDER_SUPABASE_2026-10-28.md`. Este handoff **actualiza** la foto hasta G142 y debe prevalecer para continuidad.

### 3. ENTRADAS DIRECTAS AL CÓDIGO (SIN RECONSTRUCCIÓN)
- A servidor / rutas: `apps/mobility-expo/server/g4-loopback-http-transport.mjs`, `g4-staging-runtime.mjs`, `g4-offer-gateway.mjs`, `g4-trip-command-gateway.mjs`.
- A AUTO Cliente→Servidor→PG16→D: `apps/mobility-expo/server/g98-f1-auto-postgres-loopback-e2e-ci.mjs`, `g134-geoapify-auto-route-resolver.mjs`, `g75-f1-admin-audit-gateway.mjs`, `g138-admin-auto-trace-gateway.mjs`.
- A MOTO Cliente→Servidor→PG16→D: `apps/mobility-expo/server/g101-moto-passenger-gateway.mjs`, `g102-moto-passenger-pg-http-ci.mjs`, `g119-moto-status-pg-http-ci.mjs`, `g142-admin-moto-trace-gateway.mjs`.
- A delivery AUTO/MOTO: `apps/mobility-expo/server/g121-delivery-reconcile-pg-http-ci.mjs`, `g128-geoapify-cargo-road-resolver.mjs`; contrato G5/G7/G10/G66/G67/G68/G121/G122/G123/G124/G125/G126.
- A comercios: `apps/mobility-expo/server/g139-commerce-buyer-pg-http-ci.mjs`, `g139-commerce-qa-http-bridge.mjs`, `g45-buyer-order-reservation-qa.mjs`.
- A comisiones: `apps/mobility-expo/server/g116-owner-commission-gateway.mjs`, `g116-owner-commission-a-b-postgres-http-ci.mjs`, SQL `G136_FIVE_SERVICE_OWNER_COMMISSION_ASSERT_POSTGRES_CI_ONLY.sql`.
- SQL origen: `apps/mobility-expo/docs/backend/staging_only/` (G3/G4/G38/G71/G72/G73/G93/G94/G95/G100/G116/G118/G122/G124/G136/G138/G142/G45). **Solo disposable**.
- B cliente: `apps/movete-cliente/app/transporte.tsx`, `app/viaje.tsx`, `app/moto.tsx`, `app/envios.tsx`, `app/comercios.tsx`, `app/seguimiento.tsx`, `app/historial.tsx`, `src/domain/client-experience.mjs`.
- C driver: `apps/movete-driver/app/ofertas.tsx`, `app/viaje.tsx`, `app/entrega.tsx`, `app/ganancias.tsx`, `src/domain/driver-trip-lifecycle.mjs`, `src/domain/driver-custody-http.mjs` (confirmar ruta en árbol actual).
- D Admin: `apps/movete-admin/src/main.tsx`, `AdminRuntime.tsx`, `admin-experience.mjs`, `OwnerCommissionEditor.tsx`, `OwnerCargoRateEditor.tsx`, `service-trace-gateway.mjs`, `service-trace-integrity-fence.mjs`.
- CI unificado: `.github/workflows/qore-four-apps-unified.yml` (typecheck/build), `.github/workflows/mobility-g4-postgres-disposable.yml` (real schema chain y carreras); Geoapify G129 `.github/workflows/mobility-geoapify-free-smoke.yml` y cuota G130 workflow propio.
- Todos los paths son de esta rama al corte; si se mueve HEAD, buscar equivalentes en árbol y no sobrescribir mejoras de otros arquitectos.

### 4. AVANCES CON FUENTE PROBADA (NO REPETIR)
| Área | Implementación que EXISTE | Límite claro |
| --- | --- | --- |
| Integración | A+B+C+D compilan mismo SHA; HTTP localhost + PostgreSQL16 disposable, RLS/roles, concurrencia/idempotencia | No entorno operativo permanente ni instalación real |
| AUTO | G73→G98 ruta, cotización, reserva, cancelación y G93/G94 ledger; G138 Admin trace **del mismo tripId** antes/después | G38/G71 niega asignación nueva; G109 completó **fixture aceptado pre-G38**, no ese tripId nuevo |
| MOTO pasajero | G100/G101/G102/G118/G119 quote/book/cancel/estado y subsidio; G137 Geoapify provider QA; G142 Admin D trace privado **mismo tripId**, revisión 1→2, 4+4 asientos | MOTO nueva aún NO recibe legalmente Driver/cierre real, sin PSP/GPS |
| Envíos AUTO y MOTO | B G5/G121 registro original, GET recovery privado, G122 consentimiento QA, G124 tarifas Owner, G125/G126 rutas; C G66 NO permite custodia sin courier asignado | Registro **antes** del prequote comercial; sin servicio de envío comercial/custodia real cerrada |
| COMMERCE | G139/G140 Buyer B → HTTP A → G45 PG16, precio del catálogo, stock 1 vez, replay, rechazo vehículo indebido, cancelación/restitución 1 vez | Sin entrega por Driver, pago real, merchant flujo final y D trazabilidad universal |
| Owner | G116/G136 tasas versionadas para cinco verticales; G117 HTTP readback/identidad/MFA QA; G124 separado tarifas/commission cargo; AUTO 15%, MOTO 12%, subsidio 10% | Políticas globales cargo/COMMERCE no equivalen a aplicación en todos los quotes, rubros y liquidaciones |
| Admin | G75 F1, G138 AUTO trace, G142 MOTO trace, `service-trace-gateway.mjs` para 5 contratos en D; anti-rollback | A **solo montó AUTO_RIDE y MOTO_RIDE** en endpoint trace; envío/comercio siguen sin respuesta certificada; runtime web externo por defecto OFF |
| Geoapify | G129 real provider smoke de una ruta pública Asunción pasó históricamente; G128/G130/G134/G137/G141 hard gates y control de cuota QA | No cobertura comercial geocodificada para direcciones libres ni navegación GPS auténtica |
| Driver | Ofertas privadas, bloqueo KYC, slot exclusivo G36, recuperación y lifecycle; G109 completa AUTO previamente aceptado | No ciclo nuevo B→C habilitado legalmente; ganancias no verificadas |
- Códigos G anteriores son identificadores históricos de la ingeniería, **no numeración de tareas terminadas al 100 %**.
- Siempre distinguir: `TESTED_GITHUB_QA`, `IMPLEMENTED_UNMOUNTED`, `EXTERNAL_BLOCKED`, `E2E_READY`, `PRODUCTION_APPROVED`. No equipararlos.

### 5. BLOQUEOS TRANSVERSALES REALES, PRIORIDAD DE GESTIÓN
**B1 Legal (fuera de GitHub)**: G38 exige habilitación territorial/municipal y política de transporte. G71/G20 exige documento, licencia, seguro, inspección y vigencia real. G118 exige **MOTO pasajeros** diferenciada de motos de reparto. No se puede falsificar certificados, editar `eligible_by_policy` a TRUE en QA para decir que es legal, ni usar el fixture pre-G38 de G109 como nuevo viaje. Registrar evidencia real firmada, vencimiento, revocación y autoridad emisora al autorizar; si no existe, el despacho deberá permanecer BLOCKED. La app debe ser segura aun bloqueada.
**B2 Proveedores (externos)**: Auth JWT/AAL2 proveedor realmente conectado, geocoding/geofences/peajes, Geoapify cobertura y cuota real, telemetría GPS consentimiento, WebSocket/push, PSP sandbox o real conforme autorización; mientras tanto interfaces CI honestas y contratos seguros.
**B3 Operación real**: Render HTTPS y Supabase persistente **no están configurados por este handoff**, y el Owner ordenó no pasar hasta cerrar GitHub; nunca afirmar que un runner CI sustituye staging externo.
**B4 Normativa comercial**: farmacias/productos restringidos, protección de datos, consentimiento de ubicación, cancelaciones, soporte, recibos, fiscalidad y medios de pago Paraguay; se necesita revisión legal antes de operación pública.

### 6. P0-A AUTO_RIDE: MISMO VIAJE NUEVO A→B→C→D Y LEDGER
**Owner espera** seleccionar AUTO, dirección de partida/destino → quote de Geoapify validada/valor PYG → aceptar → crear viaje → conductor eligible recibe oferta privada → acepta → llega → inicia → completa → Cliente ve cierre → Admin misma identidad y finanzas.
1. Usar `g98-f1-auto-postgres-loopback-e2e-ci.mjs` como prueba continua, SIN mezclar con `g109-driver-auto-completion-pg-http-ci.mjs`. Inspeccionar G73 booking → G85/G111/G112 worker → G16/G4 offers → G38/G71/roles → C accept G36 → G65 lifecycle.
2. Integrar resolución de candidato, vehículo, disponibilidad/slot, cobertura, permiso, TTL y aceptación única. Dos Drivers simultáneos: solo uno gana; logout/revocación/cancelación invalida oferta, no resucita viaje.
3. C completa `arriving → in_progress → completed` en ese `tripId`, B ve estados monotónicos y recuperación post-crash, D readback G138/G75 mismo quote/commission_version y ledger. G138 actual soporta solo `searching/cancelled` sin driver: **ampliar a estados legalmente asignados antes de declarar completo**.
4. Precio y subsidio: 15% inicial nominal configurable, 10% fijo al pasajero, gastos/transacciones sin redondeos dobles ni cambios retroactivos; cancelación y reversos atómicos.
5. SIN evidencia legal externa, implementar camino de autoridad segura y pruebas negativas, consignar EXTERNAL_BLOCKED para el salto conductor real y pasar al siguiente P0, no falsificar Driver.

### 7. P0-B MOTO_RIDE PASAJEROS: PROPIO, NO PAQUETERÍA
1. G100/G101/G102 cotización/reserva/replay/cancelación ya funcionan QA; G119 muestra estados de MOTO fixture; G142 lectura Admin de `searching/cancelled` y ledger G100 está verde.
2. Falta nuevo despacho y Driver C `MOTO_RIDE` (no `DELIVERY_MOTO`) con licencia/seguro/habilitación municipal/casco, roles y especialidad correctos, oferta privada, aceptar, llegar, iniciar, completar; mostrar estados en B y D mismo `tripId`.
3. Extender SQL/DTO de trazabilidad G142 después de autorización legítima: accepted/arriving/in_progress/completed; usar eventos reales G118 y correlación G100; no mostrar `NOT_ASSIGNABLE` como `ASSIGNED`.
4. Tarifa Owner MOTO independiente (12% inicial / 10% subsidio pasajero); comprobar conservación de cotización aceptada y reversos; no fallback automático a AUTO por disponibilidad.
5. Casos adversarios: conductor solo repartidor, seguro vencido, casco/KYC incompleto, dual role, geocerca negada, oferta caducada, dos aceptaciones, revocación, intento de reutilizar precio de AUTO.

### 8. P0-C ENVÍOS AUTO Y MOTO: PREQUOTE ANTES DE REGISTRO/CONTRATO
**DEFECTO PRINCIPAL DE EXPERIENCIA**: `apps/movete-cliente/app/envios.tsx` tiene botón de **"Cotizar y solicitar repartidor" DESHABILITADO**; G5 guarda QA y G7/G122 cotiza/consiente después, por lo que registro QA NO equivale a contratar envío. Mantener el botón OFF hasta completar los siguientes pasos.
1. `POST prequote`: recopilar pickup/destination, categoría/medidas/peso/vehículo, geocodificación servidor, permisos/cobertura, Geoapify G128/G130/ruta/peajes independientes, límite de carga, precio G124 Owner/versión y TTL.
2. `GET prequote`: `quoteId,requestKey,vehicleKind,currency=PYG,amountGs,ownerRuleVersion,routeEvidenceId,expiresAt` con identidad y dueño reales; nunca usar distancia fija ni precio hardcodeado ante error.
3. Mostrar antes de contratar, botón consentimiento explícito. Una transacción que vincule el prequote a `deliveryId` original con idempotencia G5/G121/G122/G125/G126 y G123 guard de despacho. Si expiró o cambió regla, pedir nueva confirmación.
4. Recovery GET seguro ante ACK desconocido, un solo `deliveryId`; prueba de dos conexiones PG, crash/reinicio Cliente con SecureStore, cambio de cuenta, cancelación simultánea y no duplicación.
5. Seleccionar repartidor privado que tiene licencia/seguro/documentación/vehículo exacto, G36 slot único; C acepta y aplica G66 cadena custodia; G67 prueba verificable de recogida/entrega/devolución con consentimientos, sin falsificar estado `delivered`.
6. B usa G68 + historial privado del mismo ID; D completa trace de `DELIVERY_AUTO` y `DELIVERY_MOTO` con alias de contrato resuelto y ledger; liquidación, devolución, incidencia, reembolso seguro.
7. Probar **ambos servicios separados**. Carga moto y auto tienen límites/medidas, tarifas, restricciones legales y comisión independientes.

### 9. P0-D COMERCIOS: RESERVA PROBADA → FULFILLMENT REAL
1. Aprovechar G139/G140: Cliente Buyer → A HTTP → G45 PostgreSQL reserva stock, cobra precio **solo en términos QA**, cancelación devuelve stock una sola vez, MOTO/AUTO sin vehículo incorrecto.
2. Pendiente catálogo/merchant por tipo, horarios, zonas y disponibilidad actualizados/administrados realmente; carrito múltiples SKUs, precio total productos + envío + impuestos/comisiones legítimas, revalidación de precio/stock/TTL antes de consentimiento, idempotencia y bloqueo de ventas simultáneas.
3. Merchant verificado recibe orden y confirma/prepara/listo. Nunca permitir que comprador/Driver decida estado o apruebe comercio.
4. Vincular `orderId` con un `deliveryId` elegible solo si aplica; C recoge/completa con G66/G67 y evidencias. B observa estados, eventual cancelación/devolución, no doble reserva ni doble restock.
5. D trazabilidad `COMMERCE`, cola merchant/branch/cases, suspensiones/revisiones, auditoría, soporte, inventario y finanzas del mismo `orderId`/deliveryId asociado.
6. Owner comisión **por rubro** supermercado/farmacia/restaurante/otros, opcional por tienda/zona, reglas versionadas y aplica a QUOTES/settlement futuros; actual G136 es una tasa global COMMERCE, no rubros.
7. Reglas medicamentos/productos sujetos a controles sanitarios y prohibiciones, comercios acreditados antes de permitir pedidos.

### 10. P0-E OWNER, COMISIONES Y LEDGER ECONÓMICO ÚNICO
1. G136 YA almacena de forma independiente `AUTO_RIDE`, `MOTO_RIDE`, `DELIVERY_AUTO`, `DELIVERY_MOTO`, `COMMERCE` (0–30% cargo/commerce; 10–30% pasajeros por subsidio); G117 prueba Owner → HTTP → PG AAL2 QA; no reinventarlo.
2. **Reconciliar G136 con G124** (tarifas y `commission_bps` específicas de carga): definir precedencia explícita Owner por servicio/vehículo/zona y momento de vigencia; cambiar G136 NO garantiza hoy actualización de todos los quotes G122 ni liquidación carga. Agregar una única autoridad de precio.
3. Desglose COMMERCE por categoría, merchant/tarifa/entrega y recibos; no cobro de comisión sin venta autorizada.
4. Para C Driver, GET privado de ganancias y pagos desde ledger real, por período/servicio/versión; pantalla `ganancias.tsx` correctamente NO declara ingresos si no hay datos. Implementar y certificar antes de mostrar dinero.
5. Financiero obligatorio PYG entero: bruto, subsidio, comisión nominal, retención, payout Driver y comercio, cargos PSP, costos, impuestos/reembolsos; doble entrada balanceada, idempotencia webhook y settlement; separar `QA_RESERVED` de `RECONCILED`. Ningún PSP real en GitHub sin orden.
6. Owner changes: POST authenticated + AAL2 + permisos exclusivos + registro auditoría + revisión/CAS/replay + read-after-write. Editar una tasa no modifica quote congelada ni comisión del otro servicio.
7. No inventar rentabilidad: 15% AUTO - 10% subsidio = retención nominal 5 puntos ANTES de costos, 12%-10%=2 puntos MOTO. La bonificación 10% aplica solo a pasajeros.

### 11. P0-F ADMIN D: TRAZA AUTORITATIVA Y OPERACIÓN COMPLETA
1. D tiene `main.tsx` sección **"Cinco flujos"**, `ServiceTracePanel` con contrato cinco clases, pero en backend solo rutas G138 AUTO y G142 MOTO; **integrar POSTGRES autoritativo para ambos envíos y COMMERCE** sin inventar `quoteId`, eventos ni ledger.
2. Revisar y unificar esquema `serviceKind`: A usa `DELIVERY_AUTO/DELIVERY_MOTO`, D declara `AUTO_DELIVERY/MOTO_DELIVERY`. Añadir traducción canónica estricta y tests de ida/vuelta; nunca usar tipo equivocado para permisos, cobros o Driver.
3. Extender AUTO/MOTO Admin a assigned/arriving/in_progress/completed con fuente real y legalGate verificado; revisión monotónica, eventos inmutables, no terminal resurrection; conservando compatibilidad del DTO y su integridad.
4. Completar Admin tareas reales: KYC/permiso/caducidad de Driver y vehiculo, merchants, fraude/casos/suspensiones/zonas, incidente G41, auditoría G30, historial/operación, Owner balances reconciliados y tasas editables.
5. En `AdminRuntime.tsx` flags HTTPS/PG/MFA/contrato por defecto OFF y dependencia de IdP/Render; **no activar flags arbitrariamente en GitHub** para fingir que hay backend externo.
6. Cada pantalla debe distinguir `NO CONECTADO` de `0 Gs.`, sesiones revocadas borran datos privados, CSP/CORS/errores sin datos PII. Contrato de lectura por serviceId y paginación estable, sin abrir scopes cruzados.

### 12. P0-G INTEGRACIÓN GEOAPIFY, UX NATIVA Y DISPOSITIVOS
1. Autorización Geoapify: G129 smoke real de landmarks públicos, G128 cargo, G134 AUTO, G137 MOTO y G130 cuota/fail closed; mantener API key SOLO backend, HTTPS, cuota, sin exponer datos de ubicación ni gastos no autorizados.
2. Resolver direcciones libres de usuario a coordenadas certificadas y Place IDs; geofence Paraguay/municipio por modalidad, horarios, peajes, rutas inválidas; manejo proveedor sin datos/con timeout y fallback **sin tarifa engañosa**.
3. B mapa visible, origen/destino móvil, elección AUTO/MOTO, cotización y confirmación, ruta polilínea/ETA real con fuente y timestamps; C mapa de pickup/dropoff y navegación a asignación propia; no usar kilómetros imaginados.
4. GPS/permiso foreground/background, tracking revocable, frecuencia/privacidad, desconexiones, sesión expirada, ADB/permisos iOS/Android y geolocalización fresca; G32 cuarentena no equivale GPS productivo.
5. Notificaciones push/realtime privadas por identidad y servicio; fallback polling privado/TTL y no duplicación; cancelación/reasignación/desinstalación/interruptores de privacidad.
6. Pantallas, accesibilidad, errores, carga lenta, teclado, telefonía protegida, chat privado/safety, dispositivos físicos Android/iOS, orientación, reconexión y reinstalación. **Typecheck Expo no prueba usabilidad en móvil**.
7. No generar APK de distribución final; preparar perfiles, firma, privacidad/consentimiento y revisión App Store/Play Store una vez aprobado despliegue.

### 13. P0-H SEGURIDAD OPERATIVA, PRIVACIDAD Y PAGOS
- Auth y sesiones: registro/login reales Cliente, Driver, merchant, Admin y Owner; roles mutuamente excluyentes, verificaciones JWT servidor, MFA AAL2 Owner/Admin, autorización DB/HTTP, sesión revocada, refresh/replay protección, logout y borrado de datos del teléfono.
- Seguridad Driver G20/G38/G71/G118 y cadena G66/G67: certificados de autoridad real, cobertura, documentos, licencias de pasajeros MOTO, vencimiento, seguro, suspensión, consentimiento/localización, no override Owner arbitrario.
- RLS y privacidad: no filtrar usuario, teléfono, documentos, token, secret, GPS de terceros, evidencia de entrega ni buyer SKU sensibles a otras cuentas. Logs redacted y rate limit.
- PSP: diseñar sandbox proveedor, autorización, captura y eventos firmados, callbacks idempotentes, cancelación y devolución; sin dinero real en GitHub. Reconciliar 1 pago ↔ 1 pedido y devoluciones, no sumar reservas provisionales como cobranza.
- Observabilidad/safety: eventos auditables, TTL/alertas/carreras, incidente, antifraude, soporte, retención/borrado, backups y migraciones idempotentes.
- Entrega legal comercial: revisión Paraguay sobre transporte de pasajeros en moto, seguros, conductores, regulación sanitaria de farmacias, fiscalidad e información al consumidor.

### 14. MATRIZ E2E DE ACEPTACIÓN OBLIGATORIA (NO MÁS TESTS AISLADOS)
| Caso | Misma sesión de prueba continua, mismas fuentes | Aceptación |
| --- | --- | --- |
| E1 AUTO | B quote y book nuevo → A PG16/dispatcher → C conductor legal acepta y termina → B status → D G138 extendido/ledger | 1 `tripId`, eventos/quote/driver/versión/ledger; legal real o BLOCKED |
| E2 MOTO | B MOTO nuevo → A G100/G118 → C MOTO pasajero → B G119 → D G142 extendido | 1 `tripId`; licencias MOTO, sin crossover |
| E3 ENVÍO AUTO | Prequote antes del request → consent → G5 → C AUTO → G67 → B G68 → D ledger | 1 `deliveryId`, precio vigente congelado |
| E4 ENVÍO MOTO | Igual E3, con peso/dimensiones/legal/courier MOTO | 1 `deliveryId`, sin reemplazo AUTO |
| E5 COMMERCE | Buyer B G139→ merchant prepara → C delivery → B estado → D trace/ledger | 1 `orderId`, vincular `deliveryId` si aplica |
| E6 OWNER | D cambia cada vertical/rubro → nuevas quotes adoptan versión → anteriores no cambian | 5 cambios aislados, 10% pasajero intacto |
| E7 Seguridad | Dos conductores compiten, KYC vencido, actor ajeno, admin revocado, geofence/PSP/Geoapify fallan | Fail closed sin bypass |
| E8 Resiliencia | Lost-ACK/crash/login de otra cuenta/cancelación simultánea, reinicio móvil y repetición | Cero doble reserva/cobro/stock, mismo ID |
| E9 Finanzas | Precio/commission/payout/split/reversos/versiones en PYG, ledger por servicio | Cero descuadre, sin cobro real encubierto |
| E10 UI REAL | Acciones disponibles y visibles, mapas/notificaciones/fallos/recovery sobre teléfonos | No afirmar completitud por capturas ni compilación |
- Guardar por caso: URL exacta de CI, SHA, IDs, requestKey, quoteId, timestamps, rev PG y ledger, Auth, legalGate, capacidad probada y limitación. Preferir una suite/ejecución repetible que avance por **un único serviceId original por escenario**.
- G109 pre-G38, G119 MOTO fixture privilegiado, G132 courier denial y G139 stock-restock **NO** equivalen a E1/E2/E3/E4/E5 completados. No mentir sobre certificación.
- `NO GO` hasta E1–E10 cerrados en su alcance y aprobaciones externas confirmadas.

### 15. ORDEN DE EJECUCIÓN DEL PRÓXIMO CHAT, SIN RECONSTRUCCIÓN
**Fase 0 — 1 ciclo GitHub:** Releer HEAD, comparar este handoff con cambios posteriores, verificar CI. Distinguir implementación no montada vs defectos, encontrar primer hueco mismo-ID. No crear otro handoff.
**Fase 1 — P0 ejecutables sin evidencia externa:** Completar Admin trace de DELIVERY_AUTO/MOTO y COMMERCE desde PostgreSQL; resolver alias de tipo; conectar Owner G136 con G124/cotizaciones; publicar precio de envío antes de registro de G5; completar comprobaciones de fuente y mismo-ID. Estas piezas sí pueden implementarse/testearse dentro de GitHub sin inventar habilitación legal.
**Fase 2 — Orquestación:** Aunar A+B+C+D en el mismo E2E para cada servicio: candidatos, oferta privada, lifecycle, proof, finalización, auditoría y contabilidad. Cualquier legalGate sin evidencia real permanece blocked. Conservar pruebas negativas independientes.
**Fase 3 — Producto:** mapas/ubicación/ETA y push privados, UX real y error recovery, Driver ganancias verificables, comercio/merchant funcional, idioma/accesibilidad, pruebas de dispositivos con credenciales/entornos autorizados.
**Fase 4 — Congelación PRE-RENDER:** todos los workflows obligatorios verdes en UN SHA, matriz E1–E10 cerrada en lo verificable, sin pendientes P0 implementables, migraciones reversibles/idempotentes, documentación de secrets/roles/quota, revisión de permisos y costos.
**Fase 5 — SOLO CON ORDEN DEL OWNER:** preparar Supabase STAGING (Auth/PG16/RLS/Storage) y Render STAGING (HTTPS/backend), sin LIVE/PSP real; repetir CI con proveedor e identidad reales, GPS/Push y Apps; luego solicitud autorización release Play Store y App Store. GitHub Actions es CI descartable, no hosting productivo. **No avanzar a F5 automáticamente.**

### 16. INSTRUCCIONES DE OPERACIÓN GITHUB PARA EL PRÓXIMO ARQUITECTO
- Cuenta/repositorio: `mezas3238-hue/Qore-mobile-`; rama canónica `integration/qore-mobile-e2e-four-apps-20261027`.
- Usar plugin GitHub conectado. Obtener `GET /repos/{repo}/branches/{branch}` y tree recursivo, verificar HEAD antes de cada cambio. Para escribir, blob→tree basada en HEAD tree→commit parent HEAD→update_ref `expected_sha=HEAD`. Si lease falla, refrescar y reconciliar, no sobreescribir trabajo simultáneo.
- GitHub Actions rama por SHA: `GET /repos/{repo}/actions/runs?branch=...`, jobs y logs del último workflow. Green **en mismo commit** en `qore-four-apps-unified.yml` y `mobility-g4-postgres-disposable.yml`. Si falla, leer log y arreglar código del recorrido, no esconder fallo o marcar optional.
- Usar tests ya existentes como escenarios de prueba viva: G98 AUTO, G102 MOTO, G121/G132 ENVÍOS, G139/G140 COMMERCE; incorporar mismo Driver C + Admin D con PG16 real en esos tests, no un segundo sistema de mocks. Reducir duplicados de pruebas y no ejecutar Geoapify real repetidamente para simular funcionalidad.
- No publicar mensajes vacíos de "avanzando" sin implementación medible. Reportar al Owner el cambio funcional, dónde, SHA, CI exacta, bloqueos legales pendientes y **siguiente defecto concreto**.
- Nunca afirmar certificado un estado que se obtuvo con token QA sintético, fixtures, bandera front-end `contractCertified` o `eligible_by_policy=true` fabricado. Los límites son parte del producto.

### 17. EVIDENCIA Y LINKS ESTABLES
- GitHub repo: https://github.com/mezas3238-hue/Qore-mobile-
- Último HEAD verde: https://github.com/mezas3238-hue/Qore-mobile-/commit/55f5db225206646ab9c96006dcd69bb159569c4f
- Compilación todas las apps verde: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40725007253
- HTTP/PostgreSQL16 E2E y concurrencia verde: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40725007333
- AUTO Admin G138: https://github.com/mezas3238-hue/Qore-mobile-/commit/2a99d82f1f022923859dcd87e37bfdf53d967a11
- MOTO Admin G142: https://github.com/mezas3238-hue/Qore-mobile-/commit/55f5db225206646ab9c96006dcd69bb159569c4f
- Prior master A+B+C+D: https://github.com/mezas3238-hue/Qore-mobile-/blob/55f5db225206646ab9c96006dcd69bb159569c4f/docs/handoff/HANDOFF_MAESTRO_FINAL_A_B_C_D_GITHUB_PRIMERO_E2E_PENDIENTES_2026-10-28.md
- Driver C issue: https://github.com/mezas3238-hue/Qore-mobile-/issues/17
- El SHA HEAD puede avanzar; priorizar fuente de verdad GitHub actual sobre esta foto.

### 18. MENSAJE QUE EL OWNER PUEDE COPIAR EN EL PRÓXIMO CHAT

**TÍTULO:** QORE Mobile — Arquitecto Ejecutivo A+B+C+D, ejecución inmediata GitHub E2E.

> Continuá como arquitecto ejecutivo de QORE Mobile (A+B+C+D) en `mezas3238-hue/Qore-mobile-`. Leé el handoff maestro `docs/handoff/HANDOFF_MAESTRO_EJECUTIVO_QORE_MOBILE_GITHUB_A_B_C_D_G142_PRE_RENDER_SUPABASE_2026-10-28.md` de la rama `integration/qore-mobile-e2e-four-apps-20261027`. Último corte verde: commit `55f5db225206646ab9c96006dcd69bb159569c4f`, workflows Actions #40725007253 y #40725007333 SUCCESS. Primero verificá HEAD actual. No quiero más planes, handoffs, pruebas aisladas ni commits decorativos: trabajá en funcionalidad real de extremo a extremo para AUTO_RIDE, MOTO_RIDE, DELIVERY_AUTO, DELIVERY_MOTO y COMMERCE, sobre las mismas operaciones originales en Cliente→Backend→Driver→Admin→PostgreSQL y conciliación. Mantené el 10 % de subsidio solo pasajeros y el 100 % de comisiones Owner configurables desde Admin. Priorizá falta de trace de envíos/comercio, tarifas cargo prequote antes de registro, integración de Owner rates al precio final y Driver lifecycle nuevo legal. No falsees permisos G38/G71/G118, PSP, GPS ni Auth, ni pases a Render/Supabase, hagas merge, LIVE o despliegues sin mi autorización explícita. Solucioná todos los P0 implementables y mostrá cada prueba E2E en el mismo SHA de GitHub. Si hay bloqueo legal real, documentalo y seguí con el siguiente P0 sin detenerte. Quiero que la aplicación se termine y funcione, no solamente CI verde.

---

**FIN.** Este handoff contiene el estado de ingeniería certificado y la ejecución pendiente; NO es prueba de lanzamiento comercial. **Arranque siguiente chat: abrir GitHub HEAD y trabajar en el primer P0.**

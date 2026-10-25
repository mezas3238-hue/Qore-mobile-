# QORE MOBILE / MOVETE FÁCIL — HANDOFF MAESTRO GLOBAL A+B
## G0–G91 (Arquitecto A), R1–R67 (Arquitecto B), F1 AUTO y continuidad SIN PAUSAS

**Fecha de corte:** 25-10-2026, Paraguay.
**Fuente soberana:** [mezas3238-hue/Qore-mobile-](https://github.com/mezas3238-hue/Qore-mobile-) (el guion final forma parte del nombre).
**Owner:** dirección QORE Mobile / Movete Fácil.
**Audiencia:** siguiente Arquitecto A de Backend + Driver + infraestructura y Arquitecto B de Cliente + Admin.
**Objetivo:** continuar desarrollo inmediatamente, **sin detenerse salvo bloqueo real de una tarea específica**, resolviendo lo que esté desbloqueado en lugar de crear documentación o cientos de commits.
**Estado comercial:** **NO_GO**. Las pruebas CI no representan una app desplegada, instalada, con pagos ni viajes reales.

> **ORDEN PRIORITARIA DEL OWNER:** «NO QUIERO MÁS CIENTOS DE COMMITS SIN FUNCIONES COMPLETAS Y OPERATIVAS». Entregar **APP CLIENTE, APP DRIVER, ADMIN WEB, BACKEND + PostgreSQL** funcionando sobre el MISMO viaje; certificar etapas E2E, seguridad y persistencia. Métrica = recorridos funcionales certificados, no cantidad de commits. No merge, no LIVE, no despliegues ni gastos sin autorización expresa.

---

## 0. RESUMEN DE 60 SEGUNDOS — LEER Y ACTUAR

1. **A PR #7 OPEN DRAFT** — rama \`feature/mobility-monorepo-isolated-20261016\`. **HEAD DE CÓDIGO comprobado** antes de publicar este documento: \`1307f3e406b9bf752c5d38cd22580581d1e86c88\`. [PR #7](https://github.com/mezas3238-hue/Qore-mobile-/pull/7). Metadatos a este corte: 1.321 commits y 821 archivos cambiados en PR; **esto NO es porcentaje de producto terminado**.
2. **A CI 4/4 SUCCESS, mismo SHA \`1307f3e4\`:** [Node STAGING 798/798 PASS](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40207321878), [PostgreSQL16 desechable](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40207321820), [Expo](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40207321847), [aislamiento dos apps](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40207321837).
3. **B PR #8 OPEN DRAFT** — rama \`feature/mobility-cliente-admin-parallel-20261022\`. **HEAD B comprobado:** \`d07d68ff9f27cd569502ab7297190653c1534abd\`. [PR #8](https://github.com/mezas3238-hue/Qore-mobile-/pull/8). 644 commits, 412 archivos cambiados, tampoco medida de progreso. **B CI 3/3 SUCCESS:** [Admin Web QA](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40207702592), [frontera de propiedad B](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40207702667), [aislamiento apps](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40207702573).
4. **Coordinación contractual A↔B:** [issue #9](https://github.com/mezas3238-hue/Qore-mobile-/issues/9). [Issue #11](https://github.com/mezas3238-hue/Qore-mobile-/issues/11) benchmark de funciones Cliente. No se puede modificar código del otro arquitecto.
5. **Último cierre funcional de A: G91.** Desde reserva G73/quote/route, G84 puede emitir oferta a Driver G4/G16 antes de que G85 concilie; G90 ahora muestra correctamente \`OFFER_PENDING\` al Cliente propietario aun con cola G85 \`PENDING\`, sin filtrar ID Driver/oferta/GPS. SQL QA positivo + 4/4 CI en \`1307f3e4\`.
6. **Último cierre funcional de B: R67.** Cliente muestra y consulta G90 con GET privado sobre mismo booking y JWT, solo después de reserva confirmada; expone los estados reales de búsqueda sin inventar asignación. 3/3 CI en \`d07d68ff\`.
7. **Infraestructura: NO LISTA.** Consulta read-only del 25-oct-2026: Render workspace \`My Workspace\` no devuelve servicios; 0 PostgreSQL; conector Supabase devuelve \`projects:[]\`. No hay STAGING HTTPS + DB remota + Auth + celulares y Admin operativos comprobados. No crear servicios ni migrar SQL \`*_CI_ONLY.sql\` a remoto por iniciativa propia.
8. **Gates:** [17 bloqueos principales](../architecture/MOVETE_FACIL_LAUNCH_GATES_2026-10-24.json): 15 \`blocked\`, 2 \`qa-only\`, cero GO (matriz fechada 24-oct; releer antes de afirmar cambio). [20 recorridos B](../architect-b/CERTIFICACION_INTEGRAL_R60_MATRIZ_VERIFICABLE_2026-10-24.json): 20/20 \`BLOCKED\` en certificación integral. **NO_GO comercial**.
9. **Primera obligación del sucesor:** no redactar otro handoff ni añadir UI simulada. Hacer auditoría mínima HEAD/CI/DTO, luego **cerrar F1 AUTO integrable**: misma reserva, mismo \`tripId\` para Cliente–Driver–Admin; Driver acepta legítimamente bajo G36/G38/KYC; ciclo accepted→arriving→in_progress→completed; historial, auditoría, tarifa/ledger. Si la DB externa está bloqueada, completar pruebas/contratos bajo rama A y abrir dependencia de infra concreta sin detener el resto.

**ADVERTENCIA DE SHA:** el commit documental que publica este handoff cambia HEAD A. Un SUCCESS del SHA anterior **no certifica** automáticamente el HEAD documental posterior; volver a consultar Actions para el nuevo SHA. Lo mismo con B, que trabaja en paralelo.

---

## 1. GOBIERNO Y DIVISIÓN ESTRICTA DE TRABAJO

### Arquitecto A: EXCLUSIVO
- \`apps/mobility-expo/**\` laboratorio backend, runtime G4, contratos, pruebas, SQL PostgreSQL desechable, autenticación, estados, tarifas.
- \`apps/movete-driver/**\` **app nativa independiente Driver**; no mezclar con Cliente.
- \`backend/**\`, \`database/**\`, \`packages/**\` si existen; rutas servidor y esquemas de datos; OpenAPI central, CI, \`.github/**\`, \`scripts/**\`, \`render.yaml\`, \`docs/architecture/**\`, \`docs/handoff/**\`.
- Admin: A da backend seguro y auditado, no dibuja ni modifica las pantallas Admin B.

### Arquitecto B: EXCLUSIVO
- \`apps/movete-cliente/**\` **app nativa independiente Cliente**.
- \`apps/movete-admin/**\` **Admin Web** (no una app móvil combinada).
- \`docs/architect-b/**\` y pruebas/contratos de consumo B.
- B no modifica SQL, backend, Driver, OpenAPI A ni configuración CI/infra A. A no edita rutas B.
- Intercambio de contrato vía issue #9, especificando SHA A y SHA B, método/ruta, DTO tipado, JWT/rol, errores 400/401/403/404/409/429/503, caducidad e idempotencia.

### NO negociable sin orden explícita Owner
NO MERGE, NO LIVE, NO producción; NO aprovisionar Render/Supabase/PSP/SMS/Google con potencial cargo; NO aplicar migraciones a remoto; NO envíos comerciales ni push reales; NO cobros/payouts/reembolsos; NO subir KYC/biometría de personas reales como fixtures; NO exponer secretos, credenciales, service_role, PII, GPS ajeno ni tokens; NO publicar APK/AAB/IPA ni distribuir apps; NO force push ni rebase destructivo; NO confundir build WEB o passing CI con app instalada.

**Sí autorizado:** implementar en rama DRAFT dentro de propiedad, SQL PostgreSQL16 desechable y sintético, pruebas Node/Expo/HTTP loopback, auditoría read-only de conectores y CI, documentación de evidencia necesaria; corregir cada fallo hasta PASS sin debilitar los controles.

---

## 2. PRODUCTO Y DECISIONES DEL OWNER — NO PERDERLAS

**Nombre:** Movete Fácil / QORE Mobile. Lanzar en **Paraguay**, activar cobertura **por zonas**; diseñar backend/tenant/config escalable para posterior expansión a **Argentina, Brasil, Uruguay y Bolivia**, sin gastar en multirregión antes de F1 certificado. La experiencia debe competir en facilidad, seguridad y funcionalidad con Bolt/Uber y plataformas de delivery; **no copiar identidad, código, imágenes o diseños protegidos**.

### Servicios comprometidos
- **AUTO Y MOTO: AMBOS son parte obligatoria de la plataforma.** NO hacer producto solo AUTO. AUTO pasajeros priorizado como F1 certificable; MOTO pasajeros deberá tener su propio gate legal, pólizas, permisos, cascos, seguridad y zona antes de activarse comercialmente: no eliminar el modo por estar bloqueado. AUTO/MOTO envíos particulares y carga, según permiso; entregas comerciales para supermercados, restaurantes, farmacias de categorías autorizadas y otros comercios.
- Cobertura geográfica NO significa disponibilidad de conductores. No fingir ETA, GPS, conductor conectado, inventario, precio, entrega, cobro, aprobación KYC ni operación comercial.
- Sin límite **global** de 50 usuarios, pedidos, conductores ni movimientos. El tamaño de página puede ser 50; usar paginación con cursor para millones, índices y crecimiento regional.
- Chat privado Cliente–Driver/repartidor durante asignación válida; revisión/ACK, revocación y privacidad.
- Tarifas oficiales **solo del backend**, en **PYG/Gs**, por servicio/vehículo/zona. Frontend no calcula comisiones ni descuentos por cuenta propia.
- Lovable limitado a interfaz final cuando la funcionalidad esté cerrada; GitHub es fuente de verdad técnica.

### Nueva política comercial Owner — IMPORTANTE, NO IMPLEMENTADA/CERTIFICADA COMO LIVE
- **AUTO:** comisión plataforma nominal **15%** del importe base del viaje; **subsidio permanente del 10% al Cliente** financiado desde esa comisión; **remanente bruto Movete Fácil 5%**, antes de PSP, impuestos, operación, fraude y otros costos.
- **MOTO:** comisión nominal **12%**; subsidio **10% al Cliente**; remanente bruto **2%** para Movete Fácil, también antes de costos.
- Ejemplo de **Gs 30.000** de precio base: AUTO descuento Cliente Gs 3.000, pago Cliente Gs 27.000, comisión bruta Gs 4.500, remanente plataforma Gs 1.500, conductor Gs 25.500 (sin otros cargos). MOTO descuento Cliente Gs 3.000, pago Cliente Gs 27.000, comisión bruta Gs 3.600, remanente plataforma Gs 600, conductor Gs 26.400. El redondeo/tributos y qué se incluye en importe base son asuntos de contrato contable/legal.
- El Owner había explorado 60/90 días de subsidios, pero su instrucción posterior fue **10% CONSTANTE**; **no implantar expiración automática de 60/90 días** sin nueva orden.
- El Owner contempla financiar 2–3 meses de infraestructura y publicidad en YouTube/Facebook para captar usuarios. **Antes de crear recursos, presentar presupuesto por proveedor, consumo esperado, costos recurrentes, pruebas gratis reales (si aplican), sobrecostos y punto de equilibrio**. NO confundir voluntad de financiar con autorización para realizar gastos ni afirmar margen neto = 5%/2%.
- Modelar subsidio en el **backend/ledger y cotización oficial**, con versión, auditoría, incentivos, control de abuso y coherencia conductor/cliente, sin cambiar oferta comercial sin autorización.

### Documentación y vencimiento Driver
- Ocho categorías documentales/evidencias contempladas en QA: licencia/registro, identidad anverso/reverso, cédula verde/título/vehículo y habilitación, seguro, inspección y selfie/rostro según esquema real. Se deben alinear requisitos con ley y tipo de servicio; NO inventar verificación de autoridades.
- Fecha de expiración: bloqueo transaccional de elegibilidad en ofertas/aceptación/asignación, notificación visible al Driver, nueva carga en privado y restauración solo si el último expediente completo es válido y verificado realmente; nunca levantar suspensión administrativa por renovación de un documento.
- Sin reconocimiento documental/facial/issuer homologado, NO aprobar cuenta real automáticamente por imagen o fecha ingresada.

---

## 3. HISTORIAL A ANTERIOR — G0 A G80, CONSERVADO EN DOCUMENTOS FUENTE

No repetir cientos de commits. Para líneas, pruebas, fallos y contratos históricos, leer:
- [Maestro G0–G66](./HANDOFF_MAESTRO_ARQUITECTO_A_G0_G66_CONTINUIDAD_SIN_PAUSAS_2026-10-24.md)
- [Maestro G0–G70 KYC](./HANDOFF_MAESTRO_ARQUITECTO_A_G0_G70_KYC_RENOVACION_CONTINUIDAD_2026-10-24.md)
- [Maestro Render/Supabase F1 G0–G80](./HANDOFF_MAESTRO_A_RENDER_SUPABASE_F1_CONTINUIDAD_SIN_PAUSAS_2026-10-24.md)
- [Inventarios y pendientes A](./ANEXO_A_TRABAJOS_PENDIENTES_Y_PRIORIDAD_KYC_2026-10-24.md)

### 3.1 Arquitectura, aislamiento, seguridad (G0–G22)
- Dos proyectos Expo nativos separados desde G0; backend Node G4/QORE Radar y PostgreSQL16 sintético desechable, Auth/roles/RLS, reservas atómicas, outbox y auditoría.
- G3/G4 viajes AUTO: solicitud, ofertas privadas, revisión de elegibilidad, decisión/rechazo/aceptación, idempotencia por clave y locks; delivery y comercios G5–G10; cotizador/comisiones en G7 (laboratorio, no precios comerciales actuales); seguridad, incidentes/SOS G8; vehículos y documentos.
- G12/G13 push/outbox: ticket de proveedor indica aceptado para **procesamiento**, nunca entregado al celular. Polling privado de Driver es alternativa limitada.
- NO hay servicio externo certificado solo por existencia de módulos.

### 3.2 Historial, RBAC, zonas, concurrencia, chat (G23–G66)
- G26 historial privado Passenger paginado con cursores firmados sujetos al usuario y expiración; no límite global de 50.
- G31 cobertura/legalidad no equivale a chofer disponible; G36 slot único por Driver, G38 gates de zona legal/seguro y carrera. G42 sesión/JWKS/roles AAL2 de laboratorio (sin IdP remoto certificado).
- G49–G66 chat Cliente/Driver con entrega idempotente, lectura/ACK/read marker, aislamiento por conversación, secuencias, revocación al reasignar, recuperación tras lost ACK. G63/G64 recuperación de decisiones y G65 transición accepted→arriving→in_progress→completed, G66 cadena delivery/custodia.
- La prueba de transición aislada no demuestra operación conjunta con Cliente/Admin en celulares.

### 3.3 Evidencia/renovación KYC, F1 inicial y Render (G67–G80)
- G67–G70 constancias de entrega con referencias privadas y revocables; lectura delegada SQL, bloqueos de replay, fixtures HTTP en localhost.
- KYC de ocho evidencias, vencimientos y renovación: validadores de artefacto/escáner/issuer/liveness como interfaces QA; soporte de permisos/cámara Driver y bloqueo servidor, más pruebas de documentos vencidos. Verificar que **TODAS** las rutas G4/G10/G36/G38 y versiones SDK legacy respeten la última elegibilidad bajo transacción. No afirmar equivalencia con un verificador oficial real.
- G73 Gs route/prequote/version/TTL/booking idempotente, G74 Passenger own state y G75 auditoría Admin; G77 integración de proveedor de rutas opcional y guardado por aprobación de costos; G78/G80 rechazos positivos de seguridad sobre Driver no elegible/zona legal. Negación de aceptación NO es prueba de viaje aceptado.
- Render: \`render.yaml\`, \`render-staging-ingress.mjs\` y \`run-g4-render-staging.mjs\` preparados para escenario STAGING no comercial. Host y TLS esperado fijado, sin cookies; CORS Admin limitado, Bearer y liveness PROCESS_UP_ONLY; pruebas con loopback. Blueprint y servidor real **NO desplegados**. G4 runtime rechaza credenciales/DB no certificadas.
- Comunicación de roles/contratos en issue #9; no usar Lovable viejo para migrar a remoto.

---

## 4. TRABAJO NUEVO A: DESDE G81 HASTA G91 — QUÉ HICIMOS Y QUÉ CERTIFICÓ

Todas las siguientes etapas corresponden a **QA código/CI/PG desechable**, no STAGING E2E externo. En GitHub los cambios de A también se realizaron concurrentemente; verificar autor y parches antes de atribuir personalmente cada commit.

| Etapa | Aporte concreto / garantía demostrada | Restricción relevante |
|---|---|---|
| **G81** | Une una **reserva real G73** (propietario, routeId, quoteId, bookingKey, mismo tripId) a oferta privada G4 y fila outbox. Rol servicio y KYC G71 + G20; rechazo de booking ajeno, Driver no elegible, duplicado y TTL conflictivo. Adaptador \`g81-f1-booking-offer-repository.mjs\`. | No selección autónoma aún, aceptación legal sigue negada por G36/G38. |
| **G82** | Selector SQL server-only de primer candidato AUTO documentalmente elegible/disponible, nunca \`driverId\` suministrado por Cliente. Mantiene una oferta única, mismo tripId visible en inbox privado G16. \`g82-f1-auto-candidate-dispatch.mjs\`. | Sin proximidad GPS confiable ni autorización geográfica; candidate ≠ Driver asignado. |
| **G84** | Conecta POST G73 tras recibo SQL confirmado a oferta G82, con clave determinista estable por booking. La pérdida del intento de despacho no duplica ni anula la reserva. Comprueba que Driver consulta oferta privada sobre la misma reserva. | El despacho oportunista en request no sustituye worker persistente. |
| **G85** | Cola persistente **dentro de transacción de booking**; runner SQL con \`SKIP LOCKED\`, reconcilia oferta G84 ya existente, no duplica outbox, WAITING con backoff de 30 s, 12 intentos máximo y EXHAUSTED, CLOSED si viaje ya no busca. | Cola y RPC solo en PostgreSQL efímero; NO daemon real desplegado. |
| **G86** | Runner Node manual limitado (máx. 5 claims) y dos conexiones PG prueban reclamo único, cancelación, rol no autorizado, concurrencia y recovery sin falsa entrega. | No ejecutor programado remoto ni aceptación legal positiva. |
| **G87** | Oferta expirada/rechazada se recupera con clave nueva, sin reusar Driver ni duplicar oferta; se mantienen G71/G38. Se probó rechazo del intento de introducir oferta vencida sintética con Driver KYC inválido. | No equiparar prueba negativa con carrera positiva de dos Drivers legales. |
| **G88** | Worker privado push G4 vuelve a comprobar estado del viaje, TTL y elegibilidad KYC **después** del lookup del dispositivo, justo antes de solicitar push Expo. Tres pruebas adversariales; Node 793/793 en ese corte. | Reduce ventana de carrera, no hace atómica transacción PG↔Expo ni certifica entrega real. |
| **G89** | GET estado Passenger distingue ausencia confirmada de viaje de caída/indisponibilidad de PostgreSQL; evita convertir 503 en 404. | No IdP/DB externa disponible. |
| **G90** | GET privado \`/v1/staging/rider/auto/bookings/{bookingKey}/dispatch\`; dueño Passenger y mismo booking/trip; DTO sin IDs Driver/oferta/GPS; SEARCHING_DRIVER, OFFER_PENDING, RETRY_PENDING, SEARCH_EXHAUSTED, CLOSED. | Cola retrasada causaba el falso SEARCHING_DRIVER corregido por G91. |
| **G91** | G90 consulta **oferta G4 activa** con outbox duradero, aun cuando G85 continúa PENDING. Test SQL: G73 confirmado→G4 oferta→antes de procesar G85, status Cliente=OFFER_PENDING, intentos=0, sin PII ni acceso de otro Passenger; luego conciliación. **4/4 SUCCESS, Node 798/798** en SHA \`1307f3e4\`. | Falta conectar dispositivos, DB externa y Driver aceptación verdadera; no es GO comercial. |

### Correcciones técnicas durante G81–G91
- G81: fixtures de licencia/vehículo/consentimiento y regex UUID de adaptador. Se corrigieron **sin relajar validación documental legal**, y tests quedaron 4/4.
- G82: se corrigió variable PL/pgSQL ambigua \`trip_id\`; tests de KYC/offer/inbox.
- G85: se corrigió agotamiento de retries para evitar error de CHECK o loop y se validó outbox antes de reconciliar oferta.
- G86–G87: la prueba intentó fabricar oferta vencida para Driver inválido; PG la rechazó correctamente. El ensayo pasó a verificar explícitamente la **denegación KYC**; nunca desactivar el trigger para conseguir PASS.
- G88: segundo snapshot servidor antes del push, con fallo cerrado.
- G90: la aserción asumía viaje cancelado cuando la oferta aún era activa; corregida según el estado real.
- G91: unifica estado visible Cliente y oferta Driver antes de reconciliación asíncrona.

**Archivos nucleares G81–G91:**
\`apps/mobility-expo/docs/backend/staging_only/G73_F1_ROUTE_QUOTE_BOOKING_POSTGRES_CI_ONLY.sql\`,
\`G81_F1_BOOKING_TO_PRIVATE_DRIVER_OFFER_POSTGRES_CI_ONLY.sql\`,
\`G82_F1_PRIVATE_AUTO_CANDIDATE_POSTGRES_CI_ONLY.sql\`,
\`G85_F1_DURABLE_AUTO_DISPATCH_OUTBOX_POSTGRES_CI_ONLY.sql\`,
\`G87_RECOVER_EXPIRED_PRIVATE_AUTO_OFFERS_POSTGRES_CI_ONLY.sql\`,
\`G90_PASSENGER_DISPATCH_STATUS_POSTGRES_CI_ONLY.sql\` y sus \`*_ASSERT_*\`;
\`server/g73-f1-auto-gateway.mjs\`, \`g73-auto-f1-repository.mjs\`, \`g82-f1-auto-candidate-dispatch.mjs\`,
\`g86-manual-dispatch-runner.mjs\`, \`g4-private-push-outbox-worker.mjs\`, \`g4-staging-runtime.mjs\`, \`g4-loopback-http-transport.mjs\`.

### ACI última certificación G91 — mismo SHA
- A HEAD de código: \`1307f3e406b9bf752c5d38cd22580581d1e86c88\`.
- Node contratos: **798/798 PASS**, run 40207321878.
- PostgreSQL16 real/desechable: run 40207321820, SUCCESS.
- Expo QA: run 40207321847, SUCCESS.
- Aislamiento de dos apps: run 40207321837, SUCCESS.
- PR #7 OPEN/DRAFT, no merge. Handoff actual crea commit DOCUMENTAL y el HEAD posterior se debe auditar por separado.

---

## 5. ARQUITECTO B: R1–R67 CLIENTE + ADMIN WEB Y SU DEPENDENCIA

Leer documento completo B existente:
[Maestro B R1–R66+F1](../architect-b/HANDOFF_MAESTRO_ARQUITECTO_B_R1_R66_F1_PRIORIDAD_FUNCIONES_CERTIFICADAS_2026-10-24.md).
No atribuir funciones B como producto comercial listo. La última rama B tiene **3/3 CI** en SHA \`d07d68ff9f27cd569502ab7297190653c1534abd\`.

### B R1–R43
- Dos frentes UI B: Cliente Expo separado y Admin Web React/Vite/TS; navegación y pantallas, viajes AUTO, envíos, comercios, cotización, estado, historial, incidentes, chat, carrito y KYC/soporte Admin.
- Seguridad: credenciales publicables, sesiones propias, limpieza al logout/cambio de JWT, respuestas tardías descartadas, HTTPS pinned opt-in OFF cuando falta backend; nunca \`service_role\` en el navegador.
- R6–R34 chat/mensajes/cursores/ACK/revocación; R35–R43 interfaz de rutas, comercios/carrito y casos de soporte; mocks seguros y contratados, no envío real de mensajes.

### B R44–R66
- Mejoras en autorización, Admin/Owner/MFA como contratos y revisiones KYC; lectura privada, chat con read markers, ruta/ETA honestos, tarifas PYG, recibo G73 idempotente, recuperación post-timeout sin nuevo POST, sender custody, monotonía de estados y pruebas de concurrencia de acciones de UI.
- El historial/Stock puede paginar; nada de tope global 50. El form/ACK local NO aprueba documentos ni acepta un viaje real.

### B F1 desde R66 a R67, ACTUAL
- Cliente: route/prequote/quote versionada en PYG, booking solo con condiciones independientes aprobadas, reconciliación read-only del mismo requestKey, conexión HTTPS pinned bajo banderas STAGING, detección de sesión rotada, no reserva doble ante respuesta incierta, seguimiento Passenger basado en tripId certificado.
- Admin: UI de auditoría, KYC y operaciones, pero falta backend remoto/MFA físico/usuarios reales de QA en misma DB.
- **R67 último**: B implementó gateway HTTP estricto \`readDispatch\` GET \`/v1/staging/rider/auto/bookings/{bookingKey}/dispatch\`, conserva \`ownerId\` y \`tripId\` recibidos del backend, valida DTO exacto, roles, revisión de sesión; muestra en \`apps/movete-cliente/app/viaje.tsx\`:
  - SEARCHING_DRIVER = «Buscando conductor elegible».
  - OFFER_PENDING = «Esperando respuesta del conductor».
  - RETRY_PENDING = «Buscando otro conductor».
  - SEARCH_EXHAUSTED = «No se consiguió conductor en los intentos permitidos».
  - CLOSED = «Búsqueda finalizada según el servidor».
- Botón de lectura **solo después de booking confirmado**, sin relanzar POST ni inventar conductor, ETA, GPS, pagos o asignación. Purga estado al rotar JWT.
- B HEAD \`d07d68ff\`, CI 3/3 SUCCESS: Admin 40207702592, frontera B 40207702667, aislamiento 40207702573.
- **Inmediato para B:** leer A G91 y comprobar que su validación G90 interpreta OFFER_PENDING aun si G85 sigue PENDING; probar en fixtures de consumidor, conservar DTO exacto y NO editar servidor ni carpeta Driver.

---

## 6. BLOQUEO DE INFRAESTRUCTURA EXTERNA — DIAGNÓSTICO VERIFICADO 25-OCT

**Render:** consulta de solo lectura del workspace conectado \`tea-dbem1ilg1s2s7381fic0\`: list_services(includePreviews=true) = null, list_postgres_instances = «No Postgres instances found». NO hay servicio web ni Postgres Render acreditado por ese conector. Un \`render.yaml\` en GitHub NO crea un servicio.

**Supabase:** consulta actual de solo lectura \`list_projects\` devuelve \`{"projects":[]}\` para la conexión disponible. La documentación previa describe un proyecto Lovable STAGING cuyos SQL \`SELECT 1\` fallaban con query_error; **NO trasladar automáticamente ese projectId como Supabase accesible** ni usar proyecto viejo en silencio. Comprobar cuenta/organización/permisos, DB real y Auth ANTES de usar migraciones o datos.

**Railway:** dificultad de conexión comunicada previamente por el Owner. No insistir en Railway ni montar VPS sin orden.

**Qué falta para STAGING real autorizado:**
1. Aprobar **por escrito** costos y cuentas/plan del proveedor; no improvisar un precio exacto ni declarar servicios gratuitos sin confirmar condiciones y límites de 2026.
2. Resolver proyecto PostgreSQL/Auth/Storage privado persistente, migraciones aprobadas por separado y política de datos, secrets fuera de Git.
3. Render HTTPS/Ingress o equivalente autorizado, hostname/forwarded TLS test real, endpoint readiness independiente de liveness, defensa de abuso, escalado seguro y backups.
4. Versionar OpenAPI hasta rutas modernas G73/G81/G82/G85/G90/G91 + Auth/errores/DTO. OpenAPI actual A aún declaraba \`1.0.0-g69\` y servidor localhost al último chequeo; fuente histórica, no exposición HTTP real.
5. Certificar conexión **de dos teléfonos físicos** y navegador Admin con mismo IdP, mismo PostgreSQL, mismo tripId, zonas legales y ruta verificada.
6. Costear Render, Supabase, Storage KYC, Maps/Routes/GPS, Expo EAS/tiendas, alertas/logs/backups, SMS/push si aplica, PSP, atención y presupuesto comercial/publicidad (YouTube/Facebook). Mostrar escenario mínimo dos/tres meses, crecimiento, overages y reservas, para aprobación ANTES de crear recursos.

**Bloqueo real de red ≠ bloqueo de QA/código.** Seguir inmediatamente trabajando en contratos OpenAPI, amenazas, KYC atómico, DTO/validadores, compensaciones, CI de concurrencia y build de desarrollo local.

---

## 7. PRIORIDAD F1 AUTO — DEFINICIÓN DE TERMINADO NO NEGOCIABLE

**F1.0 Certificar entornos:** QA local vs STAGING persistente vs producción. Un solo backend HTTPS autorizado, una DB duradera, Auth real con usuario Passenger, Driver #1, Driver #2 y Admin MFA; usuarios/datos sintéticos permitidos, roles server-side, claves no expuestas. Test read-only y migration review antes de escritura remota.

**F1.1 Cotización Gs:** ruta confiable, zona AUTO habilitada, peajes/tiempos comprobados, importe/version/TTL real, reglas de tarifa y subsidio oficialmente aprobadas; pasajero acepta el precio. El motor no inventa precios sin proveedor certificado.

**F1.2 Reserva G73:** requestKey único, SQL COMMIT y recibo verificable; lost ACK→GET de la MISMA reserva, sin POST duplicado, sin reserva ajena. Un \`tripId\` compartido, revision monotónica.

**F1.3 Dispatch:** G85 persiste cola; G82 escoge driver elegible con KYC vigente; G4 crea oferta a su inbox G16; G90/G91 muestra estado Passenger; dos candidatos no provocan dos asignaciones. G36 locks y G38 zona legal vigentes bajo una única transacción. **FALTA PRUEBA POSITIVA DE ACEPTACIÓN LEGALMENTE VÁLIDA** (los negativos actuales impiden asignación por diseño). No fabricar permisos.

**F1.4 Driver:** recibe oferta en app independiente, acepta/rechaza/caduca/reconcilia, consulta estado asignado G65; código de recogida/safety si se define, navegación y GPS consentido real o piloto autorizado. El viaje pasa **accepted→arriving→in_progress→completed**, sin saltos ni doble aceptación.

**F1.5 Cliente:** la misma reserva permite ver estado servidor, conductor/vehículo solo después de asignación persistida, progreso confiable sin posición inventada, cancelación segura, chat privado durante relación, recibo final e historial.

**F1.6 Admin:** navegador independiente, sesión Admin MFA/AAL2 y RBAC; auditoría mismo \`tripId\`, identidad justificada y operaciones con bitácora, soporte/incidentes y estado; no service_role en browser.

**F1.7 Finanzas:** importe Gs original, subsidio/commission por modalidad bajo config versionada, ledger equilibrado sin cobro real, recibos y conciliación de prueba; no activar PSP/payout hasta otro gate.

**F1.8 NATIVE:** Cliente y Driver instalados **separadamente** en teléfonos Android/iOS de pruebas, permisos GPS/cámara, JWT/revocación, push real en ambiente autorizado, reconexión, intermitencia y reinicio. Admin web externo accediendo al mismo backend. Evidencias con SHA A/B, ambiente, usuario sintético, tripId, timestamps, resultado esperado/observado, sin PII.

**No declarar F1 terminado si falta cualquiera de estas transiciones de punta a punta.**

### Evidencia mínimo de certificación por función
- Registro de actor/rol, precondición documental, ruta/quote/booking, tripId y revisión PostgreSQL.
- Un caso positivo real y adversariales: JWT revocado, account switch, quote caducada, KYC vencido, Driver suspendido, dos ofertas/aceptaciones concurrentes, zona no legal, GPS denegado, push no entregado, red intermitente, botón doble, ACK perdido y cancelación durante despacho.
- PostgreSQL duradero se conserva tras reinicio; lectura Passenger/Driver/Admin muestra **un mismo estado**.
- Build nativa real y prueba física antes de \`NATIVE_PASS\`.
- Los ensayos SQL disposable demuestran \`QA_PASS\`, NO \`STAGING_E2E_PASS\`.

---

## 8. MATRIZ P0: 17 GATES Y 20 RECORRIDOS PENDIENTES

**Gates en fuente \`docs/architecture/MOVETE_FACIL_LAUNCH_GATES_2026-10-24.json\`:**
1 IDP_BACKEND_AUTH (blocked)
2 HTTPS_BACKEND (blocked)
3 POSTGRES_PERSISTENCE (qa-only)
4 DRIVER_ONBOARDING (blocked)
5 DRIVER_LIVE_TRIPS (blocked)
6 CLIENT_LIVE_BOOKINGS (blocked)
7 PAYMENT_SETTLEMENT (blocked)
8 PRIVACY_KYC (blocked)
9 EMERGENCY_SAFETY (blocked)
10 MAPS_GPS_DEVICE (blocked)
11 DELIVERY_MERCHANTS (blocked)
12 CHAT_PHYSICAL (qa-only)
13 ADMIN_OPERATIONS (blocked)
14 NATIVE_RELEASES (blocked)
15 LEGAL_COMPLIANCE (blocked)
16 OPS_24_7_MONITORING (blocked)
17 PROD_GO_NOGO (blocked).

**20 recorridos B R60, SIN E2E real certificado:**
1 AUTH_PASSENGER
2 AUTH_DRIVER_KYC
3 FARE_QUOTE_GS
4 AUTO_BOOKING
5 DRIVER_DISPATCH
6 GPS_TRACKING
7 TRIP_COMPLETION_CANCELLATION
8 MOTO_CARGO_DELIVERY
9 AUTO_CARGO_DELIVERY
10 SUPERMARKET_ORDER
11 PHARMACY_OTC_ORDER
12 RESTAURANT_ORDER
13 CUSTOMER_DRIVER_CHAT
14 PAYMENTS_REFUNDS
15 COMMISSIONS_PAYOUTS
16 ADMIN_KYC_ZONES
17 EMERGENCY_RESPONSE
18 DATA_PRIVACY
19 SIGNED_NATIVE_RELEASES
20 ZONE_ACTIVATION_SUPPORT.

**La inclusión de MOTO debe extenderse al roadmap comercial de movilidad** con su caso de uso, legalidad y seguridad aprobados, no concluir que una lista inicial de 20 sea todo el producto. Mantener por ahora AUTO como primera ruta positiva, no como única modalidad.

### P1 después de F1 (verticales por cierre completo)
- **MOTO transporte y envíos** con seguros/casco/reglas/zonas, tarifa 12% comisión + subsidio 10% y verificación legal; prioridad fuerte del Owner.
- **Driver KYC documental real**, scanner/issuer/liveness independiente, storage privado, alertas de expiración OS y reaprobación automática solo validación completa.
- **Envíos particulares AUTO/MOTO**: desde solicitud→recolección→custodia→entrega/retorno/incident con pruebas.
- **Comercios supermercado/farmacia/restaurante/otros**: contrato/stock reales, pedido→preparación→courier→entrega→facturación según reglamento.
- **Chat/GPS/notificaciones** en ambos teléfonos, consentimiento, reconexión, lectura, revocación al cierre.
- **Soporte/SOS/seguridad**, PIN recogida, contactos confiables, investigación incidentes con operadores reales.
- **Pagos y subsidio**, promociones, PSP, cash handling, devoluciones, ledger, comisiones, fraude y fiscalidad.
- **Admin/operaciones**, legalidad Paraguay, respaldos/restore, alertas, uso regulado de datos, equipos de soporte, firma de bundles y estrategia de zonas.
- **Mercosur multi-país** después de Paraguay E2E: monedas, reglas locales, impuestos, seguros, residencia de datos y configuración por país, escalar costos gradualmente.

---

## 9. COLA DE EJECUCIÓN SIN PAUSAS — TAREAS CON CRITERIO DE CIERRE

### AHORA / PRIMER TURNO DEL SIGUIENTE CHAT
1. Releer en GitHub HEAD **ACTUALES** #7, #8, estado de CI, issue #9 y, en A, este documento. No asumir que son los SHAs de corte.
2. Revisar \`G90_PASSENGER_DISPATCH_STATUS_POSTGRES_CI_ONLY.sql\`, \`G81_F1_BOOKING_TO_PRIVATE_DRIVER_OFFER_ASSERT_POSTGRES_CI_ONLY.sql\`, \`g73-f1-auto-gateway.mjs\`, \`g4-staging-runtime.mjs\`; y el consumo B R67 sin editarlo. Congelar un contrato F1 mínimo A/B (métodos, estados, JWT, seguridad, respuesta a errores, pruebas).
3. Revisar exposición real del endpoint G90 en OpenAPI v g69 y añadir schemas estrictos/de error en el dueño A; avisar a B vía issue #9. **Esto NO requiere infraestructura externa**.
4. Cerrar **F1 vertical** en código/back-end: KYC transaccional en todos los puntos de accept/assign; aceptación legal positiva mediante evidencia de autoridad **válida y verificable en test**, nunca bypass de G38; Driver trip→estado Passenger→recibo Admin/ledger, idealmente un ensayo SQL/HTTP encadenado con UNA DB efímera; test concurrencia dos Drivers.
5. Resolver política comercial AUTO/MOTO y descuento 10% en diseño contable/versionado como contrato QA reversible, SIN aplicarlo en producción ni cambiar el precio visible de reservas actuales sin aprobación de especificación.
6. Mientras infra sin autorización: añadir tests adversariales, corregir CI y preparar matriz F1 con FAIL/PASS por paso. No incrementar epígrafes G o commits por motivos cosméticos.
7. Cuando se habiliten recursos/costos: preflight proyecto, secrets gestionados, migración revisada, HTTP/S/JWT y PostgreSQL STAGING, sin tocar producción. Hacer E2E en dispositivos, capturar evidencia real y cambiar gates SOLO con pruebas.

### SI APARECE UN BLOQUEO REAL
- Anotar: operación concreta, proveedor/recurso requerido, error literal saneado, evidencia/fecha, costo potencial, aprobación faltante, alternativa desbloqueada.
- Mantener bloqueado **solo ese subpaso**. Continuar el siguiente P0 con herramientas ya disponibles.
- Nunca inventar un éxito. Nunca insistir indefinidamente en un proveedor caído; probar lectura segura y pasar a otra parte.
- PR DRAFT siempre; una CI verde de nuevo SHA no implica que un dispositivo ya pueda instalarse.

### PRIORIDAD DENTRO DE CADA TURNO
- 1 función completa o 1 brecha observable cerrada, con pruebas positivas + adversariales.
- Test falla → leer logs → corregir falla específica preservando gate legal/KYC → CI final del mismo SHA → registrar en issue #9.
- Comparar HEAD antes de escribir para no sobrescribir al otro arquitecto; update ref con lease/expected SHA; si se movió, leer diff y rebasar lógicamente SIN force push.
- Probar versión consumer B correspondiente, no modificar su branch.
- Entregar: **función**, **qué realmente funciona**, **qué NO está verificado**, **SHA exacto/CI**, **próximo bloqueo P0**, no estadísticas de commits como sustituto.

---

## 10. ESTADOS QUE DEBEN DECLARARSE CON HONESTIDAD

| Estado | Prueba necesaria | NO equivale a |
|---|---|---|
| \`CODED\` | Código, contrato y pantalla disponibles | Servicio accesible, viaje real |
| \`QA_PASS\` | CI Node, SQL PG desechable, Expo, contratos, adversariales sobre SHA | DB remota, teléfono real, aprobación legal |
| \`STAGING_E2E_PASS\` | Mismo IdP/PG persistente/HTTPS y tripId en Cliente–Driver–Admin, con logs | Comercial GO |
| \`NATIVE_PASS\` | Binarios separados instalados en Android/iOS, GPS/push/permisos/red, evidencia | Permisos regulatorios, PSP |
| \`COMMERCIAL_GO\` | 17 gates, 20 recorridos relevantes, autorización Owner, seguro, operaciones, pago/privacidad | No se infiere de CI |

**A y B hoy están en QA_PASS para módulos específicos; F1 no es STAGING_E2E_PASS ni NATIVE_PASS; el producto es NO_GO.**

---

## 11. REFERENCIAS PRÁCTICAS PARA EL SIGUIENTE ARQUITECTO

**Enlaces vivos:**
- [Repositorio QORE Mobile](https://github.com/mezas3238-hue/Qore-mobile-)
- [PR A #7](https://github.com/mezas3238-hue/Qore-mobile-/pull/7)
- [PR B #8](https://github.com/mezas3238-hue/Qore-mobile-/pull/8)
- [Issue #9 — contratos e integración A↔B](https://github.com/mezas3238-hue/Qore-mobile-/issues/9)
- [Issue #11 — matriz funcional competitiva Cliente](https://github.com/mezas3238-hue/Qore-mobile-/issues/11)
- [Handoff anterior A Render/Supabase F1](./HANDOFF_MAESTRO_A_RENDER_SUPABASE_F1_CONTINUIDAD_SIN_PAUSAS_2026-10-24.md)
- [Handoff B R1–R66+F1](../architect-b/HANDOFF_MAESTRO_ARQUITECTO_B_R1_R66_F1_PRIORIDAD_FUNCIONES_CERTIFICADAS_2026-10-24.md)
- [Manifiesto 17 gates](../architecture/MOVETE_FACIL_LAUNCH_GATES_2026-10-24.json)
- [20 recorridos](../architect-b/CERTIFICACION_INTEGRAL_R60_MATRIZ_VERIFICABLE_2026-10-24.json)

**Archivos técnicos a inspeccionar:**
- \`apps/mobility-expo/server/g4-staging-runtime.mjs\`
- \`apps/mobility-expo/server/g73-f1-auto-gateway.mjs\`
- \`apps/mobility-expo/server/g73-auto-f1-repository.mjs\`
- \`apps/mobility-expo/server/g82-f1-auto-candidate-dispatch.mjs\`
- \`apps/mobility-expo/server/g86-manual-dispatch-runner.mjs\`
- \`apps/mobility-expo/server/g4-private-push-outbox-worker.mjs\`
- \`apps/mobility-expo/server/g4-loopback-http-transport.mjs\`
- \`apps/mobility-expo/server/render-staging-ingress.mjs\`
- \`apps/mobility-expo/server/run-g4-render-staging.mjs\`
- \`apps/mobility-expo/docs/backend/staging_only/G73_*, G81_*, G82_*, G85_*, G87_*, G90_*\`
- \`apps/mobility-expo/docs/backend/openapi/movete-facil-staging.openapi.json\`
- \`apps/movete-driver/**\`
- \`apps/movete-cliente/app/viaje.tsx\`, \`apps/movete-cliente/src/domain/f1-g73-http-gateway.mjs\`
- \`apps/movete-admin/**\`
- \`render.yaml\`, \`.github/workflows/mobility-g4-postgres-disposable.yml\` y 3 otros workflows A.

**CI A:** [Node](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40207321878) • [PostgreSQL](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40207321820) • [Expo](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40207321847) • [Aislamiento](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40207321837).

**CI B:** [Admin](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40207702592) • [Boundary](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40207702667) • [Aislamiento](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40207702573).

---

## 12. ORDEN TEXTUAL LISTA PARA NUEVO CHAT

**Asume el rol de ARQUITECTO A de QORE Mobile — Movete Fácil.**

Fuente soberana GitHub: https://github.com/mezas3238-hue/Qore-mobile-

Lee primero este handoff maestro en \`docs/handoff/HANDOFF_MAESTRO_A_B_G0_G91_R67_F1_FUNCIONES_INSTALABLES_CONTINUIDAD_2026-10-25.md\`, luego PR #7 A, PR #8 B, issue #9 y los HEAD actuales con sus workflows. Mantén estrictamente la división: A Backend/Driver/SQL/infra; B Cliente/Admin. No edites propiedad B.

**Orden del Owner:** NO más cientos de commits sin funciones completas. **CONTINÚA EJECUTANDO, CORRIGIENDO Y CERTIFICANDO SIN DETENERTE**, salvo un bloqueo REAL DE UNA ACCIÓN ESPECÍFICA. Si Render/Supabase/credenciales/recursos requieren autorización, NO inventes servicio, gastos ni resultados: registra el bloqueo y trabaja inmediatamente otra tarea P0 desbloqueada.

Prioridad P0 absoluta: lograr viaje AUTO real completo con G73 cotización→booking único→oferta Driver G82/G4→aceptación autorizada G36/G38/KYC→Driver G65 accepted/arriving/in_progress/completed→estado/historial Cliente G90/G91→auditoría Admin G75 y ledger correcto, **MISMO tripId, IdP y PostgreSQL persistente**. Luego certificar app Cliente, app Driver y Admin Web en STAGING HTTPS y móviles físicos; incorporar MOTO como servicio comprometido con gate legal propio. Contemplar comisión AUTO 15%, MOTO 12%, subsidio Cliente constante 10%, remanente bruto plataforma 5%/2% como **especificación Owner pendiente de integración y aprobación contable**, no LIVE.

El último código A \`1307f3e4\` tuvo 4/4 SUCCESS (Node 798/798); B \`d07d68ff\` 3/3 SUCCESS. La publicación de este archivo modificó A: verificar SHA nuevo y nueva CI. No declarar E2E por fixtures o localhost. Sin merge, despliegue, cobros, push real, datos sensibles, APK/IPA comerciales ni gastos sin autorización Owner.

**Entrega resultados por FUNCIONES completas con evidencia SHA y CI; no por cantidad de commits. NO_GO hasta gates reales.**

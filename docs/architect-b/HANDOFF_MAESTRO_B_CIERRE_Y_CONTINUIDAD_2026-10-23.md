# QORE MOBILE / MOVETE FÁCIL — HANDOFF MAESTRO DE CIERRE Y CONTINUIDAD
## Arquitecto B · App Cliente, Admin Web, QA, errores, bloqueos, contratos y próximos pasos
**Fecha:** 23 de octubre de 2026. **Carácter:** fuente de transferencia ACTUALIZADA sobre el handoff histórico anterior (545 líneas). **Modo de continuidad ordenado por Owner: SIN DETENERSE salvo bloqueo real.**

**Repositorio soberano:** https://github.com/mezas3238-hue/Qore-mobile-
**Rama exclusiva Arquitecto B:** feature/mobility-cliente-admin-parallel-20261022
**PR B:** https://github.com/mezas3238-hue/Qore-mobile-/pull/8 — DRAFT, sin MERGE.
**HEAD B observado antes de este documento:** eadc7df73f5e143797dd21575f5e7a7fb110f85f — el commit de este handoff lo reemplazará; verificar HEAD al comenzar.
**Rama exclusiva A:** feature/mobility-monorepo-isolated-20261016
**PR A:** https://github.com/mezas3238-hue/Qore-mobile-/pull/7 — DRAFT, sin MERGE.
**HEAD A observado:** 5e8fc6ef601f0778a603d7a3b30172aaf51f70bc, G36.4 (A puede seguir avanzando).
**Coordinación entre arquitectos:** https://github.com/mezas3238-hue/Qore-mobile-/issues/9
**Handoff histórico exhaustivo para antecedentes G0–G22 / 2026-10-22 a primera mitad del 23:** docs/architect-b/HANDOFF_MAESTRO_INTEGRAL_ARQUITECTO_B_CLIENTE_ADMIN_CONTINUIDAD_2026-10-23.md. CONSERVAR; leer junto con este. Los SHA, estados y tareas antiguas en aquel texto SON HISTÓRICOS y prevalecen los verificados aquí.

> DIRECTIVA EJECUTIVA: retomar código ya existente, avanzar en bloques sucesivos, inspeccionar el SHA actual, implementar/pruebas/commit, observar workflows, corregir hasta verde, y seguir. Si una API real falta, bloquear únicamente la integración dependiente, registrar el contrato solicitado en issue #9 y continuar otro P0/P1 del área B. No pedir aprobaciones recurrentes para refactor, UI, validadores, pruebas sintéticas y documentación dentro del ámbito B. Sí respetar aprobaciones explícitas del Owner para merge, despliegue, datos reales, dinero y operaciones de riesgo.

---

# 1. ESTADO COMPROBADO EN GITHUB EN ESTE CORTE

| Indicador | Hecho observado |
| --- | --- |
| PR B #8 | DRAFT, no merged; 116 archivos modificados antes de agregar este handoff; 0 archivos ajenos a propiedad B |
| PR A #7 | DRAFT, no merged; 447 archivos modificados, A avanzó a G36.4 (Driver y PostgreSQL) |
| Cliente, HEAD B eadc7df | **194/194 tests PASS**, 0 FAIL; TypeScript y export Expo web SUCCESS |
| Admin Web, mismo HEAD B | **131/131 tests PASS**, 0 FAIL; TypeScript y Vite build SUCCESS |
| Driver, mismo HEAD B | Job independiente de tipo/export SUCCESS, sin modificar su código |
| Workflows B | 3/3 SUCCESS: Admin #39957767415, aislamiento Cliente/Driver #39957767227, ownership #39957767253 |
| Workflows A, HEAD 5e8fc6ef | 4/4 SUCCESS: PostgreSQL disposable #39959725292, STAGING Node contracts #39959725390, 2 apps isolation #39959725649, Expo isolated #39959725298 |
| Producción / tiendas / servidores | NO habilitados, NO lanzados, NO certificados por esos SUCCESS |

Evidencias B:
- https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39957767415
- https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39957767227
- https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39957767253

**Después de publicar este documento**, el siguiente arquitecto debe consultar los workflows del NUEVO commit del handoff. No confundir conteos de tests con certificación end-to-end, Android instalado, GPS verdadero, autenticación, permisos RLS o empresa habilitada para operar.

# 2. DECISIONES DEL OWNER QUE NO DEBEN ALTERARSE

1. Marca/producto: **Movete Fácil**, plataforma de viajes y logística en Paraguay, activación por zonas. Experiencia de usuario competitiva frente a Uber/Bolt, sin inventar ventajas verificadas.
2. **DOS APLICACIONES MÓVILES REALMENTE DISTINTAS**, NO juntas: Cliente/Pasajero (apps/movete-cliente) y Driver/Conductor/Repartidor (apps/movete-driver). Admin es WEB independiente (apps/movete-admin), no app móvil.
3. Viajes pasajeros en AUTO; envíos particulares AUTO/MOTO y entregas comerciales supermercados, restaurantes, farmacias OTC y otras aprobadas. **MOTO con pasajeros prohibida** hasta verificación normativa/seguro/municipio.
4. La cobertura de zona no garantiza oferta, aceptación, ETA, seguridad, cantidad de conductores ni entrega. No derivar señales falsas de mocks.
5. Precio de viaje, entrega, tarifa dinámica, comisiones, impuestos, conciliación e ingresos se deciden en BACKEND con Gs/PYG; UI no inventa importes, distancias, descuentos, comisiones ni pagos.
6. **50 elementos es límite POR PÁGINA, NUNCA límite global de pasajeros, conductores, pedidos, expedientes o viajes**. La paginación por cursor debe recorrer todas las páginas; rendimiento real pendiente de certificar.
7. KYC de conductores y documentos: registro CENTRAL privado del backend (propiedad A). Driver captura con permiso, Admin WEB revisa solo lo autorizado; no almacenar documento en el frontend o telemetría.
8. Lovable se reservará esencialmente para interfaz definitiva y experiencia después de la infraestructura, sin delegarle motor de dispatch, seguridad, Auth, RLS, PSP, SQL ni reglas de dinero.
9. No mezclar este proyecto con trading / qore-core. GitHub es la fuente de verdad.
10. **NO MERGE, NO DEPLOY/NO LIVE, NO VPS, NO app stores, NO PSP, NO usuarios/PII reales, NO modificación de producción ni de SQL remoto, NO secretos en repositorio** sin aprobación explícita del Owner.
11. QA/STAGING solamente con datos sintéticos; ni OpenAPI ni loopback/disposable constituyen certificado de plataforma comercial lista.

# 3. DIVISIÓN DE PROPIEDAD ABSOLUTA A / B

**Arquitecto B escribe exclusivamente:**
- apps/movete-cliente/**
- apps/movete-admin/**
- docs/architect-b/**

**Arquitecto A escribe exclusivamente:**
- apps/movete-driver/**, apps/mobility-expo/**
- backend, Postgres, SQL, auth, JWT/MFA/RLS, KYC/documentos, storage, pricing, dispatch, comisiones y payments
- .github/**, raíz, lockfiles generales, scripts y documentación común docs/architecture/**, docs/handoff/**

Si falta contrato: abrir comentario técnico preciso en issue #9; A define API, B adapta cliente. No rebase/merge/force-push unilateral. PR #8 basa en rama A; pueden cambiar las ramas en paralelo. Un cambio debe usar el HEAD B más nuevo como parent y operación con expected SHA/lease. Verificar ownership tras cada commit.

# 4. INVENTARIO FUNCIONAL YA CONSTRUIDO ANTES DEL PRESENTE CORTE

## 4.1 Cliente Expo / Passenger
- Expo/React Native/Expo Router, identidad de app Cliente aislada; pantallas: inicio, viaje, envíos, comercios, cotización, seguimiento, historial, cuenta, pagos/recibos y seguridad/soporte. Las integraciones externas permanecen cerradas hasta certificación, pero la UI se diseña para operación real.
- ClientRuntime + client-experience: estado efímero, subscribe/snapshot, limpieza segura de recursos, independencia de Driver y operaciones remotas OFF por defecto.
- client-session: únicamente rol Passenger, subject UUID, token efímero, TTL, logout y rotación de JWT; invalida acciones tardías y publica revisión de privacidad sin revelar JWT.
- client-gateway: validación estricta de carga y role, HTTPS fijado, JWT, allowed operations, DTO/HTTP, control 401/403/409/429/503, manejo de timeout.
- client-mutations: requestKey UUID idempotente, mismo cuerpo en retry, exclusión ANTES del await, no generar segundo despacho tras 409/timeout, no asumir éxito comercial por ACK HTTP.
- quote-view: visualiza únicamente tarifas G7/server-priced en Gs, identidad/servicio/TTL/routing verificados. No precio ficticio.
- rider-polling/rider-status: seguimiento con revisión monotónica, propietario, asignación persistida, conductor/placa validados, GPS consentido y fresco, ETA únicamente verificada, pérdida de conexión retira coordenadas.
- Formularios de viaje AUTO, envíos por AUTO/MOTO carga, categorías y dimensiones, comercio/carrito por sucursal; pagos preparados para una futura integración PSP real y soporte local sin declarar falsamente alerta, envío o asistencia.
- client-history-gateway + history-feed: historial autenticado, hasta 50/página SIN tope global; cursor HMAC firmado por servidor por cabecera X-Qore-History-Cursor; propietario, TTL, revisión y retries; no exponer otro Passenger.
- ride-cancellation: cancelación del viaje propio con UUID seguro OS, confirmación explícita y key inmutable; no declara viaje cancelado hasta GET status del servidor.
- admin no se incluye ni comparte librerías privadas de conductor en el binario Cliente.

## 4.2 Admin Web independiente
- React 19 / TypeScript / Vite: roles Admin y Owner separados, MFA/roles expuestos sólo como capacidades públicas, sin service_role en navegador.
- AdminRuntime/admin-experience: KYC, zonas, incidentes, auditoría y owner finance por sesión; sin operaciones con efecto comercial no certificadas.
- Admin KYC queue/kyc-page-view: metadata de vehículo/documentación, estados y caducidad; no fotos/PII; **DOCUMENTOS VÁLIDOS != VEHÍCULO HABILITADO**; ningún botón local aprueba licencia.
- Zonas: modalidades AUTO_RIDE/AUTO_DELIVERY/MOTO_DELIVERY, separación cobertura/oferta y TTL de online.
- Incidentes: cola mínima de severidad/estado; NO tramitación de emergencias live, no SOS.
- Auditoría: proyección parcial G30 para revisión de vehículos, incidentes, suspensiones/restablecimiento; **NO bitácora universal de zonas/tarifas/comisiones/comercios/accesos** hasta ampliar A.
- Owner finance: PYG, neto reconciliado que puede ser negativo, ledgerRevision, RBAC Owner, sin saldo real/banco ni herramientas de cobro.
- Admin-read-gateway A05: HTTPS fijado, JWT/MFA, scopes, paginación opaca 44–256 caracteres sintácticos, errores de cursor, prevención de respuesta tardía; backend verifica firma real.
- Admin Web responde a 50 filas por página sin truncar la plataforma a 50; límites de datos exclusivamente por respuesta.

# 5. HISTORIAL CRONOLÓGICO DETALLADO DE TRABAJOS DE B EN ESTE CHAT (NO REPETIR)

**El handoff histórico contiene 84 archivos iniciales + hitos del 22/23; aquí se incorpora TODO el bloque posterior desde cancelación a privacidad. Commits orientativos y código verificable:**

### B01–B13 (22/23-oct, detallados en handoff histórico)
Creación y separación de pantallas Cliente; dominios para rutas AUTO, envíos, comercio, soporte y el contrato sintético histórico de pagos QA —no arquitectura financiera final—; ClientRuntime, JWT QA fail-closed, gateway, idempotencia, cancelación lógica, GPS/ETA, proyección de cotización, historial paginado; Admin con Owner/Admin, KYC, zonas, incidentes, auditoría y finanzas; CI Admin independiente, TypeScript y Expo web, control estricto de carpetas. PR #8 DRAFT, issue #9 de contratos y problemas. Histórico QA 131 Cliente/109 Admin antes de nuevas pruebas.

### B14 — Cancelación visible y segura; commits 8aa0b04b, bb053d7a, 57e685e5
En app/seguimiento.tsx se añadió UX de confirmación de cancelar para viaje propio elegible, CSPRNG OS mediante expo-crypto, secure-cancel-key.mjs (sin Math.random), botón/race lock, retry con la misma requestKey, 409 y error pendientes, sin reembolso inventado. client-experience descarta el controlador al cambiar de viaje y reconsulta estado tras ACK. Se añadió declaración TS y tests. Todo apagado por defecto.

### B15 — GET seguimiento RiderStatusV1 contra OpenAPI G11; commits 1ee127f9, 7e484a17
Nuevo ride-status-gateway.mjs: HTTPS pinned, Passenger, subject/viabilidad Auth, DTO propio, estado/revisión/eventos, flags de GPS/aceptación y frescura, 200 JSON, 401/403/404/429/503, sesión rotada y cuotas de respuesta. Integración optativa en client-experience. Test integrado cancelación ACK -> GET revisión posterior -> UI cancelada SOLO tras lectura autoritativa. No enlazado a servidor real.

### B16 — Cotización server G24 en Gs; commits 714da69a, 1af182b7, 90d1f718, 3fd42826
fare-quote-gateway.mjs + fare-quote-flow.mjs y tipos, pantalla cotizacion.tsx. POST exacto requestKey/fareMode=AUTO/subjectKind=RIDE/subjectId; nunca importe o comisión desde teléfono; ServerPricedQuoteV1 con owner, monto PYG, G7 anidado, versión, TTL y ruta verificada. Retry idempotente, sesión anterior descartada, nunca pago/reserva por solo recibo. Bug CI resuelto: startTracking del mismo viaje borraba cotización legítima; conservar únicamente si subjectId==tripId. **Bloqueo todavía vigente:** el contrato G24 requiere subjectId de servicio PREEXISTENTE; falta prequote/draft ANTES de empezar búsqueda/dispatch.

### B17 — Prevención de doble viaje + historial ilimitado; commits 492c4989, d14362f2, 97b1b7c9
client-mutations.prepare ahora impide nueva requestKey en retryable/failed: exige retry de clave original o conciliación. Historial FlatList virtualizado con onEndReached, paginación automática y manual por cursor, cuenta/timeout seguros. Map de historia usa clave compuesta kind:serviceId; RIDE, DELIVERY y MERCHANT_ORDER con UUID coincidente NO se borran entre sí. 50/página no 50 total. Pendiente escala de memoria para 100k+ elementos, sin tope backend.

### B18 — JWT Admin y paginación A05; commits b4442ebc, 1820eb75
Rotar token o expiración del mismo Admin/Owner elimina KYC/zonas/incidentes/audit/finance/cursors de sesión anterior; refresh idéntico conserva datos. Frontera HTTP exige cursor opaco base64url A05 44–256, nextCursor válido, 400 cursor expirado, authRevision y token sin leak. G28 incidente prueba 121 expedientes en 3 páginas 50/50/21; 51 en una sola página se rechaza. NO acción de seguridad comercial.

### B19 — A05 max 50/página y KYC G29; commits e27e6e7b, 48fb56dd
KYC, zonas, auditoría antes permitían 100/200 entradas en una RESPUESTA; se ajustó a máximo 50 por página en el DTO. Prueba KYC 123 filas en 50/50/23, sin límite global y sin false empty. Corrección de fixture que sombreaba variable en test de zonas; CI recuperado sin omitir tests.

### B20 — KYC evidencia, G30 alcance real; commits 74a6d50a, b176d904
Nuevo kyc-page-view.mjs tipado y pantalla Admin: EXPIRED, REJECTED, MISSING, PENDING, REPORTED_VALID, con filtros y contadores SOLO en página visible. Estado documental aprobado no autoriza vehículo automáticamente. Rechaza PII o modalidad MOTO_PASSENGER, clasifica estados de servidor, no calcula caducidad ficticia. Admin muestra alcance parcial de G30. Web QA pasó 131 tests.

### B21 — HTTP Cliente fail-closed triple gate; commits 29dce2f8, 75c1282e
client-gateway exige enabled, contractCertified y operación en certifiedOperations antes de salir a red. Ordena GET=200/POST=201, JSON, bytes y origin pinned; bloquea gateways genéricos para status viaje/cotización/comercio incompletos, descarta respuesta 201/403 de JWT antiguo. Dos errores CI intermedios por fixture expiry variable y expectativa antigua se corrigieron; Cliente QA 176/176 verde en ese corte. Enviar JSON válido NO equivale a contratación/búsqueda real.

### B22 — Preparación local segura de AUTO y envíos; commits c9c575f0, 18752a6b, 55954990
Nuevo client-request-preparation.mjs + .d.mts + tests, cuerpos EXACTOS del OpenAPI para rideRequest/deliveryRequest, UUIDv4 desde OS con validación previa, sin cálculo de ruta, dinero o llamadas externas. AUTO servicios económico/confort/XL. Envíos permitidos AUTO/MOTO carga, cinco categorías DOCUMENTS/PARCEL/GROCERIES/RESTAURANT/PHARMACY_OTC; MOTO <=10 kg, AUTO <=100 kg, dimensiones 1–200 cm, no restringidos, no medicamentos con receta. Números string ambiguos/decimal/exponentes rechazados. Vistas viaje/envios: revisar -> preparar -> mostrar borrador -> descartar SOLO ready nunca enviado; bloqueo de edición para no mostrar un texto distinto al request inmutable. No habilitar confirmación/dispatch.

### B23 — Privacidad de formularios en rotación JWT; commit eadc7df73f5e
Nuevo privacyEpoch/revisión pública sin token; ClientRuntime snapshot publica privateViewRevision. Formularios de viaje, envío y soporte usan key de revisión para desmontar y borrar datos privados INMEDIATAMENTE en logout, mismo usuario nuevo token, expiración o cambio de cuenta. Identidad continua con refresh del mismo token no borra ruta editada. El soporte ya no conserva el texto de la cuenta anterior. Pruebas de rotación y TypeScript/Expo; 194 tests Cliente PASS en HEAD actual.

**Resumen de auditoría de volumen B:** 116 archivos en PR #8 antes de este handoff, todos en rutas B; 194 tests Cliente + 131 Admin PASS, + Driver CI de aislamiento. No inferir avance comercial ni porcentaje terminado sin inventario E2E de A.

# 6. PROBLEMAS ENCONTRADOS Y CORREGIDOS (INCLUIR EN TRANSFERENCIA)

**Arreglados / probados en QA B:**
1. Doble click genera dos requestKey o reenvíos concurrentes -> fase in_flight bloqueada ANTES del primer await.
2. Timeout podía permitir otra clave para el mismo viaje -> retry conservando original, failed requiere conciliación.
3. 409/401/403 antiguos podían manipular token/revisión nueva -> comprobación de sesión posterior, fail-closed.
4. Consentimiento/GPS viejo y ETA no verificada visibles -> TTL, flags, limpieza.
5. startTracking borraba una cotización del mismo viaje -> retener quote sólo para mismo subjectId.
6. UUID de dos servicios de distintas tablas colisionaba en Map historial -> clave kind:serviceId.
7. Confundir 50 por página con 50 total -> cursor progresivo, FlatList y tests 120+ páginas.
8. Query de historial usaba cursor en URL -> cabecera firmada X-Qore-History-Cursor según contrato de A.
9. A05 aceptaba cursor corto o JSON sin nextCursor -> frontera 44–256 y DTO estricto.
10. Owner/Admin mismo usuario reusaba datos luego de rol/token cambiado -> borrado de vistas/cursors.
11. KYC/zonas/audit aceptaban 100/200 en respuesta de 50 -> max 50 per page y pruebas.
12. Informar conductor habilitado sólo por documentos valid -> UI sin autorización operativa.
13. Prometer auditoría integral G30 -> aclarado alcance parcial.
14. HTTP genérico funcionaba con enabled+origin aunque contrato no certificado -> triple gate.
15. Fixture expiración Date.now variable daba 3 FAIL en QA B21 -> expiry estable y corregir expectativas, sin saltar pruebas.
16. Fixture de zonas sombreaba objeto de test -> corrección y CI verde.
17. Formularios locales de misma cuenta conservaban PII después de JWT nuevo/logout -> privacyRevision + key remount.
18. Otros bugs históricos cerrados antes de este bloque: ERESOLVE react-dom/React 19, TypeScript imposible en JSX Admin, falta de helper cursor en test, regex UUID mal dimensionada, credenciales ausentes, race logout, recuento zona vencido 60s. Detalles en handoff histórico y STATUS_Y_CONTRATOS.

**No presentar como cerrados sin prueba real:** Auth/RLS servidor, ataques multiusuario E2E, caducidad documental real, dispatch, carga 30k+, precio/devolución, geocoding o disponibilidad; siguen en matriz siguiente.

# 7. MATRIZ DE PENDIENTES — PRIORIZACIÓN Y PROPIETARIO

## P0 contratos e infraestructura que faltan para la APP FUNCIONAL (A propietario)
A-01. AUTH Passenger/Driver/Admin/Owner de proveedor real: JWT, audience, role, RLS por objeto y tenant, MFA AAL2 para Admin/Owner, revoke/refresh, cross-session concurrency, prueba otro actor 401/403.
A-02. Endpoint y secuencia **prequote/draft SIN dispatch**, con subjectId del servidor ligado a JWT+TTL+requestKey, ruta/cotización Gs verificadas; aceptación explícita del pasajero ANTES de buscar conductor. No usar tripId inventado.
A-03. DTO estricto y persistido de POST rideRequest y deliveryRequest (OpenAPI actual usa respuesta genérica, NO da evidencia cerrada de asignación). Definir requestKey, tripId/deliveryId, owner, revision, estado, monto/TTL, idempotencia, 409 conflict, getByKey/reconciliación.
A-04. Contrato asignación/dispatch real auto/repartidor, disponibilidad ≠ cobertura, elegibilidad por servicio, atomicidad de oferta/revisión, conductor único en conflictos de sesiones y clases, reintento seguro.
A-05. STAGING HTTPS remoto autorizado con sintéticos, JWT verificable, RLS, TLS, CORS/CSP, rate-limit, secretos backend, logs protegidos, CI E2E y monitoreo. Las pruebas disposable G36 son LAB, no smartphone conectado.
A-06. Pricing real diferenciado AUTO_RIDE, AUTO_DELIVERY, MOTO_DELIVERY, comerciante; reglas Paraguay, Gs, distancia/tiempo, demanda, tasas/comisiones, rounding, cancelación, idempotencia y reconciliation.
A-07. KYC central privado: permisos por documento/estado, retención, revocación, firma/evidencia, no PII en URL pública, validación caducidad licencia/seguro/revisión, auditoría de decisiones. MOTO pasajeros bloqueada.
A-08. Habilitar rutas y permisos Admin A05/G29/G30, SQL store RLS, Owner finanzas autenticado, audit chain/retention. Escrituras KYC/zonas/moderación sólo con permiso.
A-09. Viajes, envíos y comercios en todas las zonas habilitadas, sin confundir cobertura con capacidad online. Pruebas masivas e índices.
A-10. SDK y permisos GPS, mensajes push, rutas/ETA, antifraude, seguridad, legalidad/seguros de cada municipio.
A-11. PSP, cobros pasajeros, liquidaciones Driver, reembolsos, tributación y conciliación sólo tras decisión/aprobación Owner; pagos de hoy siguen DEMO.
A-12. CI de versiones móviles reales, APK/AAB/iOS, emulador y dispositivos físicos; no delegar E2E nativo a una export web.
A-13. Completar auditoría G30 de tarifas/comisiones/zonas/comercios/accesos y reporte de incidentes reales con workflow seguro sin falsas promesas SOS.

## P1 próximos trabajos seguros e independientes dentro del ámbito B (continuar YA)
B-01. Auditoría de seguridad de mutaciones **en todo ciclo**: si rota JWT entre prepare/submit/ACK, limpiar formulario privado y bloquear envío obsoleto; test same subject / new token / logout.
B-02. Armar harness de UI tests e2e sintético de pasos de viaje AUTO -> preparación -> visualización segura -> borrador descartable -> pendiente de servidor. No inventar tramo dispatch.
B-03. Análogo en envíos AUTO/MOTO: clasificación legal, pesos/dimensiones, categoria, estado de error/offline, bloquear exposición de destinatarios, persistencia solo local temporal.
B-04. Comercios: dominio de checkout productivo ligado a catálogo/stock/version servidor, invalidaciones por cambios de precio/stock/sucursal y fail-closed hasta revalidación atómica. No crear rutas o campos inexistentes ni sustituir la integración real por una demo.
B-05. Status envíos: estudiar contrato exacto A; si sigue respuesta genérica no mostrar prueba de entrega/ubicación/estado como autoritativo. Crear gateway tipado sólo cuando DTO real disponible o adaptador QA OFF.
B-06. Historial a escala: cursor y FlatList ya completados; falta política de retención en memoria/windowed cache con desplazamiento y carga reversa sin limitar registros globales. Test 100k+ registros sintéticos, cambio de cuentas y memory pressure.
B-07. Accesibilidad real RN: lector de pantalla, fuentes grandes, safe area, teclado, contraste, foco de modal, errores con accessibilityRole=alert, Android emulador; sin datos reales.
B-08. Soporte: borrador seguro con aviso claro de que NO reporta a 911/SOS; prueba de cierre/rotación y futura confirmación backend, no un falso “enviado”.
B-09. Admin: filtros de KYC por página ya implementados; agregar búsqueda/filtros por servidor con cursor y role si A certifica el contrato (NO filtrar solo primera página presentándolo como global).
B-10. Admin KYC: metadatos autorizados, caducidad/verificación/legalidad, auditoría/relectura, MFA real provisto por A; no exponer documento hasta URL efímera con scopes firmados y gate Owner.
B-11. Zonas Admin: AUTO_RIDE/AUTO_DELIVERY/MOTO_DELIVERY con capacidad TTL/frescura y sin inferir disponibilidad. Diseño futuro de doble-confirmación para cambios certificados, sin mutación LIVE.
B-12. Incidentes/Admin: priorización, accesibilidad, bandeja paginada sin límite, roles; ninguna suspensión real desde UI hasta transacción A.
B-13. Auditoría y Owner: desglose contable con fuente reconciliada, neto negativo, fechas/moneda, sin cifras bancarias o PII ficticias.
B-14. Config de STAGING únicamente mediante DI segura y flags OFF por defecto; no poner service_role, contraseñas, Bearer o pins secretos en bundle Expo.
B-15. Crear tests de concurrencia (logout/refresh/401/403, timeout+retry/409, 429/503, navegación durante request, same trip/different rider, URL maliciosa, gps old), E2E UI y snapshots de privacidad.
B-16. Preparar entrega Lovable exclusivamente UI final cuando las APIs estén listas; no permitir app visually complete sobre una simulación sin avisos.

## P2 decisiones/requisitos transversales antes de LIVE (Owner + A/B)
- Política tarifaria final (AUTO diferente de MOTO entrega), comisión Driver/negocio, IVA y documentos Paraguay.
- Términos, privacidad, retención KYC, protección y seguros, habilitación territorial, contenido permitido, política de reembolso y cancelación.
- PSP, pasarela, custodia, cuentas y plan de cobro, prevención de fraude y compensación.
- Pruebas simultáneas y carga (1k/10k/30k+ y crecimiento), seguridad, respaldo, recuperación ante incidentes y soporte operativo.
- Firma/distribución móviles, íconos/branding, políticas Play Store/App Store y autorización OWNER al lanzamiento.
- Definición de qué capas de frontend delegar a Lovable tras entregar componentes/API revisados.
- Autorización explícita de merge y despliegue, por separado; DRAFT hasta entonces.

# 8. BLOQUEOS REALES VS TRABAJO QUE NO DEBE DETENERSE

**Bloqueo real puntual:** falta de recurso/contrato con riesgo de dinero, exposición de documento o GPS, permisos operativos, acción irreversible, LIVE/despliegue o decisión legal que solo Owner puede tomar. Entonces **NO habilitar esa acción**; registrar dependencia con checklist de datos y pruebas en issue #9 y cambiar a siguiente bloque B ejecutable.

**NO son bloqueos para detener todo:** un CI que demora, un DTO de nueva función aún no certificado, falta Lovable, falta PSP o falta app nativa para una prueba que puede hacerse hoy en QA sintética. Corregir, probar y continuar tareas independientes. No anunciar trabajos futuros como completados.

# 9. GATES DE ACEPTACIÓN QUE DEBE SEGUIR EL PRÓXIMO ARQUITECTO

**QA local B aprobado al corte:**
- [x] Dos apps móviles separadas y Admin web separado.
- [x] Cliente 194 tests, TypeScript, Expo export web SUCCESS en SHA eadc7df.
- [x] Admin web 131 tests, TypeScript y Vite build SUCCESS en SHA eadc7df.
- [x] Ownership B 0 violaciones, PR #8 DRAFT sin merge.
- [x] Formularios seguros, auth mock, idempotencia, cotización/seguimiento/cancelación/historial, UI KYC y filtros locales, pagination 50/page sin techo.

**QA que falta:**
- [ ] E2E completo de UI Cliente/Driver/Admin con personas y datos SINTÉTICOS.
- [ ] Certificación API STAGING remota, tokens JWT auténticos, roles/MFA/RLS y esquema versionado por A.
- [ ] Prueba de emisión + aceptación de quote antes de activar dispatch, reconciliación tras timeout y no duplicación en DB.
- [ ] Envío/documentos/comercios con receipt tipado y límites regulatorios/autorizados.
- [ ] E2E Android real/emulador; RN export web NO basta.
- [ ] Prueba carga/escala y acceso a todo el historial/documentos sin límite global.
- [ ] Seguridad SQL/Storage, CSP/CORS, privacidad y secrets auditados, retención conforme ley.
- [ ] Autorización Owner para preparar rollout, configurar servicios reales, merge, pagos, tiendas, despliegue y LIVE.

# 10. PROCEDIMIENTO EXACTO DEL SUCESOR EN UN NUEVO CHAT

1. Entrar en repo mezas3238-hue/Qore-mobile-. Leer **este** handoff maestro + el histórico de 545 líneas, el PR #8, el PR #7, issue #9 y docs/architect-b/STATUS_Y_CONTRATOS.md.
2. Obtener SHA actual A y B y cambios recientes, comprobar scopes de 100% archivos PR #8 y que ambos PR siguen DRAFT. No asumir que eadc/5e8 siguen siendo HEAD.
3. Consultar OpenAPI vigente: apps/mobility-expo/docs/backend/openapi/movete-facil-staging.openapi.json en A, y documentación G29/G30/G36. No reinventar rutas. Diferenciar existencia de contrato vs ruta HTTP desplegada.
4. Verificar última ejecución GitHub Actions de B: Admin Web QA, two app isolation, Architect B ownership boundary, y revisar dependencias CI de A. Con fallos, ver logs, diagnosticar y corregir hasta verde, sin borrar tests.
5. Empezar con B-01 o B-02; cambios dentro de rutas B, con datos sintéticos y gates OFF. Commit atómico, verificar que HEAD no se movió paralelamente (expected SHA/lease).
6. Volver a leer contratos si A cambia HEAD; si necesita backend nuevo, escribir comentario en issue #9 con DTO request/response, rol, TTL, revisión, error, idempotencia y pruebas requeridas. Cambiar a B-03/B-04 mientras A responde.
7. Tras cada bloque: código, pruebas adversariales, TypeScript/Expo o Vite, CI 3/3 SUCCESS, commit verificado, update a docs/architect-b y issue #9. Luego continuar sin esperar autorización salvo bloqueo REAL.
8. Mantener UI Cliente, Driver y Admin totalmente separadas; NO tocar .github ni docs compartidos o ramas A. No merge, release ni autorización tácita de producción.

**Comandos de QA si se usa Work con terminal:**
- Cliente: cd apps/movete-cliente && npm install --no-audit --no-fund --ignore-scripts && npm run check && npx expo export --platform web --output-dir dist
- Admin: cd apps/movete-admin && npm install --no-audit --no-fund --ignore-scripts && npm run check && npm run build
- Driver pertenece a A. Consultar CI; no instalar ni modificar su entorno por cuenta del B.

# 11. REFERENCIAS Y DOCUMENTOS CANÓNICOS

**Fuente principal actual:** este archivo docs/architect-b/HANDOFF_MAESTRO_B_CIERRE_Y_CONTINUIDAD_2026-10-23.md.
**Histórico 545 líneas:** docs/architect-b/HANDOFF_MAESTRO_INTEGRAL_ARQUITECTO_B_CLIENTE_ADMIN_CONTINUIDAD_2026-10-23.md
**Especificación/registro:** docs/architect-b/STATUS_Y_CONTRATOS.md
**Preparación de formularios:** docs/architect-b/SAFE_LOCAL_RIDE_DELIVERY_PREPARATION_UI_2026-10-23.md
**Privacidad de formularios:** docs/architect-b/CLIENT_FORM_PRIVACY_EPOCH_LOGIN_ROTATION_2026-10-23.md
**Mutaciones:** docs/architect-b/IDEMPOTENCY_MUTATIONS_RETRY_GUARD_2026-10-23.md
**HTTP contratos:** docs/architect-b/CLIENT_HTTP_OPERATION_CERTIFICATION_STALE_JWT_2026-10-23.md
**Tarifas G24:** docs/architect-b/FARE_QUOTE_G24_CLIENTE_QA_2026-10-23.md
**Cancelación propia:** docs/architect-b/CONTINUIDAD_B_CANCELACION_UX_SEGURA_2026-10-23.md
**Tracking G11:** docs/architect-b/RIDER_STATUS_G11_GATEWAY_QA_2026-10-23.md
**Historial:** docs/architect-b/HISTORY_INFINITE_SCROLL_IDENTITY_2026-10-23.md y HISTORIAL_CLIENTE_OPENAPI_G11_2026-10-23.md
**Admin roles/cursors:** docs/architect-b/A05_G28_ADMIN_JWT_CURSOR_SECURITY_2026-10-23.md
**Admin paginación:** docs/architect-b/A05_PAGE_SIZE_50_UNBOUNDED_G29_KYC_2026-10-23.md
**Admin G29/G30 UI:** docs/architect-b/G29_KYC_EVIDENCE_G30_AUDIT_SCOPE_UI_2026-10-23.md
**Admin incidentes:** docs/architect-b/G28_INCIDENTS_A05_121_PAGES_QA_2026-10-23.md
**Código Backend:** apps/mobility-expo/docs/backend/openapi/movete-facil-staging.openapi.json en rama A; PR #7 y docs/architecture/** bajo propiedad A.
**Coordinación y dependencies:** issue #9.
**Evidencias workflows:** #39957767415, #39957767227, #39957767253 para B y #39959725292 / #39959725390 / #39959725649 / #39959725298 para A en sus SHAs de corte.

# 12. PROMPT EXACTO PARA PEGAR EN EL SIGUIENTE CHAT / CHATGPT WORK

Soy el nuevo **Arquitecto B** de **QORE Mobile / Movete Fácil**. Continuá inmediatamente el desarrollo **SIN DETENERTE salvo bloqueo REAL**. GitHub es la verdad: https://github.com/mezas3238-hue/Qore-mobile-. Leé primero docs/architect-b/HANDOFF_MAESTRO_B_CIERRE_Y_CONTINUIDAD_2026-10-23.md y el handoff histórico del Arquitecto B, PR #8 DRAFT, PR A #7 DRAFT e issue #9. Verificá los HEAD/CI recientes (no reutilices SHAs antiguos). Propiedad exclusiva B: apps/movete-cliente/**, apps/movete-admin/**, docs/architect-b/**. A es dueño de apps/movete-driver/**, backend, PostgreSQL, SQL, JWT/MFA/RLS, OpenAPI, .github, scripts y docs comunes. DOS apps móviles independientes; Admin es web. El corte precedente tuvo 194/194 tests Cliente, 131/131 Admin, Driver y workflows verdes; NO hay operación comercial todavía. Retomá por B-01 (rotaciones/operaciones preparadas) y B-02 (E2E de UX segura AUTO/envíos), o el siguiente módulo B realizable. No inventes dinero, GPS, conductores, permisos, contratos ni nombres de endpoints. Implementá cambios reales y QA sintética, commits atómicos en PR #8 con lease, observá CI, repará fallos y continuá. Si falta contrato A, registrá en issue #9 y avanzá otra tarea B. NO MERGE, NO DEPLOY/LIVE, NO PII/pagos reales, NO modificar Driver/A.

**CIERRE:** el trabajo B actual está entregado mediante commits y QA auditables; **no equivale a aplicación comercial terminada**. El siguiente arquitecto tiene tareas independientes listas para implementar sin detenerse, y bloqueos externos documentados y delimitados.

---

# 13. CONTINUIDAD POSTERIOR AL HANDOFF — B24

El siguiente bloque ya no está pendiente: **B-01 fue implementado** después del commit inicial de este handoff.

- Viaje/envío, cotización G24 y cancelación quedan ligados a la revisión privada de la sesión que preparó la operación.
- Un JWT nuevo de la misma cuenta no puede transmitir el borrador anterior; los gateways lo bloquean antes de red.
- Rotación o logout durante el request descartan el ACK tardío y limpian la UI privada.
- Refresh idéntico del mismo token conserva el borrador legítimo.
- QA local del bloque: **200/200 tests Cliente**, TypeScript y Expo export web SUCCESS. Consultar el SHA/CI del commit posterior antes de declarar GitHub verde.
- Documento: `docs/architect-b/CLIENT_MUTATION_SESSION_REVISION_GATE_2026-10-23.md`.

El commit B24 quedó certificado en GitHub como `93cb5bf13ec8`: los tres workflows SUCCESS.

## B25 — B-02 completado

- Se agregó un harness headless del flujo UI AUTO: editar, revisar, preparar borrador no enviado y descartar.
- Nunca habilita precio, GPS, conductor o dispatch; esos campos permanecen nulos y el paso siguiente falla cerrado por contrato pendiente.
- Cubre Auth ausente, ruta inválida, una sola requestKey, cero red y remount por rotación JWT.
- QA local: **204/204 tests Cliente**, TypeScript y Expo export web SUCCESS. Verificar SHA/CI GitHub del commit B25.
- Evidencia: `docs/architect-b/SAFE_AUTO_UI_JOURNEY_HARNESS_2026-10-23.md`.

El commit B25 quedó certificado en GitHub como `916db657c56c`: los tres workflows SUCCESS.

## B26 — B-03 completado

- Harness headless de envíos AUTO/MOTO carga: edición, validación, preparación temporal, estados online/offline y descarte.
- Valida límites de peso/dimensiones y artículos restringidos antes de generar UUID.
- No modela ni expone PII de destinatario; deliveryId, repartidor y GPS permanecen nulos.
- QA local: **208/208 tests Cliente**, TypeScript y Expo export web SUCCESS. Verificar SHA/CI GitHub del commit B26.
- Evidencia: `docs/architect-b/SAFE_DELIVERY_UI_JOURNEY_HARNESS_2026-10-23.md`.

## B27 — B-04 completado hasta el límite real del contrato

- El carrito ahora deriva cada línea de un catálogo vigente del servidor y utiliza los nombres de precio, stock y clase ya presentes en `CatalogItem` del OpenAPI.
- Requiere `branchId`, `itemId`, versión opaca y expiración; bloquea artículo ajeno/inactivo, cantidad mayor al stock, catálogo vencido y contenido distinto bajo la misma versión.
- Cualquier cambio de precio o stock de una línea elegida invalida el carrito. Cambiar sucursal elimina líneas, versión y subtotal anteriores.
- El subtotal es informativo y deriva del servidor; el total final, tasas, reserva y compra no se calculan en el móvil.
- El `MerchantOrderRequest` se conserva sin campos inventados. La precondición de versión queda separada y no puede enviarse todavía: el OpenAPI no ofrece lectura Buyer de catálogo, revalidación atómica ni receipt de pedido tipado.
- La pantalla ya no se presenta como demo: explica el gate de integración real y nunca muestra productos ficticios.
- QA local del bloque: **211/211 tests Cliente**, TypeScript y Expo web export SUCCESS.
- Evidencia: `docs/architect-b/COMMERCE_PRODUCTION_CHECKOUT_GUARD_2026-10-23.md`.

El commit B27 quedó certificado en GitHub como `f969a526d0bd`: ownership #39965493620, Admin #39965493637 y two-app isolation #39965493603, todos SUCCESS.

## B-05 auditado contra el HEAD actual de A

- OpenAPI leído desde PR #7 HEAD `346f9dfcbd2fc3a57cb7951c473120bc8571d88d`.
- `GET /v1/staging/deliveries/{deliveryId}/status` conserva response `Success` genérica; no hay DTO de propietario, revisión, estado, asignación, ubicación ni prueba de entrega.
- Crear un gateway tipado hoy obligaría a inventar campos. B lo deja bloqueado y documenta a A el contrato requerido.
- Evidencia: `docs/architect-b/DELIVERY_STATUS_REAL_CONTRACT_AUDIT_2026-10-23.md`.

La siguiente prioridad independiente pasa a **B-06: historial con memoria acotada y navegación por ventanas**, sin confundir el límite de memoria del dispositivo con un límite global del historial del servidor.

## B29 — B-06 historial escalable completado

- `history-feed.mjs` conserva una ventana móvil de 500 elementos por defecto, configurable hasta 5.000 para pruebas/control de integración.
- Cargar páginas antiguas ya no hace crecer indefinidamente el mapa del móvil: desplaza los registros recientes ya recorridos y conserva el cursor siguiente del servidor.
- El snapshot informa tamaño máximo, filas leídas, registros liberados y si existen datos recientes fuera de la ventana.
- `historial.tsx` avisa al usuario cuando la ventana se desplazó y ofrece volver a los servicios más recientes mediante reset seguro.
- Logout, cambio de cuenta, expiración y DTO inválido limpian ventana y métricas privadas.
- Prueba de estrés: 100.000 servicios/2.000 páginas, máximo 500 en memoria, recorrido completo sin tope global. QA local: **212/212 tests Cliente**, TypeScript y Expo web export SUCCESS.
- Evidencia: `docs/architect-b/HISTORY_WINDOWED_MEMORY_2026-10-23.md`.

El commit B29 quedó certificado en GitHub como `b1b4ad943658`: ownership #39966255875, Admin #39966255923 y two-app isolation #39966256833, todos SUCCESS.

Límite restante: el contrato actual solo ofrece cursor hacia páginas antiguas. La navegación reversa granular requiere que A certifique cursor anterior o semántica bidireccional; B no lo inventa. La UI sí puede volver de forma segura al inicio reciente.

La siguiente prioridad independiente pasa a **B-07: accesibilidad real de pantallas Cliente**, con foco, lector, fuentes grandes, teclado y alertas, sin depender de datos ficticios.

## B31 — B-07 base accesible Cliente completada

- `ClientUI.Action` centraliza objetivo táctil mínimo de 48 px, texto de 16 px, contraste AA y estados accesibles `disabled`, `selected` y `busy`.
- Texto auxiliar mínimo 14 px, escalado del sistema conservado, filas flexibles y controles dimensionados para fuentes grandes.
- Pantallas con encabezados semánticos, etiquetas de entrada, regiones vivas, áreas seguras y cierre de teclado; confirmación de cancelación recibe foco y aísla su superficie para tecnología asistiva.
- Se retiró el lenguaje de demo en navegación/pagos. La UI explica la integración productiva pendiente y sigue fail-closed: no recibe tarjetas ni afirma cobro/receipt sin PSP y backend certificados.
- QA local: **220/220 Cliente PASS**, TypeScript y Expo export web SUCCESS.
- Evidencia: `docs/architect-b/CLIENT_ACCESSIBILITY_FOUNDATION_2026-10-23.md`.
- Pendiente de certificación: matriz manual TalkBack/VoiceOver en dispositivo o emulador; no se afirma validación nativa a partir del export web.

La siguiente prioridad independiente pasa a **B-08: soporte seguro**, con limpieza por rotación/logout y futura confirmación tipada del backend, sin representar nunca un borrador como aviso a 911/SOS ni como caso enviado.

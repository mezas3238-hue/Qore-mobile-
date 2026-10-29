# HANDOFF MAESTRO EJECUTIVO Y OPERATIVO — QORE MOBILE / MOVETE FÁCIL
## Corte verificado: 28 OCT 2026 · A+B+C+D · G158 · GitHub primero, E2E real después

> **ESTE DOCUMENTO ES LA ORDEN DE CONTINUIDAD, NO UNA SOLICITUD DE OTRO HANDOFF.** El próximo arquitecto debe tomar el código actual, implementar los recorridos operativos faltantes y conseguir una prueba integrada de la MISMA solicitud en las cuatro piezas. Nada de reconstruir el proyecto, presentar CI sintética como operación comercial, inventar licencias ni crear más prototipos en lugar de conectar lo existente.

### 0. ARRANQUE DEL SIGUIENTE CHAT — LEER PRIMERO
1. Actuar como **arquitecto ejecutivo integrador A+B+C+D**, coordinando Backend, Cliente, Driver y Admin/Comercios; no delegar la responsabilidad de la continuidad.
2. Abrir GitHub y verificar el HEAD ACTUAL de `integration/qore-mobile-e2e-four-apps-20261027` antes de modificar nada. Otro arquitecto puede haber avanzado en paralelo: **no hacer force push**, no sobrescribir sus cambios, usar `expected_sha`.
3. Tomar la matriz P0 de este documento y **empezar inmediatamente a implementar** el primer bloqueo técnico real que no requiera una autorización externa. Preferir código de integración y UI usable, no nuevos handoffs ni tests inconexos.
4. Verificar una sola identidad/sesión original, mismas `requestKey`, `tripId` / `deliveryId` / `orderId`, estado, tarifa y revisión en B→A→C→D. Cada caso requiere fuente PostgreSQL canónica; conservar todas las barreras legales.
5. Registrar NO_GO para dependencias externas: alta real PSP, licencias/autorización legal y proveedor STAGING (Render, Supabase, certificados, teléfonos). Continuar otros módulos sin pedir de nuevo datos ya establecidos ni declarar falsamente GO.
6. **No merge a main, no producción/LIVE, no nuevo despliegue Render/Supabase, no publicar Store ni consumir recursos de pago sin orden expresa del Owner.** El próximo arquitecto puede realizar trabajo funcional entero en GitHub/Actions antes de pedir esa autorización.

### 1. FUENTE DE VERDAD Y EVIDENCIA COMPROBADA
- Repo: https://github.com/mezas3238-hue/Qore-mobile-
- Rama de trabajo: `integration/qore-mobile-e2e-four-apps-20261027`.
- **HEAD de código verificado al corte:** `6ffaff0dc7766a1f2cb0ad8ae3aa253208909613`.
- Commit: https://github.com/mezas3238-hue/Qore-mobile-/commit/6ffaff0dc7766a1f2cb0ad8ae3aa253208909613
- Build/tipos A+B+C+D SUCCESS: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40792620466
- PostgreSQL16 descartable + HTTP + cadena completa + concurrencia SUCCESS: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40792620493
- El mismo corte integra G148→G150→G153→G154, G155, G156, G157 y G158. **GREEN no equivale a entorno externo habilitado ni ejecución de servicio pagado**.
- El enlace de esta rama, no el HEAD textual congelado, es la referencia para continuar: https://github.com/mezas3238-hue/Qore-mobile-/tree/integration/qore-mobile-e2e-four-apps-20261027
- Base heredada: `docs/handoff/HANDOFF_MAESTRO_FINAL_A_B_C_D_GITHUB_PRIMERO_E2E_PENDIENTES_2026-10-28.md` y `docs/handoff/HANDOFF_MAESTRO_EJECUTIVO_QORE_MOBILE_GITHUB_A_B_C_D_G142_PRE_RENDER_SUPABASE_2026-10-28.md`. Los SHAs y estados de esos documentos son HISTÓRICOS: prevalece el HEAD real.

### 2. MANDATO DEL PROPIETARIO — INALTERABLE
**Marca:** QORE Mobile / Movete Fácil. **Mercado inicial:** Paraguay; precios, cobros y recibos en guaraníes enteros (PYG/Gs). Arquitectura abierta a expansión futura sin habilitar cobertura internacional ficticia.
**Cinco servicios separados**:
1. `AUTO_RIDE`: pasajero en automóvil.
2. `MOTO_RIDE`: pasajero en moto, nunca confundir con moto de carga; licencia/habilitación/seguro específicos.
3. `DELIVERY_AUTO`: paquetes en auto (algunos contratos internos anteriores dicen `AUTO_DELIVERY`; normalizar en API).
4. `DELIVERY_MOTO`: paquetes en moto (algunos contratos dicen `MOTO_DELIVERY`).
5. `COMMERCE`: supermercado, farmacia OTC, restaurante y demás tienda, carrito/stock, preparación y reparto.

**Owner configura TODAS las comisiones desde Admin Web** y las tarifas específicas:
- Pasajeros AUTO comisión nominal inicial 15 %, MOTO 12 %. **Subsidio pasajero 10 % independiente**; no tratar esos números como rentabilidad neta y respetar piso de seguridad financiera.
- Carga AUTO/MOTO: tarifas y comisiones por reglas propias, configurables, no aplicar subsidio de pasajeros.
- COMMERCE: comisión configurable por servicio, y granularidad por comercio/rubro/zona conforme a futura política autorizada. No copiar porcentajes arbitrarios del mercado ni inventar descuentos.
- Cambios versionados/auditados; recibos, consentimiento, reparto y ledger históricos inmutables.
- Cliente elige AUTO/MOTO; no reasignar otro tipo sin consentimiento. Mapas/ruta deben funcionar en Paraguay y no mostrar una ruta sintética como mapa real.
- La seguridad contra estafas necesita identidad, ratings bilaterales, pruebas de evento/entrega, incidentes con derecho a revisión: **nunca expulsar por una sola estrella o alegación**.

### 3. ESTRUCTURA Y RESPONSABILIDADES (YA INTEGRADAS EN UN ÁRBOL)
- **A Backend / autoridad:** `apps/mobility-expo/server/` y `apps/mobility-expo/docs/backend/staging_only/`. Contratos HTTP, PostgreSQL 16, Auth/RBAC, tarifas, ledger, Geoapify, ofertas, KYC, custodia.
- **B Cliente Expo nativo:** `apps/movete-cliente/`. App iOS/Android de pasajeros, envíos, comercios, cotizaciones, seguimiento, historial, calificaciones, recuperación de claves.
- **C Driver Expo nativo:** `apps/movete-driver/`. App separada conductor/repartidor, documentación, ofertas privadas, disponibilidad, estado de viaje, custodia G66/G67, ganancias, chat.
- **D Admin Web + comercio:** `apps/movete-admin/`. Owner/Admin con MFA AAL2, comisiones/rates, incidentes, trazabilidad, auditoría y **portal independiente de personal del comercio** en `comercio.html` / `src/merchant-main.tsx`.
- **CI:** `.github/workflows/mobility-g4-postgres-disposable.yml` y workflow de integración A+B+C+D. Node 22+, Expo SDK 57, React Native, Vite, PostgreSQL 16 desechable.

### 4. LO QUE REALMENTE ESTÁ IMPLEMENTADO — NO REHACER
| Flujo | Evidencia integrada | Límite actual |
|---|---|---|
| AUTO B→A→D | G73/G98/G131/G138: prequote, booking, recuperaciones, trazabilidad y cancelación | El NUEVO viaje del Cliente aún no se prueba con aceptación del MISMO Driver legal G38/G71 |
| MOTO B→A→D | G100/G101/G102/G119/G142: reserva MOTO, lecturas y Admin/ledger QA | No hay ejecución completa de nueva oferta y finalización legal C del mismo `tripId` |
| Driver AUTO | G10/G36/G38/G65/G71/G85/G106/G109 y bandeja/ofertas C | G109 usa fixture QA previamente aceptado antes de fence legal; **no confundir con nueva reserva B** |
| Carga B→A | G5/G7/G121/G122/G123/G125/G126; consentimiento precio, recuperación e identidad | `app/envios.tsx` aún tiene botón `Cotizar y solicitar repartidor` **deshabilitado** |
| Custodia C | G66/G67/G68/G69 y pruebas SQL de comprobante/consumo/revocación | Falta unirse al pedido COMMERCE y repartidor realmente habilitado en un único ciclo |
| COMMERCE B→A | G139/G45 reserva stock original, G148 recovery durable y preparación Merchant G6 | Interfaz de checkout comercial, PSP y entrega terminal no están conectados de punta a punta |
| COMMERCE→envío | G150 original ready→G5 MOTO con aceptación G122 y G153 peso ≥ líneas stock | El envío queda vinculado, pero no asignado/recogido/entregado/completado como un mismo caso |
| Oferta COMMERCE | G154 bloquea oferta o asignación de paquete de comercio sin pedido G45 ready G150 / tarifa / peso | Mantiene el bloqueo G71 legal; no genera repartidor ni cobro |
| Portal staff | G156 `src/merchant-main.tsx` + inbox SQL/HTTP original, 20 filas, roles/sesión | Flags OFF; sin servidor HTTPS/IdP/PG externo verificados; funcionalidad limitada de pedidos |
| Ratings | G155 `app/calificar.tsx`, B→A→PG, datos G67 consumidos, una valoración por participante/servicio, incidentes privados | Funciona en QA; no ratings públicos reales ni ranking de despacho ni app independiente de calificación staff/Driver |
| Anti-fraude | G157 crea señal privada de G155; **G158 ya ofrece GET Backend A y panel Admin D solo lectura, AAL2/RBAC/revocación** en PG16 QA | Falta expediente y decisiones de investigación, apelación, sistema externo certificado; ranking y suspensión automáticos OFF |
| Owner comisión | G116/G136 cinco configuraciones independientes, subsidio pasajeros preservado | Asegurar aplicación económica **real** a todos los flujos y pantalla Owner COMMERCE, no solo reglas SQL |
| Owner carga | G124 editable en D, tarifa MOTO/AUTO trazable | Falta comercio/PSP, política integral por zona y producción |
| Mapas | G128/G129/G130/G134 adaptadores server-only Geoapify y cuota, key según Owner en GitHub Secrets | Sin certificado externo de geocoding/cobertura, peajes, mapa/ruta client→driver verificados en calles reales |
| Seguridad | roles exclusivos, G42 sesión, MFA AAL2 Admin, G38 legal, G71 KYC, G37 DML, G67 custodia | Privilegios reales y proveedores externos aún sin certificación; **no quitar controles para verde** |
| Pagos | contratos sintéticos de autorización/ledger/cancel y trazas | `app/pagos.tsx` indica expresamente **PSP no habilitado**; no cobrar ni afirmar settlement |

### 5. BLOQUEO CENTRAL — DEFINICIÓN DEL E2E QUE FALTA
No consta certificación de:
`Cliente crea NUEVA operación real → A conserva fuente única / tarifa / consentimiento → A emite oferta privada a C legalmente elegible → C recibe/acepta en SU propia sesión → cumple GPS/recogida/custodia/llegada → B ve misma operación terminal → D ve la misma identidad, historial y transacción económica confirmada`.
**No sustituir B recién creado con G109 histórico**. Ningún G155/G156/G157/G158 convierte un QA aislado en operación comercial.
Para cada servicio conservar el mismo ID y:
- pasajero/cliente remitente y Driver/merchant de cuentas distintas; JWT/role/session de proveedor;
- geocerca municipal, disponibilidad, licencias, KYC, seguro, cuotas, sustitución/no disponibilidad, permisos;
- precios/consentimiento/versión, tiempo de caducidad, pagos/ledger cuando aplique;
- transiciones idempotentes con registro tras caídas de red, POST ACK perdido, consulta GET y mismo requestKey;
- Admin observa la misma operación real y auditoría sin crear identidades o ingresos fantasma.

### 6. P0 — TAREAS BLOQUEANTES POR ORDEN DE EJECUCIÓN
**P0-A. Cerrar AUTO_RIDE nueva solicitud B→A→C→B→D**
1. Rastrear la salida de `g98-f1-auto-postgres-loopback-e2e-ci.mjs` y comparar con `g109-driver-auto-completion-pg-http-ci.mjs`.
2. Conectar despacho/Inbox/Driver ``G73/G85/G106/G134` sin falsificar preflight de ``G38/G71`; aceptar solo oferta original ligada a `tripId` recién creado.
3. Driver `app/ofertas.tsx`→`app/viaje.tsx`: aceptación privada, llegada, inicio y fin; restablecer tras reinicio, release slot G36, cancela/revoca antes y durante.
4. Cliente `app/viaje.tsx`/`app/historial.tsx` y Admin `src/main.tsx` observan el MISMO original (no uno anterior). Desglose monetario fiable.
5. Si KYC real es dependencia EXTERNAL_BLOCKED, dejar adaptador de evidencias legal verificable, documentar evidencia faltante y continuar sin simular habilitación.

**P0-B. Completar MOTO_RIDE con permisos propios**
1. Reusar G100/G101/G102/G118/G119/G142 y flujo privado C, sin proyectar aceptación AUTO.
2. Legal municipal MOTO, casco, seguro, licencia, ruta y geocerca; no inferir de permiso MOTO de carga.
3. Reconciliar nuevo `tripId`, Driver C, Cliente y D, 12 % nominal y 10 % subsidio si política vigente.

**P0-C. Cerrar DELIVERY_AUTO y DELIVERY_MOTO desde botón real Cliente**
1. `apps/movete-cliente/app/envios.tsx` muestra dirección libre para preparar pero registro QA exige ``PICKUP_ZONE` tags del servidor; el botón `Cotizar y solicitar repartidor` sigue OFF. Implementar geocoding/coverage, cotización ANTES del booking, confirmación total del usuario, política de cancelación y desactivación por zona/riesgo.
2. Unificar G5/G121/G122/G123/G125/G126 (origen/vehículo/precio) con G10 privada C, G66 pickup/delivery y G67 prueba real; no confundir permiso cargo y pasajeros.
3. Recuperar solicitud tras ACK perdido sin duplicar; estados en B y D, factura/PSP solamente si está integrado y certificado.
4. Rechazar categorías restringidas, dimensiones excesivas, vehículo no permitido, doble Driver, destino no cubierto, precio expirado y prueba inválida.

**P0-D. Completar COMMERCE comercial con reparto**
1. Cliente `apps/movete-cliente/app/comercios.tsx`: catálogo/stock GET original, carrito, cantidad, sustituciones consentidas, revisión y POST original con recuperación G148; mostrar precio servidor, costo envío, comisiones aplicables, confirmación.
2. Personal `apps/movete-admin/comercio.html` / `src/merchant-main.tsx` usa G156 staff inbox: listar, confirmar, iniciar preparación, marcar listo G148/G6. NO usar login Owner/Administrador para personal comercial.
3. Vincular al **mismo** `orderId` una solicitud delivery G150 con precio G122 aceptado y peso ≥ líneas reales G153; G154 impide despacho de paquetes de comercio falsos, pero falta el despacho positivo legal.
4. Repartidor C ofrece/acepta G10, recolecta con custody proof G66, confirma handoff `hand_to_courier` y entrega `delivered` en G6 con `deliveryId` original; consumidor y D observan ambas cronologías.
5. Manejar falta de stock, comercios suspendidos, cancelaciones antes/después de preparación, rechazo, tiempo agotado, falta de repartidor, incidencias, entregas incorrectas, reembolsos y conflictos de pago de forma transaccional.
6. Probar COMMERCE con AUTO y MOTO donde exista tarifa y permiso; rubro farmacia solo OTC autorizado.

**P0-E. Dinero: PSP auténtico y economía con autorización externa**
1. Elegir PSP legalmente disponible en Paraguay **mediante aprobación Owner**; jamás guardar PAN o CVV propios, usar tokenización/checkout del PSP.
2. Servidor: precio definitivo previo a aceptación, autorización/captura separadas, webhook autenticado, idempotencia, settlement, split plataforma/Driver/merchant, devolución/reversión/chargeback, conciliación y cierre diario.
3. Versionar comisión Owner por 5 servicios (G116/G136), tarifas carga G124; subsidio 10% SOLO pasajeros; no cobrar con contratos QA.
4. `app/pagos.tsx`, `app/ganancias.tsx` y D finanzas solo presentan dinero liquidado o autorizado REAL y status explícito, nunca saldos inventados. Esto depende de PSP y cuentas autorizadas.

### 7. P0 TRANSVERSAL — SERVIDOR PERSISTENTE Y EXTERNAL BLOCKERS
- Preparar en GitHub artefactos de despliegue reproducible, esquema/migraciones revisadas, roles RLS, funciones, secrets-contract y health checks; **no aplicar ``*_POSTGRES_CI_ONLY.sql` a Supabase real**. Convertirlas en migraciones seguras y auditadas independientes cuando Owner apruebe entorno STAGING.
- HTTPS persistente en Render y Postgres/Auth en Supabase; Identity Provider con JWT/audiencia/revocación; MFA AAL2 Owner/Admin; cuentas realmente distintas Client/Driver/Merchant/Admin. Hasta autorización, marca EXTERNAL_BLOCKED, no saltes controles.
- Integrar providers reales (no `G4 loopback`) mediante adapters montados desde runtime STAGING; exact-origin pinned, no secrets en móvil/web, rate limiting, tracing, circuit breaker, 429, retry y recuperar ACK.
- Geoapify key ya en GitHub Secrets según Owner. Revisar G128/G130 cuota Free sin llamadas redundantes. Geocoding y cobertura municipal, peajes independientes; map UI + polilínea/ruta de origen a destino y navegación Driver, permisos foreground GPS sin seguimiento clandestino.
- Legal: licencia/conductor/seguro/habilitación municipal original (incluida MOTO pasajero). Evidencia genuina por autoridad pertinente, vencimientos y revocación. **Ni GitHub ni aprobar una fixture sintética equivalen a permiso real.**
- Móviles: firmar builds de Android y iOS, dos instalaciones separadas en dispositivos, permisos GPS, push token/APNs/FCM, background/foreground, notificaciones y reconexión; publicación Play Store / App Store solo después de GO separado.

### 8. P1 — RATING BILATERAL Y ANTIFRAUDE INTEGRADO (NO BANEOS AUTOMÁTICOS)
**Reutilizar G155/G157/G158**:
- Cliente puede calificar DRIVER de AUTO/MOTO, COURIER de envío y MERCHANT + COURIER de COMMERCE; tras terminal `completed`/`delivered` original, y custodia G67 consumida.
- Driver/COURIER y Merchant staff deben poder calificar CLIENT **desde su app o portal**, con autorización de participante y no autoevaluación; UI bilateral faltante, aunque G155 ya contempla objetivos CLIENT a nivel SQL.
- Restringir a una calificación por persona/servicio/objetivo, plazo razonable, idempotencia, sesión no revocada y carácter privado de incidentes.
- G157 crea **alegaciones** del G155 (`SUSPECTED_FRAUD`/`SAFETY`) y cola SQL Admin; **G158 YA APORTA panel D Admin solo lectura y GET privado A protegido con JWT, AAL2, rol admin exclusivo y revocación**, en QA. **Falta** expediente de investigación, asignación de investigador, evidencias, revisión manual, resolución, apelaciones, suspensión reversible G8, auditoría y prevención de reportes coordinados.
- Señales complementarias solo verificadas: pagos disputados/chargebacks del PSP, pruebas G67, desvío GPS fiable, coincidencia dispositivo/cuenta con privacidad, pedidos anulados, múltiples cancelaciones, fraude de comprobantes, volumen de reportes corroborados. Nunca inferir delito de una nota subjetiva.
- Ranking futuro de Driver/merchant/client requiere mínimo de muestra, contrapeso de fraude/reputación, sesgo y fairness, explicación y apelación; Owner debe aprobar umbrales, y no aplicar penalizaciones automáticas en el estado actual.
- D Admin ya tiene panel G158 de alertas verificadas **solo lectura**; conectar backend externo y extender a investigación manual, resolución, apelaciones, acciones proporcionales, incidentes reabiertos e historial privado.

### 9. P1 — ADMIN/OWNER Y COMERCIOS ALINEADOS CON ECONOMÍA
- Verificar pantalla `apps/movete-admin/src/OwnerCommissionEditor.tsx` y `OwnerCargoRateEditor.tsx` en el mismo backend persistente; G136 ya prueba SQL de cinco servicios, pero **Owner debe poder configurar COMMERCE y cada vertical desde la web**, con lectura/escritura/versión y AAL2.
- Merchant staff portal G156 existe en `src/merchant-main.tsx` y `comercio.html`; bandera `VITE_G156_MERCHANT_PORTAL_ENABLED` OFF. Revisar permisos de lectura staff bajo RLS: lista de 20 recientes no equivale a cola operativa con paginación, filtros, actualización push/poll, devoluciones y evidencias.
- Admin debe ver viajes, repartos, pedidos, tarifas, Driver KYC, incidentes, PSP y ledger con el mismo `serviceId` y cronología inmutable.
- Histórico no puede reescribirse al cambiar regla; distinguir monto bruto, subsidio, comisión, merchant net, driver net, PSP fee, impuestos, reembolsos y confirmación de pago.

### 10. P1 — CALIDAD DE OPERACIÓN, PRIVACIDAD, RESILIENCIA
- Evidencias: RLS negativo por actor ajeno, jwt expirado, MFA insuficiente, sesión revocada durante POST, idempotencia tras pérdida ACK, carrera dos Drivers, una persona dobles roles, piloto de datos reales consentidos, no leak entre cuentas.
- Operatividad: disponibilidad Driver y GPS consentido; ofertas con TTL, push ACK de proveedor vs receipt móvil; falta de internet, reinstalación, rotación token, app segundo plano, cancelaciones y no-show, chat solo si asignación válida y vehículo parado.
- Seguridad: no service_role en móviles/browser; secretos API solo servidor; rate limits, abuso y logs sin PII; retención/deleción, privacidad, no guardar imágenes de documentación en público, KYC expiración y revocación.
- Validación UI: accesibilidad, estados error/empty, ayudas locales, notificaciones, coordenadas/paradas y conformidad real Android/iOS; no confundir web build y EAS candidate con teléfono verificado.
- Observabilidad: request IDs, correlación por tripId/deliveryId/orderId, eventos de compensación, métricas alertas, SLOs, rollback y backups.
- No usar Lovable u otro prototipo externo como fuente de verdad; repo integrado es la autoridad de código actual.

### 11. MATRIZ EXACTA DE ACEPTACIÓN — TODOS LOS SERVICIOS
| Servicio | Owner/cliente inicia | C legal acepta mismo original | Custodia/cierre | D mismo original y dinero |
|---|---|---|---|---|
| AUTO_RIDE | G73/G98 nuevo `tripId` y cotización | **PENDIENTE** | G109 solo fixture previa, **PENDIENTE original** | B→A→D QA; settlement real pendiente |
| MOTO_RIDE | G100/G102 `tripId` y precio QA | **PENDIENTE** | **PENDIENTE original** | QA parcial; PSP pendiente |
| DELIVERY_AUTO | G5/G122/125 registro y consentimiento QA | **PENDIENTE** | G67 solo casos originales de QA, no nuevo Cliente A→C completo | QA parcial; PSP pendiente |
| DELIVERY_MOTO | G5/G122/125 registro y consentimiento QA | **PENDIENTE** | **PENDIENTE original** | QA parcial; PSP pendiente |
| COMMERCE | G139/G148/G156 pedido→ready original | **PENDIENTE** con G150/G154 fence válido | **PENDIENTE** merchant handoff→delivered original | G146/G151 QA; PSP pendiente |

**Para marcar un servicio COMPLETO**: el usuario de B origina solicitud, A valida tarifa y cobertura, C recibe/acepta legal y termina exactamente ese servicio, B obtiene status/historial/ratings elegibles, D lo ve, liquidación existe si el PSP está certificado, y fallos/duplicados/cancelaciones revocaciones no corrompen estados. Si legal/PSP/IdP externos faltan, la etiqueta correcta es **ENGINEERING_READY / EXTERNAL_BLOCKED**, nunca GO.

### 12. ARCHIVOS DE ENTRADA DIRECTA (SIN REDESCUBRIR)
- Autoridad y routing: `apps/mobility-expo/server/g4-loopback-http-transport.mjs`, `g4-staging-runtime.mjs`, `g4-offer-gateway.mjs`, `g4-trip-command-gateway.mjs`.
- AUTO y Driver: `g98-f1-auto-postgres-loopback-e2e-ci.mjs`, `g109-driver-auto-completion-pg-http-ci.mjs`, `g106-driver-current-trip-qa.mjs`; `apps/movete-driver/app/ofertas.tsx`, `app/viaje.tsx`, `src/NativeDriverStagingRuntime.ts`.
- MOTO: `g102-moto-passenger-pg-http-ci.mjs`, `g119-moto-status-pg-http-ci.mjs`; `apps/movete-cliente/app/moto.tsx`.
- Envíos: `apps/movete-cliente/app/envios.tsx`, `apps/movete-driver/app/entrega.tsx`, `g121-delivery-reconcile-pg-http-ci.mjs`, `g125-cargo-road-fare-pg-http-ci.mjs`.
- COMMERCE: `apps/movete-cliente/app/comercios.tsx`, `apps/movete-cliente/src/G148CommerceQaPanel.tsx`, `g139-commerce-buyer-pg-http-ci.mjs`, `g148-merchant-fulfillment-pg-ci.mjs`, `g150-merchant-priced-delivery-link-pg-ci.mjs`.
- G154 SQL: `apps/mobility-expo/docs/backend/staging_only/G154_COMMERCE_PRIVATE_DISPATCH_READINESS_FENCE_POSTGRES_CI_ONLY.sql`; sus asserts demuestran el bloqueo si se intenta ofertar paquete de comercio sin pedido original.
- G155 ratings: `apps/mobility-expo/server/g155-verified-rating-gateway.mjs`, `g155-verified-rating-pg-http-ci.mjs`, `apps/movete-cliente/app/calificar.tsx`; base `G155_VERIFIED_PARTICIPANT_REPUTATION_POSTGRES_CI_ONLY.sql`.
- G156 merchant inbox: `apps/mobility-expo/server/g156-merchant-inbox-gateway.mjs`, `g156-merchant-inbox-pg-http-ci.mjs`, `apps/movete-admin/src/merchant-main.tsx`; base `G156_MERCHANT_PRIVATE_INBOX_POSTGRES_CI_ONLY.sql`.
- G157 antifraude: ``G157_VERIFIED_FRAUD_SIGNAL_TRIAGE_POSTGRES_CI_ONLY.sql` y `G157_VERIFIED_FRAUD_SIGNAL_TRIAGE_ASSERT_POSTGRES_CI_ONLY.sql` en `apps/mobility-expo/docs/backend/staging_only/`.
- Admin: `apps/movete-admin/src/main.tsx`, `OwnerCommissionEditor.tsx`, `OwnerCargoRateEditor.tsx`, `service-trace-gateway.mjs`.
- CI matriz: `.github/workflows/mobility-g4-postgres-disposable.yml` y el workflow unificado A+B+C+D bajo `.github/workflows/`.

- G158 lectura antifraude Admin: `apps/mobility-expo/server/g158-admin-fraud-qa-gateway.mjs`, `g158-admin-fraud-pg-http-ci.mjs`, `apps/movete-admin/src/G158FraudReportsPanel.tsx`, `g158-fraud-reports-gateway.mjs`; la CI original G67→G155→G157→G158 fue SUCCESS en el run PostgreSQL16 del §1. Portal solo lectura, ningún hallazgo/sanción automática.

### 13. ACTORES Y AUTORIZACIONES — NO SUPONER PROVEEDOR REAL
- B usa cuenta autenticada y rol exclusivo `passenger`. C usa `driver`. Portal comercio valida staff activo, Admin `admin`/`owner` con MFA AAL2/Scopes.
- Rutas con ejemplos `/v1/staging/merchant/{orderId}/transition`, `/v1/staging/merchant/{orderId}/attach-delivery`, `/v1/staging/merchant/{merchantId}/orders/inbox`, `/v1/staging/reputation/ratings` son **STAGING/QA**. No están certificadas públicamente por tener un handler en loopback.
- G156 portal y G155 Cliente siguen fail-closed por flags de propietario/origen HTTPS/IdP/PG. `apps/movete-driver/src/NativeDriverStagingRuntime.ts` monta adapters solo con aprobaciones y host fijado.
- Ningún QA synthetic session equivale a identidad real del proveedor. La prueba de KYC G109 anterior a G38 no habilita Driver real.

### 14. PRs ABIERTOS AL CORTE — NO FUSIONADOS
- PR #7 A fundación G0 DRAFT → `feature/mobility-monorepo-isolated-20261016`.
- PR #8 B Cliente/Admin DRAFT → `feature/mobility-cliente-admin-parallel-20261022`.
- PR #19 C Driver KYC DRAFT → `feature/mobility-arquitecto-c-driver-e2e-20261026`.
- PR #20 D Admin DRAFT → `feature/mobility-arquitecto-d-admin-e2e-20261026`.
- PR #13 dispatch retry DRAFT; PR #14 Store AAB/iOS candidate; PR #3 y #2 MVP/foundation heredados. No tratar esas ramas como árbol ejecutable más nuevo que integración sin comparar.
- Si otra persona actualiza la rama durante trabajo: comparar commits, rebase lógico/merge de cambios compatibles **solo en la rama integrada con lease**, no pisar historias ni hacer merge a main sin Owner.

### 15. SECUENCIA RECOMENDADA PARA AGILIZAR (NO REPETIR EL PROYECTO)
**Bloque A — acabar primero las transiciones de operación**:
1. Comparar código nuevo de `HEAD` con esta matriz.
2. Cerrar despacho nuevo AUTO + Driver C sin infracción G38/G71; si autorización municipal externa bloquea, terminar adaptador y pasar al siguiente.
3. Cerrar ciclo COMMERCE `ready`→courier offer→G66/G67→hand-off→delivered con el mismo `orderId/deliveryId`; hoy es la mayor discontinuidad tangible entre G150/G154/G156 y usuario.
4. Conectar `app/envios.tsx` al prequote auténtico y dos entregas completas; no habilitar botón hasta servidor exacto.
5. MOTO pasajero con permiso separado.
**Bloque B — poner el negocio en manos del Owner**:
6. Aplicación versionada real de G116/G136 a cinco precios, pantalla D Owner COMMERCE y merchant settlements, sin cambiar subsidio pasajeros.
7. B ratings G155; C/merchant califica Cliente; Admin fraude G157→G158 lectura y luego investigación/apelación.
8. Registrar pagos desde PSP legítimo **solo cuando se autorice e integre**; publicar economía real en D y B/C.
**Bloque C — releasability**:
9. E2E integrado por nueva operación en entorno reproducible, combinando B/A/C/D, simulación de corte de red y reinicio real; sin suites aisladas como sustituto.
10. EAS Android/iOS, servicios STAGING externos, permisos y pruebas en calle únicamente con autorización Owner, dispositivos, legal y certificados.
11. Gate final: seguridad, KYC, RLS, MFA, privacidad, estabilidad, observabilidad, PSP, costes, soporte, rollback, play/app-store. Nunca promover por un simple CI verde.

### 16. MÉTODO DE IMPLEMENTACIÓN Y CRITERIOS DE REPORTE
- Trabajar sobre el código, no producir series de handoffs. Cada intervención debe mostrar **qué botón/API/SQL conecta al siguiente estado de negocio**, qué pendiente cierra y qué idempotencia/riesgo protege.
- Si GitHub CI falla, leer el log de la falla real y reparar causa raíz. **No apagar tests, no forzar fixtures de licencia ni aflojar KYC**.
- Conservar tests integrados, no desautorizar controles existentes. Registrar commit SHA y CI reales; QA es evidencia de ingeniería, no garantía de proveedor externo.
- Cuando proceda verificar que la rama tenga ambos SUCCESS en el mismo SHA; no alterar Render/Supabase para poder pasar test local.
- Etiquetar fases ``DONE_CI`, `OPEN_INTEGRATION`, `EXTERNAL_BLOCKED`, `READY_FOR_APPROVED_STAGING`, `GO`. Solo el Owner autoriza `STAGING/GO/LIVE`.

### 17. NORMAS DE EJECUCIÓN, FINANZAS Y ANTIFRAUDE
- Pago externo y usuarios reales requieren autorización y proveedores comprobados; no inventar retiros, comprobantes financieros o cancelaciones como refund material.
- G157 es aviso para revisión; no publicar acusaciones, no penalizar automáticamente a conductores o comercios sin evidencia y proceso de apelación.
- No permitir que un rider con permiso pasajero se auto-convierta en Driver; no permitir que un courier de carga opere MOTO pasajeros.
- Reglas de precio y disponibilidad siempre server-side, consentimiento antes de confirmar. No duplicar reservas ante timeout; recuperar por clave original. GPS solo con consentimiento explícito y minimización.
- Nunca registrar API keys, tokens o datos de usuarios en documentos, logs o chat.

### 18. DEFINICIÓN DE ÉXITO EN EL PRÓXIMO CHAT
El próximo arquitecto deberá **publicar código funcional nuevo en la rama integrada** que cierre una transición P0 verificada en cuatro piezas, y presentar el mismo `ID` en B/A/C/D, con CI real y estados inequívocos. Si un proveedor legal no permite el camino positivo, entregar ingeniería lista para integrarlo y resolver otro P0 desbloqueable sin esperar.
El Owner NO solicita otro handoff ni otra ronda de pruebas de laboratorio desconectadas: solicita **TERMINAR LA APP**. Documento completo y fecha de corte no sustituyen la ejecución.

### 19. PROMPT EXACTO PARA PEGAR EN EL NUEVO CHAT
> Actúa como Arquitecto Ejecutivo Integrador A+B+C+D de **Movete Fácil / QORE Mobile**. Lee en GitHub `docs/handoff/HANDOFF_MAESTRO_OPERATIVO_E2E_G158_COMERCIO_ANTIFRAUDE_2026-10-28.md` en la rama `integration/qore-mobile-e2e-four-apps-20261027`. Comienza verificando HEAD y último Actions; no uses el SHA congelado si otro arquitecto avanzó. **No prepares otro handoff**. Ejecuta y termina los P0 de los cinco servicios conectando Cliente B → Backend A → Driver C → Admin D para la **misma operación original**; prioriza cerrar comercio listo→repartidor legal→custodia→entregado y nuevas reservas AUTO/MOTO/carga. Mantén legales G38/G71, sesión G42, custody G67, Geoapify server-only, Owner comisiones cinco servicios y protección G154. Aprovecha G155 ratings, G156 portal staff y G157→G158 triage/visor Admin sin sanción automática. No más prototipos ni QA aislado como reemplazo; código funcional y E2E integrado verificable en GitHub. **No LIVE, ni merge a main ni Render/Supabase sin aprobación explícita del Owner**. Declara blockers externos genuinos, no falsifiques permisos ni pagos y sigue con lo ejecutable. Dime exactamente qué quedó conectado, SHA/CI, riesgos y próximo bloqueo real.

---
**FIN DEL HANDOFF — la siguiente acción es IMPLEMENTAR, NO REESCRIBIR DOCUMENTACIÓN.**

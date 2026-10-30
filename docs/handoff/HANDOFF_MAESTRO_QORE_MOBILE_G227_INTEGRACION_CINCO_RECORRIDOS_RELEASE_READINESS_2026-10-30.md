# HANDOFF MAESTRO EJECUTIVO G227 — QORE MOBILE / MOVETE FÁCIL
## Continuidad soberana A+B+C+D · Código terminado y preparación real de despliegue · 30 octubre 2026, Paraguay

> ORDEN DEL OWNER: terminar la plataforma funcional, no seguir redactando handoffs ni sustituyendo funciones por prototipos. Este documento existe exclusivamente para cambiar de chat sin pérdida de contexto. El siguiente arquitecto debe LEERLO COMPLETO, actualizar HEAD/CI, reconciliar el código paralelo y continuar implementando los bloqueos que dependen de ingeniería. GitHub primero. Ningún merge, activación LIVE, despliegue Render/Supabase/Stores, gasto externo o PSP comercial sin autorización explícita. NO afirmar operación real porque PostgreSQL QA muestre PASS.

## 0. VEREDICTO VIGENTE Y PRIMERA LECTURA OBLIGATORIA

- Repositorio: https://github.com/mezas3238-hue/Qore-mobile-
- Rama principal de trabajo: **integration/qore-mobile-e2e-four-apps-20261027**. NO usar main como árbol de integración.
- HEAD de integración VERIFICADO AL PUBLICAR ESTE HANDOFF: **c03a727b2e71f0a6d140656a614ef19f2fd9bdcb**, commit fix(G221): compare original COMMERCE status enum to QA manifest text with explicit safe cast. El HEAD puede moverse por trabajo paralelo: comprobarlo otra vez.
- **CI integrada G221/HEAD c03a727:** PostgreSQL16 y concurrencia https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/41051967912 **SUCCESS**; cuatro superficies https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/41051967832 **SUCCESS**.
- **Avance paralelo verificado G226:** PR #41 HEAD **802d992b1459043a4f8ea161fe59c88383401cde**; PostgreSQL16 https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/41053112671 **SUCCESS**, Expo https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/41053112579 SUCCESS, STAGING Node https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/41053112688 SUCCESS. Está en otra rama, DRAFT y NO fusionado.
- **Hecho de QA más importante:** integración G221 demuestra **5/5 cinco mismos IDs originales Cliente→Driver/Courier/Commerce→Admin**, aceptaciones legales **SINTÉTICAS** y COMMIT solo dentro de PostgreSQL16 descartable. Las funciones G202, G215, G221 cotejan los mismos cinco serviceId/requestKey, eventos, pruebas de destinatario y Admin. **0/5 autorizaciones comerciales externas**.
- **Hecho paralelo distinto:** G223→G226 demuestra **2/2 viajes nuevos pasajeros + 3/3 fuentes históricas de carga/Commerce** y G215 histórico **0/5 antes → 3/5 después**; no cambia ni invalida el avance G221, sino que utiliza una población de origen diferente. ¡NO CONFUNDIR DOS MATRICES DE POBLACIÓN NI RESTAR G221!
- Veredicto: **CODE_QA_5_OF_5 / EXTERNAL_STAGING_NOT_CERTIFIED / LIVE_NO_GO**. La prueba de integración GitHub ya no es el bloqueo principal de lógica QA: ahora la prioridad es preservar los resultados en un árbol único, conectar las apps en un entorno real seguro, certificar autoridad externa y endurecer el lanzamiento.
- Evidencia CI nunca equivale a permiso municipal, identidad real, movimiento GPS de un dispositivo, entrega física o PSP liquidado. No alterar G38/G71/G118 para obtener aprobación falsa.

## 1. OBJETIVO DE PRODUCTO INNEGOCIABLE

Movete Fácil es plataforma de movilidad y comercio, inicialmente Paraguay, importes PYG/Gs enteros, con UX premium, elegante, veloz, estable y antifraude. Escalabilidad objetivo **>1 millón de clientes**, horizonte >2 millones de cuentas; ningún benchmark actual demuestra esa capacidad comercial.

Cuatro superficies coordinadas bajo un backend único:
- **Arquitecto A — Backend/Autoridad:** HTTP, PostgreSQL, RLS, identidad, KYC, política municipal, geolocalización, precio, despacho, transiciones, ledger, pagos, soporte, antifraude, observabilidad y escala.
- **Arquitecto B — Cliente Expo:** registro real, mapa/ruta/precio, reserva AUTO y MOTO, envío AUTO y MOTO, compras, estado en tiempo real, recuperación, mensajes, calificaciones, soporte, objetos olvidados, reclamos y pagos.
- **Arquitecto C — Driver/Courier Expo:** onboarding documental y habilitación por categoría, disponibilidad y distancia de recogida configurable, ofertas privadas, aceptar, navegar, custodia, completar, conversar, recuperar conexión, historial y ganancias.
- **Arquitecto D — Web Owner/Admin y Merchant Staff:** RBAC/MFA, comisiones configurables por servicio, proveedor y actor; seguimiento de cinco recorridos, Merchant catálogo/preparación/stock, fraude, disputas, conciliación, reputación y soporte. No confundir Merchant Staff con el Owner.

Cinco servicios con objetos originales distintos y tipos legales NO intercambiables:
1. **AUTO_RIDE**: pasajero solicita automóvil → precio/consentimiento → oferta/Driver AUTO autorizado → llega/inicia/completa → Cliente y Admin.
2. **MOTO_RIDE**: pasajero solicita motocicleta → permiso legal específico de pasajeros MOTO → Driver MOTO → fases completas → Cliente/Admin. Autorización MOTO carga NO habilita pasajeros.
3. **DELIVERY_AUTO**: remitente cotiza y consiente tarifa → courier AUTO autorizado → retiro y entrega → destinatario independiente confirma → Admin.
4. **DELIVERY_MOTO**: mismo esquema con courier MOTO de CARGA, límites de peso/volumen/cobertura y permisos propios.
5. **COMMERCE**: Buyer→Merchant Staff acepta/prepara/ready→envío cotizado ligado a orderId→courier→receptor independiente→Owner/Admin y reputación.

**Cadena soberana de identidad**: requestKey / quoteId / ruleVersion / consent + original tripId o deliveryId + orderId y linked deliveryId para Commerce + proveedor/vehículo/rol + revisiones y eventos + Admin privado. No duplicar por reconexión ni recrear una transacción diferente para hacer pasar una prueba.

## 2. CRONOLOGÍA ÚTIL, QUÉ ESTÁ HECHO Y QUÉ NO REHACER

- G0–G181: infraestructura y módulos de identidad, movilidad, tarifas, legibilidad CI, recuperaciones, Merchant, Admin, fraude, seguridad y escalabilidad preliminar. Ver handoffs históricos de la sección 18.
- G185–G207: Cliente AUTO relectura sin POST duplicado, Driver MOTO original, mensajería/objetos olvidados, mapa Geoapify, cola de despacho, carriles de admisión 256 lecturas + 128 escrituras por instancia, y cuatro superficies verificadas. Parte del código de PR #26–#29 fue ya incorporado a integración vía commits posteriores: no cherry-pick ni merge de todo el PR sin comparar.
- G209: handoff previo; no tiene prioridad sobre la evidencia posterior G221.
- G210/G211: Driver AUTO fail-closed y cierre seguro de casos de pertenencias olvidadas AUTO/MOTO, PR #30/#31 DRAFT. Revisar diff frente a integración.
- G212/G214/G217: cadena de custodia real SQL de courier, ACK del receptor, Admin terminal original, disputas; PR #32/#33/#34 DRAFT, con partes acumuladas ya en base.
- G219/G220: pasos de pasajeros originales y pruebas cinco servicios reversibles. Rollback-only **no** es cierre persistente.
- **G221 en la integración c03a727:** se agregan cinco originales QA COMMITTED, G202 selecciona estos cinco cuando existe manifest de G221 y G215 verifica completitud 5/5 bajo condición estricta. Archivos raíz: server/g202-five-original-service-journeys-pg-ci.mjs, server/g215-five-journey-e2e-readiness-pg-ci.mjs, server/g221-five-same-id-qa-certification-pg-ci.mjs y workflow PostgreSQL. **Este es el estándar actual a preservar**.
- G222 PR #37 corrige cotización G73 AUTO en suite paralela mediante G93 Owner QA en rollback. CI de su commit fue verde; no implica que esa reparación falte en base actual.
- G223 PR #38 agrega ledger inmutable de cinco IDs/keys originales entre sesiones; G224 PR #39 demuestra dos NUEVOS pasajeros originales COMMITTED; G225 PR #40 agrega dos envíos G122/G125 históricos y Commerce con ACK intacto; G226 PR #41 vuelve a auditar cinco registros históricos 3/5. Todos son **CI disposable**, no LIVE. Son evidencia potencial y controles reutilizables, no parche automático para G221.
- **Conflicto de ramas**: al corte, comparison integración→G226 = **diverged, ahead 23 / behind 6**. Ambas ramas modifican G202/G215, la misma workflow PostgreSQL y la semántica de selección. El próximo arquitecto debe conciliar por diff de archivos y tests, NO mezclar bajo presión.

### PR en pila G223→G226, preservar ancestry
- PR #37 https://github.com/mezas3238-hue/Qore-mobile-/pull/37 — G222; HEAD 78a0902fd0ad24415eb3fe8cf9e8f8c1f6704e78.
- PR #38 https://github.com/mezas3238-hue/Qore-mobile-/pull/38 — G223; HEAD 2308688cc7cc114c6edd06a0794e0c10791c751b.
- PR #39 https://github.com/mezas3238-hue/Qore-mobile-/pull/39 — G224; HEAD 24ec35cc6af664a65e35f29933a2c88f222b1610.
- PR #40 https://github.com/mezas3238-hue/Qore-mobile-/pull/40 — G225, base #39; HEAD 27f4dbe64c28d0547146700df5504e63beb98cd6.
- PR #41 https://github.com/mezas3238-hue/Qore-mobile-/pull/41 — G226, base #40; HEAD 802d992b1459043a4f8ea161fe59c88383401cde.
- PR #35 https://github.com/mezas3238-hue/Qore-mobile-/pull/35 — G219/G220 legacy branch; PR #36 https://github.com/mezas3238-hue/Qore-mobile-/pull/36 — G221 audit alternativo; ambos tienen divergencia y pueden estar superados por G221 integrado. Comparar antes de descartar.

**Prohibición de confundir métricas**: el 5/5 QA G221 actual usa cinco originales en la base de integración; el 3/5 histórico G226 usa un conjunto seleccionado antes de crear dos reservas nuevas para pasajeros. El objetivo ya NO es forzar G215 a 5/5 modificando datos: ya existe un examen 5/5 en integración, pero el siguiente paso real es STAGING externo y dispositivos.

## 3. PRIMER TRABAJO DEL SIGUIENTE ARQUITECTO: INTEGRACIÓN SIN REGRESIONES (P0)

1. Abrir rama de integración y consultar HEAD/commit, PR, GitHub Actions del SHA y árboles a cada comienzo. Al corte base = c03a727; G221 5/5 QA en PG16 PASS. Tomar fecha/hora/commit exactos en nueva sesión.
2. Inspeccionar archivos G202/G215/G221 sobre base y G223–G226 sobre PR #41. Comparar diff contra integración: workflow, SQL, identidad, Admin, selección de cinco, seguridad de triggers, snapshots/ledger, cobertura adversarial. Preparar matriz adoptado / ya presente / conflicto / omitir / necesita adaptar.
3. **Preservar G221 5/5 strict gate** (QORE_REQUIRE_FIVE_QA_CLOSURES, G202 source, G215 readback, certificado G221); reutilizar de G223–G226 solo controles independientes que mejoren sin cambiar semántica o sustituir IDs.
4. Reconciliar PR #30–#34 y trabajo de escalabilidad #21/#22 con base actual. No reintroducir código ya portado, no perder correcciones de seguridad, no hacer merge sin instrucción Owner.
5. Crear ramas de ingeniería desde HEAD real, commits pequeños, unit/regresiones, mismas 4 superficies y PG16 en **un mismo SHA**. Limitar alcance a correcciones funcionales concretas. Presentar al Owner lista mínima de PR preparados para merge y explicación, NO merger silencioso.
6. El estado de producción debe permanecer **NO_GO** salvo evidencia real independiente. No trasladar SQL CI_ONLY a Supabase. No habilitar LIVE por una variable de entorno o el resultado G221.

Archivos y workflows concretos:
- apps/mobility-expo/server/ — runtime A, gateways, pruebas ejecutables.
- apps/mobility-expo/docs/backend/staging_only/ — SQL marcado CI_ONLY, **EXCLUSIVO PostgreSQL desechable**.
- apps/movete-cliente/ — B Expo.
- apps/movete-driver/ — C Expo.
- apps/movete-admin/ — D Owner/Admin + Merchant.
- .github/workflows/qore-four-apps-unified.yml — integración completa.
- .github/workflows/mobility-g4-postgres-disposable.yml — G221 E2E, concurrencia, verificación Admin.
- .github/workflows/qore-mobility-staging-node.yml — contratos API.
- render.yaml — Blueprint STAGING con autoDeployTrigger OFF; **no es producción ni despliega por sí solo**.
- PR #14 candidate Android/iOS stores; PR #21 laboratorio 5.500 HTTP; PR #22 escala extrema (solo modelada).

## 4. P0 — CINCO RECORRIDOS APLICACIÓN→BACKEND→DISPOSITIVOS→ADMIN

**El QA SQL está probado; falta demostrar que las pantallas y servicios desplegados reproduzcan la operación de extremo a extremo SIN actores sintéticos.** Construir prueba verificable por vertical, misma identidad original, dispositivos de prueba y proveedor externo, primero STAGING protegido cuando el Owner lo autorice. Mientras no haya external, terminar integración y pruebas de los fallos seguros.

**AUTO_RIDE**: B apps/movete-cliente/app/viaje.tsx y G73/G98; A G111/G112 ofertas con prioridad, G205/G38 legal, G42 sesión; C apps/movete-driver/app/ofertas.tsx y app/viaje.tsx; G177 llegar, iniciar, finalizar; Admin G138; volver a B historial/recibo/calificación. PENDIENTE: reemplazar aceptación QA sintética por identidad/credencial/ubicación real, certificar suscripción/unsubscribe y ausencia de doble conductor, perder Internet y reencontrar exactamente el mismo tripId.

**MOTO_RIDE**: B app/moto.tsx, A G100/G102 precio/ledger, G118 permiso municipal independiente y G169/G189 GET recuperación; C app/moto-viaje.tsx, etapas G213; Admin G142. PENDIENTE: habilitación legal MOTO pasajeros, dispositivo, casco/seguro/municipio y estado de viaje real, nunca confundir con courier moto.

**DELIVERY_AUTO**: B cotización G121/G122/G125 y consentimiento exacto, A G5/G10 offers, C app/entrega.tsx G66/G67 custodia/proof, destinatario G187, Admin G145/G216. PENDIENTE: Courier AUTO real con sesión y KYC; GPS/ruta, imagen/proof anti-sustitución, receptor dispositivo distinto y prueba de disputa/reembolso.

**DELIVERY_MOTO**: misma cadena con vehículo MOTO carga, cobertura/peso y driver KYC específicos. PENDIENTE: aceptación real, carga permitida, oferta georreferenciada, pickup, prueba G67 y receptor G187 independiente, sin reasignar auto/moto sin nuevo precio y consentimiento.

**COMMERCE**: B apps/movete-cliente/app/comercios.tsx, G139/G45 compra/stock; D apps/movete-admin/src/merchant-main.tsx con staff G148/G156; A G150 enlaza orderId y deliveryId único, G154 readiness; C courier; G67+G187 entrega confirmada; D G146 y Admin carga G216. PENDIENTE: operar catálogo/stock/staff real, reserva atómica, cancelación/reembolso, despacho real, notificación Buyer, comprobante, reputación Merchant+Courier y conciliación.

Criterio por recorrido: Cliente inicia desde UI auténtica + sesión real; precio y consentimiento quedan congelados; un único booking key no genera duplicados ante reintento; Driver/Staff solo ve lo autorizado; exactamente un actor acepta; estados avanzan por RPC autorizadas con revisión esperada; evidencia GPS/entrega/recibo separada; lectura Admin es otro actor y otra sesión; notificación Cliente se recupera tras cierre de app; no se quedan botones bloqueados o cargas eternas.

## 5. P0 — AUTORIDAD REAL / KYC / PERMISOS / GPS / PAGOS (BLOQUEO EXTERNO)

- **IdP/Auth:** conectar STAGING real con sesiones de Cliente, Driver, Courier, Merchant Staff, Admin y Owner; RLS/roles; MFA Owner; refresh/revocación/logout, rotación de claves, pruebas de usuario ajeno. G42 evidencia QA no es acceso de proveedor real.
- **Driver KYC G20/G36/G38/G71:** documentos auténticos y expiración, permisos de vehículos, habilitación/seguro/certificado. Aceptación bloqueada al faltar cada autoridad; no suplantar certificado usando un registro SQL manual.
- **G118 MOTO pasajero:** requisito municipal/legal y coberturas INDEPENDIENTES de MOTO transporte de paquetes. Configurar regiones Paraguay por permiso y temporalidad, recertificación y auditoría de revocación.
- **GPS y Geoapify:** API key reportada en GitHub Secrets; **confirmar en CI/entorno de STAGING si el smoke G129/G134 se ejecutó con proveedor de verdad**. No imprimir secret ni embutirlo en Expo. Registrar request/response depurados, puntos, rutas, distancia real en carretera, ETA, expiración, límites/quota, caché permitido y fallback visible. Telemetría de Driver debe ser consentida, fresca, revocable y antifalsificación razonable; no confundir cálculo de ruta con ubicación real.
- **PSP sandbox/finanzas:** no hay prueba suficiente de captura, reversión, reembolso, doble cobro, conciliación ni pago real al Driver. Diseñar y probar llaves de idempotencia, webhooks firmados, ledger reconciliable, disputa/chargeback, impuestos/facturas y política de retención. Integrar solo con proveedores permitidos y credenciales autorizadas; nunca aparentar PSP=SETTLED por fixture.
- **STAGING externo primero**: Render + Supabase separados de LIVE, configuración segura, migraciones de despliegue distintas de CI_ONLY, datos de prueba con expiración y protección; Owner aprueba cuenta/plan/costos. No importar SQL que contiene DISABLE TRIGGER o synthetic fixtures a Supabase real.
- **Pruebas con dispositivos**: Android+iOS para Cliente y Driver, navegador Merchant/Admin, push/background, GPS/permissions, multitarea, red inestable, zonas y horario Paraguay, viajes de campo permitidos en TEST, reputación y objetos olvidados.
- Cualquier dependencia externa sin credencial o aprobación debe clasificarse **EXTERNAL_BLOCKED**, no desviarse hacia fake legal/PSP. Continuar trabajo de código que sí pueda completarse.

## 6. P0 — DRIVER CONTROLA DISTANCIA PARA RECOGER CLIENTES Y PEDIDOS

Requisito Owner **EXPRESO**: Driver decide alcance máximo de recogida para pasajeros y para pedidos de comercios/entregas. Revisar G197 driver pickup y G199 MOTO, NO reimplementar a ciegas:
- apps/mobility-expo/server/g197-driver-pickup-gateway.mjs, g197-pickup-road-distance-pg-ci.py y g199-moto-pickup-distance-pg-ci.py; C preferencias UI (inspeccionar app/ofertas.tsx/providers).
- Preferencias por driver / vehículo / vertical; opción OFF, distancia mínima/máxima y unidad km; guardado en servidor con versión y scope, no solo LocalStorage.
- Aplicar distancia **de carretera y tiempo de ruta confiable**, no lat/lon en línea recta como si fuese acceso real; paso pickup de un comercio y de un pasajero; la distancia de ruta necesita proveniencia de Geoapify/proveedor real para LIVE.
- Filtrar ofertas en backend de forma atómica y justa, sin revelar coordenadas privadas antes de autorización, sin despachar a Driver fuera del radio, sin perder pedidos por falta de Driver. Soportar cambios de preferencia y carrera de despacho, STAGING GPS stale y ausencia de datos => no ofertar falso.
- Probar radio por modo y categoría, límites de cuota, cancelación, movilidad en background, edge de municipio y cambios de disponibilidad.

## 7. P0 — CHAT PRIVADO, RECUPERAR OBJETOS OLVIDADOS Y SOPORTE

Owner pidió Cliente poder escribir al Driver, especialmente tras viaje para recuperar pertenencias:
- B apps/movete-cliente/app/mensajes.tsx y apps/movete-cliente/app/objetos-olvidados.tsx + objetos-olvidados-moto.tsx.
- C apps/movete-driver/app/mensajes.tsx y objetos-olvidados AUTO/MOTO. A G56/G60, G198/G200, PR #31 G211 cierre transaccional QA.
- PENDIENTE certificar chat realmente bidireccional en STAGING real, permisos por **servicio y participante**, ventana posterior al viaje limitada, soporte/Owner mediador, bloquear contacto por abuso, privacidad del número, no filtrar números o ubicación, notificaciones push sin cuerpo sensible, reporte/acoso, logs retenidos por política.
- Confirmar acuse de entrega y lectura SOLO cuando backend autentica; reconexión, deduplicación y mensajes fuera de orden; cerrar expediente de objeto perdido y cortar el acceso si fue bloqueado, revocado, vencido o terminado. Nunca activar chat global entre desconocidos.

## 8. P0 — CALIFICACIONES, REPUTACIÓN Y ANTIFRAUDE

- B apps/movete-cliente/app/calificar.tsx; C apps/movete-driver/app/calificar.tsx; backend G155 verificación de participación y cierre; D G157/G158 fraude/Admin.
- Calificaciones de Cliente a Driver AUTO/MOTO, Courier y Comercio; Driver/Courier/Comercio al Cliente cuando aplica. Solo después de servicio original terminado; una por sujeto/servicio/rol, versión e idempotencia; evitar auto-calificación, identidad ajena, reseñas duplicadas y represalias.
- Priorizar calidad de servicio y alertar sobre estafas pero **no suspender automáticamente** por pocas estrellas sin evidencia. Revisión humana, derecho a respuesta, apelación y audit trail.
- Antifraude P0: GPS falso, ruta/sobreprecio, cuentas duplicadas, KYC manipulado, entrega falsa/foto reciclada, destinatario suplantado, fraude del comercio/stock, refund/chargeback, cancelación coordinada, calificación conspirativa, Driver que pide pago fuera de app y pruebas de disputa.
- D Admin: bandeja de casos, niveles/estados, bloqueo temporal por reglas transparentes y revisión humana, auditables y con PII minimizada. Reputación no debe convertir un mercado de trabajo en sistema de castigo sin control.

## 9. P0 — PRECIOS, COMISIONES OWNER Y CONTABILIDAD

- Tarifas AUTO/MOTO, cargas y Commerce son reglas soberanas versionadas en backend (G72/G73/G93/G100/G122/G124/G136/G150). Congelar quote, regla aprobada, timestamp, área y consentimiento antes de reserva.
- El Owner define comisiones de los cinco servicios desde Admin con MFA/RBAC. Evitar porcentajes rígidos ocultos en frontends; reconciliar Owner/Driver/Merchant balances y subsidios aprobados. En material histórico AUTO 15%, MOTO 12% con subsidio Owner 10 puntos (verificar reglas VIGENTES antes de usar: no presupuestar márgenes inventados).
- Separar estimación/consentimiento/reserva de cobro/settlement/payout. PSP, impuestos locales, cancelaciones, propinas, tarifas de espera, devoluciones y chargeback necesitan política verificable. Auditoría de redondeo en PYG entero.
- No habilitar ventas de productos restringidos, medicamentos con receta o envíos prohibidos sin reglas legales apropiadas.

## 10. P1 — ESTABILIDAD: LA APP NO DEBE QUEDAR COLGADA

Orden Owner: evitar congelamientos frecuentes, no solo hacer pasar tests Node.
- Inspeccionar G159/172/178 bounded body y timeout, render-staging-ingress.mjs, Cliente/Driver Providers, render loops/listas/mapas/mensajería, memoria y gestión de background.
- Toda petición tiene límite de tiempo, cancel/Abort, reintento con backoff SOLO para lecturas; POST incierto se consulta por requestKey antes de reenviar. Estados de UI: loading útil, error comprensible, reconexión y recuperar la operación original sin doble reserva/pago.
- GPS lento o sin permiso, mapa offline/proveedor caído, push fallido, token vencido, expiración de oferta en pantalla, Owner admin sin permisos, Driver abandona la app, chat no entrega, tienda sin stock: comportamiento degradado explícito, nunca spinner infinito.
- Instrumentar crashes, ANRs, JS exceptions, tiempo a render, consumo RAM, p95/p99, leaks y red con consentimientos y PII sanitizada; pruebas en Android real/iOS real y límites de dispositivos económicos.
- Pruebas de regresión de navegación y accesibilidad en cuatro superficies; no declarar UI lista por export Expo que no abrió un dispositivo real.

## 11. P1 — ESCALABILIDAD SIN INVENTAR 1M DE USUARIOS PROBADOS

- G194/G207: Render edge con carriles **256 GET + 128 POST simultáneos POR RÉPLICA** y 32768 identidades en ventana, parámetros configurables. No equivalen a TPS ni usuarios finales.
- PR #21: 5.500 solicitudes HTTP localhost con handlers sintéticos; NO es 5.500 operaciones SQL completas.
- PR #22: contratos/modelos >2M cuentas y escenario 1M conectados; NO es ensayo de 1 millón real.
- Implementar plan de conexión pool/PgBouncer, replicas, Redis cuotas distribuidas con TLS/ACL, locks/leases/worker dispatch, cola durable y dead letters, caché seguro, partitioning/indices geo/temporal, backpressure, cap de conexiones.
- Cargar progresivamente 100/1000/10000/100000 actores QA según infraestructura aprobada; medir escritura idempotente, carreras de dos drivers, doble aceptación, fallos de nodo, Redis/Pg restarts, rollback/kill, outbox/event delivery, costos por solicitud y latencia p50/p95/p99.
- Escenario >1M usuarios se acredita solo con demanda/perfil, infraestructura apropiada y evidencia medida (usuarios registrados vs activos vs operaciones concurrentes). No contratar recursos masivos sin autorización.

## 12. P1 — DISEÑO, FIGMA Y CUATRO SUPERFICIES CONSISTENTES

- Figma QORE Signature: https://www.figma.com/design/md9phVO8aDiDG3l57G7Rkw
- Existe trabajo previo de diseño de alto nivel y pantallas reutilizables; comprobar estado actual del archivo y cómo mapea a Expo/Web. **Figma verde no significa UI implementada**.
- Calidad estética superior aspiracional a Uber/Bolt/PedidosYa: jerarquía tipográfica, navegación coherente, accesibilidad, estados vacío/error/offline, tokens visuales y microinteracciones sobrias.
- Páginas mínimas Cliente: registro, elección vehículo, mapa/cotización, reservar, Driver asignado, ETA/llegada, en curso, fin/recibo, calificar, historial, chat, objetos perdidos, ayuda/reembolso; envíos y Commerce correspondientes.
- Driver: documentación y estatus legal, online/offline, preferencias radio, ofertas y rechazo/aceptación, navegación/mensajes, fases, prueba de entrega, historial ganancias, calificar Cliente, soporte.
- Merchant: catálogo/stock/precio, pedidos nuevos/en preparación/listo/entregado/cancelado, courier y soporte. Admin/Owner: cinco líneas de negocio, identidad, permisos, antifraude, finanzas, comisiones y auditoría.
- CI visual, TypeScript, componentes, navegación y builds firmados sin romper SQL ni seguridad. No sobreescribir implementaciones funcionales con pantallas bonitas sin conexión.

## 13. P1 — RELEASE ENGINEERING ANDROID / IOS / WEB Y STAGING EXTERNO

- Reconciliar PR #14 (AAB/IPA candidatos) y cuatro app builds; app IDs/paquetes/bundle identifiers/entitlements, permisos geolocalización/cámara/notificaciones, políticas privacidad, términos y stores.
- Separar entornos LOCAL CI, STAGING REAL, PILOTO CERRADO, LIVE. Config de Expo EAS, Android keystore e iOS distribución, firma/secret scopes, versionado, actualizaciones OTA seguras, rollback de release.
- Render STAGING: Blueprint render.yaml con autoDeploy OFF y LIVE_TRIPS_ENABLED=false. Preparar health checks, readiness, logs, HTTPS/CORS, límites y conexiones; DEPLOY solo cuando Owner confirme.
- Supabase STAGING: proyecto aislado, auth/roles/RLS, migraciones reproducibles sin nombres CI_ONLY, backups, point-in-time recovery, índice y permisos mínimos. Revisar cutover y rollback. Nunca dar credenciales a App Cliente.
- Geoapify STAGING: validar Secret real, ruta, cuotas, geografía Paraguay; backend proxy y restricciones proveedor.
- PSP SANDBOX: endpoints/webhooks firmados, ledger, refunds y reconciliación, solo con permiso de Owner.
- Tras QA real en dispositivos + pruebas de piloto cerrado + requisitos regulatorios: proponer GO/NO-GO con evidencia y solicitar autorización de lanzar. No activar servicios comerciales/Stores por cuenta propia.

## 14. CRITERIOS DE ACEPTACIÓN PARA CERRAR CADA PENDIENTE

| Área | Criterio mínimo; NO basta compilar |
|---|---|
| G221 QA original | 5/5 mismo ID, evento real SQL, Admin independiente, synthetic claramente etiquetado, reejecutable en HEAD final |
| Integración de ramas | Base actual + tests equivalentes G223–G226 sin regresión o doble selección, PRs reconciliados, CI del mismo SHA |
| Cliente+Driver | Misma reserva/identidad real en dos dispositivos, no reasignar, no doble POST, lectura eventual y recuperación |
| Merchant+Courier | Misma orden/envío, stock atomicidad, precio consentido, Courier legal y ACK recipient independiente |
| KYC y municipio | Auditoría de proveedor/documentos y zona, permisos por servicio, revocación/expiración fallan cerrados |
| Georreferencia y radio | Rutas/driving distance proveedor real, Driver controla su radio, despacho aplica a pasajeros/cargo/Commerce |
| Mensajes | Cliente y Driver bidireccional por servicio, luego ventana limitada objeto perdido, permisos, dedup, incidentes |
| Ratings y fraude | Solo participación verificada, bilateral, Admin investigación + derecho a respuesta |
| Finanzas | Comisiones Owner editables MFA, quotes congelados, PSP sandbox idempotente, refunds y balance conciliable |
| Estabilidad | Sin spinner infinito, timeout/reconnect, pantallas probadas en Android/iOS, errores observables |
| Escala | Benchmark multi-instancia y PostgreSQL real bajo cargas progresivas; >1M requiere evidencia propia |
| Deploy | Secrets external, Render/Supabase STAGING separado y autorizado, migraciones/rollback, pilot y GO Owner |
| LIVE | **NO_GO** hasta aprobación explícita y certificación externa real de cinco servicios |

Cada PR debe decir **código modificado, árbol de base, SHA, tests POS/NEG, artifacts, resultado exacto, deuda y EXTERNAL_BLOCKED**, sin maquillar certificaciones.

## 15. BACKLOG P0 ORDENADO PARA EJECUTAR SIN VUELTAS

**BLOQUE A — empezar ya en código GitHub:**
1. Revalidar G221 en integración c03a727 y recuperar artifacts G202/G215/G221; inventario exacto de source IDs y dependencia.
2. Comparar PR #36–#41 vs base y consolidar solamente controles necesarios; evitar regresión G221 5/5. Actualizar pruebas de aceptación para mismo SHA.
3. Cerrar vínculos de apps B/C/D y backend A: E2E app→HTTP→Postgres→app con sesión y estado original para cinco verticales; detectar el primer RPC o pantalla que todavía no está conectado.
4. Inspeccionar/completar Driver radio real por carretera G197/G199 y commerce/cargo; agregar UX configurable, servidor persistente, permiso GPS.
5. Inspeccionar/completar chat Cliente↔Driver y objetos olvidados G56/G198/G200/G211; calificaciones bilaterales G155 y antifraude G157/158.
6. Reparar fallos que cuelgan apps, idempotencia, backoff/continuación y carreras; pruebas nativas y problemas reales.
7. Finalizar pagos/ledger/Owner reglas/Commerce stock/delivery sin inventar PSP y preparar adaptadores STAGING.
8. Auditar performance real y arquitectura horizontal, no volver a decir que 384 en vuelo = un millón de clientes.

**BLOQUE B — depende de autorización/conexiones externas:**
9. Configurar Render/Supabase STAGING reales aislados (solo permiso Owner), IdP real, Geoapify y secuencias verificadas de dispositivos.
10. Validar licencias/seguro/moto pasajero y courier por municipio y zona, políticas de datos.
11. PSP SANDBOX y eventual pago/comisiones/conciliación; prueba antifraude de cargo y disputa.
12. Pilot Android/iOS, Browser Owner/Merchant, observabilidad/rollback y autorización de lanzamiento.
13. Sólo después de pruebas/decisión Owner: merge controlado y deploy LIVE.

No pedir de nuevo requisitos presentes aquí. Frente a un EXTERNAL_BLOCKED demostrar qué falta y continuar otra tarea de ingeniería.

## 16. GATES Y PROHIBICIONES DE SEGURIDAD

- Ningún QA sintético, ROLLBACK, INSERT AUTH.USERS o DISABLE TRIGGER USER puede convertirse en una migración de STAGING/LIVE ni en permiso para viajar/cobrar. G38/G118/G71 deben conservar autoridad fail-closed.
- G221 usa transacción COMMITTED dentro del contenedor PostgreSQL descartable. Es correcto para probar persistencia pero no es dato real reutilizable ni autorización en el campo.
- En G223–G226 existe DDL CI adicional y aceptación sintética; usar solo para pruebas y revisar efectos de branch divergence. No trasladar a Supabase.
- Admin no puede simular haber visto el pedido de otro cliente; roles anon/authenticated no acceden a funciones privadas; Owner con MFA, no roles inventados.
- No fuerza merge, no cerrar PR como integrado sin prueba, no revelar secretos, no habilitar LIVE, no producción comercial, no cobrar, no contratar infra externa ni publicar stores automáticamente.
- El siguiente arquitecto puede crear ramas, código y CI en GitHub, sin pedir permiso para cada cambio de laboratorio. Debe informar con enlaces a commits/resultados, no con afirmaciones vacías.

## 17. ENLACES VERIFICADOS PARA CONTINUAR SIN BUSCAR A CIEGAS

- Repo: https://github.com/mezas3238-hue/Qore-mobile-
- Integración SHA c03a727: https://github.com/mezas3238-hue/Qore-mobile-/commit/c03a727b2e71f0a6d140656a614ef19f2fd9bdcb
- Workflow G221 5/5: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/41051967912
- Cuatro superficies mismo SHA: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/41051967832
- G223: https://github.com/mezas3238-hue/Qore-mobile-/pull/38
- G224: https://github.com/mezas3238-hue/Qore-mobile-/pull/39
- G225: https://github.com/mezas3238-hue/Qore-mobile-/pull/40
- G226: https://github.com/mezas3238-hue/Qore-mobile-/pull/41
- G226 3/5 históricos auditados: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/41053112671
- G222 QA precio: https://github.com/mezas3238-hue/Qore-mobile-/pull/37
- G221 audit alternativo: https://github.com/mezas3238-hue/Qore-mobile-/pull/36
- G217 prueba Admin: https://github.com/mezas3238-hue/Qore-mobile-/pull/34
- G211 objetos olvidados: https://github.com/mezas3238-hue/Qore-mobile-/pull/31
- G194 escalado: https://github.com/mezas3238-hue/Qore-mobile-/pull/27
- G190 Driver MOTO / apps: https://github.com/mezas3238-hue/Qore-mobile-/pull/26
- Laboratorio HTTP: https://github.com/mezas3238-hue/Qore-mobile-/pull/21
- 1M+ contrato (no benchmark): https://github.com/mezas3238-hue/Qore-mobile-/pull/22
- Stores candidate: https://github.com/mezas3238-hue/Qore-mobile-/pull/14
- Diseño: https://www.figma.com/design/md9phVO8aDiDG3l57G7Rkw

## 18. HANDOFFS HISTÓRICOS QUE COMPLEMENTAN ESTE ARCHIVO, NO LO REEMPLAZAN

- docs/handoff/HANDOFF_MAESTRO_QORE_MOBILE_G209_EJECUCION_FINAL_CINCO_SERVICIOS_2026-10-29.md
- docs/handoff/HANDOFF_MAESTRO_QORE_MOBILE_G203_CINCO_RECORRIDOS_PENDIENTES_EJECUCION_INMEDIATA_2026-10-29.md
- docs/handoff/HANDOFF_MAESTRO_QORE_MOBILE_ABCD_G181_FINALIZACION_E2E_CINCO_SERVICIOS_ESCALA_2026-10-29.md
- docs/handoff/HANDOFF_MAESTRO_EJECUTIVO_QORE_MOBILE_ABCD_G178_PENDIENTES_E2E_ESCALA_2026-10-29.md
- GitHub issues organización histórica: #15 Backend A, #16 Cliente B, #17 Driver C, #18 Admin D.
- Si cualquier enlace o prueba cambia, el siguiente arquitecto debe confirmar HEAD/CI y no confiar en fecha antigua.

## 19. PROMPT DIRECTO PARA EL PRIMER MENSAJE DEL NUEVO CHAT

Actúa como ARQUITECTO EJECUTIVO PRINCIPAL E INTEGRADOR A+B+C+D de QORE Mobile / Movete Fácil. Tu trabajo es TERMINAR LA APLICACIÓN EN CÓDIGO, no escribir otro handoff. Repositorio mezas3238-hue/Qore-mobile-, rama integration/qore-mobile-e2e-four-apps-20261027. PRIMERA ACCIÓN: leer ÍNTEGRO este documento G227 en docs/handoff/HANDOFF_MAESTRO_QORE_MOBILE_G227_INTEGRACION_CINCO_RECORRIDOS_RELEASE_READINESS_2026-10-30.md, revisar HEAD/CI actuales y verificar que la integración G221 ya tiene 5/5 MISMAS solicitudes originales QA COMPLETADAS en PostgreSQL16 descartable (HEAD histórico c03a727, run 41051967912). NO degradar a la evaluación paralela G226 de 3/5 históricos, porque usa una población distinta (2 viajes nuevos + 3 cargas/Commerce históricas); comparar PR #36 a #41, no fusionarlos a ciegas. Prioridad: reconciliar ramas sin perder G221, completar conexiones auténticas de las cuatro superficies Cliente/Driver/Backend/Admin-Merchant para AUTO_RIDE, MOTO_RIDE, DELIVERY_AUTO, DELIVERY_MOTO, COMMERCE con el MISMO ID original; cerrar preferencias de radio en carretera G197/G199, mensajería segura/objetos olvidados G198/G200/G211, ratings G155, antifraude G157/G158, Owner comisiones, estabilidad, soporte y escalabilidad con pruebas. Luego preparar STAGING real Render/Supabase, autenticación, Geoapify, dispositivos, permisos legales de Driver y MOTO pasajero, PSP sandbox y un piloto controlado, cuando existan las aprobaciones y credenciales del Owner. Cada acción debe producir commits, rutas de app conectadas, tests POS/NEG y CI del mismo SHA. Si falta permiso externo, informar EXTERNAL_BLOCKED, mantener fail-closed y seguir con otro trabajo implementable. No re-preguntar requisitos establecidos. No merge, LIVE, despliegue externo, PSP, tiendas ni gastos sin orden explícita. Quiero resultados de ingeniería, no más planes.

---

**FIN DEL HANDOFF G227. Este documento habilita CONTINUIDAD DE INGENIERÍA, no lanzamiento comercial ni certificación legal.**
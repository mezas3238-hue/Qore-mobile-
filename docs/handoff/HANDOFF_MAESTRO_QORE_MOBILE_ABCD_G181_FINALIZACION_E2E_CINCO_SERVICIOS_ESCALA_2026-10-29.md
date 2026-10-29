# HANDOFF MAESTRO SOBERANO — QORE MOBILE / MOVETE FÁCIL
## Arquitecto Ejecutivo Integrador A + B + C + D | Continuidad inmediata | 29 de octubre de 2026

> ORDEN DEL OWNER: TERMINAR LOS TRABAJOS RESTANTES PARA QUE FUNCIONEN LAS APPS. Este documento es para CAMBIAR DE CHAT sin perder contexto. El siguiente arquitecto NO debe redactar otro handoff, reconstruir lo ya desarrollado ni llenar GitHub de pruebas aisladas que no alimentan las apps. Debe ejecutar trabajo de ingeniería directamente sobre el camino de negocio, publicar commits, verificar CI del HEAD y cerrar los pendientes implementables. No inventar permisos, cobros, viajes ni certificaciones. GitHub primero; ninguna activación comercial, merge o despliegue externo no autorizado.

### Estado canónico al corte

- Repositorio: https://github.com/mezas3238-hue/Qore-mobile-
- Rama de integración A+B+C+D: integration/qore-mobile-e2e-four-apps-20261027
- HEAD de integración leído JUSTO ANTES de este handoff: 5ec92d0314d22ea2e63b5f20ebba37c99882fa91. Este SHA quedará histórico cuando se publique el presente documento; volver a leer HEAD siempre.
- Laboratorio avanzado HTTP/Redis/PostgreSQL: PR #21 DRAFT, lab/qore-mobile-isolated-http-capacity-v1-20261028, HEAD comprobado: 4c278f08f6e06873e6bb4cc9265cd8d02d7747ef.
- Laboratorio/modelo de escala: PR #22 DRAFT, lab/qore-million-plus-scale-contract-20261028, HEAD 84a6b8a41fd92b92d3634299d083128f3d6119fa; es diseño/contrato, NO prueba real de un millón.
- Integración último HEAD anterior a este documento: workflow A+B+C+D SUCCESS 40856617826; https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40856617826
- Laboratorio PR #21: los CUATRO workflows DEL MISMO HEAD 4c278f08f6e06873e6bb4cc9265cd8d02d7747ef terminaron SUCCESS. PostgreSQL 40855405165, HTTP/Redis 40855405229, Node STAGING 40855405337, Expo 40855405479.
- Veredicto: CODE_QA_ADVANCED / NO_GO_COMERCIAL. Las cuatro superficies y muchos contratos PostgreSQL funcionan en QA, pero NO hay recorrido legal/comercial nuevo, completo y certificado para cada servicio ni instalación externa real.

El antiguo handoff maestro (hasta G178 en integración) sigue siendo anexo profundo y NO debe perderse: docs/handoff/HANDOFF_MAESTRO_EJECUTIVO_QORE_MOBILE_ABCD_G178_PENDIENTES_E2E_ESCALA_2026-10-29.md. ESTE archivo es el punto de entrada por contener G180/G181 de PR #21 y el avance G173–G178 de integración. No confundir dos series con números G repetidos entre integración y laboratorio: comparar rutas de archivo y SHA, nunca el número G solo.

---

## 01. PRODUCTO, DOMINIO Y ÓRDENES INALTERABLES

Nombre: QORE Mobile / Movete Fácil. Mercado inicial: Paraguay. Importes en guaraníes enteros (PYG/Gs). Arquitectura pensada para expandirse a más mercados, pero las habilitaciones regulatorias deben ser específicas por jurisdicción. Cliente escoge vehículo: jamás reasignar MOTO a AUTO o viceversa sin autorización y reconsentimiento.

Cinco servicios que se deben completar por separado y luego operar juntos:
1. AUTO_RIDE — pasajero en automóvil.
2. MOTO_RIDE — pasajero en motocicleta, licencia/casco/seguro propios de transporte de pasajeros.
3. DELIVERY_AUTO — paquetes y envíos en automóvil.
4. DELIVERY_MOTO — paquetes y envíos en motocicleta, habilitación diferente de MOTO_RIDE.
5. COMMERCE — comercios, supermercados, restaurantes y farmacias OTC, catálogo, inventario, compra, preparación, entrega, calificaciones y soporte.

Cuatro superficies:
- A — Backend/autoridad de negocio, HTTP, PostgreSQL, RLS, sesiones, comisiones, despacho, fraude.
- B — App Cliente: viaje, envío, comercio, pagos, estados, historial, seguimiento, calificaciones.
- C — App Driver/Courier: onboarding/KYC, vehículo, ofertas privadas, aceptación, GPS/custodia, historial, ganancias, calificación del cliente.
- D — Admin Web + Merchant Staff: Owner MFA y comisiones configurables, permisos, trazabilidad, atención a incidentes, catálogo, pedidos del comercio, antifraude y liquidación.

Comisiones: TODAS configurables por Owner en Admin Web bajo MFA/RBAC, para los cinco servicios; sin porcentajes inamovibles en frontend. En las reglas de pasajero verificadas históricamente: AUTO 15% nominal, MOTO 12% nominal y subsidio Owner 10 puntos porcentuales en pasajeros. Validar versión/ruleId actual en SQL; no transferir subsidio a comercio/carga ni inventar comisión COMMERCE. Congelar valor, tarifa, versión y consentimiento en cada recibo. Pago y liquidación son cosas diferentes.

Antifraude: calificaciones bilaterales después de completar servicio verdadero; Cliente→Driver/Courier/Merchant y Driver/Courier/Merchant→Cliente. Los reportes y baja reputación generan investigación, no sanción automática. Evidencia, identidad, auditoría, revisión humana y apelación contra falsas acusaciones. Prevenir doble despacho, falso GPS, pruebas manipuladas de entrega, suplantación, cancelaciones y chargebacks.

Geoapify: fue elegido como proveedor de mapas/rutas y se reportó secret en GitHub; confirmar integración REAL, cuotas, ruta MOTO/AUTO y compatibilidad Paraguay antes de afirmar una prueba externa. No exponer API key al móvil.

SECUENCIA DE SALIDA: (1) código GitHub + E2E fiable; (2) decisión Owner sobre STAGING real; (3) Render/Supabase, migraciones independientes, Secret/IdP/Geoapify, simulación legal/dispositivos; (4) PSP cuando se autorice; (5) permiso independiente Owner de LIVE/comercial/Stores. NO merge a main, LIVE, PSP, Render, Supabase, dominio o compra externa sin autorización.

---

## 02. REPOSITORIO Y RUTAS CANÓNICAS — NO RECONSTRUIR

- apps/mobility-expo/server/ — Runtime A, adaptadores, gateways, E2E Node/Python y laboratorio.
- apps/mobility-expo/docs/backend/staging_only/ — SQL Gx exclusivo de PostgreSQL 16 descartable; NO son migraciones de producción.
- apps/movete-cliente/ — App B, Expo Cliente y domain gateways.
- apps/movete-driver/ — App C, Expo Driver/Courier y domain gateways.
- apps/movete-admin/ — Web Owner/Admin y portal Merchant.
- .github/workflows/qore-four-apps-unified.yml — revisión integrada A+B+C+D.
- .github/workflows/mobility-g4-postgres-disposable.yml — cadena real PostgreSQL16 descartable, todos los servicios, actor/idempotencia.
- .github/workflows/qore-load-lab-v1.yml — HTTP Redis real local, límites, observabilidad.
- .github/workflows/qore-mobility-staging-node.yml — contratos STAGING Node.
- docs/handoff/HANDOFF_MAESTRO_EJECUTIVO_QORE_MOBILE_ABCD_G178_PENDIENTES_E2E_ESCALA_2026-10-29.md — inventario profundo de G155–G178 integración, riesgo, requisitos y pantallas.

PRs abiertos relevantes verificados:
- #21 laboratorio real G171–G181; código en rama LAB, NO fusionado con integración.
- #22 modelo teórico >2M cuentas / horizonte de 1M conectados; NO ejecutar costo masivo ni llamarlo proof.
- #7 fundación Backend, #8 Cliente, #13 dispatcher G115, #14 candidatos Stores, #19 Driver, #20 Admin, más #2 y #3 legacy. Todos DRAFT al corte.
- Issues de roles: #15 Backend, #16 Cliente, #17 Driver, #18 Admin.
- Nunca sobrescribir archivos editados por otro arquitecto: revisar HEAD/blobs actuales, commit CAS/no force push y volver a consultar CI del SHA real.

---

## 03. IMPLEMENTADO Y COMPROBADO — INTEGRACIÓN A+B+C+D HASTA G178

1. G73/G98 cotización y reserva AUTO Cliente→API→PG; G160/G111/G112/G85/G113 despacho privado/retry/backoff/autoridad acotada en QA.
2. G100/G102/G118/G119/G142/G169 cuota, reserva, cancelación y estado MOTO pasajero, permisos diferenciados, ledger provisional.
3. G5/G121/G122/G123/G125/G126 envíos AUTO/MOTO con cotización, consentimiento exacto del precio y evidencias de ruta en QA.
4. G45/G139/G144/G148 Buyer catálogo/stock/reserva/recuperación/cancelación; G150/G153/G154 enlace comercio-precio-envío; G156 inbox Merchant.
5. G155 reputación con prueba de participación, G157/G158 alerta fraude y Admin con AAL2, sin sanciones automáticas.
6. G116/G136 Owner comisiones; G124 tarifas de carga; G128–G134 contratos Geoapify; G159 manejo cámara/timeout; G162–G169 estados y recuperaciones.
7. Integración G170 recuperación segura de viaje original Driver; G171 lector acotado Driver; G172 lector Merchant con límite de tiempo/bytes.
8. Integración G173 ruta Merchant G6 protegida con IdP staff independiente + G42: no bypass de mutación. G174 acceso real a G45 desde runtime protegido por Buyer IdP. G175 bloquea Buyer G6 legacy mutación no autorizada. G176 bloquea Courier G5 legacy para custody sin G66/G67. G177 fases del Driver AUTO ya aceptado protegidas por IdP/G42 SQL. G178 evita UI Driver colgada por streams/timeout y mantiene recuperación tras POST incierto.
9. A+B+C+D branch PREVIA a este handoff: HEAD 5ec92d0314d22ea2e63b5f20ebba37c99882fa91, workflow A+B+C+D SUCCESS https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40856617826. PG16 SUCCESS del HEAD de integración anterior G175 https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40853297190. No trasladar CI de un SHA a otro sin verificar.

Limitación decisiva: el recorrido Driver AUTO G109 depende de una reserva fixture heredada prelegal. NO es un nuevo viaje completo G73→conductor legal→G177 con identidad original hasta completar. Las pruebas CI/SQL existentes son valiosas pero NO convierten fixtures en autorizaciones municipales o pólizas reales.

---

## 04. LABORATORIO PR #21 — TRABAJO REAL G171–G181, NO PERDER

Rama PR #21: lab/qore-mobile-isolated-http-capacity-v1-20261028; HEAD 4c278f08f6e06873e6bb4cc9265cd8d02d7747ef; último CI DEL HEAD:
- PostgreSQL16 https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40855405165 — SUCCESS.
- Ingress + Redis https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40855405229 — SUCCESS.
- STAGING Node https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40855405337 — SUCCESS.
- Expo https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40855405479 — SUCCESS.

Archivos importantes de laboratorio:
- apps/mobility-expo/server/render-staging-ingress.mjs — limitación y admisión HTTP, protección de upstream, health/readiness.
- apps/mobility-expo/server/g171-redis-distributed-quota.mjs — cuota Redis atómica GET 90/min y POST 20/min por hash de bearer, fail-closed; No JWT verificado por este borde.
- apps/mobility-expo/server/g171-redis-distributed-quota.test.mjs — TLS/ACL pinned STAGING, no Redis externo automático.
- apps/mobility-expo/server/run-g4-render-staging.mjs — opt-in Redis, multi-replica debe usar shared rediss privado pinned TLS y ACL.
- apps/mobility-expo/server/g172-g113-dispatch-multiprocess-pg-ci.py — G173 LAB 1000 reservas AUTO, 24 sesiones PG, SIGKILL antes de commit, retry único.
- apps/mobility-expo/server/g177-five-service-pg-concurrent-load-ci.py — G177 LAB 900 escrituras SQL originales (300 MOTO_RIDE, 300 DELIVERY_AUTO, 300 DELIVERY_MOTO).
- apps/mobility-expo/server/g180-commerce-stock-concurrent-pg-ci.py — G180 LAB 300 pedidos comercio reales SQL G45, 350 compradores, 50 carreras de última unidad, 60 cancelaciones/reposiciones, 0 duplicados/sobrestock.
- apps/mobility-expo/server/g181-five-service-co-tenant-pg-ci.py — G181 LAB ejecuta dos PROCESOS OS solapados contra EL MISMO PG16, tercera sesión independiente audita filas originales.

Evidencia cuantitativa VERIFICADA G181, workflow PostgreSQL del mismo SHA (40855405165):
- 1200 nuevas escrituras de negocio intercaladas: 300 MOTO_RIDE, 300 DELIVERY_AUTO, 300 DELIVERY_MOTO, 300 COMMERCE. Además >=1001 reservas AUTO originales previas del G173.
- 2 procesos OS simultáneos; 53 conexiones PostgreSQL observadas; tercera sesión SQL audita filas 300/600/300/300/60 (MOTO, deliveries, merchant orders, merchant receipts, merchant cancel receipts).
- 50 disputas por última unidad: 50 rechazos válidos SQL G4509 y ningún phantom order, oversell o duplicado. 60 cancelaciones con stock devuelto, 60 replays de reserva/cancelación.
- DURACIÓN G181 9,921s en runner desechable, NO extrapolar al mundo real.
- G180 CO-TENANT p95 663,87ms, p99 754,65ms y 73,5 intentos/s (degradación frente a G180 aislado anterior 167,62/s); **considerar contención real**, no presentar solo el mejor número.
- Originales perdidos 0, duplicados 0, inventario negativo 0, asignaciones Driver fabricadas 0, PSP paid false.
- Artefactos: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40855405165/artifacts/12888882430 (G181), /12889555482 (G180), /12887964677 (G177), /12889595205 (G173).
- G178/G179 HTTP + Redis real local: 16.500 credenciales sintéticas distintas, 0 falsas limitaciones cuando Redis compartido opt-in, Redis conservó 16.503 keys, memoria Redis 4.345.336 bytes y RSS Node 132.427.776 bytes en una ejecución anterior; rangos de RPS son variables por runner. Ningún IdP real ni PostgreSQL en ese ensayo de HTTP stub. Archivo apps/mobility-expo/scripts/load/g171-redis-multireplica-ci.mjs. Fail-closed Redis 503, cuota excedida 429, reinicio de réplica sin perder contador.

LIMITACIONES: G181 certifica integridad de ORIGINALES en PostgreSQL descartable; COMMERCE carga nuevas órdenes G45, pero no aceptación Merchant ni Courier legal/última milla en esta carga. 1200 escrituras NO equivalen a 1200 viajes completados, ni a un millón de clientes. No conectar LAB PR21 a integración sin autorización de merge o cherry-pick acordado.

---

## 05. LA BRECHA CENTRAL DE FUNCIONALIDAD — 5 SERVICIOS, MISMO OBJETO ORIGINAL

Norma E2E única: una NUEVA acción desde la app real B genera requestKey e id original, que pasa por backend A, dispatcher/offer C con AUTORIDAD LEGAL verdadera y nunca por asignación falsa. La ejecución respeta estado y consentimiento, termina en B/C/Commerce cuando aplica y Admin D muestra LA MISMA identidad/actor, sin cross-tenant; historial, clasificación y economía conciliados. NO ensamblar cinco suites separadas para simular una operación final.

### AUTO_RIDE [P0: primero]
EXISTE: G73/G98 quote+booking, G111/G112/G85/G113 despacho original, G16 private offers, G170/G106 Driver recovery, G177 integración fases, G138 Admin, G36 slot, G155 ratings.
FALTA: enlazar **el nuevo booking G73** al dispatch privado en las apps reales, comprobar KYC G38/G71 genuino, oferta original→aceptación C→arrive/pickup/complete G177→estado/historial B→D traza→liberar slot→recibo/finance. No usar G109 prelegal como sustituto.
ARCHIVOS A ABRIR: apps/mobility-expo/server/g4-staging-runtime.mjs; g4-loopback-http-transport.mjs; g73-f1-auto-gateway.mjs; g111-after-booking-auto-dispatch.mjs; g112-scoped-auto-dispatch-repository.mjs; g98-f1-auto-postgres-loopback-e2e-ci.mjs; g109-driver-auto-completion-pg-http-ci.mjs; g177-verified-auto-driver-step-gateway.mjs; apps/movete-driver/src/domain/driver-trip-lifecycle-http.mjs; apps/movete-driver/app/ofertas.tsx; apps/movete-driver/app/viaje.tsx; apps/movete-admin/src/service-trace-gateway.mjs.
DONE: mismo nuevo tripId para todas las fases, rechazo de Driver no legal, aceptación exactamente una vez, dos Drivers simultáneos no cobran ni aceptan doble, no datos entre usuarios, pasajero y Admin ven estado terminal.

### MOTO_RIDE [P0: después de AUTO]
EXISTE: G100/G102/G118/G119/G142/G169 persistencia, ledger, MOTO passenger QA.
FALTA: despacho y oferta C original, KYC específico MOTO pasajero/licencias/casco/seguro, Driver→aceptación→viaje terminal, seguimiento B y Admin D de mismo MOTO tripId; no usar elegibilidad DELIVERY_MOTO como equivalencia.
DONE: identidad y estados reales, tarifa/commission/subsidio congelados, cancelación y ledger reversible donde corresponda.

### DELIVERY_AUTO y DELIVERY_MOTO [P0]
EXISTE: G5/G121/G122/G123/G125/G126 precio/consentimiento/registro, G10 ofertas, G66/G67 custodia, G176 bloqueo vía débil.
FALTA: desde pantallas B cotizar antes de operación comercial, route provider real; despacho a conductor/courier habilitado para tipo exacto, dos ofertas no pueden asignar dos couriers, G66 recoger y custodiar, G67 evidencias y confirmación INDEPENDIENTE del destinatario, completar sin GPS falso; B/C/D mismos deliveryId. Devolución, disputa, PIN con TTL, protección contra falsa prueba de entrega.
DONE: pedido nuevo→preprecio consentido→oferta→pickup→recipient proof→delivered/returned→Admin, auditoría, sin comisiones recobradas.

### COMMERCE [P0]
EXISTE: G45/G139/G144/G148 Buyer→stock/order, G156/G173 Merchant staff, G150/G153/G154 vínculo a delivery priced. LAB G180/G181 prueba sobreventa/cancelación de 300 pedidos.
FALTA: cerrar mismo orderId con Buyer B real → Merchant staff independiente confirma/prepara/listo → deliveryId legal ligado y consentido → Courier pickup G66 → Merchant handoff → destinatario G67 → COMMERCE y DELIVERY terminal congruentes → Buyer/Owner D→rating/settlement (PSP solo si aprobado). No derivar pagos del 'QA_RESERVED_NO_PAYMENT'.
ARCHIVOS: apps/movete-cliente/app/comercios.tsx; apps/movete-cliente/src/domain/g139-commerce-qa-http-gateway.mjs; apps/movete-admin/src/merchant-main.tsx; apps/mobility-expo/server/g173-merchant-verified-mutation-gateway.mjs; g148-merchant-fulfillment-pg-ci.mjs; g150-merchant-priced-delivery-link-pg-ci.mjs; g154* SQL y g156-merchant-inbox-pg-http-ci.mjs.
DONE: orderId y deliveryId originales conservados y reconciliados, stock/PSP/consentimiento exactamente una vez.

---

## 06. PRIORIDAD DE CÓDIGO EN EL NUEVO CHAT: NO MÁS TESTS AISLADOS

**ITERACIÓN 1 — cerrar el eslabón AUTO real [P0, máximo valor]:**
- Abrir HEAD vigente de integración y runtime original G4, interfaces nativas B/C, G73→G111/G112→G16.
- Identificar PRIMER punto en el camino nuevo donde una oferta privada no llega a Driver con elegibilidad real; arreglar código existente, no diseñar otra app o solo nueva suite.
- Instrumentar IDs originales, source-of-truth PG, estado versionado, claim durable, recuperación de POST incierto. Mantener legal gates; si verdadero documento municipal o IdP ausente, reportar EXTERNAL_BLOCKED en ese punto y desarrollar siguiente capa que sí puede implementarse.
- Conectar C aceptar y completar MISMO tripId; B estado/historial, D trace; prueba positiva SOLO si consta autorización. Probar negaciones de sesión revocada/Driver sin KYC.
- Publicar commit y CI. Si no es posible completar por dependencia externa, explicar bloqueo preciso y continuar MOTO/DELIVERY/COMMERCE implementables, NO emitir un supuesto PASS.

**ITERACIÓN 2 — cuatro verticales restantes [P0]:**
- MOTO pasajero G100/G118 + UI Driver MOTO.
- DELIVERY_AUTO/MOTO B quote-before-booking, G123→G10 offer→G66/G67 recipient confirmation.
- COMMERCE G45 original Buyer→G173 staff→G150 linked courier→delivery actual→Admin.
- Completar UI B/C/D (no solo handlers en SQL). Incluir rol, estado de pantalla, errores/retry y batería misma operación.

**ITERACIÓN 3 — economía, antifraude, UI estable [P0/P1]:**
- Cinco comisiones configurables desde Owner web MFA (incluida comisión COMMERCE), tarifas sectorizadas, PYG integer y versión congelada.
- Rating bilateral: completar Driver/Courier→Cliente y Merchant→Cliente en UI real después de entrega/servicio; G155 original y G157/G158 revisión con appeal.
- Evitar ANR/pantallas colgadas por mala red: cancelación de fetch, timeouts, stream límite, estados offline, recuperación tras background, cámara cancelada, no doble POST.
- Implementar abstract PSP contract/webhook/reconcile sin activar ni conectar hasta permiso.

**ITERACIÓN 4 — robustez/distribución e infraestructura [P1]:**
- Incorporar selectivamente G171–G181 del PR21 bajo decisión explícita de merge/cherry-pick, reconciliando ramas y sin sobrescribir cambios de colegas.
- Auth verificado server-side, rate limit también IP/dispositivo con privacidad, multi-tenant, Redis TLS privado, pool PG, DB index/plan, consumers/outbox idempotentes y multi-réplica; separar GPS de transacciones.
- Escalar ensayos desde 20–53 conexiones y ~1200 escrituras a 10k, 100k y eventualmente pruebas distribuidas grandes DE FORMA CONTROLADA y con límites de costos. Pruebas de cargas reales de 5 servicios, no HTTP stub.
- Backups, restore drills, rolling restart, failover/Redis outage, colas/latency SLO, apagado/circuit breaker, DLQ, observabilidad p50/p95/p99, saturación hot spots. No prometer un millón sin demostrarlo.

**ITERACIÓN 5 — release gates [cuando Owner lo ordene]:**
- Solo con integración GitHub verificada, solicitar aprobación distinta para Render/Supabase STAGING real, presupuesto, región, secrets, migraciones revisadas y rollback.
- Certificar IdP real, KYC/documentos, GPS Geoapify, PSP y dispositivos Android/iOS sin usar CI fixtures como permisos.
- GO/NO_GO legal, seguridad, producto, desempeño y comercio, con autorización LIVE/Stores separada.

---

## 07. DEPENDENCIAS EXTERNAS NO CERRADAS — NO PASAR POR VERDE

- IdP/Supabase Auth real: JWT/claims revisadas, MFA Owner/Admin, sesiones Buyer/Driver/Staff verificadas y revocación real, RLS. En CI hay grants G42 QA, NO es certificación de proveedor externo.
- KYC/Legal: licencias AUTO/MOTO pasajeros y delivery, seguro vigente, vehículo, municipalidad/cobertura, documentos falsos/suspendidos, verificadores independientes. G38/G71 deben rechazar ausentes. NO cambiar elegibilidad solo para pasar una prueba.
- Maps/GPS: Geoapify real, geocoding, route profiles, ETA, tracking legítimo y privacy/retention, permisos móviles.
- PSP: proveedor habilitado Paraguay, hosted tokenization, idempotent intent, firma webhook, capture/refund/chargeback/payout, ledger y reversión auditable. PSP OFF al corte.
- Render/Supabase STAGING: workspace, costos y recursos acordados, migraciones que NO sean CI_ONLY, almacenamiento KYC privado, dominio HTTPS, Redis privado TLS/ACL, backups y permisos correctos. No desplegado/autorizado.
- Android/iOS: probar dispositivos reales, cámara, permisos background/location/push, interfaz y stores/AAB/IPA; PR #14 es candidato no release certificado.
- Legal/privacy: términos, consentimiento, retención PII/GPS, medicina/farmacia OTC, KYC, soporte, apelaciones y revisión regulatoria.

Clasificar cada dependencia como EXTERNAL_BLOCKED si no existe evidencia, sin ocultar; los módulos implementables deben avanzar mientras tanto.

---

## 08. SEGURIDAD, PRIVACIDAD, NO DUPLICACIÓN: PUERTAS OBLIGATORIAS

- 401 actor no verificado, token viejo/revocado; 403 rol ajeno, MFA/KYC no elegible; 409 idempotency conflict/revisión/stock agotado; 429 cuota; 503 Redis/IdP/PG/KYC/proveedor caído. Ningún fallo crea aceptación, cobro o asignación fantasma.
- G175/G176/G177 de INTEGRACIÓN cierran rutas legadas de bypass; no reabrir por cambios del laboratorio.
- Un POST con ACK incierto recupera MISMO id y key; nunca generar uno nuevo ni mostrar “éxito” local. Persistencia/queue/estado compartidos, no memoria del proceso.
- SQL RLS, actor derivado del proveedor, G42 revocation fence dentro transacción, MFA en Owner, no confundir Driver+Passenger, Merchant user o Admin. No tocar role service_role para fixture G45.
- Oferta privada: una sola adjudicación, vehicle legal, geocerca, expiración, 2 Drivers en carrera, cancelación y reintentos; no mostrar identidad del pasajero fuera del scope autorizado.
- Entrega: prueba custodial G66/G67 + confirmación independiente recipient; no marcar entregado por auto reporte del courier.
- Ratings: solo por servicio original completado, participación verificada, revisión de fraude con defensa/appeal; no bloqueos por una valoración.
- Secretos, JWT, fotos, KYC, dirección, GPS, teléfonos, PII, reportes privados no deben quedar en logs ni artefactos públicos.
- Monitorear UI congelada, leaks, listeners, retries, backoff con jitter, timeouts; no callback tardío reescribiendo viaje.
- Los SQL en apps/mobility-expo/docs/backend/staging_only/ NO son migraciones para Supabase ni producción.

---

## 09. PROPIEDADES DE ESCALA: MEDIR DIMENSIONES SEPARADAS

El Owner exige arquitectura preparada para millones, incluso >1 millón de clientes. Los datos actuales acreditan apenas:
- 1200 mutaciones concurrentes distribuidas entre dos procesos Node/Python QA con PostgreSQL temporal y pico 53 conexiones; sin operación última milla real.
- 1000 AUTO booking originales G173, 24 sesiones workers PG, prueba SIGKILL/retry.
- HTTP/Redis con 16.500 credenciales sintéticas, límites compartidos y 4,35 MB Redis aproximados; NO 16.500 usuarios IdP ni 16.500 viajes completados.
- PR22 2M+ accounts/1M concurrent stretch = objetivos de modelo, no hechos.

Siguientes medidas: cuentas totales persistidas, sesiones activas, usuarios realmente autenticados, conexiones/pool PG, tasa requests/second por endpoint, operaciones de negocio/second, latencia asignación, tasa ofertas→aceptación, GPS updates/min, memory/CPU/IO, cost por 1000 acciones, lag de outbox y reintentos, fallos por servicio y tenants, escenarios hotspots/zonas. Probar horizontalmente con Redis privado redundante, Postgres con pooling y colas durables. Selección de límites SLO concreta por Owner antes de proclamar capacidad. No consumir millones de operaciones contra APIs pagas.

---

## 10. MATRIZ PENDIENTES CON PRIORIDAD / DEFINICIÓN DE HECHO

P0 — terminar ruta original nueva AUTO G73→offer/Driver C→trip complete→B+D, sin permiso falso. DONE: mismo tripId y una sola adjudicación legal.
P0 — terminar MOTO pasajero completo, licencia MOTO distinta. DONE: mismo tripId terminal y visible B/C/D.
P0 — terminar DELIVERY_AUTO y DELIVERY_MOTO desde prequote→consent→offer→pickup→recipient→delivered, G66/G67 sin atajo. DONE: mismo deliveryId y confirmación independiente.
P0 — terminar COMMERCE Buyer+Merchant+courier, linked orderId-deliveryId, doble recibo/stock/cancel y devolución. DONE: terminal B/Staff/C/D, sin PSP fantasma.
P0 — mantener Auth/role/IdP/G42, legal G38/G71, RLS y Owner MFA; NO bypass de rutas legadas.
P0 — garantizar que las pantallas reales B/C/D están cableadas al runtime y no a otro QA bridge aislado; test por flujo UI→server→PG→UI.
P0 — comisiones cinco verticales configurables y snapshots congelados; COMMERCE por completar.
P0 — datos/acciones de cliente, merchant y courier reconocibles por Admin D y auditoría inmutable.
P0 — estabilidad B/C/D en timeout, reinicio, sin red, scroll/streams/cámara; no colgadas y recovery original.
P1 — bilateral ratings UI B/C/Staff después de terminal; antifraude case management, soporte y apelación.
P1 — GPS/Geoapify real, consentimiento/localización y ETA sin ficción, fallback sin inventar.
P1 — PSP adapter de manera segura pero OFF hasta Owner + autorización externa.
P1 — sistema distribuido Redis/pool/outbox/idempotencia, failover, observabilidad y progresión a millones sin inferir capacidad.
RELEASE-GATE — STAGING Render/Supabase/migraciones/IDP y LIVE solo bajo autorización explícita Owner, seguridad/legal/regulatorio/Devices.

---

## 11. CÓMO ARRANCAR A TRABAJAR SIN PEDIR CONTEXTO EN EL NUEVO CHAT

1. Obtener HEAD de integration y HEAD de PR21/PR22, PR list y los CI exactos, sin tomar SHAs de handoff como HEAD eterno.
2. Leer ESTE archivo y el handoff G178 antiguo para rutas/decisiones. Leer g4-staging-runtime.mjs, g4-loopback-http-transport.mjs, g73-f1-auto-gateway.mjs, g111-after-booking-auto-dispatch.mjs, g112-scoped-auto-dispatch-repository.mjs, g177-verified-auto-driver-step-gateway.mjs; luego B/C/D nativos.
3. Seguir UNA sola nueva reserva AUTO desde UI B y localizar el primer eslabón que produce NO_GO real. Escribir el fix de ese eslabón en el código existente. Priorizar integración funcional sobre otro benchmark o documento.
4. Mantener base SQL real misma sesión y tenant, publicar commit y ejecutar A+B+C+D + PG16 del HEAD. Añadir pruebas negativas pertinentes, no una suite desconectada.
5. Si falta autorización KYC legal o IdP externo, preservar FAIL_CLOSED y avanzar siguiente bloqueo implementable de esa cadena; no presentar fixture como conductor legal.
6. Al informar, enumerar commit, flujos verdaderamente operativos, IDs originales, pruebas exactas, fallos que se resolvieron y el BLOQUEO siguiente. No usar cifras de G181 para afirmar 1M clientes.
7. No merge, LIVE, compras, Render, Supabase ni PSP. No borrar las ramas de otros arquitectos; usar CAS/no-force y evitar conflictos.
8. Cuando se logre completar los cinco recorridos QA desde apps reales, auditar migraciones/seguridad e informar al Owner qué depende de autorización externa para habilitar STAGING.

---

## 12. PLANTILLA DE REPORTE DE UN CAMBIO — TRANSPARENCIA

- Repo/rama/HEAD antes y después; SHA/PR.
- Servicio y flujo: requestKey original → quoteId/tripId/deliveryId/orderId → Driver/Courier/Merchant → B/C/D terminal.
- Código real modificado y ruta de UI; cuál bypass/defecto se cerró.
- Prueba positiva si la autoridad existe; pruebas negativas si IdP, KYC, permiso legal, stock o GPS falla.
- CI exacto del commit; GREEN/RED y logs; ninguna afirmación del futuro.
- Estado: CODE_COMPLETE_QA / EXTERNAL_BLOCKED / NO_GO / CERTIFIED_STAGING (solo tras evidencia externa).
- Próximo P0 concreto que se implementará sin volver a producir handoff.

---

## 13. PROMPT DE REANUDACIÓN PARA EL PRIMER MENSAJE DEL CHAT NUEVO

ARQUITECTO EJECUTIVO INTEGRADOR A+B+C+D — QORE MOBILE / MOVETE FÁCIL. Accede a GitHub repo mezas3238-hue/Qore-mobile-, lee el HEAD actual de integration/qore-mobile-e2e-four-apps-20261027 y este documento:
docs/handoff/HANDOFF_MAESTRO_QORE_MOBILE_ABCD_G181_FINALIZACION_E2E_CINCO_SERVICIOS_ESCALA_2026-10-29.md

Lee además handoff G178 de integración y PR #21 laboratorio G181, sin asumir que sus commits ya están fusionados. Confirma CI de HEAD (A+B+C+D y PG16), preserva la seguridad G173–G178 y aprovecha métricas verificadas G171–G181 de PR21, sin confundir benchmarks con viajes legales. NO ESCRIBAS OTRO HANDOFF. TU PRIMERA ACCIÓN ES CÓDIGO: reparar el primer eslabón faltante del NUEVO viaje AUTO desde app Cliente B→G73→G111/G112 privado→Driver C jurídicamente elegible G38/G71→aceptación/arrive/pickup/complete G177→Cliente B y Admin D con MISMO tripId. Si legal/IdP real está ausente, mantener fail-closed, registrar EXTERNAL_BLOCKED y continuar tareas implementables sin fabricar un Driver. Después terminar MOTO_RIDE, DELIVERY_AUTO, DELIVERY_MOTO y COMMERCE a estado terminal, todos con sus apps reales, comisión Owner configurable, stock, antifraude, ratings bilaterales, mapas/GPS, estabilidad y crecimiento medible. No más pruebas aisladas como sustituto de producto. Publica commits, pruebas E2E de MISMA operación y resultados CI del mismo SHA. GitHub primero: NO merge, LIVE, Render, Supabase ni PSP sin autorización expresa del Owner.

---

FIN — HANDOFF MAESTRO 29 OCTUBRE 2026. El próximo arquitecto debe abrir el código y ejecutar, no re-documentar.

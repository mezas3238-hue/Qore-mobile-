# QORE Mobile / Movete Fácil
# HANDOFF MAESTRO INTEGRAL — Arquitecto B · R1–R66 + F1 AUTO posterior
## Entrega para iniciar nuevo chat y continuar SIN PAUSAS, salvo bloqueo real

**Corte verificado:** 24-oct-2026, Paraguay. **Repositorio único:** [mezas3238-hue/Qore-mobile-](https://github.com/mezas3238-hue/Qore-mobile-). **Responsable sucesor:** ARQUITECTO B, Cliente Expo + Admin Web. Este documento **no** significa que el producto esté finalizado ni comercialmente certificado. Consolida trabajo implementado, verificaciones, fallos corregidos, límites, dependencias y órdenes de continuidad.

**DIRECTIVA OWNER MÁS RECIENTE Y SOBERANA: LA PRIORIDAD ES ENTREGAR FUNCIONES COMPLETAS Y CERTIFICADAS, NO AUMENTAR COMMITS.** Trabajar por recorrido funcional de extremo a extremo. Ante bloqueo verdadero por falta de contrato A, ambiente autorizado o credenciales reales, documentar dependencia concreta y seguir inmediatamente otro trabajo B que sí cierre un recorrido, sin inventar disponibilidad, despliegue ni certificación. No detenerse por dudas cosméticas; no preguntar datos ya conocidos.

---

## 0. INICIO INMEDIATO DEL NUEVO ARQUITECTO — ORDEN DE TRABAJO

1. Abrir [PR #8](https://github.com/mezas3238-hue/Qore-mobile-/pull/8), **OPEN DRAFT**, rama B **feature/mobility-cliente-admin-parallel-20261022**; base del PR #8 es la rama A, NO main.
2. Abrir [PR #7](https://github.com/mezas3238-hue/Qore-mobile-/pull/7), **OPEN DRAFT**, rama A **feature/mobility-monorepo-isolated-20261016** (base main). A desarrolla simultáneamente y puede haber cambiado de HEAD.
3. Revisar las dependencias de contrato en [issue #9](https://github.com/mezas3238-hue/Qore-mobile-/issues/9), resultados B en [issue #11](https://github.com/mezas3238-hue/Qore-mobile-/issues/11), benchmarks [#10](https://github.com/mezas3238-hue/Qore-mobile-/issues/10) / [#12](https://github.com/mezas3238-hue/Qore-mobile-/issues/12).
4. Leer este documento y el maestro [R1–R62](./HANDOFF_MAESTRO_INTEGRAL_ARQUITECTO_B_R1_R62_CONTINUIDAD_SIN_PAUSAS_2026-10-24.md), que contiene auditoría histórica extensa y enlaces por corte.
5. **F1 prioritario:** comprobar si A publicó de verdad **pre-cotización AUTO antes del despacho**, **recibo único de booking idempotente**, **resolución de origen/destino**, **GET de conciliación**, y un **STAGING HTTPS/JWT/PostgreSQL persistente**. No aceptar un contrato QA genérico como suficiente.
6. Si A ya resolvió esos puntos: integrar la API versionada en Cliente, ensayar todo el viaje AUTO Cliente→Driver→Admin en un solo ambiente permitido, validar fallos y evidenciar PASO A PASO.
7. Si no los resolvió: informar con pruebas de diferencias de DTO en issue #9, cerrar dentro del dominio B el siguiente tramo bloqueado que pueda verificarse realmente; NO añadir otra fachada cosmética ni extender códigos R por inercia.
8. Ejecutar **tres workflows B en el SHA final exacto**. Si un test falla, leer job/log y arreglar antes de declarar QA_PASS.
9. Entregar estados por función **CERTIFICADO E2E / PARCIAL / BLOQUEADO**, con evidencia y dependencia siguiente. Los commits y cantidad de tests son evidencia auxiliar, no progreso comercial.

**Separación absoluta de archivos:** B SOLO escribe **apps/movete-cliente/**, **apps/movete-admin/** y **docs/architect-b/**. A controla **apps/mobility-expo/**, backend Node, PostgreSQL, Driver, OpenAPI, infra, .github, contratos compartidos y docs/architecture. No pisar ni editar archivos A. Comunicar contratos por issue #9.

**Prohibiciones vigentes:** NO MERGE, NO LIVE, NO DEPLOY, NO VPS, NO crear infraestructura remota ni usar credenciales reales, NO PSP/cobros/transferencias reales, NO APK/IPA comercial, NO datos biométricos o PII reales, NO hacer cambios de producción sin autorización Owner específica. PR #7 y #8 permanecen DRAFT. QA local/sintética y lectura GitHub autorizadas; STAGING externo requiere su autorización separada.

---

## 1. FOTO REAL DEL CÓDIGO Y DE LAS PRUEBAS EN EL CORTE

- **HEAD B anterior a publicar este handoff:** 029561e699457185a06caf6f63c816e9dfccf5d3, [PR #8](https://github.com/mezas3238-hue/Qore-mobile-/pull/8), OPEN/DRAFT. **ATENCIÓN:** este documento generará otro commit; el siguiente arquitecto DEBE consultar HEAD actualizado, no fijarse al SHA histórico.
- **HEAD A verificado al iniciar la publicación:** a4ba115e4fc0140e25fc6784b3f444b11ff30441, [PR #7](https://github.com/mezas3238-hue/Qore-mobile-/pull/7), OPEN/DRAFT. A estaba desarrollando KYC vencimientos; sus cuatro workflows sobre ese SHA se consultaron todavía **in_progress**. NO afirmar 4/4 SUCCESS sin nueva verificación.
- **CI B en el SHA previo 029561e…: 3/3 SUCCESS, comprobado**:
  - [Movete Facil Architect B ownership boundary — 40134261670](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40134261670).
  - [Movete Facil Admin web QA — 40134261587](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40134261587).
  - [Movete Facil two app isolation — 40134261590](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40134261590); incluye pruebas Cliente/Driver, TypeScript y export WEB. Export web NO equivale a APK/AAB/IPA firmado ni a prueba en teléfonos.
- **Matriz fuente A de lanzamiento:** [MOVETE_FACIL_LAUNCH_GATES_2026-10-24.json](../architecture/MOVETE_FACIL_LAUNCH_GATES_2026-10-24.json): **17 P0: 15 BLOCKED, 2 QA_ONLY y cero STAGING_E2E_CERTIFIED; decisión NO_GO** en el corte observado. Verificar nuevamente en próximo chat.
- **Matriz B R60:** [CERTIFICACION_INTEGRAL_R60_MATRIZ_VERIFICABLE_2026-10-24.json](./CERTIFICACION_INTEGRAL_R60_MATRIZ_VERIFICABLE_2026-10-24.json): **20 flujos comerciales: 0/20 certificados**. No inventar que nuevas pruebas Node con fixtures hayan levantado uno de esos 20.
- **Versión OpenAPI A comprobada:** 1.0.0-g69 en apps/mobility-expo/docs/backend/openapi/movete-facil-staging.openapi.json, no equivale a servicio HTTPS disponible.
- A laboratorios G67–G70 validaron SQL, roles, JWT y GET mediante localhost HTTP y PostgreSQL disposable **en ensayos separados**: no existe evidencia de una misma DB persistente accesible desde teléfonos.
- Este handoff es un documento de coordinación, no cambia ni certifica el comportamiento del software.

### 1.1 Cinco niveles de estado, no mezclar conceptos

1. **Código/UI implementado:** ruta, pantalla, validaciones, DTO presentes.
2. **QA_PASS:** pruebas con mocks, servidor sintético, SQL disposable y/o CI exacto, incluso escenarios adversariales.
3. **STAGING_E2E_PASS:** dos o más cuentas autorizadas, HTTPS/JWT con proveedor y PostgreSQL persistente compartido, operaciones completas realmente escritas y leídas en el MISMO ambiente.
4. **NATIVE_PASS:** Cliente y Driver independientes en dispositivos Android/iOS físicos, permisos/GPS/push/reconexión/latencia/fallos medidos.
5. **COMMERCIAL_GO:** además de lo anterior, seguridad, cumplimiento paraguayo, PSP, soporte, operación, seguros, actas y firma expresa Owner.

Hoy solo se ha demostrado hasta QA en las capacidades citadas; **NO_GO comercial**.

---

## 2. NEGOCIO, ARQUITECTURA Y PRODUCTO DEFINIDOS POR OWNER

**Movete Fácil / QORE Mobile** es una plataforma paraguaya de movilidad y logística con activación por zonas, diseñada para superar funcionalmente la experiencia de Bolt/Uber y cubrir comercios estilo apps de delivery, SIN copiar interfaces ni marcas. Dos aplicaciones **nativas Expo completamente independientes**:

- **Cliente**: pasajero, remitente, comprador. Viajes de pasajero **AUTO**; envíos por AUTO y MOTO de carga; comercios supermercados, farmacias dentro de rubros permitidos y restaurantes; historial, cotizaciones Gs, mensajería a Driver/delivery, soporte.
- **Driver**: conductor y repartidor, elegibilidad, documentación, vehículos, GPS/navegación, ofertas, aceptar/recoger/completar, custodia; responsabilidad arquitecto A.
- **Admin Web**: backoffice exclusivo con roles, RBAC/MFA, KYC, habilitaciones, zonas, incidentes, auditoría, finanzas y soporte; responsabilidad arquitecto B para frontend.
- **MOTO para transporte de pasajero NO autorizada**. MOTO solo carga/entregas conforme vehículo/política.
- Tarifas diferenciadas por modalidad, calculadas por backend en **Gs/PYG**. Jamás mostrar misma tarifa inventada a AUTO y MOTO; no inventar ETA/GPS/precio/disponibilidad.
- **Cobertura ≠ disponibilidad**. Zona habilitada no garantiza Driver próximo. Comercios listados no significan stock real, checkout permitido o apertura actual.
- Rechazado límite total de 50 usuarios/registros: paginar páginas de 50 o 100 y ventana local RAM acotada, manteniendo historial y población global sin límite arbitrario.
- Conductor debe cargar licencia/registro, cédula de identidad anverso/reverso, cédula verde, habilitación vehículo, **foto actual de rostro**, y seguro/inspección donde apliquen. Aprobación automática SOLO por evidencias verificadas independientemente, identidad/placa/vehículo coherentes, documentos vigentes, liveness+coincidencia facial, fraude limpio y decisión transaccional del servidor. Caso ambiguo a Admin humano. **No aprobar por fecha ingresada manualmente o solo selfie.**
- Cuando un documento vence: bloquear elegibilidad/conducción y mostrar notificación privada en la pantalla Driver; cuando renueva, re-verificar fotos/documentos y re-habilitar solo con nueva decisión auténtica. Cambiar documentos invalida pruebas antiguas. A maneja datos originales, expiración y restricciones; B Admin excepciones, cola, revisión y auditoría.
- Seguridad, privacidad, consentimiento, accesibilidad y continuidad funcional por delante de promesas visuales. Lovable **solo** para interfaz final, después de que funciones/backend estén listos.

---

## 3. HISTORIAL COMPLETO B — FUNDAMENTOS, R1–R66 Y CORTES F1

**Los documentos individuales B en docs/architect-b preservan implementaciones y tests de cada etapa.** Para detalles de commits y archivos del periodo inicial, usar el [Handoff R1–R62 de 44 KB](./HANDOFF_MAESTRO_INTEGRAL_ARQUITECTO_B_R1_R62_CONTINUIDAD_SIN_PAUSAS_2026-10-24.md), sus anexos, y [STATUS_Y_CONTRATOS.md](./STATUS_Y_CONTRATOS.md). El inventario R62 contiene 343 rutas modificadas en ese momento; NO interpretarlas como número actual de archivos/commits ni como progreso funcional.

### 3.1 Base Cliente y Admin (B01–B31)

**Cliente Expo** en apps/movete-cliente:

- App independiente, navegación y pantallas index, viaje, envios, seguimiento, historial, cotizacion, pagos, soporte, comercios, cuenta, mensajes y conversaciones.
- **ClientRuntime / client-experience:** composición central, sesión Passenger exclusiva, estado privado por revisión, borrado de datos al logout/rotación, rechazo de ACK o GET tardío al cambiar cuenta.
- **client-gateway y lectores HTTP:** HTTPS pinned, JWT sujeto a actor, no redirects/cookies, AbortController y plazo, lectura UTF-8 acotada, exactitud DTO y filtrado anti-PII, opt-ins OFF por defecto.
- **AUTO:** borrador de ruta/origen/destino, requestKey UUID, validación y protocolo idempotente; separar borrador, POST, 201 y confirmación real. No inferir conductor asignado por push o status HTTP genérico.
- **GPS/estado:** rider-status, ride-status-gateway, rider-polling, revisión monotónica, tiempo/frescura de ubicación, consentimiento, ocultar Driver/GPS/ETA sin asignación persistente.
- **Cancelación:** confirmación de usuario, clave idempotente estable y GET de re-verificación; ante timeout/reintento no duplicar cancelación.
- **Tarifas:** fare-quote-gateway, fare-quote-flow, quote-view, visualización de precio Gs de servidor sujeto a TTL/versión, sin cobro.
- **Envíos:** borrador de carga AUTO/MOTO con peso, restricciones y tipos, sin pasajeros MOTO.
- **Historial:** historial propio con cursores server-signed, paginación, ventanas RAM y protección contra miles de entradas. 50 = tamaño de página, NO límite de registros de plataforma.
- **Comercios:** selector de sucursal, categorías, catálogos/versiones/TTL, carrito privado, sustituciones, stock en modo lectura, validaciones previas; checkout real no activado.
- **Seguridad/soporte:** reportes G40 QA, mensajes de estado, incidentes, consentimiento, roles, accesibilidad, evitar SOS ficticio.
- **Chat:** conversación Cliente↔Driver/repartidor ligada a asignación real, no exponer teléfono, historial read-only, mensajes y ACK idempotente, contadores de no leídos, cursores y revocación al cambiar asignación.

**Admin Web** en apps/movete-admin:

- App web React/Vite/TypeScript independiente, paneles de resumen, propietario, KYC, zonas, incidentes, auditoría.
- Estado/session Admin y Owner separados, permisos mínimos, MFA contratado, sin credenciales service_role en browser.
- Bandejas KYC, auditoría, incidentes, zona y finanzas; paginación/cursor privado; no inferir comisiones ni PSP por fixtures.
- Flujo de revisión KYC con draft seguro y bloqueo a POST no certificado.
- Bandeja de soporte comercial, filtros y accesibilidad.
- **No existe validación de Admin real con expediente de identidad de una persona real.** Training fixtures no son aprobaciones.

### 3.2 R1–R5 — comprador/comercios
Directorio G44 de sucursales por municipio y modalidad, adaptadores buyer read-only, contratos catálogo G45, protecciones HTTPS y selección. Ver:
- [Handoff R1–R13](./HANDOFF_MAESTRO_ARQUITECTO_B_R1_R13_TOTAL_Y_CONTINUIDAD_2026-10-23.md)
- [R4 G44](./CONTINUIDAD_B_R4_G44_BUYER_BRANCHES_2026-10-23.md)
- [R5 G44/G45](./CONTINUIDAD_B_R5_G44_HTTP_G45_QA_2026-10-23.md)

### 3.3 R6–R33 — mensajería completa a nivel QA (no física)
- **R6:** conversación Cliente ↔ Driver/delivery solo durante servicio autorizado.
- **R7–R9:** reconexión segura, hints push privados/revocación, ACK seguro.
- **R10–R13:** bandeja, contadores, orden y pin de conversación/autorización.
- **R14–R17:** TTL, cursor de mensajes, sesión/token nuevo, ACK/revisión sin retroceso.
- **R18–R22:** privacidad de previews y metadatos, estabilidad de orden/páginas.
- **R23–R24:** borrador privado enlazado a conversación, ACK incierto sin duplicar POST.
- **R25–R27:** G51 inbox por HTTPS pinned opt-in con fallos/cursores/autorización.
- **R28–R30:** G52 historial de mensajes read-only, sin exponer hilo ajeno.
- **R31–R33:** G53 envío idempotente y G54 revocación ante cambio de Driver/cuenta, no marcar como leído sin servidor.
Documentación: [Handoff R1–R33](./HANDOFF_MAESTRO_INTEGRAL_B_R1_R33_G55_CONTINUIDAD_AUTONOMA_2026-10-24.md) y archivos CONTINUIDAD_B_R6..R33. **Pendiente:** chat real dos móviles, push/entrega/lectura, reasignación en PostgreSQL y IdP HTTPS.

### 3.4 R34–R50 — interfaz útil, carrito, KYC/soporte Admin
- **R34** G55 marcadores lectura y referencia servicio, sin ACK falso.
- **R35–R36** editor de ruta/paradas y modo accesible simplificado, sin geocodificación/ETA real.
- **R37–R40** tiendas multirrubro, revisión carrito local, sustituciones, asistencia y estado pedido.
- **R41–R42** frescura incidente/soporte G40 y preferencias de contacto.
- **R43–R44** bandeja casos comerciales Admin y lectura QA coordinada.
- **R45** accesibilidad y navegación Admin.
- **R46–R50** fence de lectura de comercio, TTL de catálogo/sucursal, guardas del carrito, selección de sucursal válida.
Detalle por etapa: archivos CONTINUIDAD_B_R34...R50 en docs/architect-b y [maestro R1–R43](./HANDOFF_MAESTRO_INTEGRAL_B_R1_R43_CONTINUIDAD_AUTONOMA_2026-10-24.md).

### 3.5 R51–R62 — avance hacia operaciones verticales reales, sigue opt-in
- **R51** accesibilidad en comercios.
- **R52** edición segura de envíos.
- **R53** bloqueo de edición de borrador AUTO luego de intento de reserva.
- **R54** cancelación según estado vigente desde seguimiento.
- **R55** composición de STAGING HTTPS chat Cliente G61, sin habilitar transporte no desplegado.
- **R56** gateway POST booking STAGING con **recibo QA estricto de 9 campos**; no acepta HTTP 201 genérico como garantía de trip persistido.
- **R57** conciliación read-only del requestKey tras ACK perdido; prohíbe reenvío del mismo POST a ciegas.
- **R58** UI de reserva incierta / reconstrucción por servidor; sin viaje falso.
- **R59** saneamiento de códigos error y matriz de bloqueos.
- **R60** matriz auditable de **17 P0 y 20 flujos**; 0/20 con E2E comercial certificado. No reinterpretar simulaciones como GO.
- **R61** vocabulario Client Passenger frente a estados Driver G65 (accepted→assigned; at_pickup→arriving), y revisión monotónica en tracker.
- **R62** vista remitente de estado de envío y prueba de custodia QA, sin afirmar prueba entregada por UUID o notificación.
Ver archivos CONTINUIDAD_B_R51...R62, [Handoff R60](./HANDOFF_R60_CERTIFICACION_TOTAL_SIN_AMBIGUEDADES_2026-10-24.md), [maestro R1–R62](./HANDOFF_MAESTRO_INTEGRAL_ARQUITECTO_B_R1_R62_CONTINUIDAD_SIN_PAUSAS_2026-10-24.md).

### 3.6 R63–R66 — seguridad de custodia y Admin
- **R63:** custodia del envío de la cuenta propietaria, TTL y anclaje al propio historial; al cambiar JWT/propiedad/tiempo, limpiar prueba visible y descartar respuestas anteriores. 10 casos adversariales.
- **R64:** Admin KYC: impedir dos POST de revisión simultáneos y revisión posterior a ACK incierto. GET autoritativo KYC debe devolver revisión posterior mayor; un ACK o memoria local no aprueba al conductor. Siete pruebas adversariales. Archivo [R64](./CONTINUIDAD_B_R64_KYC_ADMIN_ACK_INCIERTO_Y_REVISION_AUTORITATIVA_2026-10-24.md).
- **R65:** gateway de custodia remitente GET privado bajo HTTPS pinned/Passenger, deshabilitado por defecto. Opt-ins separados (enabled, contractCertified, stagingRuntimeVerified, g68SenderContractCertified), DTO G68 exacto, límites respuesta y timeout, no URL arbitraria ni secretos browser. 12 grupos de gateway + 7 integrados. [R65](./CONTINUIDAD_B_R65_G68_CUSTODIA_REMITENTE_HTTPS_OPTIN_QA_2026-10-24.md).
- **R66:** barrera monotónica de custodia contra transiciones imposibles G5, mismo revision/diferente prueba, retroceso, cancelación resucitada o Driver/vehículo alterado. 14 adversariales + 5 integrados. Primera CI detectó regresión de código R62, **corregida** manteniendo SENDER_CUSTODY_STALE_REVISION para revisión inferior y SENDER_CUSTODY_STATE_CONFLICT para contradicción. [R66](./CONTINUIDAD_B_R66_G5_G68_G69_SECUENCIA_CUSTODIA_MONOTONICA_2026-10-24.md). Su CI 3/3 correspondió al corte R66, antes de F1; las pruebas actuales son otro SHA.

### 3.7 Trabajo posterior a R66 — PRIORIDAD CAMBIADA A F1 AUTO COMPLETO

La orden del Owner cambió la métrica: no aumentar commits sino cerrar un recorrido completo. Los cambios siguientes están en PR #8 hasta SHA 029561e… y **todos los workflows B del corte final aprobaron**. No han sido numerados como R67/R68 para no confundir volumen de commits con funciones.

**F1-A — vincular reserva persistida con seguimiento:**
- **client-mutations.mjs:** conserva exclusivamente tripId UUID, revisión y requestKey de un **recibo estricto de pasajero propio**; no basta 201 genérico. Se corrigió una expresión UUID incompleta tras fallo de CI.
- **client-experience.mjs:** rideContinuation() y continueVerifiedRide(): desde reserva propia verificada hace **GET Passenger server-authoritative** antes de abrir seguimiento; ante 503, cuenta ajena, sesión rotada o snapshot inválido no crea un viaje fantasma.
- **rider-polling.mjs:** stopIfMatching revoca incluso si no llegó el primer snapshot válido. Se corrigió una suscripción que sobrevivía a error 503; pruebas detectaron y cerraron el problema.
- **viaje.tsx:** botón de verificar y entrar a seguimiento solo con ambos contratos opt-in e ID propio. No informa tarifa ni Driver si no existen.
- **f1-verified-passenger-ride-continuation.test.mjs:** éxito, 201 genérico rechazado, lost ACK reconciliado sin re-POST, JWT rotado, otro owner, 503.

**F1-B — estados Driver hasta completado:**
- **rider-polling.mjs:** transiciones permitidas por A G3 PostgreSQL; searching→assigned→arriving→in_progress→completed o cancelaciones previas permitidas. Revisión +1 por transición; GET puede saltar estados SOLO cuando revisión avanza lo suficiente. Rechaza completed→assigned y cancelado→activo, retroceso por GET tardío, igual revisión/estado contradictorio, cancelación después de inicio. Mantiene último estado autorizado y oculta GPS/ETA en conflicto.
- Pruebas **rider-polling.test.mjs** y **f1-verified-passenger-ride-continuation.test.mjs** cubren lifecycle y conflictos con respuestas sintéticas.

**F1-C — seguimiento automático solo con pantalla activa:**
- **f1-focused-tracking-sync.mjs/.d.mts**, **f1-focused-tracking-sync.test.mjs** y **seguimiento.tsx**: GET cada **12 segundos** solo en pantalla enfocada, cuenta Passenger, recibo verificado, status configurado y suscripción actual.
- No duplica GET inicial ya hecho por continueVerifiedRide(). Evita múltiples GET simultáneos. Al salir, Android/iOS background por AppState, rotar JWT, cambiar viaje o llegar completed/cancelled, apaga el intervalo.
- Hubo una regresión TypeScript (.d.mts no declarado) y un test de callback asíncrono que fallaron en CI iniciales; se corrigieron y se obtuvo 3/3 SUCCESS antes del corte F1 siguiente.

**F1-D — reanudar viaje después de reiniciar Cliente:**
- **client-experience.mjs** agregó rideHistoryRecovery() y resumeRideFromHistory(). Solo se permite desde un **GET autenticado de historial realmente realizado por el gateway privado**; una llamada local acceptHistory() no autoriza reanudar.
- Compara owner, ID, revisión y estado RIDE searching/assigned/in_progress; hace otro GET status autoritativo y solo reabre si continúa activo. No genera segundo booking, segundo Driver ni tarifa inventada; rechaza read viejo/otro JWT/cancelado/completed/503.
- **historial.tsx**: acción «Recuperar seguimiento de mi viaje»; **f1-own-history-ride-recovery.test.mjs** prueba 2 GET encadenados, seguridad, reinicio, logout, carrera, sesión y error.
- Requiere API historial y status de la MISMA DB real para certificación fuera de QA.

**F1-E — comprobar viaje terminado contra historial (último corte B pre-handoff):**
- **client-experience.mjs/.d.mts** agregó completedRideHistory() y verifyCompletedRideHistory(), enlazado a la sesión y revisión actual.
- GET status permite mostrar «Finalizado», pero NO basta para afirmar archivo en historial. El pasajero pulsa «Verificar finalización en mi historial» en **seguimiento.tsx**; se hace GET historial read-only del propietario. Solo acepta fila RIDE completed del mismo serviceId con revisión igual o posterior a la confirmada por status.
- Respuestas 503/malformadas, owner ajeno, revisión obsoleta, JWT cambiado, dos consultas paralelas y snapshot insertado por acceptHistory no conceden confirmación adicional. Nunca afirmar cobro, tarifa liquidada o comprobante fiscal.
- **f1-completed-ride-history-reconciliation.test.mjs** valida transacciones sintéticas y adversarios. CI final exacta: 3/3 SUCCESS en SHA 029561e….

**Archivos esenciales F1 para siguiente arquitecto:**
- apps/movete-cliente/src/domain/client-experience.mjs y client-experience.d.mts
- apps/movete-cliente/src/domain/client-mutations.mjs
- apps/movete-cliente/src/domain/passenger-booking-staging-gateway.mjs
- apps/movete-cliente/src/domain/ride-status-gateway.mjs
- apps/movete-cliente/src/domain/rider-polling.mjs / rider-status.mjs
- apps/movete-cliente/src/domain/client-history-gateway.mjs / history-feed.mjs
- apps/movete-cliente/src/domain/f1-focused-tracking-sync.mjs / .d.mts
- apps/movete-cliente/app/viaje.tsx / seguimiento.tsx / historial.tsx / cotizacion.tsx
- apps/movete-cliente/src/domain/f1-verified-passenger-ride-continuation.test.mjs
- apps/movete-cliente/src/domain/f1-focused-tracking-sync.test.mjs
- apps/movete-cliente/src/domain/f1-own-history-ride-recovery.test.mjs
- apps/movete-cliente/src/domain/f1-completed-ride-history-reconciliation.test.mjs
- apps/movete-admin/src/admin-experience.mjs y r64-kyc-review-reconciliation.test.mjs

**Resultado correcto:** Cliente tiene un circuito **PROBADO MEDIANTE QA sintética** de booking estricto→status→ciclo Driver simulado→finalización→historial; puede reanudar tras reinicio. **NO es viaje real completado**: Driver/SQL/IdP/HTTPS/Admin físicos todavía no cerrados con él.

---

## 4. BLOQUEOS P0 QUE IMPIDEN ENTREGAR F1 AUTO CERTIFICADO

### P0-1: Contrato incompatiblemente tipado entre A y B

A en apps/mobility-expo/server/g4-trip-command-gateway.mjs expone POST /v1/staging/rider/trips/request y devuelve los campos:
**mode=STAGING_DEMO_ONLY, commercialRidesEnabled=false, tripId, status=searching, serverPersisted=true**.

B en passenger-booking-staging-gateway.mjs exige de modo fail-closed:
**mode, commercialEnabled=false, ownerId, requestKey, operation, serviceId, revision, serverPersisted, status=ACCEPTED_QA**.

**No son equivalentes.** OpenAPI A 1.0.0-g69 todavía describe un Success genérico para el POST de viaje. Aunque A devuelva 201, Cliente B NO puede marcar reserva segura porque faltan propietario, clave y revisión. **NO quitar la validación en B para «hacer que funcione».** A debe publicar una versión canónica y demostrar ownership+idempotencia persistente. Adaptar B solo a ese contrato versionado con tests de reintento y race.

### P0-2: Orden económico del viaje incorrecto

A /v1/staging/fares/quote pide **subjectId de viaje ya creado**, y Cliente pantalla cotizacion.tsx solicita precio de un trip ya conocido. El Owner exige **ver precio en Gs, aceptarlo y SOLO DESPUÉS solicitar/conseguir AUTO**. Falta prequote vinculante antes del dispatch: clase AUTO, ruta/municipio/cobertura, tarifa total/desglose/comisiones según política, quoteId/version/expiry, aceptación explícita y enlace transaccional a requestKey. Cualquier precio local, monto ficticio o aceptación de quote caducada = FAIL. Si no se conoce proveedor de mapas real, A debe definir un contrato verificable sin falsificar geocodificación.

### P0-3: Origen y destino incongruentes

A G4 acepta tags restringidos a letras mayúsculas/guion bajo, longitud 3–40. UI B recibe direcciones de usuario legibles hasta 120 caracteres. Falta resolver origen/destino autoritativamente, permisos GPS, zona/municipio y cobertura operativa. **No transformar texto humano a tag de forma arbitraria** ni fingir coordenadas/ruta.

### P0-4: HTTPS STAGING IdP/roles/SQL duradero no certificado

No hay evidencia de instancia externa aprobada a la que conecten dos teléfonos por TLS, proveedor JWKS real y PostgreSQL duradero con migraciones, backups/recovery, RLS y permisos. G70 local HTTP 127.0.0.1 más tests PG disposable separados NO equivale al mismo entorno persistente. No activar flags enabled/contractCertified/stagingRuntimeVerified por fixtures o localhost; no pedir acceso a LIVE ni usar proveedores sin permiso.

### P0-5: Recorrido Driver + Admin sobre la misma transacción no ensayado

A G4/G65 contiene lógica QA de ofertas, aceptación, cambios arriving/in_progress/completed; B los lee desde contratos. No hay evidencia en ambos teléfonos reales ni Admin operando el mismo ride. Probar oferta entre dos Drivers concurrentes, exactamente uno ganador en PG, llegada/pickup, GPS consentido, completado, historial y Admin mostrando misma revisión/propiedad. Push no es aceptación, cobertura no es disponibilidad, estado terminal no es pago.

### P0-6: Conciliación de POST ambiguo y lectura posterior

B recupera ACK perdido mediante callback read-only inyectado; A debe publicar GET contrato real por propietario+requestKey y recibo de reserva con revisión. Tras 503/timeout, **nunca** lanzar otro POST con una nueva llave ni suponer ausencia. Verificar duplicate requests, caída antes/después de COMMIT, sesión nueva, 409 y reintento de misma llave sin doble despachar.

### P0-7: Rutas de soporte, cancelación y extremo financiero

La cancelación y fin de viaje necesitan ledger y reglas de cobro/reembolso, no solo estados G3. No afirmar precio, autorización PSP, pago efectivo, comisiones o factura. Cualquier integración PSP necesita aprobación separada Owner y cumplimiento.

---

## 5. MATRIZ DE FUNCIONES PARA LA ENTREGA: ESTADO ACTUAL

| Vertical | Código/UI B implementado | Prueba real independiente | Estado honesto |
|---|---|---|---|
| **F1 Viaje AUTO** | Borrador, reserva segura opt-in, status, GPS protegido, cancelación, reanudación, completion→history | Sin prequote antes del POST, sin mismo Driver+SQL+Admin real | **PARCIAL / E2E BLOQUEADO** |
| **F2 MOTO** | Solo cargo/envíos, no pasajero, borradores y diferencias | Sin ciclo físico moto/elegibilidad/custodia certificado | **PARCIAL** |
| **F3 Envíos particulares** | Pantallas, remitente, custodia G68 R63–R66 y protección de prueba | Sin recogida/entrega con prueba auténtica y mismo SQL + móviles | **PARCIAL** |
| **F4 Comercios** | Sucursales, catálogo, carrito, sustitución, bandeja Admin | Checkout/stock transaccional/merchant acceptance/PSP/Driver pendientes | **PARCIAL** |
| **F5 Chat Cliente↔Driver** | Inbox, GET/POST QA, ACK, revocación, hints, seguridad | Sin mensajes reales bidireccionales/Push/read en dos teléfonos | **PARCIAL** |
| **F6 KYC/operaciones** | Admin Web, cola y revisión protegida, zonas, incidentes, finanzas QA | Proveedores documentos/selfie, aprobación SQL, alertas vencimiento y operación real | **PARCIAL** |

**Todos los workflows de negocio en [matriz R60](./CERTIFICACION_INTEGRAL_R60_MATRIZ_VERIFICABLE_2026-10-24.json) continúan bloqueados hasta evidencia completa.**

### 5.1 Los 17 P0 gate IDs que no se deben omitir
IDP_BACKEND_AUTH; HTTPS_BACKEND; POSTGRES_PERSISTENCE; DRIVER_ONBOARDING; DRIVER_LIVE_TRIPS; CLIENT_LIVE_BOOKINGS; PAYMENT_SETTLEMENT; PRIVACY_KYC; EMERGENCY_SAFETY; MAPS_GPS_DEVICE; DELIVERY_MERCHANTS; CHAT_PHYSICAL; ADMIN_OPERATIONS; NATIVE_RELEASES; LEGAL_COMPLIANCE; OPS_24_7_MONITORING; PROD_GO_NOGO.

**QA_ONLY históricos:** POSTGRES_PERSISTENCE y CHAT_PHYSICAL; los otros quince BLOCKED en matriz A del corte, cero certificados comerciales. Los campos evidence de R60 siguen vacíos para certificación E2E.

### 5.2 Los 20 recorridos que hay que cerrar con evidencia
AUTH_PASSENGER; AUTH_DRIVER_KYC; FARE_QUOTE_GS; AUTO_BOOKING; DRIVER_DISPATCH; GPS_TRACKING; TRIP_COMPLETION_CANCELLATION; MOTO_CARGO_DELIVERY; AUTO_CARGO_DELIVERY; SUPERMARKET_ORDER; PHARMACY_OTC_ORDER; RESTAURANT_ORDER; CUSTOMER_DRIVER_CHAT; PAYMENTS_REFUNDS; COMMISSIONS_PAYOUTS; ADMIN_KYC_ZONES; EMERGENCY_RESPONSE; DATA_PRIVACY; SIGNED_NATIVE_RELEASES; ZONE_ACTIVATION_SUPPORT.

Estos IDs son autoridad de la matriz verificable; no afirmar «uno aprobado» sin capturas/logs sanitizados, SHA, ambiente, usuario/rol de prueba, recorrido y todos los gates de su fila satisfechos.

---

## 6. KYC DRIVER: INSTRUCCIÓN OWNER POSTERIOR QUE NO SE DEBE PERDER

Owner ordenó **subir fotos de los documentos y rostro**, autoaprobar SOLO si se validan de verdad y están vigentes; bloquear automáticamente al vencimiento con mensaje claro en Driver; permitir reenviar documentos y volver a habilitar automáticamente SOLO tras revalidación confiable. Esta obligación afecta F6 y elegibilidad para F1/F3/F4.

**Documentos y prueba actual:** licencia/registro, cédula identidad frente y dorso, cédula verde, habilitación del vehículo, seguro, inspección, selfie actual con consentimiento, liveness y coincidencia. La lista se aplica conforme obligatoriedad legal del vehículo/modalidad; no aprobar sin comprobar el conjunto requerido. Fotografías no deben publicarse en apps/URLs públicas ni logs; backend A controla hash, antivirus, storage privado, OCR/proveedor real, revocación, titularidad, retención, cambio de docs y concurrencia SQL.

**Avances A visibles en el corte:**
- [Alcance aprobado de selfies/autoaprobación](../architecture/DRIVER_KYC_SELFIE_AUTOAPPROVAL_FUNCTIONAL_SCOPE_2026-10-24.md).
- Código A de validación QA para ocho evidencias, liveness y elegibilidad con accountApproved/driverEligible/productionEnabled **false** hasta transacción real.
- SQL de onboarding atómico y pruebas de doc sustituidos, expirados, pertenencia y verificación independiente en apps/mobility-expo/docs/backend/staging_only/DRIVER_KYC_EIGHT_DOCS_ATOMIC_ONBOARDING_... (consultar últimas versiones exactas).
- Al HEAD A a4ba115e... existe apps/mobility-expo/server/driver-kyc-expiry-status-qa.mjs: lector privado de estados BLOCKED_EXPIRED, BLOCKED_REVIEW, SUSPENDED, READY_QA; lista de documentos por renovar, accountBlocked y nearestExpiry, con autorización Driver y commercialDispatchAuthorized=false; es **QA**, no API montada ni notificación móvil operativa.
- **Arquitecto B** mantiene Admin Web: lectura de cola por rol/MFA, pendientes, aprobación humana de excepciones, revisión idempotente/conciliación R64, fecha/vencimiento verificados y auditoría; **A** implementa captura/subida Driver, proveedor de autenticidad/biometría y SQL, recordatorio/bloqueo, reactivación y notificación Driver.
- Falta todavía probar un conductor real de STAGING con vehículo y documentos sintéticos, consentimiento en móvil físico, validación por proveedor autorizado, bloqueo al vencer, renovación, aprobación y seguridad sin fuga. No prometer aprobación automática comercial desde módulo QA.

---

## 7. QUÉ HACER AHORA: PLAN DE EJECUCIÓN AUTÓNOMO POR RECORRIDO Y CRITERIOS DE SALIDA

### F1 — secuencia P0 y pruebas obligatorias

**Paso F1.0 — Verificar contrato A en HEAD actual:**
- Leer OpenAPI, g4-trip-command-gateway.mjs, g4-rider-status-gateway.mjs, g65-driver-trip-status-qa.mjs, G3 SQL y G7 fares; inspeccionar cambios A posteriores a este handoff.
- Contrastar exactamente DTO A de request/receipt vs B passenger-booking-staging-gateway.mjs.
- Si no hay aceptación de quote predespacho: bloquear certificado F1 e informar evidencia issue #9, SIN simular aceptación.
- Si existe contrato versionado nuevo, implementar adaptador B y pruebas con las mismas reglas, sin degradar seguridad.

**Paso F1.1 — Cotización ANTES del servicio:**
- Pantalla Cliente: seleccionar AUTO, origen/destino reales autorizados, obtener desglose en Gs con TTL, precio válido, confirmar usuario. Al caducar debe inhibirse «Confirmar y buscar». Sin hardcodes, sin inventar distancia o tiempo.
- A devuelve quoteId con owner, routeId, reglas, zona/vehículo/expiry y validación transaccional. La reserva no existe antes de consentimiento.

**Paso F1.2 — Reserva/conciliación:**
- Un solo POST con quoteId aceptado y requestKey estable; backend hace INSERT durable idempotente, un recibo estricto tipado, rechazo quote vencido, y GET propio por requestKey para ACK perdido.
- Ensayos: doble toque, mismos UUID con body distinto, reconexión tras timeout antes/después COMMIT, mismo pasajero vs ajeno, roles, race, revocación y 503. No crear segundo viaje.

**Paso F1.3 — Asignación y ciclo real:**
- A ofrece a dos Driver elegibles y prueba SQL un ganador; Driver acepta/arrive/pickup/complete; Cliente ve searching→assigned→arriving→in_progress→completed bajo GET seguro y al menos una prueba con GPS consentido/ETA real.
- B mantiene foreground GET cada 12s, sin leak al background, rollback/revisión monotónica, reanudación desde historial y confirmación de completed en historial. Revisar nuestros cuatro f1-* tests, pero NO confundirlos con la prueba real.
- En Admin, visualizar estado y auditoría del mismo trip; no simular conductor/admin a partir de respuesta de Cliente.

**Paso F1.4 — Certificar vertical real:**
- El mismo ambiente HTTPS STAGING con IdP/JWKS/roles/DB persistente autorizado. Dos pasajeros o uno propio+otro ajeno, dos Driver competidores, Admin con rol y MFA.
- Pruebas de falla: desactivar red, caducidad token, cuenta ajena, pin TLS, GPS negado/antiguo, quote caducada, conductor se desconecta, app restart, cancelación, dispatch repetido, terminal retrocedido, historial distinto.
- Evidencia sanitizada por corrida: SHA A, SHA B, OpenAPI versión, ambiente, claves de prueba ficticias, fecha, status code, SQL revision/commit, pantalla Cliente/Driver/Admin, logs y PASS/FAIL; no exponer foto/rostro/JWT ni latitud personal real.
- Repetir en Android/iOS físicos y pasar gates. Solo entonces considerar F1 E2E CERTIFIED, no comercial hasta Owner GO.

### Si A está realmente bloqueado por STAGING/infra

No detener trabajo B. Ruta alternativa desbloqueada, en este orden:
1. Alinear con el contrato A más reciente los DTO y pruebas B de F1; corregir diferencias reales y escribir tests de consumer contract sin degradar receipt.
2. Completar UI de aceptación del **prequote oficial** cuando A publique contrato; mientras no exista, crear exclusivamente modelo de estado y pruebas fail-closed, sin simular precio.
3. Integrar Admin read-only de un mismo viaje cuando A publique endpoint autorizado; no fabricar tabla de Driver activo.
4. Preparar pruebas automatizadas de aceptación E2E con fixtures de dos usuarios y auditoría sin privilegios, separando QA de STAGING.
5. Continuar F6 Admin KYC ligado a las fuentes A nuevas de vencimiento/revisión y reactivación; sin aprobar por fechas de browser.
6. Si F1 y F6 tienen bloqueo verdadero, avanzar F3 envío con proof real, F5 chat físico o F4 pedido end-to-end, priorizando cerrar un recorrido, no producir otro documento por cada commit.
7. A cada bloqueo, issue #9 con ruta/DTO exactos, evidencia y responsable; no abrir múltiples frentes decorativos.

### Condición de STOP legítimo

Solo detener la ejecución de una acción que requiera **permiso explícito Owner**, credenciales/proveedor/ambiente realmente ausentes, migración de producción, acceso a datos personales o interferencia con archivos A. Eso bloquea ESA acción, no todo el desarrollo. Seguir automáticamente lo no bloqueado. Ante fallos CI, leer logs y corregir; fallo de un test no es motivo para abandonar.

---

## 8. CRITERIOS DE ACEPTACIÓN Y NEGACIONES OBLIGATORIAS POR FUNCIONALIDAD

- **Viaje:** no dar por completado por UI «Finalizado» si no existe revisión/propiedad en historia y DB. Tampoco equivale a cobro.
- **Tarifa:** ningún Gs calculado por app como tarifa real; prequote versionada, confirmada y vigente.
- **Asociación Driver:** push no es aceptación; doble aceptación se resuelve atómicamente en SQL, no por quién llega primero al móvil.
- **GPS:** no mostrar si falta consentimiento, ruta verificable, frescura, autorización, asignación persistida o lectura vigente.
- **Envío:** delivery status o proofRef sin verificación hash/SHA, ownership y transacción no es prueba de entrega ni causa reembolso.
- **Chat:** lectura y envío solo asignados; no exponer teléfonos ni mensajes a usuarios no autorizados; ACK incierto no es permiso para duplicar.
- **KYC:** foto o documento fecha válida en browser no aprueba; biometría real requiere política/consentimiento/proveedor seguro. Aprobación KYC ≠ derecho comercial a despacho.
- **Historial:** read-only por propietario y cursor firmado; 50 páginas no límite total, no leak al cambio JWT o app restart.
- **Comercios:** checkout solo con stock, sustitución y total reconciliado; farmacia sin receta/restricción verificada según ley, no vender medicamentos regulados.
- **Admin:** rol del JWT no sustituye RBAC/MFA verificados servidor; POST decisión y cola siguen sujetos a revisión posterior de DB, nunca optimistic approve.
- **Pagos:** PSP no habilitado; no montar pagos ni inferir liquidación desde quote, history o pruebas sintéticas.
- **Testing:** SUCCESS en GitHub certifica código del SHA, NO staging persistente, firmas mobile ni legal/comercial GO.

---

## 9. FUENTES, AUDITORÍA, REGRESIONES Y ERRORES YA CORREGIDOS

### GitHub y documentos primarios
- [Repositorio soberano](https://github.com/mezas3238-hue/Qore-mobile-).
- [PR #7 A](https://github.com/mezas3238-hue/Qore-mobile-/pull/7), [PR #8 B](https://github.com/mezas3238-hue/Qore-mobile-/pull/8).
- [Issue #9 contratos A/B](https://github.com/mezas3238-hue/Qore-mobile-/issues/9), [issue #11 progreso B](https://github.com/mezas3238-hue/Qore-mobile-/issues/11).
- [Maestro B R1–R62](./HANDOFF_MAESTRO_INTEGRAL_ARQUITECTO_B_R1_R62_CONTINUIDAD_SIN_PAUSAS_2026-10-24.md).
- [Anexo R62](./ANEXO_INVENTARIO_MAESTRO_B_R1_R62_CORTE_2026-10-24.md).
- [R65](./CONTINUIDAD_B_R65_G68_CUSTODIA_REMITENTE_HTTPS_OPTIN_QA_2026-10-24.md), [R66](./CONTINUIDAD_B_R66_G5_G68_G69_SECUENCIA_CUSTODIA_MONOTONICA_2026-10-24.md).
- [R60 gates y flujos](./CERTIFICACION_INTEGRAL_R60_MATRIZ_VERIFICABLE_2026-10-24.json).
- [G65 Driver lifecycle](../architecture/G65_DRIVER_AUTO_TRIP_LIFECYCLE_CROSS_APP_STAGING_QA_2026-10-24.md).
- [G70 HTTP local QA](../architecture/G70_PINNED_PASSENGER_HTTP_LOCAL_CHAIN_QA_2026-10-24.md).
- [KYC rostro y onboarding A](../architecture/DRIVER_KYC_SELFIE_AUTOAPPROVAL_FUNCTIONAL_SCOPE_2026-10-24.md).

### Regresiones detectadas y cerradas — NO reintroducir
- **R66** regresión SENDER_CUSTODY_STALE_REVISION vs STATE_CONFLICT, CI falló, se corrigió y luego 3/3 SUCCESS.
- **F1 booking:** parser UUID incompleto rechazaba recibos válidos; se corrigió y verificó.
- **F1 status 503:** quedaba suscripción fantasma sin snapshot; stopIfMatching corrigió y probó.
- **F1 foreground:** faltaba declaración .d.mts; TypeScript falló y se corrigió.
- **F1 foreground:** controlador hacía GET extra al enfocarse tras continueVerifiedRide; causaba carrera. Ahora el primer GET ya viene de continueVerifiedRide y los siguientes son periódicos.
- **F1 tests async:** se esperaban microtasks sin esperar fin del GET; callbacks awaitable y test completo corregidos. CI del SHA final anterior al handoff SUCCESS 3/3.
- **F1 transiciones:** evita retroceso desde completed/cancelled, cambio estado en misma revisión, evento saltado con revisión insuficiente, pérdida GPS y ETA al conflicto.
- **F1 recuperación e historial:** no aceptar acceptHistory inyectado como prueba HTTP ni levantar viaje ajeno; comparación owner/JWT/revisión/TTL; viejo status final no crea historial ficticio.
- **KYC R64:** revisión duplicada y ACK ambiguo pasan a latch hasta GET SQL de revisión nueva; no declarar cuenta aprobada en Admin por 200 aislado.

No eliminar pruebas de regresión por conveniencia ni «arreglar» el síntoma relajando validaciones. Si A cambia legítimamente esquema, solicitar/leer versión OpenAPI y demostrar nueva prueba end-to-end antes de adaptar.

---

## 10. PLANTILLA DE REPORTE DE CONTINUIDAD Y PRUEBAS

Para cada ciclo en el nuevo chat, reportar en GitHub y al Owner:

**Función:** F1 AUTO / F3 ENVÍOS / F5 CHAT / F6 KYC.

**Lo que quedó operable:** recorrido específico, pantalla, backend/SQL enlazado, sin palabras ambiguas.

**Evidencia:** PR, branch, SHA exacto, tres CI B con conclusión del mismo SHA, contratos versionados, tests adversariales, dispositivos/ambiente si aplican.

**Estado honesto:** IMPLEMENTADO_LOCAL / QA_PASS / STAGING_E2E_PASS / NATIVE_PASS / COMMERCIAL_GO; nunca reemplazar último por el primero.

**Fallos:** reproducción y corrección con test o dependencia A y aceptación concreta. Decir si falló un run intermedio y quedó corregido.

**Siguiente acción:** exactamente cuál barrera real se va a cerrar, dueño A o B y condición verificable.

**No reportar como métrica de logro:** cantidad de commits, etapas, archivos o líneas del documento. Son para auditoría únicamente.

---

## 11. ORDEN FINAL DE HANDOFF — COPIAR AL NUEVO CHAT

> Asumo el rol de **Arquitecto B de QORE Mobile — Movete Fácil** y continúo el proyecto desde el HEAD vigente del PR #8, **sin reiniciar arquitectura**. Leo de inmediato el Handoff Maestro B de 24-10-2026, PR #7 A y PR #8 B, issues #9/#11, gates R60 y OpenAPI A. Respeto propiedad estricta de Cliente/Admin/docs B. La orden del Owner es **entregar funciones completas y certificadas, no incrementar commits**. Prioridad F1 AUTO: prequote Gs y consentimiento antes del dispatch, reserva idempotente canónica, Client→Driver→historial/Admin sobre un mismo HTTPS/IdP/PostgreSQL persistente con dispositivos físicos. Corrijo los fallos que estén dentro de B, añado pruebas adversariales y verifico tres CI en el SHA final. Ante bloqueo real de A lo documento con contrato/ruta exactos y avanzo la siguiente tarea B realizable, sin pausas ni preguntar lo ya resuelto. No declaro E2E ni producción por mocks/localhost/web export. Mantengo ambos PR DRAFT, NO MERGE, NO LIVE, NO DEPLOY, NO PSP ni PII real sin autorización expresa del Owner. La app no está terminada: GO comercial NO_GO hasta 17 P0, 20 recorridos, certificación nativa y firma Owner.

**Fin del handoff. El siguiente arquitecto debe avanzar EJECUTANDO y CERTIFICANDO funciones, no redactando otro plan como sustituto del trabajo.**

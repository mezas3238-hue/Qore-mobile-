# HANDOFF MAESTRO G288 — QORE MOBILE / MOVETE FÁCIL
## Continuidad ejecutiva verificable + REGISTRO DRIVER COMPLETO APROBADO
**Corte verificado: 1 de noviembre de 2026.**
**Proyecto:** QORE Mobile / Movete Fácil (transporte AUTO/MOTO, envíos AUTO/MOTO y comercios).
**Repositorio:** https://github.com/mezas3238-hue/Qore-mobile-
**Separar totalmente de CRT RADAR PRO / QORE CRT ALERTS y de qore-core.**

> ORDEN DEL PROPIETARIO: terminar las cuatro aplicaciones con la infraestructura existente; no reconstruir componentes, no generar handoffs sucesivos en lugar de código, no repetir cuentas QA ni pruebas certificadas. Trabaja con herramientas GitHub, Supabase y Railway, publica PRs/revisiones/tests y avanza hasta E2E reales. El propietario trabaja desde un teléfono Android y puede usar GitHub Codespaces. Las funciones de registro Driver, capturas inteligentes y controles descritos aquí quedan APROBADAS para implementar en STAGING, pero NO implican aprobación documental legal ni autorizan LIVE/PROD, pagos reales ni altas de privilegios Owner sin sus controles de seguridad.

---

## 1. Fotografía real del proyecto — no confundir CI con E2E

| Elemento | Último hecho comprobado | Interpretación exacta |
|---|---|---|
| Supabase Auth QA | **8 usuarios QA** y **7 roles nativos** (4 Driver, 3 Passenger; 1 owner_admin sin rol nativo) | Bootstrap terminado; NO crear ocho cuentas nuevas |
| G275 Auth | Operador Codespaces obtuvo 8 sesiones independientes y 8 revocaciones | PASS externo de autenticación, no KYC |
| G278 Cliente | Operador verificó GET privado a Railway + rechazo de otros roles/token revocado | PASS externo read-only, NO viaje |
| G281 Driver | Operador verificó 2 sesiones, GET documentos/licencia, 403 Passenger y logout | PASS externo read-only, NO vehículo aprobado |
| Supabase PG17 | G262 reservas, G265 tarifas, G269/G113 despacho, G280 KYC lectura, G282 alta vehicular, G283 readiness instalados | SQL instalado NO implica proveedor vial real ni worker encendido |
| Railway backend STAGING | ONLINE, deployment **46de86a4-9e5b-4a1f-9d77-849a3077dca0**, SUCCESS | Código desplegado **7be419cf1d705918a7598dfd84722c6bab6762c7** |
| App Driver G287 | PR #88 DRAFT, HEAD **2be5f94b4dfe294fa9608410962b12dfa90623c3**, 4/4 checks SUCCESS | Formulario creado en código; NO afirmar APK instalada ni POST 202 real |
| Registro Driver documental | 0 expedientes/documentos; 0 solicitudes de vehículo; 0 vehículos | No hay documentos legales en STAGING |
| Owner/Backoffice G27 | 0 roles aprobados | MFA, autorizaciones y revisión pendientes; no autopromover |
| Consentimiento GPS | 0 registros | Driver no puede estar legalmente disponible |
| Tarifas AUTO activas | 0 reglas | No se pueden certificar reservas tarifadas reales |
| Comercios | 0 aprobados | Recorrido Comercio sigue bloqueado |
| E2E externos de negocio | **0/5** | AUTO, MOTO, envío AUTO, envío MOTO, Comercio NO certificados |
| Producción/pagos | Deshabilitados | Mantener así |

Comprobación SQL de solo lectura: **8 Auth QA, 0 sesiones persistentes, 7 roles, 0 G27, 0 driver_enrollments, 0 vehicle_applications, 0 vehículos, 0 driver_docs, 0 GPS consents, 0 tarifas activas, 0 merchants, 0 trips, 0 offers.** No marcar E2E como aprobados sin evidencia real.

### Identificadores (sin secretos)
- GitHub: mezas3238-hue/Qore-mobile-
- Supabase STAGING project ref: mrjzxftsdxzepzbcuids; PostgreSQL 17.
- Railway project: qore-mobile-staging, ID f0afe535-a398-41bf-b8cc-918dcf108667.
- Railway environment staging ID 19682286-3b2f-40ec-8768-65faeefe6cc8.
- Railway service qore-mobile-backend-staging ID c00a1f8a-4b03-4e39-9264-9aad74d0bb10.
- HTTPS STAGING: https://qore-mobile-backend-staging-staging.up.railway.app
- Source activo: integration/qore-g284-g279-g283-safe-railway-release-20261101, SHA 7be419cf1d705918a7598dfd84722c6bab6762c7.
- Rollback previo a G284: SHA a9144301af7da5922c519eb8c2c16668a2592e82, deployment e9738581-4403-4cea-bfcc-7b8e94ba9caf.
- **No tocar proyecto de gateway antiguo ni eliminar Railway.**
- Nunca escribir/mostrar claves Supabase, service_role, JWT ni passwords en GitHub/chat/logs; no repetir bootstrap --apply.

---

## 2. Trabajo HECHO y comprobado: no volver a construir

1. Laboratorio GitHub: cinco clases de recorrido implementadas y probadas en PostgreSQL desechable. No sustituyen cinco E2E externos.
2. Railway HTTPS/STAGING disponible, backend G4 y pruebas liveness/401. G270, G278, G281, G285 HTTP son evidencias complementarias.
3. Ocho usuarios QA Auth independientes: cuatro Driver, tres Passenger, owner_admin sin elevación automática. G275 --verify ya pasó 8/8 y revocó sesiones.
4. Perímetro Cliente G278 y Driver G281 verificado con sesiones auténticas y 401/403 tras revocación.
5. G262 PostgreSQL 17: ruta AUTO, cotización y booking privado, sin precio real Owner publicado.
6. G265: esquema y RPC de tarifa/commission Owner; no reglas activas todavía.
7. G263: radio máximo de recogida por Driver/vertical, requiere sesión y pruebas reales.
8. G269/G90/G112/G113: cola y procesador SQL de despacho AUTO instalados; G283 exige tarifa Owner y Driver legal reales antes de procesar. Worker Railway OFF.
9. G280: dos RPC privadas de consulta de documentos/licencia instaladas; PG16/17 CI verde, KYC real siempre FALSE sin expedientes.
10. G282: POST de vehículo pending-only con confianza G247/G42 y SQL transaccional instalada; gateway operativo en Railway STAGING con opt-in. Solo 401 anónimo probado; POST 202 con datos reales pendiente.
11. G283: backport seguro sobre Railway que evitó perder G260 Admin AAL2 y G272 arranque PG17.
12. G284: Railway integra historial G279 (sesión revocada), G113 worker OFF y lectura G283 readiness antes de cada lote. Desplegado SHA 7be419c; 7/7 CI en PR #84 y deployment SUCCESS.
13. G285: verificación HTTPS real liveness 200 y acceso anónimo a rutas privadas 401 sin escritura, PR #86.
14. G287: pantalla Driver nativa para enviar **borradores vehiculares** a G282, campos clase AUTO/MOTO, matrícula, municipio, marca, modelo, año y capacidad; reintento manual con misma idempotencia; feature flags OFF por defecto. PR #88 DRAFT, 4/4 checks green incluyendo tests Node, TS y export Expo web. **No APK instalada/certificada**, no envío de vehículos reales.
15. Seguridad previa: RLS en tablas, secretos en backend, G27 Owner separado, G260 AAL2, documentos Storage privado, alertas de vencimiento como estructuras, falsos datos prohibidos en STAGING real.

### Enlaces de prioridad
- Base Railway real desplegada: https://github.com/mezas3238-hue/Qore-mobile-/pull/84
- Verificación HTTPS postdeploy: https://github.com/mezas3238-hue/Qore-mobile-/pull/86
- Formulario Driver nativo: https://github.com/mezas3238-hue/Qore-mobile-/pull/88
- Alta Driver G282 en backend: https://github.com/mezas3238-hue/Qore-mobile-/pull/80
- Backport seguro: https://github.com/mezas3238-hue/Qore-mobile-/pull/83
- Dispatcher y readiness: https://github.com/mezas3238-hue/Qore-mobile-/pull/72 ; https://github.com/mezas3238-hue/Qore-mobile-/pull/81 ; https://github.com/mezas3238-hue/Qore-mobile-/pull/82
- Tarifa Owner G268 y formulario Admin G285: https://github.com/mezas3238-hue/Qore-mobile-/pull/85 ; https://github.com/mezas3238-hue/Qore-mobile-/pull/87
- Auth QA y G27: https://github.com/mezas3238-hue/Qore-mobile-/pull/73
- G278 Cliente: https://github.com/mezas3238-hue/Qore-mobile-/pull/76
- G281 Driver: https://github.com/mezas3238-hue/Qore-mobile-/pull/79
- Evidencias y handoffs anteriores G273: https://github.com/mezas3238-hue/Qore-mobile-/pull/70

**No asumir PR DRAFT = fusionado a main.** Varios PRs están apilados/divergentes, pero ciertos SQL y commits fueron aplicados directamente a STAGING. Comparar siempre commit del servicio, PR HEAD, y catálogo/migraciones de Supabase ANTES de modificar.

---

## 3. NUEVA APROBACIÓN OBLIGATORIA: registro completo del Driver

El propietario aprobó TODOS los requisitos de captura y registro descritos aquí. Hay que implementarlos, no redactar solamente propuestas.

### 3.1 Evidencias obligatorias solicitadas
- **Cédula de identidad del Driver**, frente y reverso.
- **Registro/licencia de conducir** válido, con clase compatible y vencimiento.
- **Cédula verde del auto o moto**, legible (titular/vehículo/matrícula, según campos del documento).
- **Habilitación del auto o moto**, con vigencia y matrícula correspondiente.
- **Fotografía real del auto o moto con su chapa/matrícula visible y legible**; registrar correspondencia con cédula verde.
- **Selfie actual del Driver** con consentimiento explícito, revisión de identidad, controles antisuplantación y tratamiento especial de datos biométricos.
- Mantener **seguro** e **inspección técnica** como evidencias adicionales según obligatoriedad aplicable; NO eliminarlas ni presumir el alcance jurídico sin verificar normativa.

**No confundir identidad del Driver con titular registral del vehículo**: si son distintos, exigir autorización legal para conducir/utilizar el vehículo y revisión humana; jamás marcar coincidencia de nombres como requisito universal sin base normativa.

### 3.2 Estado actual del esquema: adaptación necesaria
- Tipo de documento existente en PG17 **mobility_stage_driver_document_kind** enum: licencia, identidad_frente, identidad_dorso, cedula_verde, seguro, inspeccion, habilitacion, rostro_selfie. Este enum **NO incluye foto_vehiculo_con_chapa**.
- Archivo móvil existente: apps/movete-driver/src/domain/driver-document-upload.mjs, 8 tipos y flujo de captura/Storage privado mediante adaptadores inyectados. La cámara/autocaptura nativa **NO conectada** (NativeDriverStagingRuntime no inyecta captureEvidence/uploadPrivateObject). No confundir botón Capturar o expo-image-picker con autocaptura inteligente.
- App documentos: apps/movete-driver/app/documentos.tsx; pantalla vehículo G287: apps/movete-driver/app/vehiculo.tsx en PR #88.
- Datos en DB: mobility_stage_driver_documents, mobility_stage_driver_document_reviews, mobility_stage_driver_document_attestations, mobility_vehicle_applications, mobility_driver_compliance; esquema vivo RLS, NO sustituir. **Ampliar con migración ADITIVA** el enum (ej. foto_vehiculo_con_chapa), metadatos de calidad, OCR y vínculo a solicitud/vehículo; no romper G17/G20/G280 y tests.
- Mantener los identificadores internos existentes (licencia, habilitacion, etc.) y mostrar etiquetas en español. Evitar renombrados destructivos.
- El campo foto_chapa NO puede aceptarse solo como foto adjunta sin verificación de lectura. Si no hay certeza, marcar manual_review / retake_required.

### 3.3 Cámara inteligente con AUTO-CAPTURA (requisito expreso)
Implementar una pantalla de cámara nativa (puede requerir Expo development build + módulo con procesador de frames/visión, no solo Expo Go o expo-image-picker) con:
1. Guía/overlay adecuado a documento, rostro o auto/moto; permisos de cámara y privacidad.
2. Detección de marco del documento; identificación del vehículo y una placa visible dentro de la toma amplia.
3. Evaluación de enfoque/nitidez, iluminación, distancia/escala, recorte, reflejos y estabilidad en una secuencia real de frames; umbrales calibrados con dispositivos Android objetivos.
4. Cuando el frame es nítido y el encuadre se mantiene estable, **disparar fotografía automáticamente** una sola vez, evitando ráfagas/repetición. Informar qué se está detectando; permitir corrección/recaptura.
5. Fallback manual accesible si falla detección por hardware, baja luz, tipo de chapa u OCR (sin afirmar que esa foto está certificada automáticamente).
6. Optimizar batería, frames y tiempos de análisis; procesar calidad **en dispositivo** cuando sea posible. No conservar imágenes privadas en álbum, logs, analytics ni estado React; neutralizar EXIF de ubicación si no se requiere.
7. Para selfie, mostrar instrucciones de consentimiento y antisuplantación compatibles con el proveedor; no afirmar prueba de vida por simple foto.
8. No usar un bucle que tome fotos silenciosamente fuera de la pantalla de registro. Cámara solo con acción y consentimiento claro del usuario.

**Diferencia clave**: enfoque correcto + autocaptura es validación de CALIDAD, no autenticidad del documento, biometría ni propiedad de vehículo.

### 3.4 OCR, comparación de matrículas y antifraude
- OCR de cédula verde y lectura de chapa de la **foto real del vehículo**. Preferir procesamiento privado server-side/on-device autorizado, con proveedores y coste identificados; no afirmar OCR instalado sin pruebas.
- Normalizar matrículas con reglas reales de Paraguay y validación específica de categoría (AUTO/MOTO): mayúsculas, guiones/espacios tolerados solo cuando sea correcto; conservar valor original y normalized; bloquear coincidencias aproximadas peligrosas.
- Comparar también matrícula de habilitación y datos del vehículo (marca/modelo si son legibles).
- Resultado computado: MATCH / MISMATCH / UNCERTAIN / OCR_FAILED, score/calidad, evidencia y versión del motor. Sin exponer documentos a otros conductores.
- MATCH => **documentos pendientes de revisión**; nunca autoaprobación. MISMATCH/UNCERTAIN => corrección de imagen o cola de revisión; permitir tratar excepciones legales documentadas por Admin.
- Las fotos son objetos privados asociados a Driver y solicitud de vehículo concretos; enlazar SHA/hash, expiración/vigencia, idempotencia, reviewer/auditoría y control de acceso.
- Validar formatos y firmas, tamaño, control antivirus de carga, acceso Storage RLS, TTL/retención y revocación; prohibir URLs públicas y registrar consentimientos de datos personales y biometría.
- Sin verificación positiva de documentos obligatorios + licencia vigente + foto/chapa compatible + autorización humana G27 + vehículo/seguro/habilitación vigentes => Driver no disponible/no ofertable. No habilitar servicio por la mera respuesta 202 o un OCR MATCH.

### 3.5 Pantallas obligatorias Driver
- Registro de cuenta, login, datos del conductor, solicitud de vehículo AUTO/MOTO (G287) y lista de requisitos obligatorios claramente etiquetados.
- Captura guiada/autocaptura por evidencia, foto de vehículo/chapa, selfie y recaptura cuando falle calidad.
- Estado por documento: faltante, capturando, recibido/pendiente, revisando, rechazado, aprobado, vencido, recaptura requerida; traducción a los estados persistidos sin inventar aprobación.
- Comprobación de vencimientos y avisos; si el conductor no está al día, bloquear disponibilidad/ofertas.
- Mensajes de progreso, error de conexión, privacidad, estado de revisión y solicitud de renovación.
- La matrícula no debe rellenarse con valores de laboratorio; Driver introduce datos reales en dispositivo. Nunca pedir que envíe documentos al chat.

---

## 4. TODOS LOS PENDIENTES — ORDEN EJECUTABLE

### P0 — consolidar código seguro y KYC Driver completo (PRIMERA PRIORIDAD)
1. Revisar ramas en GitHub. Base operativa de Railway = **7be419c G284**. PR #88 G287 tiene 4/4 CI verde y no está integrado ni distribuido en APK; resolver DRAFT según política de revisión, sin pisar G260/G272/G279/G282/G283.
2. Crear módulo nativo de cámara/autocaptura con pruebas Android reales, función de recaptura y fallback. Elegir dependencia nativa compatible con Expo 57/RN 0.86; no imponer una API inexistente ni asumir que Expo Go soporta frame processing. No conectar a producción.
3. Migración ADITIVA G289 o nueva secuencia coordinada para foto_vehiculo_con_chapa, OCR, asociación a aplicación, metadatos de captura/vencimiento/quality y auditoría RLS. Antes de aplicar: inspeccionar esquema y migraciones activas; CI PG16/17; rollback lógico compatible. Nunca ejecutar fixtures CI en STAGING.
4. Adaptar flujo de captura y subir de manera privada: cablear implementaciones reales para captureEvidence/uploadPrivateObject en NativeDriverStagingRuntime, conservar control temporal y borrado seguro; G17 observa y deja pending.
5. Desarrollar motor de lectura cédula verde/chapa y cotejo con placa vehículo, habilitación y fechas. Evaluar proveedores/modelos de forma técnica; registrar resultado versionado y evidencia; no fabricar coincidencias.
6. Revisión de Admin: G27 + MFA AAL2 de proveedor independiente, aprobaciones con reviewer, oposición a autovalidaciones y trazabilidad; no crear/admin autoaprobar owner_admin.
7. Vencimientos, renovaciones y fraude: avisos programados Driver/Admin, suspensión/bloqueo inmediato de viajes al expirar documentos, documentos rechazados o cambios de vehículo.
8. Generar Android QA build que se pueda instalar desde el **teléfono Android del propietario**, con configuración pública STAGING (URL/clave publishable) y secretos solo en backend. No decir instalada hasta que se haya instalado.
9. **Prueba real G287/G289:** un Driver autenticado captura y presenta matrícula/vehículo/expediente legítimos; POST G282 devuelve 202 pending; verificar en SQL ownership, request_key idempotente, datos estrictamente sin aprobar; Passenger/anon 401/403; sesión revocada 401; no filtrar PII por logs.
10. El propietario ya autorizó implementar todas estas funciones. **No volver a pedir permiso para escribir código o tests STAGING**, pero autorización legal de documentos, uso de biometría, creación de roles privilegiados y activación LIVE siguen sujetos a controles específicos.

### P1 — Owner/Backoffice y tarifas (bloqueos E2E)
11. Habilitar Owner legítimo mediante G27 separado y MFA AAL2. Hay 0 roles Backoffice aprobados; usar un autorizador real distinto y prueba de independencia. Si no hay autoridad habilitante, escalar condición como bloqueo, no suplantar.
12. Integrar PR #85 G268 backend tarifa AUTO + PR #87 G285 editor en Admin sobre **SHA Railway real G284**, NO aplicar esas ramas directamente por divergencia. Flags de escritura Owner OFF hasta certificar Auth/G42/AAL2/G27.
13. Propietario introduce montos reales en **PYG/guaraníes** (base, km, minuto, mínimo, comisión y zona); no inventar Bolt/Uber ni los datos de negocio. Confirmar idempotencia y lectura posterior separada.
14. Tarifas AUTO, MOTO, envíos y comisiones Owner: mantener separación de verticales, reglas de cobertura, cotización ANTES de aceptar y ledger simulado auditado. Pagos reales/PSP OFF.

### P2 — despacho automático, proveedores viales y ubicaciones
15. G269/G113 SQL y G283 readiness YA instalados; **no repetir migraciones**. Worker G113 Railway OFF hasta que G283 real retorne databaseReady=true y evidencias legales y viales existan.
16. Implementar/verificar proveedor de datos de rutas/calles y distancias reales (Geoapify/otro aprobado), frescura, GPS/consentimiento, radio elegido por Driver, trayecto vial no distancia en línea recta, anti-replay (G274 bookingKey/proofKey), fallbacks fail-closed. El teléfono no informa metros como prueba.
17. Conectar automáticamente reserva AUTO/MOTO/entregas al matching de Drivers correctos por radio y compliance, colas con SKIP LOCKED, límites, TTL, reintentos, outbox, push, aceptación y cancelaciones idempotentes, no asignaciones Admin.
18. Probar carga, varios workers concurrentes, backpressure, locks, eventos duplicados, estado tras reconexión Android, agotamiento de pool, rotación de tokens y disponibilidad horaria. Objetivo escalabilidad 1M+ no equivale a capacidad probada; establecer presupuestos y pruebas cuantificadas.

### P3 — cuatro aplicaciones y cinco E2E REALES
19. Cliente: comparar AUTO/MOTO, cotización previa, seleccionar servicio; chat Cliente↔Driver y objetos olvidados; calificaciones de conductor, comercio y repartidor; visibilidad de privacidad.
20. Driver: onboarding + cámara+KYC+vehículo, radio por vertical, disponibilidad real, ofertas, navegación, recogida, viaje y entrega, comprobación antes de cada transición; no mezclar motocicleta y auto.
21. Comercio: alta/aprobación de comercio y staff, catálogo, preparación/entrega, pedidos, comisiones/ventas, inbox privado, despacho automático de courier.
22. Admin: panel real para reclamos/denuncias/aprobaciones, métricas, comisiones, auditoría, supervisión de documentos vencidos, suspensión e investigación; **no participar en el despacho rutinario**.
23. Integrar configuraciones externas STAGING de **las 4 apps** y construir Android/portales de QA para el propietario (desde Codespaces Android). Comprobar tanto app nativa como backend, no solo Expo web export.
24. **E2E #1** AUTO pasajero: login, tarifa real, reserva, despacho automático, Driver elegible, aceptación, recogida, viaje, fin, rating/ledger auditado.
25. **E2E #2** MOTO pasajero equivalente con reglas y habilitación propias.
26. **E2E #3** envío particular con AUTO: cotización, asignación, custodia, entrega y liquidación simulada.
27. **E2E #4** envío particular con MOTO: mismo recorrido con clase correcta, límites y evidencia.
28. **E2E #5** Comercio: merchant order, stock/preparación, courier, entrega, cierre ventas/finanzas simuladas.
29. Para cada E2E: actor QA auténtico, HTTPS Railway y DB STAGING, timestamps, logs sin secretos, pruebas negativas de acceso/cancelaciones, evidencia de persistencia y recuperación, CI/detalle de ejecución, PASS/FAIL con enlace. NO llamar E2E a una prueba solo GET/401.
30. Compatibilidad Android/red lenta y reconexiones, notificaciones/push, seguridad de certificados, mapas y UX; antes de producción revisar leyes/retención biométrica, costes de proveedores, cobros, carga y presupuesto.

---

## 5. Requisitos funcionales permanentes (no recortar)
- Cliente selecciona AUTO o MOTO con comparación estilo aplicaciones de movilidad.
- AUTO/MOTO pasajeros; envíos AUTO/MOTO; flujo comercio, sin mezclar roles ni permisos.
- Cotización previa y tarifas configurables Owner; comparación de costos sin inventar cifras.
- Driver determina radio máximo por servicio/vertical; backend lo respeta por rutas reales.
- Despacho de solicitudes completamente automático. Admin solo reclama/aprueba/investiga.
- Chat Cliente↔Driver para objetos olvidados con protección de asignación; chat con comercio cuando proceda.
- Evaluaciones Cliente→Driver, Cliente→Comercio, Cliente→Repartidor; antifraude y reputación.
- App Comercio: pedidos, preparación, etapas y ventas.
- Admin: tarifas, comisiones, reportes, auditoría, alertas automáticas de documentos vencidos, denuncias y suspensiones.
- Geoapify/laboratorio de mapas ya explorado; no incorporar Google Maps facturable sin decisión explícita de costo.
- Escalar con colas, límites, idempotencia, locks, observabilidad y test de carga; ambición 1M+ requiere medición real.
- Prohibido LIVE o cobros reales sin criterios de salida, seguridad y autorización separada.

---

## 6. Seguridad y restricciones innegociables
- **Se autoriza todo el desarrollo del REGISTRO DRIVER solicitado**, migraciones aditivas revisadas, CI y pruebas STAGING, sin necesidad de nuevos permisos de diseño.
- No equivale a aprobar documento, vehículo, licencias, identidad, biometría, Owner/admin, comisiones, PSP ni explotación LIVE.
- No generar 8 cuentas nuevas; G275/G278/G281 ya cerrados y documentados. No pedir credenciales al chat.
- Nunca publicar PII/biometría/placas reales en PR/CI/capturas, logs o chat. Repositorio y documentos de revisión solo metadatos anonimizados; Storage privado/RLS.
- No hacer bypass de G27/AAL2, KYC, requerimientos de matrículas, ni modificar políticas RLS para despejar lints.
- Borradores de vehículos G282 en pending; autocaptura/OCR MATCH NO significan approved.
- Conservar Railway y proyecto Supabase existentes; no eliminar bases, no tocar Prod.
- Como hay PR apilados, revisar HEAD real; merges/sources solo si no se pisan G260/G272/G279/G282/G283.
- Regresión obligatoria ante cada cambio: Node, TS Expo, web export, PostgreSQL 16/17, secretos ausentes, JWT revocado, cross-role, RLS, lifecycle y tasas/TTL.
- Responsables legales reales deben aprobar documentos de conductores y permisos de operación. Solicitar consentimiento explícito y cumplir legislación local de datos personales/biometría.

---

## 7. Primeros pasos del nuevo arquitecto (EJECUTAR, no explicar)
**Tarea A:** Abrir GitHub #88 SHA 2be5f94 y base Railway SHA 7be419c; verificar que son los últimos HEAD y que no existe un PR paralelo que ya haya implementado cámara/autocaptura.
**Tarea B:** Crear rama nueva apilada sobre G287 o backport compatible con SHA Railway vigente. Añadir evidencia foto_vehiculo_con_chapa a tipos UI/SQL/document-reviews y migraciones aditivas, sin rehacer G17/G20.
**Tarea C:** Entregar módulo de cámara nativa real con autoenfoque/autocaptura + fallback; pruebas calidad/permiso y capturas sin exponer PII. Escoger módulos tras verificar compatibilidad con Expo/RN.
**Tarea D:** Desarrollar captura de vehículo/chapa, OCR y comparación privada con cédula verde y habilitación; estados mismatch/uncertain/review, anti-replay y revisión Admin.
**Tarea E:** Conectar almacenamiento privado/observación G17 y firmar recibos scoped; verificar en CI + Supabase STAGING de forma no destructiva antes de cada DDL.
**Tarea F:** Generar build Android QA, instalar/probar en teléfono y ejecutar POST real de vehículo pending usando la cuenta Driver real, sin inventar matrículas; certificar acceso Passenger bloqueado.
**Tarea G:** En paralelo integrar Owner G268/G285 y resolver autoridad G27/AAL2 sin autoelevar la cuenta; obtener tarifas reales y concluir G283 readiness.
**Tarea H:** Proveedor vial/consentimiento GPS/Driver legal; activar G113 solo tras preflight de DB real y pruebas; ejecutar cinco E2E externos.
**Tarea I:** En cada avance publicar commit SHA, PR, workflows, infraestructura afectada, resultado SQL y cuánto falta. Si no hay datos reales/autoridad externa, implementar todo el código y exponer gate específico (sin pararse a escribir otro handoff).
**Tarea J:** No dar por terminada la app hasta probar en infraestructura REAL los cinco recorridos con cuentas legítimas, apps instalables y resultado de negocio auditado.

### Definición de éxito
- Driver se registra y presenta todos los documentos autorizados; cámara hace foto automáticamente cuando hay encuadre nítido y estable; vehículo/matrícula, licencia y cédula verde se verifican en forma privada; informe al Admin; ningún Driver trabaja con documentos vencidos o no revisados.
- Cliente, Driver, Comercio y Admin conectados realmente a STAGING, con credenciales y roles, sin compartir sesiones entre apps.
- Propietario/Owner decide tarifas y comisiones después de MFA/G27; despacho rutinario automático.
- Cinco recorridos externos completos repetibles y certificados 5/5. Sin excepciones de seguridad.
- Producción solo en una fase posterior tras autorizaciones de seguridad/legales/pagos.

---

## 8. MENSAJE MAESTRO PARA PEGAR COMO PRIMER MENSAJE DEL NUEVO CHAT

Actúa como ARQUITECTO EJECUTIVO PRINCIPAL, integrador A+B+C+D, programador y QA de QORE Mobile / Movete Fácil, repositorio mezas3238-hue/Qore-mobile-. Tu obligación es TERMINAR la app existente sin reconstruir ni dar vueltas.

Lee el archivo HANDOFF_MAESTRO_G288_QORE_MOBILE_DRIVER_AUTOCAPTURA_FIN_STAGING_2026-11-01.md en GitHub y verifica el estado vivo. Railway STAGING qore-mobile-backend-staging está ONLINE, source integración G284 SHA 7be419cf1d705918a7598dfd84722c6bab6762c7, deployment 46de86a4-9e5b-4a1f-9d77-849a3077dca0. Supabase STAGING mrjzxftsdxzepzbcuids tiene 8 cuentas QA y 7 roles, G269/G113/G280/G282/G283 instalados; no hay Owner G27, documentos legales, vehículos aprobados, tarifas activas ni recorridos E2E externos (0/5). Ya se certificaron Auth G275 y lecturas externas G278 Cliente/G281 Driver. G287 formulario Driver PR #88, SHA 2be5f94b4dfe294fa9608410962b12dfa90623c3, 4/4 CI verde, pero NO se instaló en Android ni se creó solicitud real. No repetir pruebas ya realizadas.

AUTORIZACIÓN EXPRESA DEL PROPIETARIO: implementar COMPLETAMENTE el registro Driver: cédula de identidad frente/dorso, licencia, cédula verde, habilitación, foto del AUTO/MOTO con chapa visible, selfie consentida y complementos legales; cámara que detecte documento/vehículo, nitidez, iluminación y estabilidad y dispare foto AUTOMÁTICAMENTE; recaptura/manual cuando corresponda; OCR de cédula verde, matrícula de vehículo y habilitación, comparación de matrícula, alertas de fraude/vencimientos, Storage privado y revisión Admin. La coincidencia NO equivale a aprobación legal. Mantener KYC fail-closed, consentimiento de privacidad/biometría y bloqueo de operación sin expediente vigente.

PRIORIZAR AHORA: (1) completar esos módulos reales en código nativo Android y migración aditiva compatible con enum PG17 (hoy 8 kinds, falta foto_vehiculo_con_chapa); (2) conectar cámara/Storage seguro y Admin de revisión; (3) generar build Android STAGING y probar POST 202 pendiente Driver real; (4) integrar Owner G27/MFA y PR #85/#87 tarifas legítimas; (5) completar proveedor vial + G283 readiness y activar worker automático G113 bajo gates; (6) conectar cuatro apps y cerrar AUTO, MOTO, envíos AUTO, envíos MOTO y COMERCIO, E2E externos 5/5.

Usa conectores GitHub, Supabase, Railway para ejecutar cambios verificables. Trabaja sobre SHA desplegado o PR compatible, respeta G260/G272/G279/G282/G283 y ramas paralelas. Mantén LIVE/PROD y PSP deshabilitados; no borres Railway ni Supabase, no crees usuarios QA duplicados, no fabriques permisos/documentos/tarifas, no publiques secretos ni PII. El usuario trabaja desde un teléfono Android con Codespaces: da comandos reproducibles listos para copiar solo cuando deba actuar. Para cada avance entrega commit, PR, CI, despliegue y pruebas reales. No prepares otro handoff ni preguntes lo que ya está aprobado: ejecuta todo lo técnicamente posible y expón únicamente bloqueos legítimos, verificando los cinco recorridos hasta terminar la aplicación.

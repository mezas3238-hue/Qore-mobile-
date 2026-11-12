# HANDOFF MAESTRO DE CONTINUIDAD — QORE MOBILE / MOVETE FÁCIL
**Fecha de corte:** 12 de noviembre de 2026 — Paraguay.
**Destinatario:** siguiente arquitecto principal/integrador, trabajando desde Android y GitHub.
**Objetivo de producto:** concluir y certificar Movete Fácil con Cliente, Driver, Comercio, Admin y portal de Soporte; pasar de laboratorios/CI a recorridos externos y publicación en tiendas tras autorización.
**Estado global:** DESARROLLO AVANZADO / NO GO COMERCIAL. No se ha demostrado 5/5 E2E externos ni el funcionamiento físico completo de las apps.

## 0. Directivas inviolables del Owner
1. GitHub es la fuente única del código. Releer HEAD, diferencias, CI, PR abiertos antes de tocar archivos. Jamás reconstruir la app desde cero.
2. **NO MERGE, NO LIVE, NO DEPLOY productivo o de STAGING sin autorización expresa**; tampoco gastos, dinero real, PSP real, KYC real, creación automática de usuarios privilegiados ni cambios remotos de esquema sin revisión/autorización.
3. Es obligatorio avanzar con trabajos independientes mientras se resuelven bloqueos: no hay permiso para que tres arquitectos trabajen sobre el mismo módulo. Entregar resultados, no simplemente planes.
4. Cliente y Driver **RECHAZADOS** por el Owner hasta prueba física satisfactoria: Cliente GPS/destino y estabilidad Android; Driver cámara que disparaba antes de enfocar. CI PASS no es prueba física ni aceptación.
5. Separar roles: Cliente, Driver y las superficies web Admin, Comercio, Soporte, todas con permisos mínimos y contratos backend propios. Servicio STAGING Railway existente no se rompe ni se cambia por accidente.
6. Las APK son solo para QA antes de Google Play / Apple App Store. Los enlaces ChatGPT y Drive fallaron repetidamente para el Owner: usar **GitHub Releases HTTPS directo**, dar URL verificada de asset y no volver a enviar enlaces sandbox no comprobados.
7. Comercios: mercadería solo **PREPAGO DIGITAL acreditado antes de preparar/entregar**, jamás efectivo; viajes AUTO/MOTO y envíos particulares pueden ofrecer efectivo o digital según política y capacidad real. Distribución de dinero automática mediante PSP autorizado, no aprobación ficticia.
8. Tarifas, comisiones y porcentajes los configura el Owner en Admin; respetar reglas de producto previamente acordadas (histórico AUTO 15% comisión / subsidio pasajero 10%; MOTO 12% / subsidio 10%, sujeto a configuración/validación de negocio); no grabar porcentajes arbitrarios en frontend.
9. SOS de Driver: icono pequeño en mapa únicamente cuando Driver lo active voluntariamente, OFF de fábrica; destino de llamada contacto de confianza o 911 según configuración, sin presuponer que una llamada fue realizada.
10. KYC Driver obligatorio y privado, sin campo de código de municipio para el usuario. Revisión humana y habilitación legal antes de recibir viajes.
11. Informes en español, SHA y CI exactos, bloqueos verificables, próximos pasos, sin afirmar que “funciona” por una mera prueba unitaria.

## 1. Estado verificado por conectores el 12-nov-2026
### GitHub
**Repo:** https://github.com/mezas3238-hue/Qore-mobile- (público). Default main: NO sustituye al backend desplegado ni al release candidate.
**Candidato integrado prioritario:** PR #138 https://github.com/mezas3238-hue/Qore-mobile-/pull/138
- Branch integration/qore-g318-single-staging-release-candidate-20261112.
- HEAD 38ff8efd1a62c3ec235b9d22d4f13d4f0abae000.
- PR DRAFT, OPEN, NO MERGE, NO DEPLOY. Integra G317 Cliente GPS+Driver scanner, Admin, Soporte G313 y finanzas G306/G305.
- 80 archivos modificados frente a G317; incluye contrato de bloqueo de Comercio sin PSP, revisión de estabilidad GPS G319 y CI unificada.
- Workflows GitHub asociados al HEAD G318 inspeccionados: 20/20 runs SUCCESS, incluyendo G318 integrated candidate, Client GPS APK, aislamiento móvil, Admin, Soporte, Node/STAGING, G4/PG desechable y dinero QA. **No equivalen a pruebas de hardware o PSP real.**
**Móvil integrado:** PR #136 https://github.com/mezas3238-hue/Qore-mobile-/pull/136 HEAD 75f26d69086e832159a480fc158a5ad15f131eb4 (DRAFT): Cliente G312+Driver G313; PR #115 GPS, #117 ML Kit, #127 direcciones PY, #130 ARM64.
**Soporte más avanzado FUERA DE G318:** PR #139 https://github.com/mezas3238-hue/Qore-mobile-/pull/139, HEAD 0a65f98cc012fb31b3c4440c3e27c5945e7c68cf (DRAFT). G320 incluye asignación atómica de tickets, 2 agentes concurrentes, Edge candidate y bitácora; 5 runs CI SUCCESS. Integrador debe revisar delta y traerlo al siguiente candidato único sin sobreescribir G318 ni tocar DB real.
**Distribución QA directa**: 
- Release G314: https://github.com/mezas3238-hue/Qore-mobile-/releases/tag/qore-mobile-G314-android-qa-20261112 — Cliente 42.171.139 B y Driver 66.211.732 B, ambos APK ARM64 publicados y verificados por GitHub; PR #131.
- **Cliente más reciente G319**: https://github.com/mezas3238-hue/Qore-mobile-/releases/tag/qa-g319-cliente-gps-estable-2026-11-12 — Movete-Facil-Cliente-G319-GPS-Estable-ARM64-QA.apk, 42.175.507 B. G319 reduce consultas de ubicación y polling, usa un único trabajo nativo/cooldowns para evitar que el móvil se vuelva inestable; target 38ff8efd (G318). Requiere certificación física.
- Driver G313 individual: https://github.com/mezas3238-hue/Qore-mobile-/releases/tag/qa-g313-driver-arm64-2026-11-12. Driver G314 del release combinado también válido para QA; no confundir packaging ARM64 con escáner certificado.
- Los enlaces existen como assets GitHub. **El Owner todavía NO ha confirmado descarga/instalación exitosa**. No declarar problema solucionado por la presencia de assets solamente.

### Railway STAGING
- Proyecto qore-mobile-staging ID f0afe535-a398-41bf-b8cc-918dcf108667.
- Entorno staging ID 19682286-3b2f-40ec-8768-65faeefe6cc8.
- Servicio qore-mobile-backend-staging ID c00a1f8a-4b03-4e39-9264-9aad74d0bb10.
- Dominio https://qore-mobile-backend-staging-staging.up.railway.app
- Último deploy de estado SUCCESS: id 539a4221-ad8a-4d93-a26d-d4a1ebea21af; 1-nov-2026; commit G292 **48c4dff774deba3256b0b35b31aba0b1b38d7b1b**, branch integration/qore-g292-consolidated-g284-owner-driver-20261101; no staged changes; 1 réplica. No está desplegado G318.
- Runtime node server/run-g4-railway-staging.mjs; variables críticas existentes por nombre pero nunca revelar valores. Gate LIVE OFF. Verificar HTTPS liveness/rutas/permisos antes de pretender conexión exterior.

### Supabase STAGING
- Proyecto qore-mobile-staging ref mrjzxftsdxzepzbcuids; sa-east-1, ACTIVE_HEALTHY, PostgreSQL 17.
- SQL **solo lectura** ejecutado 12-nov-2026:
  - auth.users 8; public.profiles 8; public.user_roles 7.
  - auth.mfa_factors 0; backoffice_roles 0.
  - driver_documents 0; driver_enrollments 0; mobility_vehicles 0.
  - fare_rules 0; fare_quotes 0; auto_demo_trips 0; g269_dispatch_jobs 0.
  - merchants 0; merchant_orders 0; payment_intents 0; ledger_entries 0.
- 46 tablas public con RLS enabled, pero 6 sin políticas; identificar si deliberadamente denegadas por diseño, **no abrir políticas genéricas**. Edge Functions desplegadas: 0.
- Security Advisor: leaked password protection disabled (revisar antes de usuarios comerciales): https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- El esquema propuesto de Soporte, PSP/ledger/Comercio G306 y KYC no está certificado como instalado o habilitado.
- OCHO usuarios creados no significan ocho recorridos de inicio de sesión correctos.

## 2. Módulos construidos en código (NO confundir con activos)
1. Cliente Expo: AUTO, MOTO pasajeros, envíos y comercios, formularios de origen/destino, contexto Auth, recuperación y pantallas. G309→G312 GPS foreground, dirección Paraguay seleccionable; G319 cooldown y anti-congelamiento. Falta probar estabilidad en teléfono, mapas reales, rutabilidad y traslado de coordenadas al servidor con contrato geoespacial verificado. En formularios, no basta mostrar etiqueta si los contratos backend esperan coordenadas.
2. Driver Expo: registro de vehículo, núcleo de calidad, OCR matrícula, cámara ML Kit scanner en G310 sin disparo repetitivo por aplicación; documentación pendiente; no se aceptan documentos reales en QA y no hay aprobación legal automática. Revisar lifecycle/borrado caché/compatibilidad Google Play Services y que cámara NO dispare antes de enfocar.
3. Admin Web: control de tarifas/comisiones y MFA propuestos; UI construida, pero falta cuenta Owner AAL2 real, reglas persistidas y verificación de rol sin usuario privilegiado inventado.
4. Soporte Web independiente: PR #104→#116→#121→#126→#132→#137→#139. UI, bandeja, sesión, RLS draft, cola, Edge adapter y adjudicación atómica en laboratorio. Faltan tablas/Edge reales, 2 agentes genuinos, asignación/tickets reales, funcionalidad autorizada y HTTPS separado. No dar a Soporte permisos de dinero/KYC/Owner.
5. Finanzas: PR #105 (G302 digital settlement QA), #106 (G303 efectivo y comisión a cobrar), #109 (G304 comercios prepago digital), #110 (G305 bloquear mutaciones de comercio sin acreditación), #112 (G306 verificador y SQL atómico draft). G318 trae parte significativa en un solo árbol. **No hay PSP conectado ni pagos/payout reales.** Banco/pasarela/split requieren contratos, verificación de firma/consulta en servidor y pruebas externas. Bloqueo G305 de rutas antiguas aún NO desplegado en G292: revisar antes de cualquier tráfico comercio.
6. Backend G292 STAGING: Auth/rutas/contratos AUTO y otros módulos avanzados pero gates comerciales OFF. G318 es reemplazo candidato, no deploy.
7. SOS: PR #100 G297–G299 diseño opcional, OFF, sin llamada 911 certificada; integrar icono solo opt-in y probar llamada directa configurada con confirmación humana.
8. Notificaciones, chat y seguimiento: contratos parciales; faltan cierre real de identidad/entrega push, permisos, GPS Driver cuando corresponda, viajes con mismo ID, manejo de suspensión, sesiones, latencia, recuperación offline y seguridad.
9. Google Play / Apple App Store: configuraciones EAS/Android QA y plan de publicación, pero no certificado ni publicado comercialmente. Para iOS: firma Apple, builds nativas, permisos de privacidad, App Review y comprobación real en dispositivo iOS.

## 3. Pendientes críticos priorizados
### P0 — Lo que desbloquea la prueba funcional, sin dinero real
P0.1 **Garantizar descarga:** usar Release G319 Cliente y G314 Driver; abrir enlace desde Chrome Android, probar descargas reales con evidencia y SHA256, instalar ARM64 sin que otro package reemplace versión no relacionada. Si falla, capturar respuesta HTTP, navegador, cuenta, compatibilidad Android/ABI; no volver a crear enlaces sandbox ficticios.
P0.2 **Cliente GPS funcional:** al entrar ¿Dónde te buscamos? permiso foreground, GPS preciso, dirección visual real, actualización manual; no bucles ni consultas que bloqueen celular. Destino con búsqueda precisa local PY, sugerencia identificable y selección explícita; mapas y marcador para ajustar puerta exacta. Probar permiso denegado, GPS OFF, interior, timeout, stale responses, segundo plano, cambio de cuenta, consumo y memoria.
P0.3 **Driver cámara funcional:** sin foto temprana/desenfocada, 3 ensayos nítidos y 3 deliberadamente borrosos con papeles ficticios, bordes e interior, reflejos/luz, cancelación y segunda apertura, reversión de app; ver ML Kit/GMS real. Eliminar código de municipio visible sin perder adjudicación backend. Regresar evidencia sin PII.
P0.4 **Comprobación de backend STAGING:** revalidar endpoint seguro Railway G292, auth JWT/roles, G42/legal, misma tripId persistida, cotización/reserva/transiciones; contrastar rutas G318 y decidir despliegue de candidato exclusivamente tras autorización expresa y plan de rollback.
P0.5 **Cuenta QA**: verificar 8 logins/7 roles, identidad Owner/Admin y MFA AAL2; completar ausencia de rol 8 según diseño; no crear privilegios automáticamente. Driver legal, auto/moto y aprobaciones con revisión humana.
P0.6 **Consolidación GitHub**: G318 es única base de integración; añadir G320 Soporte y cada arreglo móvil confirmado con cherry-pick/revisión de SHA, sin rebase ciego, sin sobrescribir cambios de los 3 frentes, mantener PR DRAFT. CI integrado completo, check RLS/secret scans y reproducibilidad build.

### P1 — Completar recorridos del negocio y seguridad
P1.1 **Alta Driver/KYC y vehículo:** identidad, licencia, cédula verde, habilitación de vehículo, foto vehículo y chapa coincidente; exigir demás categorías del dossier aprobado (hasta 8 documentos), validez/vencimiento, OCR controlado, upload cifrado privado, RLS/Storage, revisión humana y aprobación legal. Motos y autos separados.
P1.2 **Tarifa y rutas reales:** geocoding/reverse, GPS origen/destino coordenadas reales, API de rutas/distancias, cobertura, moneda Gs, tipo vehículo, reglas Owner y cotización congelada/versionada; evitar precios ficticios o valores puestos por el cliente.
P1.3 **Despacho AUTO/MOTO/ENVÍOS:** disponibilidad Driver, radio pickup y ruta por calles, ofertas, aceptación concurrente/idempotente, GPS seguimiento, cancelación, llegada, comienzo/fin, historial y trazabilidad unificada. No asignar Driver sin KYC.
P1.4 **Admin Owner:** cuentas y TOTP AAL2, tarifas por servicio/comisiones y subsidios, auditoría, revisiones documentos, suspensión, conciliación y reportes; políticas de acceso y separación de Soporte.
P1.5 **Soporte:** integrar G320 tras revisar, instalar sólo si autorizado esquemas/RPC/Edge y roles mínimos, 2 agentes, cola asignada, reclamos/escalaciones, trazabilidad, revocación, pruebas BOLA/IDOR, sin acceso a fondos ni KYC. Portal HTTPS separado.
P1.6 **SOS y seguridad:** opt-in OFF, llamada al contacto/911 seleccionado, ubicación autorizada y protección de identidad, incidentes servidor idempotentes, soporte de emergencia humano; nunca simular llamada realizada ni activar denuncia automática.
P1.7 **Mensajería/notificaciones:** cliente↔driver↔comercio por servicio, push fiable, permisos de Android/iOS, anti-spam, privacidad, sesión revocada, tracking solo con consentimiento; pruebas de segundo plano/cierre de app.

### P2 — Cobros reales, liquidaciones y comercialización
P2.1 **Proveedor PSP** compatible con Paraguay, medios tarjeta/transferencia/QR y payout/split marketplace; validar legal y contratos, KYB/KYC de beneficiarios, costos, chargebacks, límites y recibos. Un gateway de cobro no implica split/payout.
P2.2 **Comercios PREPAGO**: conectar verificador G306 a PSP de verdad, webhooks firmados + consulta independiente server-to-server, PostgreSQL17 transacción atómica comprobante + inventario + autorización, idempotencia/replay y anticobro falso. Mantener G305 409 hasta certificación. Nunca efectivo comercio.
P2.3 **Viajes/envíos dinero digital**: cobrar al cliente y acreditar neto Driver, retener comisión de Movete Fácil con ledger contable, settlement por proveedor, errores/reintentos/conciliación, auditoría, reembolsos y disputas.
P2.4 **Efectivo de viajes/envíos**: Driver recibe billetes; registrar solo comisión por cobrar a Movete Fácil, compensar futuras liquidaciones digitales bajo política y límites; no declarar efectivo como saldo bancario de QORE.
P2.5 **Pagos Comercio**: tras entrega y fondos acreditados liquidar Comercio, Repartidor y plataforma, comparar recibos bancarios y ledger, evitar dobles pagos. Soporte jamás puede aprobar desembolsos.
P2.6 **Play Store y App Store:** después de QA/E2E y autorización; firmas RELEASE comerciales, certificados, bundle IDs, políticas, mapas/GPS privacidad, ficha tienda, soporte, eliminaciones de cuenta y review de dispositivos.

## 4. Los cinco E2E externos que hay que cerrar
**Matriz de aceptación propuesta para el integrador; revalidar nombre exacto contra el ledger de QA existente antes de marcar 5/5.**
E1 — Driver KYC/documentación/vehículo, revisión Admin/Owner, permisos correctos, Driver no elegible hasta aprobación; relación placa/cédula verde.
E2 — AUTO pasajero: GPS origen+destino real→tarifa Owner→reserva servidor→despacho/aceptación Driver→mapa/seguimiento/chat→finalización→historial/finanzas/Admin con único tripId.
E3 — MOTO pasajeros: recorrido independiente del envío de carga, legalidad, tarifa y comisión propias; mismo cierre de estados y seguridad.
E4 — ENVÍOS particulares: pedido, confirmación emisor/receptor, Driver habilitado, seguimiento, comprobante de entrega y finanzas por pago efectivo/digital.
E5 — COMERCIOS: catálogo/stock→precio productos+envío→prepago acreditado por PSP→preparación→repartidor→entrega→conciliación Comercio/Driver/plataforma; denegar todos los bypass por falta de pago.

Transversal: validar los cinco con Auth real STAGING, usuario/rol correcto, persistencia PG17, HTTPS Railway, Idempotencia, revocación, AAL2 donde corresponde, fallos de red, cambios concurrentes, restore y soporte. **No marcar E5 como completo con PSP mock**. Recolectar identificador de prueba, commit exacto, dispositivo, fecha, capturas redactadas sin datos sensibles y comprobantes de banco cuando autorizado. Estado al corte: **0/5 externos certificados**, no hay reporte de aceptación física por Owner.

## 5. Reparto obligatorio — tres arquitectos + integrador único
**Arquitecto A / Issue #118** https://github.com/mezas3238-hue/Qore-mobile-/issues/118:
Cliente GPS, Driver cámara/registro, Android, distribución APK y pruebas en teléfonos. Exclusividad sobre apps/movete-cliente/**, apps/movete-driver/** y CI de QA móvil. Próximo: cerrar descarga e instalación G319/G314 y defectos hardware, sin invadir finanzas/Soporte.

**Arquitecto B / Issue #119** https://github.com/mezas3238-hue/Qore-mobile-/issues/119:
Comercio/PSP, SQL/ledger, pagos, comisiones, despacho y pruebas proveedor. Propiedad backend financiero, interfaces de proveedor, tests/SQL dedicados. Próximo: revisar bloqueos G305/G306 en G318, diseñar plan autorizado de PSP real/PG17 sin pagos aún. NO tocar UI móvil/Soporte.

**Arquitecto C / Issue #120** https://github.com/mezas3238-hue/Qore-mobile-/issues/120:
Soporte independiente, funciones ticket, identidad AAL2 y mínimo privilegio, 2 agentes/aislamiento, migraciones propuestas y Edge candidate. Próximo: presentar delta G320 contra G318 para integrar sin romper otros frentes, nunca instalar funciones elevadas sin auditoría.

**Integrador principal (único)**:
- Solo él lleva candidato integrado y conserva árbol único G318. Revisa PR #139 y las ramas posteriores, compatibilidad de tipos/rutas, lockfiles, workflows, estados SQL reales vs draft, seguridad/revisión de secretos.
- No enviar a los tres arquitectos el mismo archivo o PR.
- Mantiene registro de bloqueos y evidencia; aprueba técnicamente gates pero no sustituye autorización Owner para MERGE/deploy/LIVE.
- Podrá coordinar despliegue STAGING controlado solo con orden expresa, plan de rollback y 5 E2E, nunca producción por inferencia.

## 6. Primer ciclo operativo del siguiente chat
1. Leer este documento y consultar HEAD real PR #138 (G318), #139 (G320), releases G319 y G314; corroborar CI, estado ramas y nuevo trabajo concurrente.
2. Abrir Issues #118/#119/#120; pedir a cada frente estado de defectos y evidencia, sin repetir su código.
3. Verificar descarga real Owner: si no funciona GitHub Release, diagnosticar HTTP/dispositivo/Chrome/ABI; no enviar ZIP/Drive/ChatGPT más veces. Registrar prueba por dispositivo.
4. Trabajar P0 Cliente/Driver en teléfonos y P0 STAGING Auth/rutas; no confundir fallback de geocoding con ubicación de puerta precisa.
5. Construir matriz de diferencias G318 vs G292 y G320; CI de integración sin merge. Revisar G305 antes de permitir checkout.
6. Preparar scripts de despliegue reversible en STAGING y migración PG17 auditable, conservar gates OFF; solicitar permiso explícito para ejecutarlos.
7. Tras la autorización, instalar contratos/roles mínimos y completar E1→E5 con evidencia real y sin datos personales expuestos; aislar PSP sandbox y producción.
8. Presentar informe: commits, tests CI, descargas, estado por E2E, dependencias externas, riesgos, bloqueos Owner y cuándo es realmente GO.

## 7. Gobierno de evidencias / go-no-go
- PASS CI unitario, TypeScript, Expo, PG16 desechable o APK construida **no** significa sistema comercial listo.
- Necesario: teléfono Android físico que no se congela; localización real; cámara enfocada y documentos controlados; 8 cuentas/roles comprobados; Owner/Soporte con MFA; Driver aprobado; tarifas y rutas reales; mismo ID y estados servidor; PG17 transaccional; PSP/payout certificado cuando corresponda; RLS sin IDOR; seguridad SOS; 5 E2E externos aprobados por Owner.
- La única afirmación sustentada a 12-nov: Rails STAGING G292 SUCCESS, PG17 ACTIVE_HEALTHY, G318 CI verde, APK QA en GitHub, 0/5 E2E reportados, producción NO GO.
- No guardar credenciales, tokens, PII real, documentos de identidad ni imágenes privadas en este handoff, PR o issues.

## 8. Prompt de arranque para siguiente arquitecto
“Actúa como integrador principal de QORE Mobile / Movete Fácil. Lee el HANDOFF MAESTRO de 12-nov-2026 y verifica el HEAD actual de GitHub, PR #138 G318, PR #139 G320, Railway STAGING G292 y Supabase PG17 antes de actuar. No reconstruyas ni duppliques módulos. Hay 3 frentes separados: A móvil Issue #118, B comercio/pagos Issue #119, C soporte Issue #120. Misión: resolver los rechazos de Cliente/Driver y descargar desde GitHub Releases, crear un solo candidato conectado STAGING, cerrar Auth/KYC/tarifas/GPS/cámara/soporte/seguridad/PSP con evidencia y certificar 5/5 E2E externos. No MERGE, no desplegar, no LIVE, no costos ni dinero real sin autorización expresa Owner. Avanza con código, pruebas y PR DRAFT; no prometas trabajo en segundo plano; produce informes verificables en español. Mi objetivo es tener la app funcionando cuanto antes sin sacrificar seguridad.”

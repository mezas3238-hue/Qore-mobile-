# HANDOFF MAESTRO G321 — QORE MOBILE / MOVETE FÁCIL
**Corte verificado:** 12 de noviembre de 2026 (Paraguay)  
**Propósito:** continuidad integral para el arquitecto/integrador siguiente, sin pérdida de contexto.  
**Repositorio fuente:** https://github.com/mezas3238-hue/Qore-mobile-  
**Mandato Owner:** acelerar la terminación de Cliente, Driver, Comercio, Admin y Soporte. No más arquitectos duplicando tareas. **NO MERGE sin orden explícita del Owner; NO LIVE / NO capital ni pagos reales; NO despliegue comercial implícito.**

## 1. RESUMEN EJECUTIVO — QUÉ ESTÁ REALMENTE LISTO
- **GitHub `main`:** commit `ef059e1132b10ce3adf1f3f6bc1f84e8ce529ad6` (no contiene los PR apilados del producto). No comenzar desde `main` ignorando las ramas.
- **Candidato único de integración G318, PR #138:** `integration/qore-g318...` (leer `head` exacto del PR); HEAD al corte `38ff8efd1a62c3ec235b9d22d4f13d4f0abae000`. DRAFT, NO MERGED. Partió de G317/G292, integró Cliente/Driver/Admin, bloqueo G305 de Comercio, prepago G306 y Soporte hasta G313. **20 ejecuciones de GitHub Actions en HEAD: SUCCESS**, incluyendo CI unificada G318 #43322763317. Su commit incluye además **G319 estabilidad GPS Cliente** (confirmado por lista de commits y cambios). Esto es QA, no release externa.
- **Railway STAGING:** proyecto `qore-mobile-staging`, `f0afe535-a398-41bf-b8cc-918dcf108667`; environment `staging`, `19682286-3b2f-40ec-8768-65faeefe6cc8`; servicio `qore-mobile-backend-staging` `c00a1f8a-4b03-4e39-9264-9aad74d0bb10`. **Despliegue real SUCCESS sigue siendo G292**, commit `48c4dff774deba3256b0b35b31aba0b1b38d7b1b` del 1-nov-2026, ID `539a4221-ad8a-4d93-a26d-d4a1ebea21af`. Dominio `qore-mobile-backend-staging-staging.up.railway.app`; sin cambios staged. **G318 NO está desplegado**. Verificar salud/rutas, no concluir E2E solo por HTTP 200.
- **Supabase STAGING:** proyecto `mrjzxftsdxzepzbcuids`, PostgreSQL 17.11, `ACTIVE_HEALTHY`. La instancia había estado INACTIVE el 12-nov y fue restaurada; comprobación posterior SQL confirmó **8 usuarios Auth**, **0 roles Owner activos**, **0 MFA verificados**, **0 tablas `mobility_stage_support%`**, **0 Edge Functions**. No se han aplicado migraciones G301/G312/G313/G314/G320. No inventar personal aprobado ni privilegios.
- **E2E de entorno externo:** **0/5 PASS_EXTERNAL confirmados** (AUTO, MOTO, ENVÍO AUTO, ENVÍO MOTO, COMERCIO). Pruebas PostgreSQL16 descartables, Node/TS y build Android no son los cinco recorridos reales.
- **Datos de registro Driver:** informe integrador #135: 0 documentos Driver, 0 altas/vehículos. Las 8 cuentas Auth QA no implican KYC Driver finalizado.

## 2. APK PARA PRUEBAS REALES — ENLACES DIRECTOS, SIN ZIP TEMPORAL
- Cliente **G319 GPS estable**, ARM64, 42.175.507 bytes; prerelease público `qa-g319-cliente-gps-estable-2026-11-12`:
  https://github.com/mezas3238-hue/Qore-mobile-/releases/download/qa-g319-cliente-gps-estable-2026-11-12/Movete-Facil-Cliente-G319-GPS-Estable-ARM64-QA.apk
- Driver **G313 scanner ML Kit**, ARM64, 66.211.596 bytes; prerelease público `qa-g313-driver-arm64-2026-11-12`:
  https://github.com/mezas3238-hue/Qore-mobile-/releases/download/qa-g313-driver-arm64-2026-11-12/Movete-Facil-Driver-G313-ARM64-QA.apk
- Alternativa prerelease conjunto G314 (2 APK): https://github.com/mezas3238-hue/Qore-mobile-/releases/tag/qore-mobile-G314-android-qa-20261112
- **G319 específicamente corrige sobrecarga de Cliente**: GPS de origen una sola vez al entrar, sin loops de permiso/reanudación; destino solo tras pulsar botón, sin geocodificar cada pulsación; límite de frecuencia/single-flight y sin snapshot periódico de 5 segundos. Tag de release G319 apunta al HEAD de G318 `38ff8efd...`.
- **No confundir compilación y prueba física**: Owner había rechazado Cliente por consumo/comportamiento anómalo y Driver por disparo antes del enfoque. El Owner debe probar ambos APK en teléfono Android real y marcar ACCEPTED/REJECTED; el resultado sigue sin certificar.
- Revisar SHA256, firma de test, minSdk/ABI, package IDs y permisos; las APK QA tienen identificador propio y no son versiones Play Store. Si un enlace caduca o falla, regenerar release GitHub con assets válidos, NO usar rutas sandbox/Artifacts vencidos. No mandar claves KYC ni credenciales comerciales por chat.

## 3. FRENTE A — CLIENTE + DRIVER (issue #118)
**Fuente:** Cliente G309 #115 → G312 #127 → G319 incorporado a #138; Driver G310 #117 → G313 #130/#133; consolidación G317 #136. No rehacer código.
### Cliente — P0
1. Instalar G319 en Android real desde release, instrumentar ANR/crash/permisos sin datos personales y probar arranque, reanudación, 2º plano, GPS denegado/apagado, conectividad débil, cambios de destino.
2. «¿De dónde te buscamos?» debe intentar **GPS preciso al abrir** con permiso foreground; mostrar dirección real, precisión/estado de error y **permitir corrección manual**, sin autocaptura interminable. No prometer exactitud de portal/casa que GPS no puede conocer.
3. «¿A dónde vas?» debe permitir búsqueda/select de dirección inequívoca geocodificada **en Paraguay**; no «Opción 1», países erróneos, coordenadas como dirección o inferir la intención del usuario. Confirmar destino explícito y revisar las búsquedas limitadas G319.
4. Pantallas de servicios AUTO/MOTO/ENVÍOS/COMERCIO, tarifas realmente recibidas del backend, reserva con estado consistente, cancelación, estados, permisos, consumo batería/datos y recuperación ante red.
5. Verificar que las opciones de pago dependen del tipo de servicio: viajes/envíos particulares **efectivo o digital**; comercios **solo prepago digital acreditado**.
### Driver — P0
6. Instalar APK G313 ARM64. Usar **escáner documental nativo ML Kit**, sin `takePictureAsync` repetido, sin selfie/desenfoque aceptado; probar documentos ficticios en iluminación mala/buena y fotografiar vehículo con chapa legible. No usar PII real para depurar CI.
7. Registro real pendiente: cédula de identidad, licencia, cédula verde, habilitación y foto auto/moto con chapa, verificaciones cruzadas; completar los **8 requisitos/documentos** que mantiene el expediente del proyecto, fechas de vencimiento y revisiones humanas. No confiar solo en OCR ni autoaprobar KYC/vehículo. Storage privado con RLS, acceso revocable y auditoría.
8. Oferta/aceptación/rechazo, mapa/navegación, estado disponible, alertas, historial y ganancias; vehículo aprobado por persona autorizada antes de despacho; motor de despacho AUTO/MOTO y entregas por tipo y radio, con seguridad vial y geografía.
9. SOS Driver **opt-in OFF por defecto**, icono pequeño solo si el Driver lo activa en la esquina del mapa, destino configurable contacto de confianza/911; llamada normal gestionada por SO (911 usa marcador/confirmación cuando corresponda). No prometer silencioso o llamada estable en fondo ni fingir recepción policial. Issues #96/#97, PR #100.
**Salida A:** APKs instaladas y testadas físicamente; matriz de defectos con dispositivo/Android/fecha, evidencia sin PII, ACCEPTED/REJECTED del Owner. Si falla, corregir rama móvil sin tocar backend/Soporte.

## 4. FRENTE B — COMERCIO, DINERO Y LIQUIDACIONES (issue #119)
**Fuentes:** G302 split QA #105, G303 efectivo #106, G304 prepago #109, G305 bloqueo de bypass #110, G306 PSP/SQL atómico #112. La integración G318 ya contiene el bloqueo de mutación de comercio G305.
1. **Comercios: 100 % digital y previo a preparación/entrega**. No mostrar efectivo/contraentrega de mercaderías; solo pago confirmado servidor a servidor (tarjeta CAPTURED/SETTLED, transferencia/QR SETTLED). Mientras no haya PSP real/sandbox certificado: respuestas `409`, ningún avance hacia preparación/despacho. No falsificar cobro.
2. Seleccionar y conectar proveedor PSP autorizado para Paraguay en entorno **sandbox**, definir contrato, credenciales solo servidor, webhook con firma+idempotencia, consulta independiente de captura, conciliación, reversos, chargeback, retries, factura/recibo y trazabilidad por pedido.
3. Aplicar **solo tras auditoría/orden del integrador** SQL G306/ledger contra esquema PG17 y pruebas negativas de pago ausente/duplicado/caducado/importe incorrecto/reversión; confirmación de stock y despacho en la misma transacción.
4. Viajes con tarjeta: al finalizar y fondos acreditados, comisión Owner/versionada + neto Driver; ejecutar futuro payout **solo** tras KYC y PSP de desembolsos. PR #105 es contrato QA, no fondos.
5. Viajes con efectivo: Cliente paga billetes al Driver, plataforma NO recibe dinero. Registrar comisión como saldo por cobrar y compensar contra ganancias digitales futuras con límites protectores; PR #106 no cobra deuda real.
6. Comercios: conciliación de tres partes Comercio/repartidor/plataforma después de entrega comprobada. Distintos esquemas de comisión por modalidad y políticas fiscales/regulatorias.
7. Tarifa Owner/Admin G265/G268/G285, MFA AAL2 y reglas por Paraguay, validación de coste y negocio; no confundir tarifas de prueba con valores vigentes aceptados.
**Salida B:** flujo económico en sandbox probado + reporte claro de PSP conectado/no conectado, sin pago real ni despacho comercial inseguro.

## 5. FRENTE C — PORTAL DE SOPORTE (issue #120)
**Fuente exacta:** G301 #104 → G309 #116 → G311 #121 → G312 #126 → G313 #132 → G314 #137 → **G320 #139** (HEAD `0a65f98cc012fb31b3c4440c3e27c5945e7c68cf`).
- G301 interfaz web `apps/movete-soporte` independiente de Admin: login por cuenta, TOTP AAL2, bandeja de casos mínimos, roles separados.
- G309 impide actualizaciones tardías tras logout.
- G311 contrato de acciones fijas sin texto arbitrario/datos bancarios; servidor OFF por defecto.
- G312 esquema de cola privada y RLS; pruebas PG16 A/B, rol Owner denegado, AAL1/expired denegados.
- G313 encolado SQL atómico con comprobación del rol/Owner, sesión Auth y factor MFA, ticket asignado, estado e idempotencia. `SECURITY DEFINER` excepcional en esquema privado, revisar propietario/ACL/search_path.
- G314 candidato Edge `qore-support-actions`: `auth.getUser(jwt)`, origen HTTPS exacto, RPC solo `service_role`, UI de acciones ocultas OFF. **NO desplegado**.
- G320 `Tomar caso` atómico: ticket `OPEN` sin asignación de prioridad NORMAL/HIGH, bloqueo `FOR UPDATE`, bitácora append-only; dos transacciones PG16 simultáneas dieron **un solo ganador/un evento**. QA G320 workflow #43322774399 SUCCESS; G301/G312/G313/G314 también SUCCESS. PR DRAFT, no deployment.
**Importante:** el PR de integración G318 incorpora Soporte **solo hasta G313**. G314 y G320 **todavía deben incorporarse por SHA** tras auditoría; no crear otro Portal paralelo.
### Pendientes de Soporte
1. Supabase PG17: crear roles de soporte con aprobador Owner genuino ya autenticado y MFA AAL2; hoy **0 Owner activo, 0 MFA verificados**, no inventar identidad con SQL. Bootstrap de Owner via flujo G300 #102 y validación humana formal.
2. Auditar migraciones G301/G312/G313/G314/G320, `SECURITY DEFINER` G313/G314/G320, permisos `EXECUTE` solo servidor, RLS por fila, GRANT mínimos, sesiones expiradas/revocadas; aplicar primero STAGING bajo autorización.
3. Verificar alta de dos agentes reales QA A/B y asignación sin escalamiento horizontal; roles Owner/Admin/Cliente/Driver no heredan Support.
4. Desplegar Edge Functions seguras con secretos solo servidor; activar flags STAGING únicamente tras pruebas; añadir rate limit por ticket/agente, antifraude y bitácora.
5. Implementar lo **todavía no existente**: crear tickets desde Cliente/Driver/Comercio, comunicación/reply reales con consentimiento y minimización de PII, notificación y seguimiento, cierre con evidencia, SLA, reasignación supervisada, revocación, escalamiento humano seguridad/finanzas. `QUEUED` no significa mensaje entregado ni caso resuelto.
6. Preparar interfaz y permiso del empleado de soporte sin acceso a precios, pagos, retiros, KYC/vehículos ni cuentas Owner. No copiar panel Admin.

## 6. INTEGRADOR ÚNICO — BLOQUEO TRANSVERSAL P0 (issue #135)
**Rama canónica candidata:** PR #138 G318, HEAD exacto `38ff8efd1a62c3ec235b9d22d4f13d4f0abae000` al corte; incluye corrección Cliente G319. **Fuente desplegada G292 aún antigua**. No hacer merge de decenas de PRs apilados a `main` por separado.
1. Revalidar HEADs de #138, #139 y #137, workflow checks, tree diff y origen branch Railway; construir plan de integración **uno solo**, conservando G302 área Driver, G305 bloqueo Comercio, G319 estabilidad y G320 sin doble adjudicación. Verificar dependencias y archivos compartidos; no duplicar funciones/PR.
2. Preparar migraciones STAGING **ordenadas** y reversibles; toma de snapshot/backups, comparación `information_schema`, seguridad de scripts `SECURITY DEFINER` y pruebas de rol revocado. Nunca usar datos reales KYC ni pagos para experimentar. Solo desplegar tras autorización de Owner.
3. Instalar/activar software de forma limitada en STAGING y verificar variables OFF/NO LIVE, salud HTTP/Auth/DB; Railway service procede de rama G292 hasta que se cambie. No afirmar que nuevo PR está en Railway solo porque CI PASS.
4. Ejecutar 5 recorridos **EXTERNOS** con cuentas QA, GPS real, hardware real, PostgreSQL17 y auditoría Admin independiente:
   - **AUTO pasajeros:** elegir origen/destino → tarifa verificada → reserva → despacho → Driver acepta → completa → evidencia/comprobante sandbox.
   - **MOTO pasajeros:** igual con vehículo, radio, tarifa y reglas de MOTO.
   - **ENVÍO AUTO:** cotización → Driver AUTO → recogida y prueba de entrega del destinatario → cierre y conciliación QA.
   - **ENVÍO MOTO:** igual con condiciones de carga/seguridad propias.
   - **COMERCIO:** compra de mercadería con PSP sandbox **realmente acreditado** → pedido/preparación → despacho → recepción → conciliación 3-partes y asiento QA; mientras PSP no esté disponible, clasificar `BLOCKED_EXTERNAL`, NUNCA PASS falso.
5. Por cada escenario, reportar `NOT_RUN`, `FAIL`, `BLOCKED_EXTERNAL` o `PASS_EXTERNAL`; fecha, SHA, app package, run CI, alias de actor QA, latencia, detalle, log en privado, evidencia sin PII y firma de aceptación Owner. Estado actual: **0/5**.
6. Observabilidad: errores del cliente/driver, ANR, batería/memoria, requests GPS, HTTP 4xx/5xx, reintentos, sesión, bloqueo de cobros, logs trazables por `request_id`; evitar detalles secretos.
7. Si cualquiera de los cinco falló, corregir **el único módulo propietario**, volver a certificar la rama unificada y actualizar matriz. El integrador es único dueño de archivos transversales y despliegue.
8. Después de 5/5 E2E y aprobación: liberar RC STAGING; planificación independiente de LIVE/pagos/regulatorio.

## 7. FUNCIONES DE PRODUCTO Y SEGURIDAD AÚN ABIERTAS
- Usuario final: registro/recuperación de cuenta, consentimiento y GPS, cancelaciones, facturación, historial, soporte, notificaciones, accesibilidad, localización español-PY, redes malas y reintentos.
- Driver: KYC/vehículo e inspección humana; renovación licencias/habilitación; alerta SOS opt-in, seguridad de noches/incidentes, prueba de entrega y disputas, historial/ganancias.
- Despacho: ETA/rutas reales, capacidad AUTO/MOTO, radios, casos sin Driver, cancelación/reasignación/timeout, control de doble aceptación y estado autoritativo en DB.
- Administración Owner: tarifas/comisiones, seguridad AAL2, tablero de operación, aprobaciones y auditoría; **crear el Owner legítimo es prerrequisito**, el frontend por sí solo no lo hace.
- Comercios: onboarding, catálogo/stock, pedido, prueba de prepago, impresión/estado de preparación, prueba de entrega, conciliación y liquidación.
- Seguridad: #96/#97, verificación identidad pasajero real para incidentes, retención y acceso legal; no fingir que email confirmado acredita identidad civil. Plan AUTO MUJER #95 es propuesta no certificada; no activarlo por accidente.
- Legal/regulatorio Paraguay: privacidad/consentimiento, contratos, seguros, transporte de personas/mercaderías, impuestos, tratamiento KYC e incidentes. Revisar con especialistas locales antes de publicar.

## 8. DESPUÉS DE QA: GOOGLE PLAY + APP STORE
- **Owner exige distribución final en tiendas oficiales, NO distribución permanente APK.** Las APK actuales son laboratorio.
- PR #108 tiene perfiles EAS para Cliente+Driver: Android AAB y iOS App Store/TestFlight, paquetes productivos separados; Admin, Comercio y Soporte son web salvo decisión posterior.
- Pendiente: cuentas Play Console/Apple Developer/EAS, firma de publicación, App Privacy/Data Safety, política de privacidad y borrado de cuentas, permisos GPS/cámara/SOS, fichas, capturas, pruebas internas Android y TestFlight, revisión tienda, iOS hardware y aprobación Owner.
- NO asumir que hay builds iOS ni tiendas configuradas porque existe `eas.json`; investigar estado real antes de prometer fecha de publicación.

## 9. RESPONSABILIDADES — EVITAR TRES ARQUITECTOS HACIENDO LO MISMO
- **A: móvil** #118 (Cliente, Driver, GPS, cámara, instalación/QA Android).
- **B: comercio/finanzas** #119 (PSP, conciliaciones, cash vs digital, ledger, pagos y SQL del dominio).
- **C: soporte** #120 (agentes, MFA, RLS, tickets, atención/escalación).
- **Integrador único** #135 (HEAD, diffs entre ramas, backend compartido, release candidate, STAGING, 5/5 E2E).
- Los issues históricos #15–18 tienen nombres de Arquitectos A/B/C/D de una distribución anterior; **NO confundirlos** con A/B/C del reparto actual. Comentarios en cada issue muestran las decisiones. Estas asignaciones están registradas en GitHub; **no significa que los chats se comuniquen automáticamente**.

## 10. INSTRUCCIÓN EJECUTIVA PARA EL PRÓXIMO ARQUITECTO
1. Empieza **en este instante** verificando la fuente de verdad: GitHub PR #138 HEAD + #139 HEAD + #137 HEAD + Railway G292 + Supabase PG17. No cites handoff histórico como sustituto de inspección.
2. **No vuelvas a crear apps, perfiles, GPS, cámara, payment split ni portal Soporte.** Ya tienen implementaciones. Cierra brechas funcionales concretas.
3. Lo primero es aceptación física **Cliente G319 y Driver G313**; pide solo los resultados que todavía no se hayan documentado y registra evidencia.
4. Luego asigna a A/B/C tareas no solapadas; el integrador debe preparar y validar el RC único contra PostgreSQL17 sin afectar datos reales.
5. Desbloquea Owner AAL2 de manera legítima, KYC Driver y PSP sandbox; no simules estos hitos.
6. Produce **5/5 PASS_EXTERNAL** o una lista exacta de `BLOCKED_EXTERNAL` y acciones desbloqueantes; no proclames "app lista" con CI verde.
7. **NO MERGE sin orden Owner, NO LIVE, NO transferencias reales, NO modificación de dispositivos/credenciales de Owner sin su participación.**
8. Cada turno debe ejecutar trabajo verificable, actualizar GitHub y reportar: `HECHO / FALLÓ / BLOQUEADO` con SHA, run, próximo bloqueo y responsable. No seguir generando handoffs nuevos como sustituto de ejecución.

## 11. ENLACES DE CONTROL
- Integración G318: https://github.com/mezas3238-hue/Qore-mobile-/pull/138
- Integrador único P0: https://github.com/mezas3238-hue/Qore-mobile-/issues/135
- Móvil A: https://github.com/mezas3238-hue/Qore-mobile-/issues/118
- Finanzas B: https://github.com/mezas3238-hue/Qore-mobile-/issues/119
- Soporte C: https://github.com/mezas3238-hue/Qore-mobile-/issues/120
- Soporte G314: https://github.com/mezas3238-hue/Qore-mobile-/pull/137
- Soporte G320: https://github.com/mezas3238-hue/Qore-mobile-/pull/139
- Android RC: https://github.com/mezas3238-hue/Qore-mobile-/pull/136
- App Stores: https://github.com/mezas3238-hue/Qore-mobile-/pull/108
- Seguridad SOS: https://github.com/mezas3238-hue/Qore-mobile-/issues/96
- Seguridad identidad: https://github.com/mezas3238-hue/Qore-mobile-/issues/97

### Cláusula final
**La app no está comercialmente terminada al corte.** Existe un RC QA avanzado, APK Android directas y backend STAGING más antiguo funcionando. Lo urgente es **aceptación física, reconciliación del RC, identidades/roles legítimos, PSP sandbox y 5 E2E en entorno externo**. La ausencia de proveedores o validación humana debe declararse como dependencia real, no maquillarse con mocks.

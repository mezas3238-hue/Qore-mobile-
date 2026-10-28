# QORE MOBILE / MOVETE FACIL — HANDOFF MAESTRO ARQUITECTO A
## Continuidad inmediata G0–G70 + alta documental, selfie, bloqueo por vencimiento y renovación | 2026-10-24

**ORDEN OWNER:** continuar trabajando sin detenerse a menos que haya un BLOQUEO REAL. Medir avance por **funciones completas e integradas, certificadas con pruebas reproducibles**, NO por número de commits o gates. Al comenzar un chat nuevo, leer este handoff, revisar PR y Actions actuales, empezar a implementar el primer pendiente P0 y corregir los CI antes de reportar entrega. No pedir confirmaciones ya dadas. Si un paso precisa proveedor, autorización, datos reales o infraestructura externa, detener SOLO esa acción y continuar QA seguro en otra tarea.

### Identidad, ramas y fuente de verdad
- Repo exacto (incluye guion final): https://github.com/mezas3238-hue/Qore-mobile-
- Arquitecto A: rama feature/mobility-monorepo-isolated-20261016, PR #7 https://github.com/mezas3238-hue/Qore-mobile-/pull/7, DRAFT, base main.
- Arquitecto B: rama feature/mobility-cliente-admin-parallel-20261022, PR #8 https://github.com/mezas3238-hue/Qore-mobile-/pull/8, DRAFT, base rama A.
- Contratos entre A/B: https://github.com/mezas3238-hue/Qore-mobile-/issues/9.
- Ultimo HEAD funcional A auditado: 2685e478c606a3b2335a90920965460c7e3ddb41, cuatro workflows SUCCESS.
- Ultimo HEAD B observado: ac7ad3561972e28ddd3b428ba14038fe627f7fdc, tres workflows B SUCCESS.
- Este documento agrega un commit posterior. NO atribuir automáticamente 4/4 de SHA anterior al nuevo HEAD documental.
- Historial exhaustivo previo A: docs/handoff/HANDOFF_MAESTRO_ARQUITECTO_A_G0_G66_CONTINUIDAD_SIN_PAUSAS_2026-10-24.md; asimismo handoff G0–G58E, inventario G66 y anexos.
- Handoff maestro B: docs/architect-b/HANDOFF_MAESTRO_ARQUITECTO_B_R1_R66_F1_PRIORIDAD_FUNCIONES_CERTIFICADAS_2026-10-24.md.
- Manifiesto de lanzamiento: docs/architecture/MOVETE_FACIL_LAUNCH_GATES_2026-10-24.json. Decision NO_GO: 17 gates sin evidencia de GO (15 BLOCKED, 2 QA_ONLY al ultimo corte).
- Inventario A verificado al SHA funcional: 761 archivos Git rastreados, arbol completo sin truncamiento. Este numero es solo auditoria.

### Gobierno no negociable
**NO MERGE / NO LIVE / NO DEPLOY / NO VPS / NO PSP o pagos reales / NO SQL remoto / NO credenciales o secretos / NO PII, fotos o biometria personales reales en QA / NO push-SMS real / NO publicacion de APK-IPA / NO fusionar apps / NO force-push, rebase destructivo o cambios a la base de PR B** sin instruccion especifica del Owner. Todo trabajo se mantiene en DRAFT. No llamar terminada o comercialmente certificada a una app con resultados de mocks, CI o export web.

### Producto y decisiones Owner
Movete Facil operara en Paraguay con cobertura progresiva por zonas/municipios, compitiendo por calidad superior con Bolt y Uber. Apps completamente separadas: Driver nativa Expo para conductor y repartidor (A), Cliente Expo para pasajero/remitente/comprador (B), Admin Web para control (B). Backend PostgreSQL/Node/Auth/SQL/API pertenece a A.
Servicios: viajes de personas en AUTO; envios particulares y delivery de comercios por AUTO y MOTO; supermercados, farmacias dentro de categorias permitidas, restaurantes y otros comercios. No pasajeros en MOTO sin autorizacion legal/Owner. Cliente puede enviar mensajes al Driver o repartidor durante servicio asignado. Tarifas y comisiones en PYG calculadas por servidor; AUTO y MOTO diferentes. Coverage no implica disponibilidad. No limite de 50 registros globales: paginas de 50/100 son paginacion. Documentos KYC centralizados y privados, no decision tomada por la app. Lovable solo para interfaz final, sin recrear backend o Auth.

### Division de carpetas
Arquitecto A ESCRIBE apps/mobility-expo/**, apps/movete-driver/**, docs/architecture/** y docs/handoff/**; coordina .github/workflows/** con cautela. Arquitecto B ESCRIBE apps/movete-cliente/**, apps/movete-admin/**, docs/architect-b/**. El otro arquitecto consulta sin editar. Resolver dependencias por issue #9. Leer siempre HEAD A y B de nuevo porque las ramas avanzan en paralelo.

## HISTORIAL IMPLEMENTADO A — G0 A G66 (QA, no producto en calle)
- G0–G2: monorepo, limites de seguridad, PostgreSQL16/Supabase RLS, roles, elegibilidad Driver/vehiculo, reglas AUTO/MOTO, licencia, seguro e inspeccion.
- G3–G4: viajes AUTO y ofertas privadas, aceptar/declinar, llegadas, inicio/fin/cancelacion, estado revisado, idempotencia, concurrencia de ofertas y despacho.
- G5/G10/G14: encomiendas AUTO/MOTO, pickup/deliver/return/disputa, capacidad peso/volumen, ofertas courier privadas, carrera de dos repartidores y adjudicacion unica.
- G6/G9/G44/G45: comercios, sucursales, catalogo, inventario, carrito, compra/reserva y rollback con datos sintéticos, sin cobros.
- G7: tarifas server-side Gs, contabilidad, comisiones y recibos de QA.
- G8/G27–G30/G39–G41: seguridad, SOS e incidentes, cola Admin, control Owner/admin, triaje, historico, auditoria, cursor privado.
- G11–G15: OpenAPI contratos; outbox de notificaciones, leases y fencing, polling backup; no proveedor push real.
- G16–G22: app Driver inicial, inbox/documentacion G17, rol exclusivo Driver G18, observacion de archivos G19, preflight licencia G20, estado/login/logouts.
- G23–G26: historiales privados y paginacion keyset/MVCC sin limite de volumen global.
- G31–G38: zonas/cobertura, GPS consentido cuarentenado, antifraude posicion/replay, slot Driver compartido AUTO/DELIVERY, fences SQL de transicion y bloqueo comercial.
- G42–G43: JWT JWS firmado/pinneado, usuario/sesion proveedor, rol exclusivo, locks de sesion G42 en COMMIT, AAL2 para Admin. JWT de laboratorio NO es IdP real.
- G46–G48: permisos RLS minimos, evidence leases, grants SQL/tickets opacos NOLOGIN de un solo uso.
- G49–G60D: chat Cliente-Driver bajo asignacion autorizada, SEND/INBOX/HISTORY/READ, cursores y ack idempotentes, lectura contigua verificada, reconciliacion ante ACK perdido, Driver mensajes, pruebas JWT y HTTP loopback.
- G61: 17 gates NO_GO, seguridad de SDK/transportes HTTPS pinneados opt-in.
- G62: composicion Driver de auth, documentos, inbox, chat y estado licencia con runtime null por defecto.
- G63–G64: oferta AUTO/DELIVERY aceptada/declinada por Driver con rol privado y reconciliacion read-only del requestKey ante COMMIT incierto.
- G65: Driver flujo AUTO aceptado/arribo/recogida/finalizacion, sesiones, estado y revisiones, cross-app synthetic QA. No dos telefonos reales.
- G66: Driver flujo courier pickup/deliver/return, prueba independiente exigida; el receipt fake no sirve. No envio fisico.
**Detalle G0–G66, SQL, pruebas y correcciones en handoff maestro anterior citado, no empezar de cero.**

## G67–G70 ENTREGADO (QA)
**G67:** comprobante de entrega protegido en transaccion SQL de G5, revocable, one-use, por Driver y entrega; evita completar con UUID arbitrario; pruebas de rollback, dos conexiones, revocacion, Node; no foto/proveedor real. Docs: docs/architecture/G67_DELIVERY_PROOF_ATOMIC_CUSTODY_POSTGRES_QA_2026-10-24.md.
**G68:** consulta privada del estado de custodia del remitente con actor Passenger propietario, G42 y rol exclusivo, DTO sin courierId/proofRef/GPS/telefono. B R65/R66 consume el contrato.
**G69:** lector scoped de privilegio minimo con proof opaco SHA256/TTL/one-use, roles NOLOGIN, carrera real PostgreSQL16; OpenAPI marca runtime no wired.
**G70:** JWT ES256 firmado de laboratorio + G42 + Passenger + G69, servidor Node GET loopback 127.0.0.1, cabeceras estrictas, max plazo, no retry proof incierto. HTTP y PostgreSQL fueron ensayados por separado, no un STAGING TLS compartido.
**G70 SHA certificado:** a63620031cfe9dd6f96db266e97a85c90e9a995f; PG #809, Node #1238, Expo #1944, aislamiento #1709, 4/4 SUCCESS.

## NUEVO REQUISITO CRITICO OWNER: ALTA DRIVER CON DOCUMENTOS + SELFIE
**Documentos:** licencia/registro conducir; cedula identidad frente/dorso; cedula verde del vehiculo; habilitacion; seguro; inspeccion; fotografia actual del rostro (selfie). Para politica real, evaluar requisitos municipales, clase vehiculo y servicio. Todo verificado contra el Driver autenticado y el vehiculo correcto.
**Aprobacion automatica:** SOLO si fuente autentica confirma vigencia, identidad, titularidad/permiso de vehiculo, consentimiento/liveness y coincidencia facial, ausencia de inconsistencias, ocho evidencias vigentes y estado administrativo correcto. Foto recibida, OCR o fecha enviada por movil no son prueba suficiente. Proveedor inactivo, rechazo/inconsistencia/fraude: cola Admin y opcion apelacion/renovacion, sin autoaprobar.
**Datos personales:** cifrado, minimo privilegio, consentimiento facial expreso y revision humana alternativa, retencion/borrado seguro, NO PII en logs o respuestas.

### A. Politica evaluacion KYC Node
- apps/mobility-expo/server/driver-kyc-auto-approval-qa.mjs + test.
- Ocho tipos, vigencia/autenticidad verificadas por fuentes servidor, rol exclusivo Driver, vehiculo asignado, selfie consentida con liveness y face-match. READY_FOR_ATOMIC_APPROVAL solo elegibilidad QA, accountApproved=false, driverEligible=false.
- SHA 6f04e56b089db360012e6f317bd05f0063fd455f, PG #811 / Node #1242 / Expo #1948 / aislamiento #1723, 4/4 QA.

### B. Aprobacion QA SQL atomica y comprobacion actual
- DRIVER_KYC_EIGHT_DOCS_ATOMIC_ONBOARDING_POSTGRES_CI_ONLY.sql y su ASSERT bajo apps/mobility-expo/docs/backend/staging_only/.
- Cada atestacion SQL apunta a source_document_id del ULTIMO documento privado G17 del mismo Driver/tipo. Reemplazar documento invalida atestacion anterior.
- RPC owner-only mobility_stage_kyc_atomic_approve_owner_qa bloquea G42 sesion, verifica vehiculo y ocho evidencias bajo locks, idempotencia y recibo QA_ONBOARDING_APPROVED_NOT_COMMERCIAL.
- mobility_stage_kyc_current_onboarding_owner_qa DERIVA vigencia en cada lectura: recibo historico NO autoriza cuenta perpetua ni despacho.
- driver-kyc-onboarding-command-qa.mjs y tests vinculan auth/rol/sesion, verificadores y recibo SQL. Sin permiso EXECUTE a SDK/anon/service_role.
- SHA 7f23c635ad511c886de7b768581cdc46615a5559, PG #822 / Node #1255 / Expo #1968 / aislamiento #1774, 4/4 QA.

### C. G17/G19 y ocho evidencias con selfie
- G1_PRIVATE_DOCS_BUCKET_STAGING_ONLY.sql amplia allowlist de ocho tipos JPEG/PNG owner-scoped.
- G17_PRIVATE_DRIVER_DOCUMENTS_POSTGRES_CI_ONLY.sql registra ocho clases, todo empieza pending; UI lectura limitada; nunca registra faceVerified por recibir foto.
- server/g19-private-driver-evidence-observer.mjs y tests verifican propietario, ruta, bytes, MIME, SHA256, version y antimalware externo inyectado antes de crear referencia.
- server/g17-driver-document-gateway.mjs y repository, tests, Driver driver-documents.mjs, driver-workspace.mjs, app/documentos.tsx.
- SHA 59f7306e6cb723d3222b8085a2602ed142fa6b9c, PG #829 / Node #1267 / Expo #1982 / aislamiento #1794, 4/4 QA.

### D. Camara nativa Driver, Storage privado y pantalla
- src/native/driver-evidence-camera.ts con expo-image-picker ~57.0.20: permisos, selfie SOLO camera, otros documentos camera/galeria. src/domain/driver-base64-image.mjs decoder limitado y tests.
- src/domain/driver-document-upload.mjs y .d.mts/test: MAX 5MiB, owner/rol/token privado, camino DriverUUID/tipo-UUID.jpg, upload sin overwrite, reconfirmacion G17 observe, respuesta solo pending-review, limpieza de imagen temporal incluso error, sin reintentos post COMMIT incierto.
- src/domain/driver-storage-supabase-adapter.mjs/.d.mts/test: bucket mobility-staging-driver-evidence, sesion Driver y propietario coherentes, no service_role/public URL, upsert=false.
- DriverDocumentUploadProvider.tsx, DriverApplicationProviders.tsx, driver-staging-runtime.mjs y app/documentos.tsx. Controles visibles solo si composicion autorizada; por defecto disabled.
- SHA 37d8c5b772824d8af9b5e18b845b6a547e350f88, PG #837 / Node #1275 / Expo #1990 / aislamiento #1814, 4/4 QA.
- **Todavia NO hay Storage remoto, OCR proveedor real, liveness real, camara probada en telefono real o cuenta comercial aprobada.**

## ULTIMO TRABAJO: VENCIMIENTOS, BLOQUEO, AVISOS Y RENOVACION
**Mandato Owner:** si vence documento Driver: bloquear automaticamente para nuevos servicios, avisar en la pantalla cual vencio y pedir fotos nuevas. Una vez renovado y validado de verdad, rehabilitar automaticamente elegibilidad documental. NO levantar suspensiones administrativas por renovar.

### Lo hecho
- DRIVER_KYC_EXPIRY_RENEWAL_STATUS_POSTGRES_CI_ONLY.sql y su ASSERT: calcula con reloj PostgreSQL el estado actual desde ocho evidencias, ultima G17 y estado vehiculo; BLOCKED_EXPIRED, BLOCKED_REVIEW, SUSPENDED o READY_QA. ExpiredKinds, renewalRequiredKinds, expiringSoonKinds con anticipacion 30 dias, proximo vencimiento. commercialDispatchAuthorized sigue false.
- Subir foto nueva NO desbloquea; solamente la atestacion independiente valida del reemplazo restaura READY_QA si no hay sancion. El historico de aprobacion no predomina sobre documentos vigentes.
- Test PG: expiracion licencia bloqueo inmediato; upload pendiente permanece bloqueado; atestacion renovada restaura estado QA; 7 dias de anticipacion habilitacion; suspension Admin permanece bloqueada.
- server/driver-kyc-expiry-status-qa.mjs + test: consulta privada ligada a JWT, G42, rol Driver exclusivo, vehiculo propio y DTO sin fotos/PII.
- src/domain/driver-kyc-expiry.mjs/.d.mts y test: GET HTTPS /v1/staging/driver/kyc/validity, contrato estricto y avisos claros en espanol.
- DriverKycExpiryProvider.tsx: refresh al entrar, volver a primer plano y cada 60 s con app activa; borra snapshots al cambiar sesion. NO push al sistema operativo con app cerrada.
- app/index.tsx, app/ofertas.tsx y app/documentos.tsx: banner vencido/pendiente/proximo vencimiento, acceso a renovacion y disponibilidad/aceptacion de QA deshabilitadas con KYC bloqueado. Runtime enableKycExpiryStatus=false por defecto.
- **Ultimo SHA funcional A confirmado 2685e478c606a3b2335a90920965460c7e3ddb41**:
  - PostgreSQL16 #843 https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40136334678 — SUCCESS.
  - Node STAGING #1282 https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40136334663 — SUCCESS.
  - Expo #1999 https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40136334667 — SUCCESS.
  - Aislamiento Driver/Cliente #1823 https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40136334723 — SUCCESS.

**PRINCIPAL BRECHA P0:** la consulta y el bloqueo UI NO bloquean todavia todas las nuevas asignaciones en las transacciones backend G4/G10/G36. Una app cerrada o cliente hostil puede omitir pantalla; hay que asegurar el rechazo directamente dentro de SQL bajo locks de evidencias, sesion y vehiculo. **Este debe ser el primer trabajo del nuevo chat**. Ninguna aprobacion QA autoriza despacho comercial.

## B: estado real y dependencias
B HEAD ac7ad3561972e28ddd3b428ba14038fe627f7fdc, PR #8 DRAFT; boundary #521, Admin QA #477, aislamiento #1824 — 3/3 SUCCESS en ese SHA.
R1–R66: Cliente Expo viajes AUTO, envio, comprador, chat, tracking, historial, tarifa, booking seguro/conciliacion, custodia remitente G68/G69 monotonic, seguridad. Admin Web roles, cola KYC, revision manual, soporte/auditoria. F1 posterior: reserva own Passenger con receipt estricto y GET antes de seguimiento.
B bloqueado para E2E real por precotizacion/origen-destino, servicio HTTPS persistente, mismo backend e IdP, entre otros. Admin necesita contrato A para documentos vencidos, reenvio, foto, decision, sancion, apelacion. NO editar sus carpetas, coordinar issue #9.
20 recorridos negocio B no cuentan como certificados reales solo por tests de QA.

## PROBLEMAS Y ERRORES YA CORREGIDOS — NO REPETIR
- Prueba entrega G67: UUID arbitrario no es prueba; SQL one-use en COMMIT.
- G69/G70: privilegios owner/NOLOGIN, JWT signed, Host falso probado con raw HTTP porque fetch reescribe Host; timeout no reintenta proof incierto.
- KYC: SQL alias/EXTRACT/variables test, evidencia vinculada ultima G17, idempotencia/revocacion y roles; no aprobar por Node boolean.
- G17/G19: tests viejos license-only corregidos; g19 observer fue duplicado por replace de texto: restaurado desde Git original y modificado minimo, validado archivo publicado.
- Foto/camara: buffer temporal se borra incluso si MIME invalido; UUID propietario se corrigio a cinco segmentos.
- Vigencia: nunca usar reloj o flag de React como autorizacion de servidor; suspension Admin no se levanta al renovar.
- En cada regresion, inspeccionar job/log, arreglar, no eliminar controles de seguridad para verde, verificar SHA exacto final 4/4.

## PENDIENTES PRIORIZADOS — NO AGREGAR GATES DECORATIVOS
### P0.1 IMMEDIATO: KYC EN ACEPTACION/DESPACHO SQL BAJO LOCK
1. Inspeccionar scripts SQL G3/G4 ofertas AUTO, G10 courier, G36 slot, G38 fences y G42 bloqueo sesion.
2. Insertar barrera server-side atómica que exija expediente de 8 evidencias actuales verificado + Driver/vehiculo/servicio/municipio + no suspendido + sesion vigente. Debe ejecutarse DENTRO de transaccion, en todos los RPC/trigger de aceptacion/adjudicacion, no como preflight de UI.
3. Evitar TOCTOU: lock de evidencia y sesion hasta COMMIT, impedir fecha vencida o sustitucion concurrente, dos Driver compitiendo, vehicle-swap. No aumentar grants publicos.
4. Pruebas PG16 2 conexiones y Node adversarial: expirado, pendiente, reemplazado, validado, suspension administrativa, sesion revocada, desconocido ACK, usuario ajeno, mapeo Driver/vehiculo; no GO comercial.
5. Workflow PG/Node/Expo/aislamiento mismo SHA, issue #9.

### P0.2 CERRAR DRIVER DOCUMENTOS EN STAGING REAL AUTORIZADO
- IdP/JWKS y G42 real, HTTPS con TLS, PostgreSQL duradera, Storage cifrado RLS/owner/path/antivirus, SDK auth; migraciones CI_ONLY NO aplicar directamente en remoto.
- Proveedores de autenticidad documental y vigencia Paraguay, comparacion facial consentida/liveness, revision humana accesible y retencion/borrado; revisar legal datos biometricos.
- Dos Driver con datos autorizados, fotografia camara, upload bytes, G17 observation, decision SQL, actualizacion estado Driver y Admin B en mismo entorno. Falsaciones revocacion, cuenta ajena, perdida ACK, offline, fraude/expiracion.
- Bloqueo REAL: no usar proveedores/PII reales, ni desplegar sin autorizacion Owner. Continuar tests QA que no la necesiten.

### P0.3 PUSH DE VENCIMIENTOS Y RENOVACIONES
- Programar notificaciones preventivas 30d, 7d, 1d y al vencer, sin PII en notificacion SO, dedupe/retencion/opt-in, token privado y audit.
- Push real con app cerrada requiere proveedor y autorizacion. El bloqueo SERVER no depende de entrega push.
- Revalidar automaticamente despues de nuevo expediente verificado, mantener suspension/fraude.
- Android/iOS fisicos con app cerrada, permiso notificaciones, usuarios distintos, timezones y credenciales.

### P0.4 AUTO COMPLETO Cliente↔Driver↔Backend
- Solicitud origen/destino y quote PYG real/TTL, reserva persistida 1 vez, adjudicacion con KYC, GPS consentido, llegada/inicio/final, cancelacion/historial, chat/soporte y reconciliacion tras fallos. Coordinar B F1 para receipt y GET Passenger.
- Demostrar mismo viaje/ID en dos apps nativas y una base/IdP HTTPS aprobada; sin eso QA parcial.

### P0.5 ENVIOS AUTO/MOTO Y MERCADERIA
- Cliente envio → Driver oferta con KYC → pickup → prueba real protegida → entrega/disputa/devolucion → estado cliente/admin, notificaciones, historial.
- G67 hasta hoy es prueba sintética, falta autoridad de evidencia real cifrada/retencion, proof receptor.
- Supermercados/restaurantes/farmacias: catalogo, stock, check-out, picking/reparto/entrega, zonas, cancelaciones y soporte.

### P0.6 CHAT, KYC ADMIN, ZONAS, GPS Y SEGURIDAD
- Chat dos dispositivos/push/read real, vehicle stopped y reasignacion; seguridad vial.
- B Admin KYC revisión/rechazo/solicitar nueva foto/apelacion, RBAC/MFA real; A datos seguros/backoffice endpoints.
- Zonas Paraguay, ubicación/fraude, SOS con operador real, KYC vehiculos y seguros.
- No entregar dinero, licencias de operación ni promesas legales sin evidencia.

### P1 LANZAMIENTO/COMERCIAL (TODO BLOQUEADO HASTA APROBACION)
- PSP/bancos/ledger/settlements/refunds/payouts reales, precios/comisiones, antifraude, impuestos.
- DNS/TLS/hosting monitoreo/alertas, backups/restore/rotacion secrets, seguridad/performance, soporte operacional.
- Legal privacidad/biometria, seguros/municipios/consumidor, contratos comercios, Play/App Store build firmada Driver y Cliente separadas, pilotos en zonas autorizadas.
- Evidenciar 17 gates y 20 recorridos de B, decidir COMMERCIAL_GO solo con orden Owner.

## PROTOCOLO DEL SIGUIENTE ARQUITECTO
1. Reconsultar HEAD A PR #7, B PR #8, Actions y issue #9. Leer este handoff y maestro G0–G66; no rehacer historial.
2. Ir de inmediato a los SQL de aceptación G4/G10/G36 y KYC current/expiry. Implementar lock SQL KYC atómico y tests de carrera, seguir con cierre funcional.
3. Respetar territorios A/B; publicar DTO y dependencias para B en issue #9.
4. Verificar 4/4 QA en mismo HEAD funcional: PostgreSQL disposable, Node STAGING, Expo, aislamiento dos apps. CI verde es QA y NO producción.
5. Si falta infraestructura/IdP/Storage/biometría/PSP/legal, señalar la accion concreta bloqueada sin desplegar; continuar otro bloque autorizado. NUNCA detener todo el desarrollo por una dependencia externa.
6. Reportar por función: estado QA/STAGING_E2E/DISPOSITIVO/COMMERCIAL, evidencia, fallos, bloqueos y proximo cierre. NO porcentajes inventados ni conteo de commits como progreso.
7. Los PR siguen DRAFT. No mezclar apps, merges o producción sin permiso.

## ORDEN LISTA PARA PEGAR EN NUEVO CHAT

**"Actúa como Arquitecto A de QORE Mobile / Movete Fácil. Lee inmediatamente docs/handoff/HANDOFF_MAESTRO_A_FUNCIONES_KYC_VENCIMIENTOS_CONTINUIDAD_2026-10-24.md en GitHub mezas3238-hue/Qore-mobile-, el handoff histórico A G0–G66, el handoff B R1–R66+F1; confirma HEAD PR #7 DRAFT, PR #8 DRAFT e issue #9. Continúa implementando SIN DETENERTE salvo bloqueo real. Prioridad no son commits sino funciones completas y certificadas. El último A funcional 2685e478c606a3b2335a90920965460c7e3ddb41 tiene 4/4 SUCCESS solo QA. PRIMER TRABAJO: bloquear en la misma transacción SQL de G4/G10/G36 cualquier asignación/aceptación Driver si una de las ocho evidencias, incluida selfie, está caducada, sustituida o sin atestación; restaurar elegibilidad documental al renovar/verificar sin eliminar suspensiones. Probar carreras PostgreSQL16 y CI 4/4; después cerrar ID/HTTPS/Storage/cámara/biometría y E2E AUTO/DELIVERY con B sin tocar sus carpetas. NO MERGE, NO LIVE, NO DEPLOY, NO VPS, NO secretos, NO PII real, NO pagos reales. Si depende de autorización externa, bloquea solo esa acción y sigue con trabajo QA."**

## CIERRE
La plataforma ya tiene código funcional amplio y laboratorios QA certificados para viajes, envíos, chat, KYC, selfie, carga privada, expiración y renovación; NO está terminada para uso real. Primer bloqueo técnico corregible: falta restricción transaccional KYC en todos los RPC backend de asignación. Las dependencias externas (IdP/HTTPS/Storage, KYC oficial, dispositivos, PSP, legal) exigen decisión Owner antes de activar. Continuar trabajo inmediatamente, sin reiniciar ni detenerse salvo bloqueo real de una acción concreta.

# ANEXO AL HANDOFF MAESTRO A — TRABAJO QUE FALTA Y CONTINUIDAD INMEDIATA
**24 octubre 2026 · QORE Mobile / Movete Fácil.** Complemento obligatorio del [Handoff A principal](./HANDOFF_MAESTRO_A_FUNCIONES_CERTIFICADAS_Y_CONTINUIDAD_2026-10-24.md). El objetivo es cerrar funciones E2E, NO contar commits. PR #7 y #8 continúan DRAFT, producto NO_GO.

## PRIORIDAD 1 — BLOQUEO KYC EN DESPACHO BACKEND (P0, EMPEZAR AHORA)

**Brecha actual:** la app Driver muestra bloqueo y el SQL QA calcula BLOCKED_EXPIRED, pero los RPC antiguos de G4/G10/G36 podrían asignar/aceptar con G20 licencia vieja, GET previo o disponibilidad de UI sin contrastar las ocho evidencias más recientes. Un conductor puede cerrar la app o usar cliente antiguo; **el backend debe ser autoridad**.

Tareas Arquitecto A:
1. Abrir SQL G3/G4 AUTO, G10 courier, G36 slot, G37/G38 fences, G17 documentos, G42 sesión y DRIVER_KYC_EIGHT_DOCS_ATOMIC_ONBOARDING_POSTGRES_CI_ONLY.sql; trazar TODOS los puntos de asignar, aceptar y activar conductor.
2. Añadir verificación **en el mismo COMMIT SQL** de Driver+vehículo+servicio, rol exclusivo, G42 sesión bajo lock, ocho documentos/última revisión G17 y timestamps PG, estado documental, sanción Admin, zona legal y slot. No delegar decisión a GET/UI, ni confiar en input del teléfono.
3. Ensayar 2 conexiones PG16 desechable: vencimiento anterior y durante aceptación; nueva foto pendiente; documento revalidado; conductor/vehículo ajeno; sesión revocada; sanción mantenida; doble oferta/slot; llamada directa al RPC sin pasar UI. Las denegaciones no dejan evento, slot ni orden asignada. No abrir service_role ni grants owner-only.
4. Renovación autenticada confirmada por fuente independiente restaura únicamente elegibilidad **QA**, sin quitar sanción ni levantar G38 NO_GO.
5. Validar PG16/Node/Expo/aislamiento 4/4 SUCCESS en el SHA final y publicar contrato/test en issue #9 para B. **No iniciar otra etapa nominal antes de cerrar esta debilidad.**

**DoD:** ningún nuevo trabajo queda asignado/aceptado por conductor caducado/suspendido aunque app esté cerrada; renovado verificado puede ser elegible documentalmente en QA, no comercialmente.

## PRIORIDAD 2 — ALTA REAL DOCUMENTAL DRIVER + SELFIE

1. Vincular cámara Expo, permisos/consentimiento, SDK Storage privado y G17/G19 a un único IdP, backend HTTPS, PostgreSQL/Storage STAGING durable **autorizados**. Los archivos CI_ONLY no son migraciones remotas.
2. Verificar issuer y fechas de registro, identidad, habilitación, cédula verde, vehículo, seguro/inspección y selfie con liveness/match auténticos y **consentimiento informado**. Nunca aprobar por fecha del móvil o foto recién recibida.
3. Proteger PII/biometría con cifrado, RLS, antivirus/bytes/MIME/SHA256, retención/borrado, no URL pública y controles acceso/auditoría; alternativa humana para falsos rechazos.
4. Decisión de aprobación SQL con locks, revisión G17 de cada uno de ocho tipos, suspensión y estado administrativo. No activar despacho sin todos los gates.
5. B Admin Web: cola MFA/RBAC, revisión de excepciones, solicitudes de reenvío, rechazo/apelación, auditoría y suspensiones no levantadas por nuevas fotos.
6. E2E 2 conductores + actor ajeno, documentos vencidos, foto no coincidente, sesión rotada/logout, ACK perdido y recuperación del estado en teléfonos.

**Bloqueo parcial REAL:** proveedor de verificación de identidad/biometría, infraestructura y tratamiento de documentos personales requieren autorización Owner y cumplimiento legal. A sigue desarrollando SQL/contratos y QA seguro mientras tanto.

## PRIORIDAD 3 — AVISOS AUTOMÁTICOS Y RENOVACIÓN

- Outbox server-side con eventos de caducidad próximos 30/7/1 días, vencido, pendiente, aprobado o rechazado; deduplicación, requestKey, auditoría privada mínima.
- Push nativo Android/iOS incluso app cerrada **solo tras autorización de proveedor push**, consentimiento y ambiente. La alerta actual al abrir/regresar/cada 60 s NO equivale a push.
- Probar background/killed/sin conectividad, cambio de cuenta/token, notificación tardía y no mostrar documentos personales en pantalla bloqueada.
- Renovación pendiente **no desbloquea**, verificada independientemente **sí puede recuperar** estado documental QA, sanción/fraude/servicio/zona siguen su propio bloqueo.

## PRIORIDAD 4 — VIAJE AUTO REAL CLIENTE ↔ DRIVER

- Cotización PYG real antes de dispatch, ruta origen/destino, TTL, booking idempotente y recibo único, oferta Driver elegible, aceptación atómica, GPS/ETA consentido, llegada/inicio/fin/cancelación, historial y Admin.
- A backend/Driver; B Cliente (handoff B R1–R66+F1). Un mismo servicio/ID/revisión en ambas apps con **un mismo backend HTTPS y PostgreSQL persistente**; no DTO inventado por UI.
- Pruebas de dos usuarios, expiración KYC en tránsito, doble tap, token revocado, zona, GPS falso, offline/ACK y recuperación.
- No habilitar pasajeros MOTO, ni tarifas/payment fabricated.

## PRIORIDAD 5 — ENVÍOS Y COMERCIOS

- Pedido particular o comercial, selección zona/tarifa/capacidad, courier con KYC vigente, recogida, entrega con comprobante **real y privado**, devolución/disputa, Cliente remitente G68/G69/G70 consulta resultado, historial y chat.
- G67 prueba UUID/metadata sintética, no imagen de entrega física. Faltan Storage seguro, receptor/consentimiento, antifraude y retención.
- Supermercados/farmacias rubros permitidos/restaurantes: sucursal/catálogo/stock real, preparación, sustituciones y entrega. No considerar catálogo sintético como comercio disponible.

## PRIORIDAD 6 — CHAT, ADMIN, SOPORTE, SEGURIDAD

- Chat bidireccional con dos dispositivos/cuentas y asignación verdadera, SEND/ACK/READ contiguo visible, sesión/reasignación, push sin PII y seguridad vial.
- Admin B: KYC, RBAC MFA, auditoría, zonas, incidencias/SOS, atención humana, soporte y sanciones.
- Infra: monitoreo/incident response, backups/restore, GPS/maps, permisos y privacidad Paraguay, seguros, pagos PSP/conciliación **solo con aprobación**, aplicaciones firmadas Android/iOS.
- Certificar 17 gates G61 y 20 recorridos B realmente E2E con evidencia, luego aprobación GO expresa Owner. Comercial sigue NO_GO.

## INCIDENCIAS QUE NO SE DEBEN OCULTAR
- Snapshot KYC QA no equivale a gate SQL de despacho.
- Recibo histórico QA no equivale a cuenta vigente; reloj y revocación deben bloquear bajo COMMIT.
- Renovación no quita sanción ni habilita vehículo no autorizado.
- Selfie es PII sensible; recibo de foto no es liveness/face-match.
- Backend G69 SQL y G70 HTTP local no constituyen STAGING HTTPS remoto probado.
- G67 proof sintético no equivale a entrega calle.
- Cliente/Admin B están en PR separado basado en A; no forzar integración.
- Nunca reintentar mutador tras UNKNOWN_COMMIT sin consultar recibo original.
- Cero componentes reales de PSP/operación/GO, no ocultar bloqueos externos.

## ORDEN LISTA PARA EL SUCESOR
> Continuá QORE Mobile/Movete Fácil Arquitecto A en mezas3238-hue/Qore-mobile-, rama feature/mobility-monorepo-isolated-20261016, PR #7 DRAFT. Leé el handoff maestro A, este anexo, maestro histórico A G0–G66, maestro B R1–R66+F1, PR #7/#8 e issue #9. No rehagas lo construido: último SHA funcional A 2685e478c606a3b2335a90920965460c7e3ddb41, QA 4/4 PG #843, Node #1282, Expo #1999, aislamiento #1823; no es producto real GO. **Implementá YA el bloqueo transaccional KYC en G4/G10/G36**, con fecha de documentos, selfie, última evidencia G17, sesión G42 y suspensión, pruebas dos conexiones y sin bypass por RPC; renovaciones verificadas permiten solo elegibilidad QA. Documentá contrato a B y continuá recorridos AUTO, envíos, chat y Admin sin detenerte salvo bloqueo verdadero de una acción externa. Prioridad funciones completas certificadas, NO número de commits. NO MERGE/LIVE/DEPLOY/VPS/PSP/secretos/PII reales ni tocar Cliente/Admin B sin orden Owner.

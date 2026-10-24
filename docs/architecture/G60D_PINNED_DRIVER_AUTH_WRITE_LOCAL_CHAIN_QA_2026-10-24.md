# QORE Mobile — G60D / A51: Integración local de Auth G42 → G60C SQL → G60B HTTP

**Fecha:** 24 de octubre de 2026 · Arquitecto A · PR #7 DRAFT · solo laboratorio local.

## Integración construida

`apps/mobility-expo/server/g60d-pinned-driver-local-chain-qa.mjs` conecta tres componentes YA implementados por A a través de interfaces privadas:

1. **G42** verifica la firma JWT contra una lista de claves públicas y algoritmos/issuer/audience conocidos, nunca busca claves proporcionadas por el propio token. Confirma además usuario y sesión directamente con dos callbacks independientes del proveedor, y consulta G42 para la concesión persistente no revocada.
2. El controlador consulta el **rol exclusivo Driver** almacenado en el servidor. Rechaza roles mixtos, Passenger, usuarios anónimos, sesión caducada y cualquier caída de los orígenes de identidad.
3. Antes de SEND, un callback independiente `readStoppedEvidence` debe devolver `driverId`, `serviceKind`, `serviceId`, `conversationId` originales, `vehicleStopped:true`, `source:'trusted_navigation'` y timestamp confiable con antigüedad máxima 5 segundos. Esta evidencia está ligada a la identidad verificada por G42, no al toggle del teléfono. Reconcile no crea un mensaje y no exige detener el vehículo.
4. **G60C** recibe exclusivamente los parámetros verificados por servidor, valida nuevamente rol, sesión y rate-gate inyectado, utiliza un atestado SQL corto generado por un fixture privado y llama al intercambio `mobility_g60c_execute_ci`. No expone roles SQL ni emisor de pruebas al cliente.
5. **G60B** expone solamente un par de operaciones HTTP POST cuando el harness CI ejecuta `listen()` explícitamente en `127.0.0.1`, sin CORS ni puertos públicos. Devuelve ACK autoritativo desde G56 o recibo original G59B; el resultado incierto nunca autoriza un segundo SEND automático.

El ensamblador solo ofrece `listen()` y `close()`. No devuelve JWT verificadores, identidades, emisores SQL, bases de datos ni secretos.

## Pruebas

`g60d-pinned-driver-local-chain-qa.test.mjs` genera una pareja de claves ES256 **volátil de laboratorio**, firma tokens JWT con issuer y audience sintéticos, y ejecuta peticiones HTTP reales a loopback. Comprueba:

- JWT firmado → Auth G42, usuario y sesión del proveedor, concesión G42, rol exclusivo → atestación vial → prueba SQL → ACK Driver.
- Recuperación por `requestKey` original, `ack.revision` inmutable, `latestRevision` posterior y `historyRefreshRequired`.
- Repetir SEND con la misma clave produce un único mensaje; cambiar texto con esa clave genera 409.
- Firma inválida, issuer/audience/rol o sesión manipulados, concesión revocada, rol Passenger o dual, caída del proveedor, GPS no confiable, datos de identidad/cuerpo no autorizados: rechazo antes de admitir operaciones privilegiadas.
- Fuentes ausentes, `liveEnabled:true` o entornos productivos: inicialización rechazada.

**Límite de evidencias:** la base de datos usada en el test de integración Node es una simulación explícita del contrato de intercambio, mientras el PostgreSQL16 real y la carrera entre conexiones se certifican por separado en `g60c-driver-write-exchange-race-ci.py`. No afirmamos que el mismo test HTTP monte un PostgreSQL externo ni que existan credenciales válidas de un IdP real.

## Pendientes para STAGING real y G61

- Selección y autorización del IdP/JWKS oficial, validación de ciclos de claves, sesión G42 en base administrada, niveles MFA del backoffice, source de rol y rate limit persistente.
- Fuente vehicular verificable con control de manipulación y política de no interacción durante la conducción; las pruebas actuales solo verifican el contrato.
- Servidor HTTPS staging autorizado, configuración de origen/certificados, revalidación de asignaciones y ejecutor de conexiones SQL de privilegios mínimos con timeouts y circuit breakers.
- Autenticación de aplicación Driver y Cliente en dispositivos físicos, logística por zonas, mensajería bidireccional E2E, push privado, KYC y seguridad vial.
- Evaluación independiente de seguridad, observabilidad sin PII, planes de rollback y gates de Owner antes de LIVE.

**Prohibiciones vigentes:** no modificar Cliente/Admin (arquitecto B), no merge de PR #7/#8, no despliegue, VPS, pagos, contraseñas, datos reales ni exposición de puertos sin autorización.

## QA requerido

Certificar PostgreSQL disposable, Node STAGING, Expo y aislamiento sobre **el mismo commit** con resultados SUCCESS. El estado de laboratorio no representa disponibilidad comercial.

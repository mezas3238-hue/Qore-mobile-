# QORE Mobile — Driver KYC, selfie obligatoria y autoaprobación condicionada

Directiva Owner (24 de octubre de 2026): entregar la función completa y certificada, no aumentar commits.

## Expediente obligatorio Driver

- Registro/licencia de conducir vigente, auténtica y válida para el vehículo.
- Cédula de identidad frente y dorso; deben coincidir con el conductor autenticado.
- Cédula verde del vehículo, propiedad/permiso y coincidencia de chapa/vehículo.
- Habilitación municipal/vehicular vigente y correcta para la operación.
- **Foto actual del rostro (selfie)** con consentimiento explícito, verificación de presencia real y coincidencia con la cédula. Si falla o no es concluyente: revisión humana y apelación.
- Seguro e inspección técnica cuando sean exigibles por tipo de vehículo y servicio.

## Aprobación automática: reglas fail-closed

El teléfono presenta evidencias pero NUNCA decide su propia aprobación. La API confirma, por fuentes confiables independientes del móvil: identidad/sesión/rol; almacenamiento privado; bytes, MIME real, hash y antivirus; autenticidad y vencimiento documental; asociación exacta Driver/vehículo; consentimiento y verificación facial no suplantada; ausencia de fraude/revocaciones. No bastan fechas introducidas por el usuario ni que exista un selfie.

Solo con todas las verificaciones positivas, una transacción SQL con locks y revalidación de revisiones debe aprobar la cuenta para onboarding. Una cuenta aprobada documentalmente NO significa habilitación para despacho comercial: se mantienen zona, vehículo, seguro, licencia, GPS y gates operativos.

Ante rechazo, inconsistencia, documento ausente/vencido, falso positivo facial, problema de accesibilidad, proveedor offline o revocación: no autoaprobar; revisión humana, posibilidad de reenvío y vías de reclamación. No retener ni exhibir imágenes faciales, documentos, tokens, biometría o datos identificativos en logs/respuestas de QA.

## Código realmente implementado hasta este corte

Archivo servidor: apps/mobility-expo/server/driver-kyc-auto-approval-qa.mjs; test driver-kyc-auto-approval-qa.test.mjs. Validación exacta de ocho tipos (licencia, ID frontal/reverso, cédula verde, habilitación, seguro, inspección y selfie), vigencia y autenticidad, propietario/vehículo, consentimiento, liveness y coincidencia facial. Estado READY_FOR_ATOMIC_APPROVAL solo expresa elegibilidad de QA: accountApproved=false, driverEligible=false, productionEnabled=false. No realiza aprobación o verificación biométrica real.

GitHub SHA de código: 6f04e56b089db360012e6f317bd05f0063fd455f. Workflows GitHub: PostgreSQL #811, Node #1242, Expo #1948, aislamiento #1723 — SUCCESS 4/4. Es QA sintético, NO flujo real terminado.

## Bloqueos pendientes para que Driver realmente pueda enviar la selfie

El G17 actual permite registrar mediante Storage solamente licencia; sus enums, endpoint, app y políticas de bucket no soportan aún rostro_selfie como foto segura ni envío general de todos los documentos. Falta integrar captura de cámara con consentimiento y permisos, upload privado con control de usuario, escáner y cifrado, servicio de comprobación documental/facial autorizado, retención/borrado, y SQL atómico que registre aprobación. También faltan HTTPS STAGING, IdP, dispositivos físicos y autorización del Owner.

Arquitecto A: cerrar de extremo a extremo captura/subida/verificación/decisión bajo session G42 y SQL lock; dos conductores con datos sintéticos y casos adversariales, notificaciones privadas y estado de onboarding. Arquitecto B: Admin Web revisa excepciones manuales con MFA, auditoría, rechazo y corrección, sin tocar las rutas de A. Coordinar mediante issue #9.

Estado: ambos PR DRAFT; NO MERGE, NO LIVE, NO DEPLOY, NO VPS, NO secretos/datos personales reales ni pagos sin instrucción Owner. 17 gates comerciales NO_GO.

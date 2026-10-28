# QORE Mobile — G66 / A55: custodia de envíos AUTO/MOTO en Driver

**Fecha:** 24-10-2026. Arquitecto A, rama `feature/mobility-monorepo-isolated-20261016`, PR #7 DRAFT. **NO MERGE / NO LIVE / SIN DESPLIEGUE / sin datos reales / sin PSP.**

## Avance implementado

La app Driver ya dispone de una pantalla independiente `app/entrega.tsx` para continuar una oferta `DELIVERY` aceptada a través de G63/G64. A diferencia de AUTO pasajeros (G65), los envíos exigen custodia y comprobante verificable; aceptar una entrega no constituye recogida ni prueba de recepción.

### Backend

- `g66-courier-custody-status-qa.mjs`: ruta lógica `GET /v1/staging/courier/deliveries/{deliveryId}/custody`. El actor se deriva del JWT verificado, una sesión no revocada y rol exclusivo Driver; la consulta exige propiedad de la asignación. Datos mínimos: estado, revisión, próxima acción, `proofVerified`. No transmite remitente, domicilio, GPS, teléfono ni documentación.
- `g66-courier-custody-repository.mjs`: selecciona exactamente `id=deliveryId` y `courier_id=actorId` en la tabla G5, evitando confiar en un `courierId` enviado por el teléfono. Los datos operativos privados permanecen en el servidor.
- `g66-courier-custody-transition-qa.mjs`: ruta lógica `POST /v1/staging/courier/deliveries/{deliveryId}/custody-transition`. Solo permite `pickup`, `deliver` y `return`, con `eventKey` UUID y `proofRef` exclusivamente para `deliver`. Antes de invocar la transición SQL G5, un callback **independiente del cliente** `verifyIndependentProof({actorId,deliveryId,proofRef,action})` debe verificar existencia, propietario y asociación del comprobante. El simple UUID **no basta**.
- Las reglas SQL originales `mobility_stage_delivery_transition` siguen siendo la autoridad transaccional sobre secuencia, actor autorizado, idempotencia, límites de paquetes y custodia. G66 no las sustituye y **no cambia su comportamiento en bases remotas**.
- `g66-courier-custody-qa.test.mjs` y `g66-sender-courier-custody-contract-qa.test.mjs`: sesión JWT/rol, emisor ajeno, SQL scoped, falsificación de comprobante, MOTO categoría farmacia sin medicamentos controlados y secuencia Cliente→courier→pickup→deliver en memoria de QA. No son dispositivos ni entregas reales.

### App Driver

- `driver-custody-http.mjs` / `.d.mts`: transporte fijado a HTTPS STAGING explícitamente autorizado; GET estado y POST etapa bajo el mismo bearer Driver. Exige respuesta exacta `STAGING_DEMO_ONLY`, sin redirect, sin actor/rol/PII desde el cuerpo. Error de red o recibo malformado **nunca** permite reenvío automático.
- `driver-custody-controller.mjs` / `.d.mts`: controlador de custodia privado por sesión. Secuencia `accepted→pickup→picked_up→deliver→delivered` y recuperación `disputed→return→returned` solo cuando el SQL autoriza cada estado. Un resultado HTTP incierto bloquea nuevas mutaciones; `refresh()` exige revisión posterior y estado persistido coincidente, no finge un recibo. Logout/cambio de actor invalida todos los datos y respuestas tardías.
- **Prueba exigida para entrega:** `obtainVerifiedProof` es una autoridad independiente, inyectada, que debe emitir comprobantes vinculados a entrega y actor. **No está configurada por defecto.** En STAGING actual la UI deja registrar recogida, pero no permite marcar una entrega completada sin este proveedor y sin validación en servidor.
- `DriverCustodyProvider.tsx`, `DriverApplicationProviders.tsx`, `app/entrega.tsx`, `app/ofertas.tsx`, `app/_layout.tsx`: ruta Driver separada para custodia, desde una oferta `DELIVERY` confirmada. Las pantallas se desactivan sin runtime autorizado; mantienen privado el ID del comprobante y no generan imágenes o UUIDs de entrega en el teléfono.
- `driver-staging-runtime.mjs`: añade `custodyActions` al mismo host/identidad G62, con `obtainVerifiedProof:null` por defecto, `liveEnabled:false`. No hay una activación accidental de entrega comercial ni una promesa de entrega sin comprobante.
- `driver-custody-controller.test.mjs`: recepción de JWT externo en transporte, fases, recogida, prueba válida/inválida, ausencia de proveedor, ACK perdido tras COMMIT, recuperación por status, aislamiento y logout durante subida del comprobante.

### Limitaciones esenciales

Esta etapa entrega código de conexión y contratos QA, no un backend HTTPS desplegado. El registro de comprobantes reales (archivo cifrado, identidad del receptor, consentimiento, metadatos inmutables, controles antifraude, retención, firma/recibo y revisión de administrador) **no existe aún como servicio autorizado e integrado**. Los ensayos Node de pruebas usan comprobantes sintéticos verificados por callbacks mock; **no son imágenes ni pruebas de entregas reales**. La aceptación comercial permanece inhabilitada por G38 y el manifiesto de 17 gates sigue `NO_GO`.

## Próximo trabajo obligatorio

**G67**: implementar el subsistema seguro de registro y verificación de comprobantes de entrega con almacenamiento cifrado, URLs privadas firmadas y auditoría (sin capturar documento ni teléfono real hasta autorización), después conectarlo al servicio HTTPS STAGING aprobado con una sesión G42 real. Continuar en paralelo con B para flujo Cliente y Admin, sin tocar sus archivos; cerrar después pruebas físicas AUTO/MOTO, comercios, soporte, cobros y autorizaciones Owner.

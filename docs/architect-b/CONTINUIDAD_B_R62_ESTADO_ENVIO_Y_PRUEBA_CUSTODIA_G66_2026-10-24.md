# QORE Mobile — R62 Arquitecto B · Estado privado del envío y custodia G66
**Fecha:** 24-oct-2026 · **PR #8 DRAFT** · **Rama:** `feature/mobility-cliente-admin-parallel-20261022`.

## Objetivo y contrato de roles

Arquitecto A publicó G66, ciclo de envíos `requested→accepted→picked_up→delivered` con entrega certificada exclusivamente al verificar `proofRef` contra **autoridad independiente de almacenamiento**, más ruta Driver privada `GET /v1/staging/courier/deliveries/{deliveryId}/custody`. **Esa ruta Driver no se consulta desde Cliente Passenger.** Para el remitente se requiere un GET distinto con JWT Passenger/propiedad `sender_id` y un DTO propio mínimo, todavía **NO aprobado ni desplegado por A**.

## Código ejecutable B

- `apps/movete-cliente/src/domain/sender-custody-flow.mjs` y `.d.mts`: lectura de custodia **deshabilitada por defecto** salvo `enabled`, `contractCertified`, `stagingRuntimeVerified` y callback separado `readOwnDelivery`. Revalidación de sesión Passenger, JWT, revisión y cuenta antes/después de lectura; doble GET bloqueado, logout y respuestas antiguas descartadas. Sin GPS, ETA, teléfonos, dirección, medios de pago, datos de Driver o `proofRef` en snapshot.
- DTO QA **candidato B**, no sustituye contrato A: `mode:'STAGING_DEMO_ONLY'`, `deliveryId`, `ownerId`, `state`, `revision`, `vehicleKind:'AUTO'|'MOTO'`, `assignmentPersisted`, `proofVerified`, `qaOnly:true`, `productionEnabled:false`, `liveDeliveriesEnabled:false`. Se niegan campos extra, otros titulares, etapas sin asignación, entrega final sin `proofVerified:true`, o revisión más vieja. `proofVerified:true` se acepta **únicamente si el propio backend autorizado lo afirma después de consultar su autoridad independiente**, nunca un booleano introducido por el teléfono.
- `client-experience.mjs` y `.d.mts`: `senderCustodyOptions`, método `readOwnDeliveryCustody(deliveryId)`, snapshot `senderCustody` sin PII. El método comprueba que el `deliveryId` exista **en un historial propio Passenger válido, vigente y de tipo DELIVERY**; nunca basta conocer el UUID. Logout limpia el estado y la revisión de JWT invalida resultados tardíos.
- `app/historial.tsx`: botón «Consultar custodia de mi envío» **solo** si el contrato está certificado y la sesión/historial/identidad coinciden al tocar. Texto accesible que diferencia «prueba independiente confirmada en QA» de «estado de entrega no verificado». Nada se presenta como prestación comercial.
- `sender-custody-flow.test.mjs`: **13 pruebas** de gates OFF, etapas G66, rol/cuenta ajena, sin persistencia ficticia, prueba de entrega falsa, timeout, doble consulta, revocación/logout, revisión vieja, PII y estados terminales.
- `client-experience.test.mjs`: **3 pruebas adicionales** de historial propio, ausencia de autorización sin historial, rechazo de prueba falsa y borrado en logout. **Total: 16 pruebas R62**.

## Qué no está certificado

La lectura funciona por callback QA inyectado y fixtures sintéticos. No existe un endpoint remitente aprobado/desplegado, ni permiso comercial, ni G66 Driver en producción, ni fuente independiente de comprobantes aprobada para uso real. El gate G61 `DELIVERY_MERCHANTS` sigue **BLOCKED/NO_GO**. No declarar «entregado» para clientes reales sobre el booleano suministrado en una prueba sintética.

## Coordinación y exigencia a Arquitecto A

Se requiere **GET sender-owner** respaldado por DB `sender_id=JWT.subject` y G42 revocación, verificación de roles exclusiva, contrato OpenAPI de estado/revisión/prueba no sensible, servicio de pruebas de entrega G67 con retención/cifrado/auditoría y protección contra uso de UUID ajeno. Validar QA con dos roles sobre la **misma fila persistida** (sender → courier pickup → comprobante independiente → delivered), sin filtrar ubicación ni teléfono. Solo después E2E físico Android/iOS bajo STAGING autorizado.

## CI y continuidad

Para declarar **R62 QA PASS** los tres workflows del **mismo SHA final** deben concluir SUCCESS: B ownership, Admin QA, aislamiento Cliente/Driver (tests, TypeScript, Expo export web). Documentar cualquier fallo sin disfrazarlo. A/B mantienen ramas exclusivas, NO MERGE/NO LIVE/NO DEPLOY/NO PSP, 17 gates G61 permanecen NO_GO.

Siguiente R63 P0: conectar contratos definitivos de historial+envíos+tracking con servidor HTTP autorizado por A, probar recuperación de red y terminal delivered/rejected en dos dispositivos sintéticos. Antes de ello no inventar URLs ni certificados reales.

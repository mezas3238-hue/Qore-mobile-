# QORE Mobile / Movete Fácil — Arquitecto B R59: reparación de errores, desbloqueo G63 y matriz P0

**Fecha:** 24 octubre 2026 · **Repositorio:** `mezas3238-hue/Qore-mobile-` · **Rama:** `feature/mobility-cliente-admin-parallel-20261022` · **PR #8 DRAFT; no merge, LIVE ni despliegue.**

## 1. Estado verificado de fallos concretos

- **A / Driver G63 corregido** en su rama soberana `feature/mobility-monorepo-isolated-20261016`. Commit `c12c3daa5844c19cc76da2d4d569a056f5d1b4f5`, **4/4 workflows SUCCESS**: PostgreSQL #40106765350, Node STAGING #40106765357, Expo #40106765364, two-app isolation #40106765348. Los siete fallos G63 observados al integrar R58 antes de esta actualización no justifican editar código A desde rama B. La nueva integración PR B requiere CI de **SHA posterior**.
- **B / R58 Cliente**: el último corte `694374dedcff90b6c5ed725233276b6ad6fd0d36` aprobó suites, TypeScript y Expo export web Cliente, B ownership y Admin QA. El workflow integrado falló por G63 en Driver de A, ahora resuelto en el HEAD verificado de A. Revalidar con commit nuevo en B para obtener 3/3 en el mismo SHA.
- **B / R59 código correctivo**: `apps/movete-cliente/src/domain/client-mutations.mjs` antes copiaba directamente `reply.code` del gateway HTTP/conciliación a `state.error` y por ende a `ClientSnapshot.mutation.error`, potencialmente revelando texto privado, caracteres de control, secretos o HTML al cliente y haciéndolos llegar a avisos o diagnósticos. Ahora `SAFE_CODES` es una lista cerrada de códigos de protocolo; cualquier entrada desconocida o no-string se convierte en `REQUEST_REJECTED` (envío) o `BOOKING_RECONCILIATION_UNKNOWN` (consulta). Desconocidos **no se reintentan**; se mantiene la prohibición de otro POST de reserva después de ACK incierto.
- **B / R59 regresiones**: cinco pruebas nuevas en `client-mutations.test.mjs` verifican rechazo de strings maliciosos, token/teléfono incrustados, entrada de tipo incorrecto, conservación de códigos legítimos, estado fail-closed sin POST repetido y respuesta de conciliación desconocida sin filtrar PII.

## 2. Matriz de problemas pendientes reales para lanzar

El registro del Arquitecto A `docs/architecture/MOVETE_FACIL_LAUNCH_GATES_2026-10-24.json` sigue **NO_GO (17 P0)**. Estos no se resuelven con una suite Node o exportación web; cada uno requiere una evidencia distinta de backend, dispositivo, seguridad o aprobación.

| Prioridad | Gate(s) P0 de lanzamiento | Responsable | Evidencia necesaria |
|---|---|---|---|
| P0-1 | `IDP_BACKEND_AUTH`, `HTTPS_BACKEND` | A | IdP + JWT/JWKS y roles verificados en servidor, dominio HTTPS accesible desde dos teléfonos, autorización STAGING de Owner |
| P0-2 | `POSTGRES_PERSISTENCE`, `CLIENT_LIVE_BOOKINGS` | A+B | persistencia real, recibos tipados OpenAPI, GET conciliar por requestKey, pruebas timeout/comisión/carrera con Client y servidor |
| P0-3 | `DRIVER_ONBOARDING`, `DRIVER_LIVE_TRIPS` | A | documentos KYC verificables, conductor elegible, aceptación→inicio→fin real con GPS y revocaciones |
| P0-4 | `DELIVERY_MERCHANTS`, `CHAT_PHYSICAL` | A+B | catálogo/orden/stock/custodia y chat asignado Passenger↔Driver con mensajería confirmada en dos dispositivos |
| P0-5 | `PAYMENT_SETTLEMENT` | A+B | proveedor PSP aprobado y ledger de cobros, liquidaciones, comisiones, cancelaciones y reembolsos idempotentes |
| P0-6 | `PRIVACY_KYC`, `EMERGENCY_SAFETY` | A+B | cifrado, acceso/retención documental, SOS físico y escalado a operadores con protocolo verificado |
| P0-7 | `MAPS_GPS_DEVICE`, `NATIVE_RELEASES` | A+B | permisos y GPS real, reconnect, anti-manipulación, builds Android/iOS firmados y pruebas físicas |
| P0-8 | `ADMIN_OPERATIONS` | B | Admin con Auth real por permisos, KYC, incidentes, zonas, soporte, historial y auditoría E2E |
| P0-9 | `LEGAL_COMPLIANCE`, `OPS_24_7_MONITORING`, `PROD_GO_NOGO` | Owner+A+B | permisos/seguro/términos Paraguay, alertas/on-call, presupuesto, aceptación de riesgos y autorización Owner inequívoca |

**Nota:** la tabla es un **plan de resolución**, no evidencia de GO. Cada gate continúa en su estado oficial hasta publicar actas o CI y pruebas E2E de su área. Solo Owner puede aprobar merge/despliegue/PSP/LIVE.

## 3. Secuencia crítica de aceleración

1. **A** entregar schemas y GET de conciliación de booking, IdP y HTTPS STAGING aprobado con persistencia y trazas de autorización; no inventar una URL desde B.
2. **B** cablear circuitos Cliente real solo contra esos DTOs verificados, una misma `requestKey` por intento, sin duplicar POST después de ACK perdido.
3. **A+B** probar dos cuentas sintéticas y dos dispositivos: Cliente POST → persistencia → oferta Driver → aceptar/rechazar → tracking/cancelar → chat/pedido; registrar tiempos y errores sin PII.
4. **B** completar Admin real; **A+B** validar KYC, pagos y seguridad; **Owner** autorizar ámbito legal y plan operativo.
5. Certificar APK/AAB y IPA nativos antes de considerar publicación o Lovable final; no confundir Expo export web con build instalable.

## 4. Continuidad

R59 debe certificar **el mismo SHA final** en Architect B ownership, Admin QA y two-app isolation (Cliente y Driver). Una CI verde no corrige los 17 gates externos. PR #7 y PR #8 siguen DRAFT; nunca tocar archivos A desde rama B. Siguiente R60: integrar y probar contratos de backend autoritativos **solo si A los publica**; si no, priorizar pruebas de seguridad y cierre de gates Cliente/Admin en sus archivos.

# QORE Mobile — Arquitecto B R66: invariantes de estados de custodia G5/G68/G69

**24 octubre 2026 / PY · PR #8 DRAFT · NO MERGE / NO LIVE / NO DEPLOY / sin PSP / sin datos reales.**

## Lectura real del HEAD A

- PR #7 HEAD observado: `744a7543bae8a63b12b347ca53f9424e25f4dcdb`.
- `G5_DELIVERY_CUSTODY_POSTGRES_CI_ONLY.sql` fue leído directamente para obtener la única secuencia autorizada: `requested→accepted→picked_up→delivered→disputed→returned`. `cancelled` solo procede de `requested` o `accepted`; el SQL incrementa revisión por transición. Consultas omitidas durante desconexión pueden saltar etapas, pero deben mostrar un incremento de revisión al menos igual al número de etapas saltadas.
- G68 (`g68-sender-custody-status-qa.mjs`) define GET exclusivo Passenger por `sender_id` y prueba G67; G69 (`g69-trusted-sender-read-qa.mjs`) añade puente **privado exclusivamente QA**, con atestación no expuesta al teléfono. Ni G68 ni G69 están desplegados en HTTPS productivo ni son fuente de datos reales.
- Último OpenAPI A inspeccionado: `1.0.0-g57`; no acredita la ruta G68 en un servidor montado.

## Código nuevo B

1. `apps/movete-cliente/src/domain/sender-custody-flow.mjs`: `acceptedFloor` privado retiene última evidencia monotónica del mismo envío, incluso cuando una lectura posterior falla. El estado que ve Cliente se borra inmediatamente ante GET incierto; el piso de revisión no se borra hasta `clear()` (logout, pérdida del ancla de historial o sesión).
2. `compatible(previous,next)` niega revisión menor, revisión idéntica con DTO contradictorio, vehículo incompatible, estados anteriores y reapertura desde `cancelled`/`returned`; permite saltos hacia delante solo con suficiente incremento de revisión. Estados `delivered`, `disputed`, `returned` siguen exigiendo prueba independiente verificada en DTO G68 (sin mostrar `proofRef`).
3. `apps/movete-cliente/src/domain/r66-sender-custody-transition-fence.test.mjs`: 14 pruebas de SQL lifecycle, ausencia de red, prueba física no inventada, cambio de vehículo, múltiples revisiones, token/clear, fallo opaco y separación de envíos.
4. `apps/movete-cliente/src/domain/r66-g68-client-custody-sequence-integration.test.mjs`: 5 ensayos usando el verdadero compositor Cliente con un `fetchImpl` sintético inyectado por el adaptador HTTPS G68 opt-in de R65. Incluyen ciclo completo de estados, error 503, revisión repetida, cambio de cuenta y cancelación irreversible.
5. No se modificó backend A, Driver, PostgreSQL, OpenAPI, root, workflows ni configuraciones de despliegue. Sigue `enabled=false` por defecto.

## Condición de cierre

- Confirmar **3 workflows SUCCESS en el mismo SHA final de PR #8** (owner boundary, Admin Web QA, two app isolation que ejecuta tests/TS y web export). Si falla, inspeccionar logs y corregir.
- Esta evidencia es `QA_ONLY`: mocks/laboratorio no equivalen a teléfono, nube HTTPS, Auth/JWKS, PostgreSQL compartido, verificaciones de entrega presencial, firma nativa o auditoría externa. Se requiere backend A desplegado en STAGING aprobado, contratos sellados, E2E cross-role y equipos físicos para subir nivel.
- Si G5 futuro introduce una transición nueva, A debe versionar esquema y aportar prueba transaccional antes de que B actualice `compatible`; B no inventa estados/ETA o entrega real.

## Pendientes reales después de R66

A: publicar OpenAPI/GET G68 y puente G69 montado en HTTPS seguro, IdP y DB persistente sin credenciales cliente privilegiadas; evidencia G67 proof real, anti-IDOR y 2 dispositivos. B: con contrato autorizado, activar solamente entorno STAGING y certificar relectura after-delivery contra la misma transacción y revisión de DB; continuar KYC/commerce/booking mientras falta infraestructura. Owner debe aprobar infraestructura, pagos, despliegue y COMERCIAL_GO por separado.

**El proyecto sigue NO_GO: 17 gates P0 y 20 recorridos de negocio no certificados funcionalmente.**

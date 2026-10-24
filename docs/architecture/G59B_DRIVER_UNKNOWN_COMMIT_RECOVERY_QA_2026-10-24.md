# QORE Mobile — G59B / A48: recuperación del ACK Driver después de COMMIT incierto
**Fecha:** 24 octubre 2026 · Arquitecto A · PR #7 DRAFT · ambiente local QA, no LIVE ni deploy.

## Qué aporta
Paridad con el G59 Passenger certificado. El conductor puede perder la respuesta HTTP después de enviar un mensaje a un pasajero; no debe emitir otro `SEND` por ausencia de ACK, ni mostrar `serverStored:true` sin comprobante PostgreSQL.

**Ruta de código:**
- `G59B_DRIVER_UNKNOWN_COMMIT_RECONCILIATION_POSTGRES_CI_ONLY.sql`: función exclusiva del propietario de laboratorio `mobility_stage_g59b_reconcile_driver_owner_qa`, no ejecutable por `service_role` ni el rol delegado Driver. Exige Driver actual, G42 session lock, servicio/asignación activos, `requestKey` y texto exactos, y devuelve recibo de mensaje existente sin efectuar INSERT.
- `G59B_DRIVER_UNKNOWN_COMMIT_RECONCILIATION_ASSERT_POSTGRES_CI_ONLY.sql`: demuestra `SECURITY DEFINER`, `search_path` fijo, NO grants de lectores ajenos ni acceso a través de role gateway.
- `g59b-driver-uncertain-commit-race-ci.py`: PostgreSQL 16 real, dos tickets Driver `G56_SEND` válidos compitiendo por el mismo `requestKey`: exactamente un mensaje, dos ACK iguales, recuperación `G59B` de ese ACK sin alterar la revisión. Tras un mensaje Passenger posterior, la revisión histórica original permanece igual mientras `latestRevision` aumenta y `historyRefreshRequired` se activa. Casos adversariales: rol Passenger ajeno, sesión ajena, servicio equivocado, carga adulterada, Driver ya no asignado, revocación G42 concurrente y privilegios de rol.
- `g59b-driver-uncertain-commit-recovery-qa.mjs` y test: módulo privado Node, rol Driver exclusivo, identidad JWT externa inyectada, revocación y rate gate independientes, respuesta validada estrictamente.
- Workflow PostgreSQL disposable incorpora G59B después de G59; Node Contracts se ejecuta por `*.test.mjs`.

## Protocolo del cliente móvil
1. Ante `G58E_OUTCOME_UNKNOWN` conservar `requestKey`, `conversationId`, servicio y texto original; marcar la operación `RESULTADO_INCIERTO` localmente, no `enviado`.
2. Cuando exista un futuro backend autenticado, pedir consulta autoritativa de recibo. `state=COMMITTED` permite mostrar el ACK **exacto almacenado**.
3. `NOT_YET_OBSERVED` obliga a reconsultar con backoff; **NO significa rollback y NO autoriza automáticamente un segundo SEND**.
4. `latestRevision` posterior a la `ack.revision` original exige actualizar historial por G52/G56. No deducir lectura de pantalla ni modificar marcadores G57/B.
5. Si cambió el conductor asignado, sesión o proveedor, negar incluso el recibo. No revelar chats a un Driver anterior.

## Estado de producto real
Este QA prueba lógica SQL/Node con participantes sintéticos en PostgreSQL16 local. **No** existe servidor HTTPS ni proveedor JWT real conectado a este emisor, API pública autenticada, teléfono físico integrado ni confirmación de mensaje por push/OS. No autoriza producción.

## Próximo G60
Construir pantalla de mensajes Driver en su propia app `apps/movete-driver/**` y conectar adaptadores exclusivamente después de contratos de servidor realmente implementados, Auth de proveedor, pruebas físicas y autorización; en laboratorio mantener render fail-closed. Cliente/Admin del Arquitecto B intocables. Coordinar contrato por issue #9.

# QORE Mobile G67/A56 — prueba de entrega atómica contra G5
**Arquitecto A · 24 oct 2026 · PR #7 DRAFT · SOLO PostgreSQL16 desechable y Node QA · no producción**

## Amenaza corregida (P0)
El RPC heredado `mobility_stage_delivery_transition(deliveryId,courierId,'deliver',eventKey,proofRef)` de G5 comprobaba si `proofRef` era UUID no nulo, pero **no comprobaba procedencia, sesión, expiración ni si realmente existía una prueba**. G66 añadió un callback Node `verifyIndependentProof` antes de llamar al RPC, pero por sí solo existe una brecha temporal *check/use*: un proof podría revocarse o expirar antes del COMMIT o un llamante legado con privilegios del RPC podría saltarse ese callback.

**G67 agrega un trigger de cumplimiento general al UPDATE del estado de custodia**: incluso el RPC G5 antiguo queda obligado a presentar un comprobante atestado y no revocado, asociado al mismo courier/entrega, y a bloquear prueba + sesión G42 hasta finalizar la transacción. No confiar en booleanos `proofVerified` de UI ni confiar en un UUID válido como acreditación.

## Cambios implementados
1. `apps/mobility-expo/docs/backend/staging_only/G67_DELIVERY_PROOF_ATOMIC_FENCE_POSTGRES_CI_ONLY.sql` — aborta fuera de `qore_disposable_chain`, `application_name=qore_ci_disposable_chain` o con schema incompleto. **NO EJECUTAR en Supabase ni staging remoto.**
2. Tabla `mobility_stage_g67_delivery_proofs` con `proof_ref` UUID, `delivery_id`, `courier_id`, `session_id`, `token_iat_ms`, SHA-256 del contenido **sintético**, MIME/bytes acotados, atestación `QA_SERVER_ATTESTED_NO_CONTENT`, timestamp, TTL máximo 15 min, `revoked_at`, `consumed_at`, revisión. RLS habilitada, **sin acceso a anon/authenticated/service_role ni gateways**. Un único proof activo por delivery, tras revocación se puede reemplazar sin recuperar la prueba antigua.
3. `mobility_stage_g67_register_proof_owner_qa`: solo ejecutable por propietario del laboratorio; comprueba sesión G42 en la transacción y custodia `picked_up` del courier. No hay emisión desde el teléfono, browser, ni un proveedor real de imagen/KYC.
4. `mobility_stage_g67_revoke_proof_owner_qa`: no se puede revocar un comprobante ya consumido tras entrega; permite reatestación tras rechazo previo. Un `proofRef` revocado nunca retorna a estado verificable.
5. `mobility_stage_g67_enforce_delivery_proof`: trigger `BEFORE UPDATE OF status,proof_ref` para cualquier `picked_up→delivered`. Bloquea la evidencia `FOR UPDATE`, coteja actor/entrega/vigencia/revocación/consumo, toma `mobility_stage_g42_lock_session` bajo la misma transacción, consume `proof` con `consumed_at`. El RPC G5 inserta después su evento en la misma transacción; si falla la inserción, **se revierte también el consumo del proof, la actualización del servicio y la liberación del slot G36**.
6. `mobility_stage_g67_proof_verified_owner_qa`: solo lectura de propietario que verifica proof activo para `picked_up` o consumido realmente por un servicio `delivered/disputed/returned` ligado al mismo proof; nunca afirma que una imagen auténtica fue revisada en la calle.
7. `G67_DELIVERY_PROOF_ATOMIC_FENCE_ASSERT_POSTGRES_CI_ONLY.sql`: comprueba RLS, rol, EXECUTE mínimos, trigger habilitado, `SECURITY DEFINER` y `search_path` cerrado.
8. `apps/mobility-expo/server/g67-delivery-proof-atomic-race-ci.py`: crea fixtures sintéticos solo en local, restaura los triggers después de prepararlos y prueba UUID falso incluso desde el RPC legado, denegación de actor/sesión, rollback si el evento G5 falla, prueba revocada y reemplazada, carrera de dos conexiones y revocación G42 mientras otra conexión sostiene COMMIT. No puede usarse para inferir seguridad física del suministro.
9. `apps/mobility-expo/server/g67-courier-proof-authority-qa.mjs` y test: operador privado de consulta de prueba sintética atestada, ligado a usuario/sesión y rol exclusivo, sin exposición de bytes, foto, hash, nombre, teléfono, JWT ni datos de remitente. **No registra evidencias reales** ni habilita `obtainVerifiedProof` por defecto.

## Criterios y pruebas
- GitHub: PostgreSQL16 disposable, Node STAGING, Expo y aislamiento de dos apps: cada uno **SUCCESS en el mismo SHA funcional**; ante un fallo inspeccionar logs, corregir y repetir.
- El flujo G66 Driver `deliver` **permanece deshabilitado por defecto** porque `obtainVerifiedProof:null` y `runtime=null` en la composición de producción. No introducir una imagen simulada para levantar el gate.
- G67 extiende el cierre SQL incluso cuando código G66 Node sea omitido accidentalmente. Las pruebas QA están aisladas y no significan que haya almacenamiento verdadero de medios.
- Registros nuevos con hash/fecha son evidencia de **integridad y asociación sintética**, no un aval pericial de que alguien efectivamente recibió el paquete.

## Pendientes críticos después de G67
**G68 inmediato:** ruta **Passenger/sender-owner** separada de G66 Driver para seguimiento de estado de su envío en el Cliente de B R62. Filtrado SQL `id=deliveryId AND sender_id=JWT.subject`, session G42, rol Passenger exclusivo, revisión y `proofVerified` vinculado a G67; DTO mínimo sin `proofRef`, Courier ni PII. Coordinar schema con B mediante issue #9.

**Integración real G69+:** proveedor externo de Auth/JWKS, almacenamiento cifrado de foto/documento de entrega y antimalware, retención legal, método de verificación de receptor, dispositivos físicos Android/iOS y HTTPS STAGING bajo aprobación Owner. En la implementación real no conservar `QA_SERVER_ATTESTED_NO_CONTENT`: sustituir con firmas del proveedor y verificación de bytes/custodia; no trasladar directamente migraciones CI-only.

**Límites:** no MERGE, LIVE, VPS, secretos, datos personales reales, push ni PSP sin orden Owner. Dos apps nativas separadas Driver/Cliente y Admin Web solo B. Los 17 gates comerciales siguen NO_GO.

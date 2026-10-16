# Continuidad de ingeniería — G0/G1 — 2026-10-16

## Acción G0 realmente aplicada
- Se trasladan los blobs originales de movilidad del HEAD PR #3 `e06f110...` a `apps/mobility-expo/` en una rama nueva **desde main**, sin escribir en PR #2 ni editar `main`.
- Workflows ROOT separados (`.github/workflows/mobility-ci.yml`). Antiguo `.github/workflows/ci.yml` de Expo NO copiado a raíz.
- `docs/adr/0010-two-product-isolation.md` explica estrategia de monorepo, aislamiento de seguridad y criterios de revisión.
- La fuente de movilidades PR #3 se conserva como borrador/historia hasta confirmar paridad y proceso de merge.
- Se agregan tests de validación pasajeros/registro auto y bloqueo runtime de viajes, además de un guard CI que verifica los package IDs y `LIVE_TRIPS_ENABLED=false`.
- No se han hecho modificaciones en Supabase, entorno Lovable, pasarela, mapas ni dispositivos físicos.

## Inspección del backend Lovable (read only)
- Proyecto ID `2fa91fe1-e7a0-4fff-a16f-7d457b2d6eed`, no publicado; backend Supabase habilitado.
- Consulta de `information_schema.columns` confirma tablas `driver_applications`, `profiles`, `user_roles`, `vehicles`, `rides`, `fare_configs`.
- `vehicles`: `category` enum sin `vehicle_type`, sin `insurance_verified`; `rides`: `driver_id` pero sin `vehicle_id`, sin versión de tarifa, sin quote_id.
- Consultas adicionales pg_policies/pg_proc quedaron **NO EJECUTADAS**: límite de acciones SQL del plan gratuito de Lovable, respuesta indicó reintentar en 44 minutos. No afirmar RLS segura por esta inspección.
- NINGUNA consulta SQL mutó datos ni leyó datos privados de usuarios.

## Próximo trabajo prioritario G1 (pendiente / sin afirmar completado)
1. Recuperar permisos de consulta y crear SNAPSHOT de RLS, SECURITY DEFINER, grants y migraciones reales del backend; revisar tablas/índices/roles y bucket privado.
2. Preparar entorno Supabase **staging separado** con URL/key publicable propia; verificar confirmación correo, signup/login/logout/revocación, perfiles y roles.
3. E2E con dos pasajeros, dos conductores AUTO, vehículos y admin asignado mediante servidor; probar RLS de aislamiento y prohibición de autopromoción; documento privado.
4. Solo después preparar migración additive vehicle_type AUTO/MOTO, service_category moto_pasajero, vehicle_id y verificación de documentos/seguros por autoridad local.
5. No habilitar categoría comercial moto ni viajes/cobros. FairPrice en UI es hipótesis; 15% en fare_configs Supabase es seed, no precio de producción.
6. Validar en CI rama de este PR, y test Android/iOS físicos por separado; export web NO certifica SDK nativo.

## Puertas no satisfechas
Legalidad remunerada moto por municipio, póliza comercial por categoría, verificación KYC, provisión PSP/QR, rutas Google Routes server-side, RLS, replay/idempotencia, ledger reconciliable, SOS operativo y pilotos.

## Actualización de progreso del arquitecto — 2026-10-16

### Commits posteriores
- `017e5c4f4db3b156e911c7a25b0b0fb09de47b3b`: `src/domain/vehicle-eligibility.ts`, 8 casos de test para AUTO/MOTO, seguros, dos cascos, licencia, inspección, consentimiento y GPS fresco; y `scripts/staging-auth-readonly.mjs` para comprobar lectura RLS entre dos cuentas en **staging exclusivamente**. CI push 38853315755 y PR 38853320224 PASS.
- `34833296981616ed102f9af9e94914cf4068fedc`: corrige subida de licencia (detecta JPG/PNG básico, extensión y MIME concordantes, límites de tamaño); pruebas nuevas `license-evidence.test.ts`. CI push 38853517590 y PR 38853522901 PASS.
- `29869c761b29999649f7743c225853cd70dfc45b`: rescata el SQL inicial de Lovable desde `drizzle/migrations/0000_migration.sql` a **docs/backend/LOVABLE_DRIZZLE_0000_REFERENCE_DO_NOT_APPLY.sql**; documenta auditoría estática y queries read-only de metadatos. NO se ejecutó SQL migratorio ni se modificó Supabase.

### Verificación CI del otro producto
Consulta HEAD PR #2 `4608aeb2519262cef42f722b43caffdfd455701b`: los últimos workflows **Security Gate**, **Android Production Bundle**, **Android Direct Install APK**, **Gateway CI**, **Mobile CI** aparecen SUCCESS (runs 36805264885, 36805264946, 36805264891, 36805264929, 36805264886). Son resultados históricos propios de ese HEAD y NO validan un merge conjunto. La comparación de filenames entre PR #2 (192) y PR #7 (60 antes de esta actualización) mostró **0 rutas superpuestas**. Ambos PR siguen DRAFT sin merge.

### Riesgos nuevos P0 del SQL del backend
- `accept_ride` no comprueba `vehicles.category == rides.category` ni póliza/licencia/inspección/vehicle_id; no activar despacho.
- `admin_review_driver` asigna driver tras rol admin sin evidencias persistidas de seguro/licencia; `submit_driver_application` admite ruta documento nula.
- `driver_locations` y `get_nearby_requests` no verifican GPS fresco; existe riesgo de entregar posición obsoleta.
- Requiere verificar contra **pg_catalog real**, pues el snapshot de Lovable no demuestra migración aplicada. Query directa limitó cuota por 44min; no está auditada RLS en vivo.

### Próximos gates
1. G1: staging separado y aprobación de fixtures para ejecutar `scripts/staging-auth-readonly.mjs` sin tocar datos reales; confirmar RLS, funciones, policies storage y esquema actual. Validar signup/logout, roles/admin, documentos privados y retiro de consentimientos.
2. G2: vehículo concreto + licencia + cobertura para pasajeros remunerados y municipio con verificación server-side; migración auto/moto **propuesta**, sin activar hasta revisión.
3. G3/G4: Google Routes y ETA pickup auténtica en servidor, price quote versionado, matching anti carreras y GPS seguro; `LIVE_TRIPS_ENABLED=false`.
4. G5/G6: PSP/QR en sandbox, ledger de doble entrada, liquidaciones, atención incidentes y pólizas; legal/seguro previo a piloto.

**No confundir cobertura de pruebas puras con certificación de operación.**

## Segunda ronda — Seguridad backend G1, 2026-10-16 (hora PY)
**RESULTADO VERIFICADO EN LA BASE SUPABASE DE LOVABLE:**
- Proyecto `2fa91fe1-e7a0-4fff-a16f-7d457b2d6eed`, ref `qdqrlgzlotnfdxzpacxs`. No se creó ni configuró un proyecto STAGING independiente.
- Lectura pre-migración: 0 perfiles, 0 solicitudes de conductor, 0 viajes, 0 viajes activos. Todas las 10 tablas públicas tenían RLS habilitada; índices contra viajes simultáneos y políticas del bucket documentos observadas en `pg_catalog`/`pg_policies`.
- Verificación de grants antes del cambio: 8 RPC operativas autorizaban `authenticated`; `has_role`, `is_approved_driver` y `handle_new_user` autorizaban PUBLIC/anon.
- Se creó y aplicó exitosamente la migración reversible `supabase/migrations/20261016192600_p0_lockdown_trips_and_roles.sql` a la **base Lovable existente**, sin insertar, borrar ni editar datos de usuarios o viajes. Transacción `BEGIN/COMMIT` y comprobación previa de ocho funciones. Las RPC request/accept/advance/cancel/availability/nearby/counterpart/rating siguen existiendo pero inaccesibles a anon/authenticated.
- **Verificación post-aplicación con `has_function_privilege`: 8/8 denegadas para anon y authenticated; `submit_driver_application` y `admin_review_driver` conservaron permiso authenticated; 3 helpers denegadas para anon. La definición aplicada de `has_role` y `is_approved_driver` exige el propio `auth.uid()`.** Service_role conserva permiso de administración y no debe distribuirse.
- El CI inicial de los nuevos tests falló **2/40 por patrones de test incorrectos en funciones sin argumentos**; se corrigió regex y punto y coma PL/pgSQL antes de aplicar. CI posterior del commit `cb6cf33d439b8a3565efd30b0edb247d079d00ec`: [push SUCCESS](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/38976203904) y [PR SUCCESS](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/38976208465), **40/40 pruebas**, export web.
- Se agregó comprobación de claves públicas Supabase en cliente Expo (commit `88d11a5998b137b0eba1fb413ee24a64653670c7`): no acepta `service_role`/clave secreta en variables `EXPO_PUBLIC`; CI de este commit requiere verificación separada.

**Aún no verificado:** E2E con JWT de dos pasajeros, permisos de operaciones de administrador, email confirmado, recuperación, sesión en dos dispositivos, documentación conductor auto, STAGING independiente, validación legal/seguro. La revocación RPC es gate protectivo **y no equivale a certificar producción**. `LIVE_TRIPS_ENABLED=false` sigue intacto. PR #2 Flutter trading sigue separado y sin cambios.

**Siguiente acción inequívoca:** provisionar STAGING Supabase *diferente* del ref `qdqrlgzlotnfdxzpacxs`, instalar esquema mediante migraciones revisadas y ejecutar `scripts/staging-auth-readonly.mjs` con dos cuentas precreadas de prueba. NO utilizar el proyecto Lovable existente para esas credenciales de prueba hasta confirmar segmentación. Luego preparar registros conductor AUTO y moto con aprobación server-side y snapshots seguros.

## Cierre técnico de la segunda ronda — seguridad documentación / CI
1. **CLIENTE seguro:** `src/domain/supabase-public-config.ts` rechaza `service_role`, `sb_secret_*`, JWT autenticado y URL insegura en variables `EXPO_PUBLIC_*`. GitHub tests y typecheck verificados en commit `88d11a5998b137b0eba1fb413ee24a64653670c7`.
2. **ARCHIVOS de licencia:** Se inspeccionó bucket privado `driver-docs` con `file_size_limit=5242880` bytes, `allowed_mime_types=NULL`, 0 objetos. Código móvil ahora exige máximo 5 MiB y JPG/PNG, tanto en selección como en envío. La migración `20261016195200_private_license_mime.sql` para restringir MIME del bucket **ESTÁ ESCRITA, PERO NO APLICADA**. Intento de ejecución rechazado por cuota del plan gratuito Lovable (respuesta indicó reintentar tras 49 min); el proveedor afirmó explícitamente "This query wasn't executed". **No declarar MIME bucket protegido hasta reejecutar y verificar.**
3. **CI VERIFICADO:** commit `66dd2923954887edf25f85db09462b70d07e9996`, GitHub Actions [push 38976844877 SUCCESS](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/38976844877), [PR 38976849307 SUCCESS](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/38976849307), **46/46 unit tests PASS, TypeScript PASS, LIVE guard PASS, web export PASS**. Un commit previo (7e490b17) falló 1 test por texto de mensaje asertado desactualizado; corregido y revalidado en 66dd292.
4. **No se hicieron pruebas reales de carga/lectura storage ni JWT de otros usuarios.** Las verificaciones de función SQL `has_function_privilege` confirman que las 8 RPC operativas permanecen denegadas a anon/authenticated tras la primera migración aplicada; no hay servicio comercial habilitado.
5. **SIGUIENTE TRABAJO:** al restaurarse cuota, aplicar `20261016195200_private_license_mime.sql` solo si el bucket sigue privado, vacío, 5 MiB; verificar `allowed_mime_types` = JPEG/PNG, sin publicar. En paralelo, crear STAGING separado para confirmar Auth/RLS y registros con dos usuarios de prueba. Mantener PR #7 draft y Flutter PR #2 intacto.

## Tercera ronda — G2 vehículos AUTO/MOTO y verificación jurídica
**El PR #7 sigue en DRAFT; app Flutter trading en PR #2 intocable.**
- Se volvió a intentar inspección del bucket `driver-docs`; Lovable respondió cuota superada, "This query wasn't executed", reintentar tras ~43 min. **Migración `20261016195200_private_license_mime.sql` sigue NO APLICADA.** No inferir que JPEG/PNG ya estén limitados server-side.
- Se diseñó esquema **solo para staging**, ubicado deliberadamente fuera de `supabase/migrations`: `docs/backend/staging_only/G2_AUTO_MOTO_COMPLIANCE_DO_NOT_APPLY_PRODUCTION.sql`. Introduce tipos AUTO/MOTO/servicio, inventario por conductor, certificación licencia/seguro remunerado/inspección/permiso municipal/casco/chaleco. Usuarios autenticados solo pueden LEER sus registros de inventario; no conceder INSERT, UPDATE, DELETE ni autoaprobación; las certificaciones quedan restringidas a service_role. **No se aplicó ninguna tabla G2 a Supabase real**; no hay backend de aprobación/dispatch G2.
- `src/domain/vehicle-assignment.ts` evalúa una propuesta pura vinculada a rideId, vehículo concreto, conductor autenticado, propietario, categoría y versiones con TTL corto; **NO es transacción**, no bloquea carrera, no genera viajes ni sustituye chequeo server-side. Tests adversariales incluyen suplantación, persona ajena, doble asignación, póliza vencida, GPS obsoleto y MOTO incompatibles.
- `src/domain/vehicle-onboarding.ts` prepara solicitudes de AUTO y MOTO en estado `pending`; exige documentos seleccionados y validación separada de cascos/chalecos, pero **no acredita autenticidad y no está conectado a formulario/envío backend**. No habilitar MOTO en UI comercial hasta registro/app/servidor/ley comprobados.
- Investigación jurídica `docs/legal/PY_MOTO_SERVICIO_PASAJEROS_G2_2026-10-16.md` con BACN Ley 5016 arts. 72 y 76, MOPC y trámites Municipalidad de Asunción: moto máximo 2 ocupantes, acompañante menor de 12 prohibido, casco y chaleco reflectivo para ambos. El código puro exige 2 chalecos, 2 cascos, afirmación de verificación 12+, ruta habilitada; necesita atribución y comprobación en servidor (no basta cliente). **No se confirmó permiso comercial de mototaxis por app, específico de cada municipio.**
- Pruebas estáticas G2 detectan concesiones peligrosas y mezcla AUTO/MOTO, pero NO equivalen a SQL ejecutado en staging ni certifican RLS.
- Próximas tareas G1/G2: esperar cuota para aplicar/re-verificar MIME del bucket privado; provisionar STAGING Supabase separado; probar Auth/RLS/roles/storage con JWT; terminar backend de registro y revisión auditable, tablas territoriales de habilitación, seguro remunerado, restricción infantil/seguridad sin datos de menores excesivos; añadir referencia vehicleId + snapshot de asignación en transacción serializable; solo entonces planificar piloto sujeto a aprobación legal y garantías.
- CI de la tercera ronda: consultar último run del HEAD PR #7 antes de declarar tests aprobados (pruebas anteriores 46/46 en commit 66dd292).

## Cuarta ronda — G1 staging aislado y G2 pruebas PostgreSQL reales
**Estado al 2026-10-16 (última ronda):**
- **Proyecto Lovable STAGING creado:** https://lovable.dev/projects/9c677bb2-746b-419f-ad9c-dd6d26bab944 (ID `9c677bb2-746b-419f-ad9c-dd6d26bab944`). Agente completado; no publicado, pantalla `STAGING — NO LIVE`, registro público y servicios apagados. **Supabase no provisionado:** `get_database_status.enabled=false` y `enable_database` bloqueada por cuota Lovable. No afirmar que staging DB exista ni que E2E JWT ejecutó.
- **Backend viejo protegido:** ocho RPC operativas sin EXECUTE público/authenticated (verificación G1 anterior); `LIVE_TRIPS_ENABLED=false`. MIME driver-docs JPEG/PNG sigue PENDIENTE: Lovable rechaza la SQL por cuota, transacción no ejecutada.
- **Nuevo CI PostgreSQL 16 REAL en entorno efímero:** `.github/workflows/mobility-ci.yml` job `g2-postgres-contract` levanta PostgreSQL desechable, ejecuta `scripts/sql/g2_postgres_smoke.sql` con esquema AUTO/MOTO, roles ficticios, políticas RLS, grants, regresiones operativas y controles positivos/negativos. Esto **sí prueba SQL ejecutable en PostgreSQL**, no RLS aplicada en Supabase.
- **G2 preflight server-only, staged:** `docs/backend/staging_only/G2_SERVER_PREFLIGHT_DO_NOT_APPLY_PRODUCTION.sql`. Exige licencia/seguro remunerado/inspección/habilitación vigente, revisores admin, driver en rol driver, GPS disponible/fresco con consentimiento registrado por servidor. RPC `SECURITY INVOKER` exclusiva de `service_role`, sin vía comercial. **MOTO explícitamente falsa** porque carece certificación municipal + señal independiente de edad/ruta.
- **G2 revisión de vehículos staged:** `docs/backend/staging_only/G2_REVIEW_AUDIT_DO_NOT_APPLY_PRODUCTION.sql`. Función de admin privado vía gateway (caller solo service_role), revisión atómica con bloqueo fila, revisión de evidencia, clave idempotente, revision, auditoría sin permiso update/delete al servicio. Rechaza auto-revisión por conductor y **rechaza aprobación comercial MOTO**. Solo diseño SQL ejecutado en PostgreSQL CI, NO desplegado a Lovable.
- **Resultado PostgreSQL CI verificado:** run `38979413844`, logs: `PASS: PostgreSQL G2 AUTO/MOTO schema, deny-by-default RLS and preflight test.` y `PASS: G2 admin-only audited review, idempotency and MOTO commercial freeze.`. Antes, run `38979203367` exitoso para gates de preflight.
- Documento operacional de esta ronda: `docs/backend/STAGING_G1_G2_POSTGRES_2026-10-16.md`.
- Próximo: habilitar DB aislada cuando se renueve cuota, confirmar ref diferente de Lovable anterior `qdqrlgzlotnfdxzpacxs`, copiar esquema revisado a ese staging, ejecutar JWT/RLS/Storage adversarial, integrar gateway servidor; NO abrir operaciones ni tocar Flutter trading del PR #2.

**Separación de conceptos:** G2 validó SQL sintáctico y permisos localmente, pero NO completó staging remoto ni autorización legal/comercial. Web export ≠ prueba Android/iOS físicos.

## Actualización cierre cuarta ronda — Intake vehículos pendiente y PostgreSQL G2
- La propuesta de staging se completó hasta **intake, preflight y review**, en tres archivos separados de `docs/backend/staging_only`: `G2_APPLICATION_INTAKE_DO_NOT_APPLY_PRODUCTION.sql`, `G2_SERVER_PREFLIGHT_DO_NOT_APPLY_PRODUCTION.sql` y `G2_REVIEW_AUDIT_DO_NOT_APPLY_PRODUCTION.sql`.
- **Intake:** tabla `mobility_vehicle_applications`, siempre pending/evidence_unverified; `mobility_submit_vehicle_draft` solo service_role con identidad extraída por futuro gateway, idempotencia UUID, validación AUTO/MOTO/capacidad y RLS de lectura propia/admin. Clientes NO pueden INSERT ni llamar a la RPC directamente. Conductor/pasajero no ganan rol `driver` o aprobación por registrarse.
- **Preflight:** únicamente service_role con verificación server-side de rol driver, estado aprobado, póliza comercial, permiso, vencimientos, GPS fresco consentido; MOTO siempre FALSE hasta gates legales.
- **Review:** RPC de solo service_role, confirma revisor admin, bloquea fila, evidencia vigente, idempotencia, histórico con revision y auditoría sin permiso UPDATE/DELETE. MOTO siempre rechazada para aprobación comercial.
- PostgreSQL efímero 16 en CI **ejecutó con éxito** DDL y tres grupos de aserciones SQL; [PR run #38979762327](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/38979762327) SUCCESS sobre commit `4b6499afb807654a64ef7acc630cf3b5496103dd`. Se confirmó salida `PASS: G2 AUTO/MOTO pending-only intake queue, JWT RLS and idempotency.`.
- **IMPORTANTE** todos estos SQL se mantienen deliberadamente FUERA de `supabase/migrations`, sin desplegar a Lovable. La única DB remota de movilidad conocida sigue siendo la vieja con ocho RPC bloqueadas. Nueva Lovable STAGING creada pero sin Supabase por cuota. Bucket MIME sigue NO APLICADO.
- Próximo trabajo inequívoco: al habilitar BD STAGING nueva, automatizar implantación de SQL de staging + fixtures, pruebas JWT/storage, construir gateway seguro y firma/verificación legal, app conectada solo a test. Verificar últimos workflows del HEAD; no fusionar PR hasta gates.

## Quinta ronda — 2026-10-16: gateway Auth y STAGING Supabase ACTIVADO
**Aplicación Flutter trading PR #2 intocable; PR #7 continúa DRAFT.**
1. Se creó `server/g2-staging-vehicle-gateway.mjs` y pruebas `server/g2-staging-vehicle-gateway.test.mjs`, integradas en `mobility-check` workflow. Los endpoints propuestos para staging reciben solicitudes pending (AUTO/MOTO) y revisiones admin con **identidad de JWT validado remotamente** por backend; jamás aceptan IDs/roles/approved/verified client-supplied. `server/run-g2-local-staging-gateway.mjs` está diseñado para localhost 127.0.0.1 exclusivamente, **NO desplegado**, Supabase service-role sólo en variables server y ref != proyecto antiguo.
2. Esquema nuevo G1 `docs/backend/staging_only/G1_ISOLATED_SUPABASE_BASELINE_DO_NOT_APPLY_PRODUCTION.sql`: perfiles, roles, ubicación privada, signup trigger a `passenger` solamente, control `has_role` para propia identidad. No contamina Lovable backend viejo ni enum legacy. Se integró en PostgreSQL CI G1+G2; [PR #38981291543](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/38981291543) SUCCESS, y [gateway CI #38981153687](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/38981153687) SUCCESS.
3. **STAGING remoto SUPABASE HABILITADO:** proyecto Lovable `9c677bb2-746b-419f-ad9c-dd6d26bab944`; llamada a `enable_database` respondió `{"enabled":true,"stack":"supabase"}` tras esperar cuota. Verificación SQL read-only: base `postgres`, `auth.users` presente con **0 usuarios**, 0 buckets, **sin tablas public ni enums custom**, y `request_ride` legacy ausente. Es un entorno limpio separado de backend Lovable viejo. Aún no se extrajo ref público `*.supabase.co` propio del proyecto (settings devolvieron NULL).
4. Intento posterior de **APLICAR** la baseline G1 en nuevo proyecto fue RECHAZADO por cuota `"This query wasn't executed; retry in 2 minutes"`. **No hay migraciones remotas aplicadas a esta altura**. Ni users test Auth creados. Cuando se restablezca, aplicar migraciones staged revisadas, con guard de entorno limpio y verificar pg_catalog/RLS antes de dar G1 cerrado.
5. La migración de bucket MIME antigua sigue NO APLICADA. Las ocho RPC de viajes antiguas permanecen revocadas; cliente `LIVE_TRIPS_ENABLED=false`.
6. Runbook nuevo `docs/backend/STAGING_DEPLOY_RUNBOOK_G1_G2_2026-10-16.md`; documento de estado remoto `docs/backend/STAGING_G1_G2_POSTGRES_2026-10-16.md` actualizado. **No afirmar login/JWT E2E con usuarios reales, permiso comercial, pagos, moto lista ni Android/iOS certificados.**

## Actualización crítica G1/G2 — migraciones REMOTAS APLICADAS en STAGING aislado
- **Backend STAGING nuevo** `9c677bb2-746b-419f-ad9c-dd6d26bab944`: SQL read-only inicial confirmó 0 auth.users, 0 storage buckets, sin tablas públicas, enums ni RPC legacy. `enable_database` respondió `enabled=true`.
- **G1 instalado** en STAGING nuevo vía Lovable `query_database` con archivo `G1_ISOLATED_SUPABASE_BASELINE_DO_NOT_APPLY_PRODUCTION.sql`, respuesta `rows=[]`.
- **G2 instalado y postcheck ATÓMICO**: cuatro SQL `G2_*.sql` del directorio `staging_only` aplicados como un solo `BEGIN; guard; DDL; postcheck; COMMIT;`, tras verificar por SQL entorno limpio, trigger G1 presente y sin permisos inesperados. Respuesta literal de la consulta: `auth_users=0`, `public_table_count=9`, `client_can_insert_app=false`, `client_can_review=false`. POST de SQL hace rollback si tablas, RLS o grants no cumplen. En este sentido **G1/G2 DB remoto ya está instalado en el nuevo STAGING**.
- Migración G2 NO tocó backend viejo `2fa91fe1-e7a0-4fff-a16f-7d457b2d6eed`; ese backend tiene ocho RPC de viajes revocadas. Su `driver-docs` MIME todavía NO aplicado a la fecha de esta anotación.
- **G1/G2 operacional NO COMPLETO:** staging no tiene usuarios Auth ni fixture admin, falta ref público/anon key de ese staging, pruebas login/JWT cross-user, e integración del gateway local al backend. Código `server/g2-staging-vehicle-gateway.mjs` testado y solo loopback; sin endpoint real, clientes no pueden inscribirse hasta activar gateway seguro. MOTO comercial bloqueado siempre.
- Pruebas PostgreSQL CI [#38981291543](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/38981291543) PASS y gateway [#38981153687](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/38981153687) PASS. Ver `docs/backend/STAGING_G1_G2_POSTGRES_2026-10-16.md` por pre/post de despliegue real.

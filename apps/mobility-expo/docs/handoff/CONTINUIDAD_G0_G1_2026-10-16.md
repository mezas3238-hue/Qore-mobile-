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

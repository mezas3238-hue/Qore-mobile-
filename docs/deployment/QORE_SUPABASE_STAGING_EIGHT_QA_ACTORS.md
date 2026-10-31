# QORE Mobile — G277 STAGING Auth ocho identidades + Backoffice G27

Proyecto fijado: `mrjzxftsdxzepzbcuids`; PostgreSQL 17, Railway STAGING online (deployment `74ef0709-b1f5-4a08-bbfe-f091246225b0`). **NO LIVE, NO PSP, NO MERGE, NO DEPLOY.**

## Separación obligatoria de autoridad

- El trigger de Auth crea una fila nativa `passenger` para cada cuenta. Durante G251/G263, **solo el slot `owner_admin` elimina esa fila automática** para dejarlo sin roles nativos, pendiente G27.
- Resultado esperado del bootstrap: **8 Auth reales, 7 roles nativos** (4 Driver, 3 Passenger), **1 Admin pendiente sin privilegio**, 0 autorizaciones comerciales. La función real `mobility_stage_g27_backoffice_role_of` deniega Admin con cualquier fila nativa; no se debe asignar `user_roles(admin)` a ese slot.
- Admin/Owner G27 requiere registro independiente `mobility_stage_backoffice_roles` ACTIVE, `approved_by != user_id`, MFA AAL2 para operaciones sensibles. **No falsificar o autoasignar aprobaciones**.

## Operación privada segura

1. En equipo del operador de confianza, generar credenciales mediante `node apps/mobility-expo/scripts/g263-private-qa-manifest.mjs --generate`; escribe `actors.json` con permisos 0600 en carpeta 0700, sin imprimir secretos. Guardar ruta de forma privada; **no compartir archivo en ChatGPT ni en GitHub**.
2. Verificar que `auth/v1/settings` confirma `disable_signup=true`; usar solo Supabase STAGING y `LIVE_TRIPS_ENABLED=false`.
3. Establecer secretos backend `QORE_STAGING_SERVICE_ROLE_KEY`, clave pública `QORE_STAGING_ANON_KEY`, `QORE_STAGING_PROJECT_REF=mrjzxftsdxzepzbcuids`, `QORE_MOBILITY_ENV=staging`, `QORE_QA_MANIFEST_FILE` (ruta del archivo), `QORE_QA_EXPLICIT_APPLY=CONFIRM_STAGING_ONLY`, `QORE_QA_SESSION_VERIFY_APPROVED=CONFIRM_STAGING_ONLY` en el entorno protegido. No usar también `QORE_QA_ACTORS_JSON`.
4. Primero `node apps/mobility-expo/scripts/g275-staging-qa-operator.mjs --plan` (offline). Solo en el host autorizado, `--apply` crea ocho cuentas por Auth Admin API, audita 8/7 roles y verifica 8 sesiones G42 con revocación local.
5. Si el alta terminó y falló la verificación posterior, **NO reejecutar --apply**. Usar `--verify` con las credenciales originales para volver a comprobar 8/7 y las sesiones **sin crear cuentas**. Si hay entre 1 y 7 usuarios, auditoría manual; no reintentar ni borrar automáticamente.
6. Para evidencia Admin independiente, `node apps/mobility-expo/scripts/g263-backoffice-authority-audit.mjs` es read-only y debe devolver falta de aprobación hasta que exista autoridad G27 genuina.

Los CI de GitHub ejecutan exclusivamente mocks, nunca reciben credenciales privadas. Las ocho cuentas no equivalen a KYC Driver, ruta real, tarifa Owner, despacho, viajes o comercios. **Recorridos externos 0/5 hasta certificación independiente**, siempre mismo `tripId` en Cliente→Backend→Driver/Comercio→Admin→PostgreSQL.

# G1 — Consola interna de pruebas Lovable / Auth + RLS

**Fecha:** 2026-10-17 · **Estado:** interfaz implementada en Lovable, no publicada, sin usuarios de prueba ni E2E JWT remoto.
**Lovable STAGING nuevo:** https://lovable.dev/projects/9c677bb2-746b-419f-ad9c-dd6d26bab944
**No confundir:** backend viejo ID `2fa91fe1-e7a0-4fff-a16f-7d457b2d6eed`, Supabase ref `qdqrlgzlotnfdxzpacxs`; app Flutter trading PR #2.

## Trabajo real hecho dentro del proyecto Lovable STAGING
Se enviaron **dos instrucciones de construcción** al agente Lovable del proyecto NUEVO, tras comprobar `enabled=true`. Los agentes completaron:
- Primera compilación Lovable, commit **`d8c24ac4c79904b18019119ebdb1258d7831e355`**: vista de entrada `QORE Mobility · STAGING · NO LIVE`, autenticación `supabase.auth.signInWithPassword` y `getUser`, cierre de sesión, consulta **únicamente de filas propias** de `profiles`, `user_roles`, `mobility_vehicle_applications` (`pending`) y `mobility_vehicles`. Consultas con `eq('id'/'driver_id'/'user_id', auth.uid())`; filtros secundarios cliente son defensa adicional y NO reemplazan RLS del servidor. Sin UI de signup, admin review, pagos ni viajes.
- Segunda revisión Lovable, commit **`6d834bd2f4a5975ddc751b7ce1f0c6749787ec93`**: `validatePublicConnection` exige URL HTTPS y clave `sb_publishable_*` o JWT anon; rechaza claves `sb_secret_*`, service_role, roles no anon y la ref del backend anterior. Validación de configuración NO equivale a firma JWT; Auth confirma sesiones. Lovable reportó **13 tests unitarios de aislamiento/configuración aprobados** y build correcto.
- Archivos Lovable relevantes: `src/routes/index.tsx`, `src/routes/__root.tsx`, `src/components/staging-auth.tsx`, `src/components/staging-records.tsx`, `src/lib/staging-access.ts`, `src/test/staging-access.test.ts`. Las modificaciones están en el proyecto **Lovable**, NO en el árbol Expo de GitHub PR #7.
- `get_project`: `is_published=false`, `project.status=ready`, `agentFinished=true`. Es una **preview interna**; no suponer que una URL de preview es una barrera de acceso por sí misma.
- Lovable informó coste de las dos construcciones: **3 y 2 créditos respectivamente**. Consultar balance real directamente en la plataforma, no inferir saldo.

## Postcheck REAL en Supabase STAGING NUEVO
Luego del trabajo de Lovable, consulta PostgreSQL read-only devolvió:
`auth.users=0`, `profiles=0`, `mobility_vehicle_applications=0`, `mobility_vehicles=0`, `storage.objects=0`, **9 tablas públicas**, bucket `mobility-staging-driver-evidence`; `authenticated` continúa sin permiso `INSERT` en `user_roles` ni `EXECUTE` de `mobility_review_vehicle`.
La tarea del agente **no creó usuarios, pagos, viajes, documentos o migraciones**.

## Bloqueador P0 descubierto en Auth (requiere acción manual)
Lovable comprobó la configuración Auth del proyecto STAGING: el endpoint de estado nativo indicó **`disable_signup=false`**. Ausencia de botón de registro en UI NO bloquea `/auth/v1/signup`. Intentó evaluar un cambio administrado, pero la herramienta disponible de configuración podría reescribir `password_hibp_enabled` sin poder leer su estado; **no aplicó esa modificación para evitar regresión de seguridad**.

**Acción requerida en el proyecto Lovable STAGING:**
**Más → Cloud → Users → Auth settings → activar `Disable sign-up` → guardar** (verificar nomenclatura exacta en su editor). Después comprobar estado con respuesta backend de Auth. Aun así, para crear dos cuentas de test hacer provisionamiento controlado por método admin invitación/fixture aprobado y sin guardar credenciales en GitHub.

Hasta bloquear signup del lado del servidor, **G1 Auth invite-only NO está certificado**. UI sigue no publicada; la API de Auth podría crear usuarios bajo la configuración actual. No confundir `disable_signup=false` con una brecha de acceso a viajes: RLS previene autoaprobación y la movilidad LIVE está deshabilitada.

## Siguientes gates
1. Configurar `Disable sign-up` nativo en Cloud staging y revalidar.
2. Provisionar dos identidades de test sin credenciales en chats/repo, obtener la ref pública y anon publishable del Supabase **STAGING** sin imprimir service_role.
3. Ejecutar `scripts/staging-auth-readonly.mjs` (identidad propia/ajena, `has_role`) y Storage REST autenticado con documentos *sintéticos* (no licencias reales).
4. Verificar en preview consola Lovable con sesión 401/403 y aislamiento al cambiar cuenta.
5. Integrar gateway server-side del repo Expo en entorno seguro sólo tras fijar Auth. Moto comercial, dispatch, tarifas reales y PSP siguen inhabilitados.

**Invariantes:** `LIVE_TRIPS_ENABLED=false`, nada conectado al backend Lovable viejo ni Flutter trading. PR #7 DRAFT sin merge.

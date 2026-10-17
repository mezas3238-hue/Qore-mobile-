# G1 — Certificación Storage REST con dos JWT reales (STAGING, sin datos personales)

**Fecha:** 2026-10-17 · **Proyecto autorizado:** Lovable QORE Mobility STAGING `9c677bb2-746b-419f-ad9c-dd6d26bab944`. **Nunca usar:** Supabase anterior `qdqrlgzlotnfdxzpacxs`. Branch `feature/mobility-monorepo-isolated-20261016`, PR #7 DRAFT, `LIVE_TRIPS_ENABLED=false`.

## Avance implementado en GitHub

`apps/mobility-expo/scripts/staging-storage-readonly.mjs` permite completar el gate G1 de documentos con **dos cuentas de prueba ya creadas, verificadas y diferentes**. El comando:

1. Rechaza cualquier ref antigua, malformed ref o clave `sb_secret_*`/`service_role`; exige email ficticio con dominio `.invalid`.
2. Inicia sesión por email/contraseña **solo de cuentas de prueba**, valida inmediatamente su identidad en `GET /auth/v1/user` y comprueba confirmación, sin interpretar un JWT sin verificar.
3. Exige rutas bajo el bucket `mobility-staging-driver-evidence` con carpetas que coincidan con `auth.uid()` y nombres explícitamente `licencia-SYNTHETIC...` con extensión JPG/PNG.
4. Descarga los **dos objetos propios**: exige HTTP 200. Si ambos responden 404, el gate falla (no acepta falsos resultados verdes).
5. Comprueba HTTP de denegación en A→B, B→A y dos consultas sin token. Solo considera denegación los códigos 400/401/403/404.
6. Nunca imprime contraseña, token, URLs con identidades, bytes de documentos ni cuerpos de respuestas; cierra inmediatamente los streams sin almacenar fotos. No sube ni borra archivos. **No habilita viajes**.
7. Tests offline `scripts/staging-storage-readonly.test.mjs` ejercitan login confirmado, cuenta ajena, archivo faltante 404, fuga 200, URL antigua, owner folder y formato de fixture.

## Prerrequisitos antes de ejecutar (gate NO cerrado hoy)

- Activar **Disable sign-up** en Lovable STAGING → Más → Cloud → Users → Auth settings, guardar y comprobar `disable_signup=true` con `scripts/staging-auth-policy-gate.mjs`. En la última observación del agente Lovable seguía `false`; no hay certificación nueva ni acceso invite-only demostrado.
- Identificar ref Supabase público exclusivo de este proyecto y clave publishable/anon exclusiva; jamás copiar `service_role` a chat, archivo, CI ni Expo.
- Provisionar **dos cuentas ficticias confirmadas** mediante mecanismo administrativo seguro del entorno STAGING; evitar altas públicas y usuarios reales.
- Con cada usuario autenticado cargar a través de **Storage API** una imagen de prueba sin PII (JPG o PNG real; no archivo renombrado) al bucket privado y su carpeta `<uuid>/licencia-SYNTHETICxxxx.jpg`. La política de insert exige `owner_id` desde el propio token, por eso no crear objetos mediante INSERT SQL ni subir con otra identidad. Comprobar que ambos objetos realmente existen como documentos sintéticos, sin documentos personales.
- Registrar **sin contraseñas** ubicación de los archivos de prueba y plan de limpieza administrado; el DELETE para usuario normal está bloqueado intencionadamente por RLS. Programar borrado **exclusivamente** con operación autorizada de administración de Storage, después del smoke, y verificar conteo 0.

## Comando local con variables de entorno (no repetir secretos en logs)

```bash
cd apps/mobility-expo
export QORE_MOBILITY_ENV=staging
export QORE_STAGING_PROJECT_REF='<ref_del_SUPABASE_nuevo>'
export QORE_STAGING_ANON_KEY='<clave_publica_solo_staging>'
export QORE_STAGING_PASSENGER_A_EMAIL='passenger-a@qore-staging.invalid'
export QORE_STAGING_PASSENGER_A_PASSWORD='<contraseña_ficticia_A>'
export QORE_STAGING_PASSENGER_B_EMAIL='passenger-b@qore-staging.invalid'
export QORE_STAGING_PASSENGER_B_PASSWORD='<contraseña_ficticia_B>'
export QORE_STAGING_TEST_OBJECT_A_PATH='<uuid-A>/licencia-SYNTHETICAAA1.png'
export QORE_STAGING_TEST_OBJECT_B_PATH='<uuid-B>/licencia-SYNTHETICBBB2.jpg'
node scripts/staging-auth-policy-gate.mjs
node scripts/staging-auth-readonly.mjs
node scripts/staging-storage-readonly.mjs
```

**Los valores entre corchetes son marcadores; no contienen identidades ni credenciales existentes.** No agregar variables a archivos versionados, no imprimir variables desde la terminal, no volcar .env a repositorios ni CI. El shell puede persistir historiales; preferir inyección de secretos del operador local si disponible.

## Alcance y garantías

Los tests offline de GitHub Actions usan *mocks* y **no** certifican el endpoint remoto de Supabase Storage. La lectura autenticada propia de dos objetos y la lectura ajena denegada requieren ejecución posterior con el proyecto correcto y fixtures existentes. Ningún upload, cuenta o JWT real fue creado por este cambio. Este smoke es una prueba puntual de aislamiento; siguen pendientes limitación de frecuencia, contenido malicioso (MIME disfrazado), escaneo de archivos, preservación/retención, KYC, póliza y permisos municipales. MOTO comercial, tarifas y despachos permanecen bloqueados.

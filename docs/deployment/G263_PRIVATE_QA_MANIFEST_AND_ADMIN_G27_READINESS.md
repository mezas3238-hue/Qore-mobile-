# G263 — Ocho identidades QA STAGING: credenciales privadas y autoridad Admin G27

**Proyecto fijado:** `mrjzxftsdxzepzbcuids` (exclusivamente Supabase STAGING).
**No es un manual de producción.** Sin LIVE, sin PSP, sin pagos, sin usuarios sintéticos insertados en SQL.

## Hechos comprobados
- G259 real provider signup deshabilitado: workflow 41221015071, `REAL_PROVIDER_SIGNUP_DISABLED`.
- Al abrir G263, Auth usuarios = 0, roles = 0, sesiones = 0.
- G251 crea y asigna roles QA con Auth Admin API; G254 audita roles; G261 prueba sesiones G42 sin retenerlas.
- **P0 corregido en G263 (código, aún sin aplicar a cuentas reales):** `mobility_stage_g27_backoffice_role_of` exige una fila `mobility_stage_backoffice_roles` ACTIVE con aprobación de otro actor y **ausencia total de rol nativo en `user_roles`**. El nuevo bootstrap G251 elimina exclusivamente la fila automática `passenger` del slot `owner_admin`, dejando **8 usuarios Auth, 7 roles nativos (4 Driver, 3 Passenger) y 1 Admin PENDIENTE sin rol nativo ni poder elevado**. G254 y G261 verifican esta separación. G263 continúa bloqueando Admin hasta aprobación real en G27; nunca eleva ni inventa ese permiso.
- `service_role` no dispone de INSERT ni UPDATE de `mobility_stage_backoffice_roles`. La aprobación debe pasar por un circuito separado y auditado. G263 únicamente observa esta evidencia.

## Flujo local y seguro de credenciales

Solo en equipo confiable del operador, fuera de GitHub, Railway, CI y ChatGPT:

1. En un checkout aprobado del código, ejecutar `node apps/mobility-expo/scripts/g263-private-qa-manifest.mjs --generate`. Produce una carpeta nueva privada (0700) en el temporal del sistema y un archivo `actors.json` (0600), con ocho direcciones `.invalid` y ocho contraseñas aleatorias fuertes independientes. La salida muestra **solo la ruta**, nunca correos ni contraseñas.
2. Mantener el archivo protegido en el equipo del operador, sin adjuntarlo ni subirlo al repositorio, proyecto o artefactos CI.
3. Operador habilita entorno privado STAGING: `QORE_QA_MANIFEST_FILE=<ruta absoluta>`, `QORE_STAGING_PROJECT_REF=mrjzxftsdxzepzbcuids`, `QORE_MOBILITY_ENV=staging`, `LIVE_TRIPS_ENABLED=false`. Las variables de API pública y servicio se administran como secretos en la máquina confiable; nunca imprimirlas.
4. Solo tras autorización de esta operación y comprobación Auth cero, ejecutar G251 con `QORE_QA_EXPLICIT_APPLY=CONFIRM_STAGING_ONLY` y `--apply`. Este programa usa API Auth Admin, no inserta directamente en `auth.users`.
5. Si la ejecución parcial crea menos de ocho usuarios, **no repetir automáticamente**: G251 falla cerrado si el proveedor ya tiene usuarios. Reconciliar con auditoría manual privada antes de cualquier reintento.
6. G254 `--audit` certifica ocho usuarios y roles nativos (no poderes backoffice). G261 `--verify`, con `QORE_QA_SESSION_VERIFY_APPROVED=CONFIRM_STAGING_ONLY`, certifica inicios y cierres de sesión reales.
7. G263 backoffice `--audit` comprueba el resultado G27 y la aprobación de backoffice por un actor distinto. **Tras G251 actualizado, responderá `INDEPENDENT_BACKOFFICE_APPROVAL_REQUIRED` hasta que exista esa aprobación real**, no `ADMIN_NATIVE_ROLE_CONFLICT_G27`. La ausencia de rol nativo Admin es intencionada; no aprobar ni elevar roles automáticamente.

`QORE_QA_ACTORS_JSON` sigue siendo una opción heredada; **no establecer ambas fuentes a la vez**. Preferir `QORE_QA_MANIFEST_FILE` porque evita contraseñas completas en variables de entorno.

## Alcance de los tests

La suite G263 usa solo Node mocks y filesystem temporal. Su éxito no significa usuarios reales, aprobación Owner, KYC Driver, credenciales en Railway, conexiones HTTP ni viajes E2E. G262 ruta/pre-cotización/reserva AUTO (PR #63) también permanece como migración no aplicada mientras falten los gates necesarios.

**Prohibido:** merge sin orden, deploy Railway sobre patch destructivo, LIVE/PROD, falsas aprobaciones de motos, credenciales en logs o chat.

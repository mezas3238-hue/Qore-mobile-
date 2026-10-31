# G263 — Ocho identidades QA STAGING: credenciales privadas y autoridad Admin G27

**Proyecto fijado:** `mrjzxftsdxzepzbcuids` (exclusivamente Supabase STAGING).
**No es un manual de producción.** Sin LIVE, sin PSP, sin pagos, sin usuarios sintéticos insertados en SQL.

## Hechos comprobados
- G259 real provider signup deshabilitado: workflow 41221015071, `REAL_PROVIDER_SIGNUP_DISABLED`.
- Al abrir G263, Auth usuarios = 0, roles = 0, sesiones = 0.
- G251 crea y asigna roles QA con Auth Admin API; G254 audita roles; G261 prueba sesiones G42 sin retenerlas.
- **P0 detectado en PostgreSQL17:** `mobility_stage_g27_backoffice_role_of` exige una fila `mobility_stage_backoffice_roles` ACTIVE con aprobación independiente y **ausencia total de rol nativo en `user_roles`**. Actualmente G251 crea `owner_admin` con `user_roles.admin`, por lo que **G251+G254+G261 no certifican Admin G27**. Un role='admin' nativo nunca equivale a aprobación de Owner. No cambiar la función G27 para eludir la separación ni generar aprobación legal ficticia.
- `service_role` no dispone de INSERT ni UPDATE de `mobility_stage_backoffice_roles`. La aprobación debe pasar por un circuito separado y auditado. G263 únicamente observa esta evidencia.

## Flujo local y seguro de credenciales

Solo en equipo confiable del operador, fuera de GitHub, Railway, CI y ChatGPT:

1. En un checkout aprobado del código, ejecutar `node apps/mobility-expo/scripts/g263-private-qa-manifest.mjs --generate`. Produce una carpeta nueva privada (0700) en el temporal del sistema y un archivo `actors.json` (0600), con ocho direcciones `.invalid` y ocho contraseñas aleatorias fuertes independientes. La salida muestra **solo la ruta**, nunca correos ni contraseñas.
2. Mantener el archivo protegido en el equipo del operador, sin adjuntarlo ni subirlo al repositorio, proyecto o artefactos CI.
3. Operador habilita entorno privado STAGING: `QORE_QA_MANIFEST_FILE=<ruta absoluta>`, `QORE_STAGING_PROJECT_REF=mrjzxftsdxzepzbcuids`, `QORE_MOBILITY_ENV=staging`, `LIVE_TRIPS_ENABLED=false`. Las variables de API pública y servicio se administran como secretos en la máquina confiable; nunca imprimirlas.
4. Solo tras autorización de esta operación y comprobación Auth cero, ejecutar G251 con `QORE_QA_EXPLICIT_APPLY=CONFIRM_STAGING_ONLY` y `--apply`. Este programa usa API Auth Admin, no inserta directamente en `auth.users`.
5. Si la ejecución parcial crea menos de ocho usuarios, **no repetir automáticamente**: G251 falla cerrado si el proveedor ya tiene usuarios. Reconciliar con auditoría manual privada antes de cualquier reintento.
6. G254 `--audit` certifica ocho usuarios y roles nativos (no poderes backoffice). G261 `--verify`, con `QORE_QA_SESSION_VERIFY_APPROVED=CONFIRM_STAGING_ONLY`, certifica inicios y cierres de sesión reales.
7. G263 backoffice `--audit` confirma la aprobación independiente y G27 efectivo. **G263 fallará con `ADMIN_NATIVE_ROLE_CONFLICT_G27` con el bootstrap actual hasta que se implemente un procedimiento seguro de separación de roles y aprobación de Owner.** No eliminar ni elevar roles por atajo.

`QORE_QA_ACTORS_JSON` sigue siendo una opción heredada; **no establecer ambas fuentes a la vez**. Preferir `QORE_QA_MANIFEST_FILE` porque evita contraseñas completas en variables de entorno.

## Alcance de los tests

La suite G263 usa solo Node mocks y filesystem temporal. Su éxito no significa usuarios reales, aprobación Owner, KYC Driver, credenciales en Railway, conexiones HTTP ni viajes E2E. G262 ruta/pre-cotización/reserva AUTO (PR #63) también permanece como migración no aplicada mientras falten los gates necesarios.

**Prohibido:** merge sin orden, deploy Railway sobre patch destructivo, LIVE/PROD, falsas aprobaciones de motos, credenciales en logs o chat.

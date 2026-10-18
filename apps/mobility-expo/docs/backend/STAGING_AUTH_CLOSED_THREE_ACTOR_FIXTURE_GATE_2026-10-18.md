# QORE Mobile — Auth STAGING P0 CERRADO y plan de 3 JWT ficticios

**Fecha de verificación:** 2026-10-18 02:47:57 UTC (17 de octubre, 23:47:57 PY). **Alcance:** Lovable STAGING nuevo `9c677bb2-746b-419f-ad9c-dd6d26bab944`; Supabase propio `hylgkfgkcyrddokloljm`. **No corresponde** al Supabase antiguo `qdqrlgzlotnfdxzpacxs`.

## Evidencia real — no suposición por pantalla

Se realizó GET de solo lectura a `https://hylgkfgkcyrddokloljm.supabase.co/auth/v1/settings` con la clave pública obtenida desde el entorno de STAGING sin imprimirla. Resultado confirmado por el agente Lovable: **HTTP 200, `disable_signup=true`**. El registro público de Auth está deshabilitado de verdad. Continúan `mailer_autoconfirm=false`, email habilitado y usuarios anónimos desactivados. El campo `password_hibp_enabled` **no está expuesto**, por lo cual **NO se puede certificar su valor** y no se ejecutó ningún `configure_auth` que pudiera sobrescribirlo.

La base se inspeccionó también con SQL **solo lectura**: 10 tablas públicas, todas con RLS activo, 0 usuarios, 0 solicitudes, 0 vehículos, 0 documentos y **G3/G4 aún no instalados**. El rol normal `authenticated` tiene SELECT propio sobre `user_roles` y carece de INSERT, UPDATE y DELETE; el rol `anon` no tiene privilegios. Solo `service_role` puede mutar roles; la app nunca debe disponer de esa clave.

**Estado de gates:** P0 cierre de signup **VERIFICADO**. P1 tres cuentas/roles/JWT/Storage **PENDIENTE**. G3/G4 remoto **NO DESPLEGADO**. Viajes y pagos comerciales **NO LIVE**.

## Provisionamiento seguro: acciones del operador (NO ejecutadas)

La herramienta del agente Lovable no incluye un procedimiento autónomo seguro de `auth.admin.createUser` ni dispone de clave service-role exportable. **No insertar en `auth.users` directamente mediante SQL**, porque se perderían garantías de Auth. La opción recomendada es desde el editor Lovable: **Cloud → Users → Add user**.

Crear manualmente, con contraseñas fuertes diferentes **que nunca se compartan por chat ni GitHub** y con email **confirmado desde la acción administrativa**, estas tres identidades completamente inventadas:

| Uso | Correo ficticio | Rol final único |
|---|---|---|
| Pasajero QA | `qa-passenger@qore-staging.invalid` | `passenger` |
| Conductor AUTO QA A | `qa-driver-a@qore-staging.invalid` | `driver` |
| Conductor AUTO QA B | `qa-driver-b@qore-staging.invalid` | `driver` |

**Precaución:** el trigger `mobility_staging_new_signup` crea automáticamente perfil y rol `passenger` para **todo** usuario nuevo, incluidos los dos conductores. Antes de realizar pruebas de los roles, un administrador autorizado deberá añadir `driver` y retirar `passenger` de esos dos usuarios dentro de una operación específica, auditada y aprobada en **public.user_roles**. No otorgar `admin`. No ejecutar esa escritura automáticamente por el agente ni mediante la aplicación; pedir aprobación explícita del propietario una vez existan los 3 usuarios y revisar sus UUID con consulta restringida.

No crear otras cuentas, no abrir el registro público, no asignar KYC verdadero, ni enviar fotos personales o push reales. La generación de credenciales y las acciones de Admin Auth deben ocurrir en un entorno privado y controlado.

## Nueva comprobación preparada en GitHub (no ejecutada contra personas reales)

`scripts/staging-three-actors-readonly.mjs` verifica, una vez creados los usuarios:

- `disable_signup=true` **antes** del login, entorno staging y `LIVE_TRIPS_ENABLED=false`.
- Tres logins Auth password-grant, cada uno con correo `.invalid`, seguido de **`GET /auth/v1/user`** que exige usuario distinto y confirmado; no confía en decodificar tokens sin firma. El login con POST crea una sesión de Auth, pero no escribe perfiles, roles, documentos ni viajes.
- Con cada JWT de test lee únicamente su perfil y exactamente su rol esperado; intenta leer los otros dos perfiles y roles y debe obtener conjuntos vacíos. Detecta rol admin, rol doble en conductor, perfil faltante y lectura cruzada.
- Nunca imprime tokens, contraseñas, correos, UUID de cuentas, posiciones ni respuestas completas.
- Los `scripts/staging-three-actors-readonly.test.mjs` se ejecutan **solo con mocks offline en CI**. No hay JWT ni cuenta real E2E certificada hasta ejecutar el script contra el STAGING auténtico.

Ejecutar únicamente en un entorno privado, inyectando de manera segura las siguientes variables sin registrarlas ni guardarlas en el repositorio:

```text
QORE_MOBILITY_ENV=staging
LIVE_TRIPS_ENABLED=false
QORE_STAGING_PROJECT_REF=hylgkfgkcyrddokloljm
QORE_STAGING_ANON_KEY=<clave publishable solo del STAGING>
QORE_STAGING_PASSENGER_EMAIL=<cuenta ficticia confirmada>
QORE_STAGING_PASSENGER_PASSWORD=<secreto privado>
QORE_STAGING_DRIVER_A_EMAIL=<cuenta ficticia confirmada>
QORE_STAGING_DRIVER_A_PASSWORD=<secreto privado>
QORE_STAGING_DRIVER_B_EMAIL=<cuenta ficticia confirmada>
QORE_STAGING_DRIVER_B_PASSWORD=<secreto privado>
```

Luego `node apps/mobility-expo/scripts/staging-three-actors-readonly.mjs` desde la raíz del repositorio. **No escribir contraseñas en el historial de terminal.** Estas variables son nombres, no valores de secretos.

## Gates después de tres JWT

1. Ejecutar control RLS de roles y Storage privado con tres identidades; pruebas de adjuntos **sintéticos**, sin documentos reales.
2. Revisar y autorizar explícitamente migración G3/G4 en el proyecto nuevo, manteniendo `LIVE_TRIPS_ENABLED=false`, y verificar las tres tablas/funciones/roles con usuarios no privilegiados.
3. Integrar un servicio de HTTPS staging autenticado y notificaciones FCM/APNs, GPS con consentimiento y Google Routes con cuotas/clave solo servidor.
4. Probar en 3 teléfonos reales de QA (pasajero, conductor A, conductor B): competencia de aceptación, foto/placa verificada, distancia carretera y ETA, reconexiones y caducidad; nunca exponer secretos.
5. Resolver seguros, requisitos municipales y proveedor de cobro antes de cualquier piloto comercial AUTO. MOTO comercial necesita aprobación legal y seguros separados.

**Aislamiento:** no se modificó `auth.users`, `user_roles`, G3/G4 remoto, RLS, Storage, Flutter trading PR #2 ni backend antiguo. PR #7 continúa DRAFT.

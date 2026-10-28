# G27 / A04.2 — Registro de autoridad backoffice y alcance por permiso (QA)

**QORE Mobile / Movete Fácil · 23/10/2026 · Arquitecto A · NO MERGE / NO LIVE / NO SQL REMOTO.**

## Implementado y ensayado

Se añadió \`apps/mobility-expo/docs/backend/staging_only/G27_BACKOFFICE_ROLES_POSTGRES_CI_ONLY.sql\`, ejecutado **sólo dentro del PostgreSQL 16 desechable** del workflow G4. No migra ni altera el Supabase remoto ni crea usuarios reales. \`mobility_stage_backoffice_roles\` es el registro separado del \`public.app_role\` histórico G1, el cual sólo distingue \`admin\`, \`driver\` y \`passenger\`. Los nuevos permisos backoffice \`owner\` y \`admin\` se excluyen mutuamente mediante \`PRIMARY KEY(user_id)\` y rechazan identidades que todavía tengan cualquier rol nativo de G1. Una cuenta creada como Passenger NO adquiere Admin/Owner por ser titular de un email.

- \`status\`: \`pending\` por defecto; sólo \`active\` tiene autoridad. \`suspended\` deja de autorizar lecturas inmediatamente.
- Columna \`approved_by\` obligatoria para atribución, y \`revision\` de cambios; el esquema no incluye acceso del usuario final a esa tabla.
- \`anon\`, \`authenticated\` y browser NO pueden consultar, insertar ni alterar la tabla; \`service_role\` sólo tiene \`SELECT\`, protegido por RLS, **no** \`INSERT\`/\`UPDATE\`. La creación o revocación de autoridades reales requiere una ruta de mantenimiento protegida y auditada, aún no aprobada.
- Funciones \`mobility_stage_g27_backoffice_role_of(uuid)\` y \`mobility_stage_g27_backoffice_has_scope(uuid,text)\` usan \`SECURITY DEFINER\` con \`search_path=''\` y permisos \`EXECUTE\` exclusivamente para \`service_role\`; verifican base-role ambiguity, suspensión, rol y permiso. No conceden \`admin.permissions.write\` ni \`owner.finance.write\`.
- Scopes Admin: \`admin.kyc.read\`, \`admin.zones.read\`, \`admin.incidents.read\`, \`admin.audit.read\`. Scope Owner: \`owner.finance.read\`; ninguno se hereda entre roles.
- \`apps/mobility-expo/server/g27-backoffice-role-authority.mjs\`: adaptador servidor para consultas RPC; valida actor UUID, prohíbe scopes ajenos a la lista y rechaza respuestas malformadas, errores o \`service_role\` falso.

La prueba \`G27_BACKOFFICE_ROLES_ASSERT_POSTGRES_CI_ONLY.sql\` utiliza actores totalmente sintéticos: RLS/privilegios, dos roles separados, cinco scopes, suspensión y retorno inesperado de rol pasajero. Opera bajo \`SET LOCAL ROLE service_role\` en una base desechable y finaliza con \`ROLLBACK\` de las identidades. El fixture NO constituye pruebas del proveedor JWT ni MFA real.

## Cómo se integrará sin traspasar los gates de seguridad

El backend de A04.1/A05.1 recibe \`loadExclusiveBackofficeRole\` y \`authorizePermission\` del nuevo adaptador, pero sólo **después** de validar el JWT con revocación en el servidor. Se debe suministrar \`verifyBackofficeMfa\` independiente del cliente, con prueba AAL2 del proveedor ligada al mismo usuario y sesión; **no** se simula MFA con \`true\` en un servidor real. Todos los componentes permanecen desactivados sin autoridades verificadas.

El flujo de autorización será: *JWT confirmado → rol privado activo y exclusivo → permiso específico → control de tasa → atestación MFA provider-bound → consulta SQL propia*. Cualquier error deniega el acceso. Ni el Admin Web de B ni el teléfono Driver reciben la clave \`service_role\`.

## Pendientes P0

1. Diseñar y certificar proceso real de alta/suspensión de operador Admin/Owner (doble aprobación, identidades verificadas, rotación y auditoría) antes de habilitar cuentas reales.
2. Conectar JWT + MFA y revocación de sesión de un proveedor en **STAGING HTTPS autorizado**, con secretos gestionados en servidor.
3. Implementar \`loadPage\` PostgreSQL realmente autorizada con revisión de RLS/consultas y reconciliación financiera; los repositorios G17/G8/G7 históricos por sí solos **no** garantizan los DTOs A05.
4. Publicar resultados de pruebas por commit SHA exacto, ejecutar E2E browser físico para B y aprobación legal/seguridad.
5. Sin autorización STAGING real, continuar pruebas sintéticas y no abrir API pública, SQL remoto ni pagos reales.

**Acuerdo A/B:** B conserva \`apps/movete-admin/**\` y \`apps/movete-cliente/**\` y no necesita renombrar sus rutas ni la forma de cursor.

# G314 — Pasarela independiente de acciones de Soporte

**Fecha:** 12 de noviembre de 2026. **Propietario:** Arquitecto C, issue #120. **Antecesores:** G301 #104 → G309 #116 → G311 #121 → G312 #126 → G313 #132.

## Diferencia respecto a G313

G313 implementó un encolado SQL transaccional, pero no existía un servidor que asociara la identidad verificada al RPC. G314 añade una pasarela HTTP/Edge candidata que:

1. Deniega todo si `QORE_SUPPORT_ACTIONS_ENABLED` no es exactamente `true`, o faltan URL y claves de servicio **solo del runtime**. El origen autorizado debe ser un HTTPS exacto en `QORE_SUPPORT_ALLOWED_ORIGIN` (CORS sin comodín).
2. Exige POST JSON máximo 1.024 caracteres, `Authorization: Bearer`, y aplica el contrato cerrado de cuatro campos: ticket, estado esperado, acción y clave de idempotencia.
3. Comprueba token con `supabase.auth.getUser(accessToken)` contra el servidor Auth; **solo después** extrae `sub/session_id/aal/role` del token validado, cotejando `sub` con `user.id`. Rechaza AAL1 y usuarios anónimos.
4. Llama al RPC `public.mobility_stage_g314_enqueue_action_qa` mediante el cliente de servidor que posee `SUPABASE_SERVICE_ROLE_KEY`, **nunca desde el navegador**. El RPC público concede `EXECUTE` exclusivamente a `service_role`; anon y authenticated NO lo tienen.
5. El RPC utiliza G313 para validar **de nuevo** rol independiente, Owner aprobador, sesión actual y MFA TOTP AAL2, titular y estado del ticket, y clave de idempotencia. Se aplican bloqueos de filas transaccionales.
6. Solo responde `QUEUED` + ticket, acción y UUID de solicitud. Los errores de SQL, Auth o ticket inexistente se mantienen genéricos y sin PII. No permite escribir mensajes ni cambiar dinero.
7. El portal Cliente de soporte muestra botones exclusivamente si hay sesión y caso asignado, y solamente con `VITE_QORE_SUPPORT_ACTIONS_APPROVED=true` compilado explícitamente; valor por defecto OFF. Los reintentos de red conservan el mismo UUID hasta confirmar.

## Estado externo realmente verificado

Supabase STAGING `mrjzxftsdxzepzbcuids` está `ACTIVE_HEALTHY` a 12-nov-2026, pero una consulta read-only volvió a confirmar **cero tablas de Soporte, cero roles Owner activos, cero TOTP verificados**. La G314 NO se ha aplicado ni desplegado. Todos los logs son del runner desechable.

## Advertencias y pendientes bloqueantes

- **No desplegar todavía**: faltan G301/G312/G313 SQL reales, Owner legal activo con MFA y personal autorizado, revisión de `SECURITY DEFINER` tanto G313 como el puente `public` G314, y prueba con sesiones Auth emitidas por STAGING real.
- El wrapper `public` de G314 es `SECURITY DEFINER` intencionalmente pero está restringido a `service_role`: no aceptar ninguna ampliación a `PUBLIC`, `anon` o `authenticated`. Registrar y revisar Security Advisor `0028/0029` antes de aprobar.
- No basta CORS para autenticar: el token se verifica vía Auth y G313 consulta las tablas de sesión/MFA vivas. El origen HTTPS evita uso accidental de navegadores ajenos, no es la barrera de identidad.
- Las claves de `service_role` **jamás deben entrar a variables `VITE_*`**, logs, dispositivos ni tests con usuarios reales. La ruta de código Edge vive bajo `apps/movete-soporte/edge-functions/qore-support-actions/`; instalarla requerirá un proceso de despliegue explícito, sin sobreescribir otro endpoint.
- Para producción falta rate limiting por agente y ticket, auditoría append-only de resultados, worker que atienda y entregue respuestas, gestión de reclamaciones sin datos personales en `summary`, retención y controles de privacidad.
- **Un request EN COLA no significa reclamo resuelto, ni atención enviada, ni transferencia efectuada.** Nunca simular esos estados en la interfaz.

## Pruebas de laboratorio

`scripts/sql/g314-support-edge-disposable-ci.sql` instala solo PostgreSQL16 descartable y comprueba que la función no es ejecutable por `anon/authenticated`, que el servidor puede usarla de forma idempotente, que los roles y la sesión cambian permisos y que el retorno tiene exactamente 4 campos.

`src/support-action-http.test.mjs` cubre CORS de origen exacto, ausencia de sesiones, AAL1, sesiones/roles inválidos, campos extra, tamaño y contenido incorrectos, rechazos SQL, no revelación de tickets ajenos y respuesta QUEUED.

`src/support-action-options.test.mjs` confirma cero botones cuando el gate está OFF, denegación de acciones sobre tickets ajenos y lista finita de acciones por estado.

**Entrega:** PR DRAFT, NO MERGE, NO LIVE, NO DEPLOY. Mantener frente móvil #118 y Comercio #119 separados.

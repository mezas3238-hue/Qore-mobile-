# G131 — QORE Mobile: GitHub primero, sin Render ni Supabase

**Orden expresa del Owner (28 octubre 2026)**: NO pasar a Render ni a Supabase hasta que la app funcione de extremo a extremo sobre una única versión de GitHub. Prohibido crear proyectos externos, activar servicios, incurrir en costos o desplegar sin orden posterior.

## Estado comprobable, sin publicidad engañosa

Rama única: `integration/qore-mobile-e2e-four-apps-20261027`; A backend, B Cliente, C Driver y D Admin se incorporaron como árboles íntegros en un solo commit. El workflow de cuatro aplicaciones comprueba compilación nativa de Cliente/Driver y build web de Admin. El workflow G4 verifica HTTP real de Node a PostgreSQL16 efímero de GitHub Actions.

### Nuevo recorrido G131 (misma orden y mismo PostgreSQL, no fixtures distintos)

El escenario `g98-f1-auto-postgres-loopback-e2e-ci.mjs` ahora conecta la **máquina de estados propia de Admin Web D** mediante `createAdminExperience.loadF1RideAudit`, no solo la función A G75. En la misma ejecución:
1. Cliente B y Backend A precotizan AUTO con tarifa Owner/subsidio y reservan viaje en PostgreSQL16.
2. Admin D obtiene por HTTP autenticado + MFA QA el **mismo `tripId`, `bookingRequestKey`, `quoteId`, tarifa y revisión persistentes**.
3. Cliente B verifica estado y cancela; A produce asiento de reverso en SQL.
4. Admin D reconsulta el mismo viaje y ve la misma revisión/cancelación. El segundo viaje B también se coteja en D.
5. Una revocación de la sesión Admin en el backend provoca 401 y borrado de datos privados del navegador.
6. El conductor C no se asigna ilegalmente a un viaje sin G38/G71; SQL prueba que no hay transición ficticia ni pago PSP.

**La aceptación de un conductor legalmente habilitado en un viaje recién solicitado todavía es un bloqueo real**, aunque `g109` ejecuta las transiciones de una fila histórica QA aceptada antes de G38. No confundir dos viajes distintos ni fixtures sintéticos con cumplimiento E2E real.

## Definition of Done obligatorio, antes de Render/Supabase

Se requerirá una sola ejecución ininterrumpida desde Cliente B a Driver C y Admin D sobre **el mismo** ID y PostgreSQL efímero de GitHub Actions:
- Pasajero autentica y elige AUTO o MOTO; geocodificación/cobertura/tarifa válida y versionada antes del pedido.
- PostgreSQL persiste exactamente una reserva y un reparto del precio/commission/subsidio Owner.
- Conductor elegible con evidencias verificadas por gate G38/G71 recibe oferta privada, acepta, recoge, finaliza con prueba, la app Cliente observa cambios.
- Admin D muestra la misma operación y libro mayor, y permite editar comisiones de los cinco servicios con Owner AAL2 real.
- Replicar entrega AUTO, entrega MOTO y COMMERCE por categoría. Ninguna acción comercial es declarada exitosa por un mock, un status 201 o banderas de UI.
- 0 fallos de integración en GitHub, pruebas de reinicio/duplicidad/revocación y ausencia de diferencias de esquema/migraciones. GitHub Actions efímero **no** reemplaza las verificaciones de credenciales, conectividad ni comportamiento nativo de un STAGING real; estas son pruebas adicionales al llegar a esa fase.

**Política actual: GitHub solamente. Nada de Render, Supabase, LIVE, merge de PR #7/#8/#19/#20, app stores ni dinero.**
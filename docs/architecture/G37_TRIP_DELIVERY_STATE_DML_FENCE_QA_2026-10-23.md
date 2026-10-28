# G37 / A18 — blindaje de mutaciones y máquina de estados (23-10-2026)

## Alcance aplicado (SOLO PostgreSQL 16 descartable)
Se retiran INSERT/UPDATE/DELETE directos de `service_role`, `anon` y `authenticated` en las tablas G3/G5 de viajes, entregas y recibos de eventos. La lectura privada permitida y los índices/slots G36 permanecen. La creación, cancelación, avance y aceptación se conservan exclusivamente mediante RPCs con `EXECUTE` restringido a `service_role` y funciones seleccionadas `SECURITY DEFINER` con `search_path=''`. Los atajos directos `G3.accept` / `G5.accept` siguen revocados. Ninguna función expone credenciales al cliente.

El trigger G37 rechaza inserciones en estados asignados, cambio posterior de dueño, requestKey, tipo, términos, ruta, fechas, conductor/vehículo ya asignados, revisiones no secuenciales y saltos ilegales o resurrección terminal. Conserva la trayectoria normal de G3/G5 y la prueba transaccional G36 mediante ofertas privadas G4/G10.

### QA agregada
- Permisos DML efectivos con `has_table_privilege`; RPC y rol de browser.
- Intentos de INSERT/UPDATE directo reales bajo `SET LOCAL ROLE service_role`.
- Solicitud y cancelación lícitas por RPC, comprobando eventos auditables.
- Ataques de falsificación como DB owner descartable: identidad, ruta y reapertura terminal; todos deben ser rechazados `G3701`.
- Se mueve la prueba G36 de dos conexiones **después** del guard G37, asegurando los dos órdenes de competencia con los permisos nuevos; la ejecución local no implica CI verde hasta el SHA confirmado.

## Límites y prioridades siguientes
**NO LIVE / NO MERGE / NO despliegue / NO SQL remoto**. `SECURITY DEFINER` no autentica al usuario. Requiere Auth real, JWT, scopes, session revocation, protección de `service_role` en infraestructura de servidor y tests en STAGING autorizado. Se conserva la revisión de otros dominios DML en G38.

**Hallazgo G36/G5 por validar:** `delivered -> disputed` figura como paso legítimo G5 pero el reingreso de slot de G36 exige estado previo `requested`; testear y corregir su fencing antes de certificar el circuito de disputa. No afirmar que queda resuelto por G37.

**Continuidad:** G38 debe ligar aceptación a elegibilidad específica de la oferta (KYC, consentimiento revisionado, zona autorizada, frescura GPS, disponibilidad y slot atómico) y validar caducidad/carreras con SQL en dos sesiones. No confundir telemetry QA con operador físicamente disponible.

Responsabilidad A: `apps/mobility-expo/**`, `.github/**`, `docs/architecture/**`; PR #7 DRAFT. No se han modificado carpetas del Arquitecto B.

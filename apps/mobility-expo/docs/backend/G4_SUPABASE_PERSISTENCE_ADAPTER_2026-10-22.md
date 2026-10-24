# QORE Mobile — G4 adaptador persistente Supabase STAGING

**Fecha:** 2026-10-22

**Entorno:** rama DRAFT, STAGING sintético, `LIVE_TRIPS_ENABLED=false`

**Prohibido:** producción, pagos reales, SQL remoto, publicación o habilitación comercial.

## Resultado de esta ronda

Se cerró la brecha entre la frontera abstracta de persistencia y las RPC
transaccionales G3/G4 ya versionadas para PostgreSQL. El runtime local de
staging ya no implementa por separado la aceptación ni confía en identidades de
participantes declaradas por el cliente.

### Implementación

- `server/g4-supabase-dispatch-repository.mjs` implementa las cinco operaciones
  `request`, `offer`, `accept`, `transition` y `snapshot` con un cliente
  Supabase exclusivamente server-side.
- Las escrituras llaman las RPC SQL atómicas existentes:
  `mobility_stage_auto_demo_request`, `mobility_stage_auto_demo_offer`,
  `mobility_stage_auto_demo_accept_offer` y
  `mobility_stage_auto_demo_transition`.
- `snapshot` añade en la consulta de base de datos el filtro por `trip_id` y por
  el `actorId` ya resuelto en servidor como pasajero o conductor. El adaptador
  no usa `passengerId` o `driverId` enviados por el cliente para autorizar.
- `server/dispatch-persistence-contract.mjs` ahora valida cada operación con su
  forma real: solicitar no exige un viaje preexistente; aceptar usa oferta y
  clave idempotente; transición y snapshot exigen viaje; `dispute` permanece
  cerrado porque el estado SQL actual todavía no lo implementa.
- `server/g4-staging-runtime.mjs` usa el adaptador para lectura autorizada del
  estado del viaje y aceptación atómica. No crea clientes, no lee secretos y no
  abre una conexión remota por sí solo.

## Controles de seguridad

1. El actor procede de `auth.getUser` en el servidor.
2. Las identidades alternativas aportadas por el cliente se descartan antes de
   llegar al repositorio.
3. El snapshot con `service_role`, que evade RLS, compensa ese privilegio con un
   predicado SQL explícito de participante; un usuario ajeno obtiene denegación.
4. El adaptador solo admite `SYNTHETIC_STAGING` y `liveEnabled=false`.
5. AUTO mantiene servicios `economico`, `confort` y `xl`; MOTO comercial sigue
   cerrada. No hay tarifas reales, pagos ni datos personales nuevos.
6. Errores de RPC, recibos UUID inválidos, filas contradictorias y estados no
   implementados fallan cerrados.

## Verificación local

- TypeScript: PASS.
- Pruebas de dominio Expo: **102/102 PASS**.
- Pruebas de servidor Node: **145/145 PASS**; eran 138 en el handoff.
- Guardia `check-safety.mjs`: PASS, LIVE permanece deshabilitado.
- Nuevas pruebas cubren actor derivado, parámetros exactos de RPC, rechazo de
  spoofing, snapshot pasajero/conductor, actor extraño, viaje cancelado asignado
  o no asignado, transición no soportada y fallos de base de datos.

## Corrección del handoff maestro

El handoff Work afirmaba que faltaba una carrera PostgreSQL G4 y que el workflow
`mobility-g4-postgres-disposable.yml` era la única cobertura. La inspección del
HEAD demostró que `.github/workflows/mobility-ci.yml`, job
`g2-postgres-contract`, ya instala G1→G4 en PostgreSQL 16 desechable y ejecuta:

- carrera G3 de dos conductores;
- carrera G4 de dos ofertas privadas;
- outbox y ACK;
- carrera de dos workers para un solo claim.

El workflow manual sigue siendo un smoke redundante, pero no se lo amplió ni se
duplicó la misma prueba. Esta ronda atacó el pendiente real: el adaptador
persistente conectado al runtime y la autorización de participantes desde la
base.

## Límite de la evidencia y siguiente paso

Este cambio es código funcional y probado con dobles de Supabase más los
contratos SQL reales ya ejecutados en PostgreSQL efímero. **No** prueba un
Supabase remoto, dos teléfonos, GPS/push real ni un viaje comercial.

El siguiente bloque debe exponer, todavía solo en loopback/staging, endpoints
autenticados para solicitud de pasajero y transiciones de conductor usando este
repositorio; después debe probar el flujo HTTP completo contra el PostgreSQL
efímero. La activación remota continúa bloqueada hasta autorización expresa.

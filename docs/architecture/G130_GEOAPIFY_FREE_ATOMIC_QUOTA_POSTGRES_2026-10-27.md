# G130 — Geoapify Free, cuota atómica por día y sin reintentos billables

**Arquitecto A+B · QORE Mobile · 27 octubre 2026 · SOLO laboratorio PostgreSQL16**

## Entrega

El adaptador Geoapify G128 ya exige `reserveFreeQuota` pero antes no existía un contrato durable en PostgreSQL. G130 aporta una reserva **atómica y pesimista**. Por decisión del Owner se mantiene proveedor Geoapify **Free**; sin claves en dispositivos ni peticiones nuevas a Geoapify durante estas pruebas.

- Tabla diaria en UTC: máximo **100 llamadas reservadas** y **300 créditos apartados** (costo máximo de diseño conservador: 3 créditos por llamada). Es presupuesto de seguridad interno, NO afirmación sobre el cobro real de una ruta concreta ni sobre el precio vigente del proveedor.
- Tablas cerradas por RLS y privilegios; RPC `mobility_stage_g130_reserve_geoapify_free_qa` únicamente `service_role`, verificación de base y aplicación efímeras. `INSERT ... ON CONFLICT` y `SELECT FOR UPDATE` serializan instancias de backend del mismo día antes de apartar créditos.
- Clave idempotente = `coverageEvidenceId` independiente. Un segundo pedido sobre esa evidencia devuelve `approved:false/replayBlocked:true`; **nunca** aprueba otra consulta externa, ni siquiera si se perdió la respuesta anterior. La reserva se considera consumida tras commit, aun si falla el HTTP, para impedir repeticiones peligrosas.
- Rechaza actor, entrega, tipo de vehículo o evidencia distintos para una clave existente. `AUTO` y `MOTO` mantienen el cálculo tarifario G124 separado; ambos consumen el mismo grupo de créditos Geoapify Free.
- `g130-geoapify-free-quota-adapter.mjs` solo transforma el cuerpo G128 validado en el contrato PostgreSQL; sin un repositorio SQL real inyectado y aprobado, **OFF**.
- Pruebas SQL secuenciales hasta el límite + negativa 101, replays y permisos. Prueba en **conexiones PostgreSQL independientes y concurrentes**, incluidos múltiples intentos con la misma evidencia, sin llamadas a la API Geoapify.
- GitHub Actions `mobility-g130-geoapify-free-quota.yml`: sin ningún secreto; Postgres16 descartable `qore_disposable_geoapify`.

## Pendiente para conectar rutas auténticas y tarifas comerciales

1. Integrar un repositorio de PostgreSQL **real de STAGING autorizado** al adaptador G130, con autenticación service-role, límites operativos de conexión y prueba de inyección negativa. El SQL actual se niega a ejecutarse fuera de CI descartable.
2. Resolver geocodificación y cobertura paraguaya de origen/destino **en servidor** con evidencias geográficas independiente; geofence rectangular actual no demuestra cobertura legal. No confiar en coordenadas del Cliente.
3. Verificar peajes independientemente, no suponer costo cero. Integrar catálogo Owner tarifas, reglas por vehículo y zona y comisiones editables Admin para todos los servicios, incluyendo comercios.
4. Emitir PRE-cotización antes de una reserva comercial y conservar precio/version/TTL con aceptación explícita atómica; vincular con Driver C, Admin D y ledger por un ID único.
5. No activar tráfico en tiempo real: Geoapify usa `traffic=approximated`; no llamarlo tráfico LIVE.

**Estado:** G130 laboratorio atómico en GitHub, NO backend desplegado, LIVE, pagos, autorización de cuota externa, ni Store. No hacer merge ni consumir proveedor para certificarlo.

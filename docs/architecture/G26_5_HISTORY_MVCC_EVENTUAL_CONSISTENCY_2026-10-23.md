# G26.5 — MVCC y semántica verificable del historial (QA)

**Fecha:** 2026-10-23 · Arquitecto A · **SOLO PostgreSQL 16 descartable** · NO LIVE / NO SQL remoto / NO merge.

## Resultado y decisión técnica

El API \`GET /v1/staging/rider/history\` recupera el historial completo del propietario en páginas de hasta 50, sin un límite del total. Ordena \`(created_at, id, kind) DESC\`, usa ancla temporal y cursor HMAC privado. **Esto NO constituye un snapshot MVCC consistente a través de múltiples peticiones HTTP**, porque cada consulta PostgreSQL READ COMMITTED observa commits distintos.

Se adopta explícitamente **consistencia eventual por recorrido + refresco desde primera página** para el contrato QA actual. No se anunciará como snapshot fuerte ni como listado inmóvil entre páginas. La UI puede deduplicar por \`serviceId\` y reemplazar estados más recientes por \`revision\`, pero no puede garantizar cobertura de commits tardíos durante una sola exploración. Un refresco nuevo sin cursor debe recalcular el conjunto actual. El cursor firmado controla propiedad, ancla y orden; **no certifica ausencia de cambios concurrentes**.

## Dos anomalías reproducibles con PostgreSQL real y dos sesiones

1. **Commit tardío detrás del cursor.** Sesión A inserta antes de que se consulten 55 filas posteriores, permanece sin commit durante la página 1 y confirma antes de la página 2. El nuevo registro puede aparecer en página 2 pese a no existir en la fotografía inicial: **phantom**.
2. **Commit tardío delante del cursor.** Se confirman 55 filas; luego A inserta (sin confirmar) un registro de fecha más nueva; página 1 obtiene un cursor por debajo; A confirma. La continuación **no lo verá** porque quedó por encima del cursor. Una lectura nueva desde página 1 sí lo recupera.

La suite \`apps/mobility-expo/server/g26-history-mvcc-concurrency-ci.py\` prueba ambos casos con conexiones independientes, RDBMS real, 50 por página, unicidad en páginas observadas y \`transaction_timestamp()\` bajo G26.4. Corre después de índices G26.2, 31.200 filas G26.3 y guardas G26.4. Rechaza host o DB no descartables.

## Requisitos que se mantienen

- Sin límite global de pasajeros, conductores, viajes, envíos, pedidos ni historial. \`50\` es **solamente** límite de transporte HTTP. \`nextCursor=null\` finaliza el recorrido; no un máximo fijo de páginas.
- Propietario siempre derivado de JWT verificado en servidor; RLS e índices existentes se mantienen; cursor firmado y privado por actor. Nunca registrar ni compartir JWT, HMAC o cursor en telemetría pública.
- Revisión / cambios de estado entre páginas, bajas y retención legal pueden alterar resultados; la consistencia eventual no sustituye un registro de auditoría. La UI debe poder hacer refresco completo/reconciliación, no deducir estabilidad a partir de \`anchorMs\`.
- Un snapshot fuerte requiere un diseño adicional (p. ej. corte de commits materializado o un protocolo de snapshot retenido, con autorización y límites operacionales); ni \`created_at\`, ni secuencias asignadas al inicio de transacción garantizan orden de commit.
- No alterar \`created_at\` ni propietario; G26.4 ya endurece ambas invariantes. Cualquier futuro borrado/retención deberá tener política aprobada y pruebas de cursor.

## Gates posteriores abiertos

- G26.5 valida la **limitación** y el comportamiento esperado; NO habilita sincronización en teléfonos.
- A03: firma HMAC independiente + rotación de claves y tests de seguridad.
- A04–A07: JWT real STAGING, revocación, integración Cliente de B y backend Admin/Owner.
- A08+: sólo con autorización para el entorno HTTPS STAGING, Storage, dispositivos físicos; LIVE sigue bloqueado.

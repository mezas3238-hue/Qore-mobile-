# QORE Mobile / Movete Fácil — Arquitecto B, continuidad R26–R27

**Corte:** 23/oct/2026 (Paraguay). Rama `feature/mobility-cliente-admin-parallel-20261022`, [PR #8](https://github.com/mezas3238-hue/Qore-mobile-/pull/8) DRAFT, sin merge/deploy/LIVE/pagos/documentación personal/secretos. Solo `apps/movete-cliente/**` y `docs/architect-b/**`; backend/Driver/SQL a cargo exclusivo de A.

## Punto de partida: R25 validado

- SHA funcional R25 + fix R24 [`657ae065`](https://github.com/mezas3238-hue/Qore-mobile-/commit/657ae065ab798f07db2e2c2256256433f2259e9c): [Cliente/Driver/aislamiento #40048090271](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40048090271), [Admin #40048090084](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40048090084), [propiedad #40048090166](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40048090166) **3/3 SUCCESS**; Cliente **504/504 PASS**, Admin **185/185 PASS**, total QA **689/689**. No equivalen a dispositivos físicos o red operativa.
- Handoff R25 [`727de54e`](https://github.com/mezas3238-hue/Qore-mobile-/commit/727de54ea8941fa3626ca89a2878a5ad036bb43d): su propia CI documental ahora **3/3 SUCCESS**.
- OpenAPI de A, versión **G51**, **61 rutas**, chat con inbox y read receipt; todas las operaciones de chat tienen `x-qore-runtime-wired:false`. El gateway G51 de B sigue OFF por defecto y únicamente se prueba con identidades/orígenes sintéticos.

## R26 — hardening del gateway HTTPS G51

1. [`8da1462d`](https://github.com/mezas3238-hue/Qore-mobile-/commit/8da1462df5d24bd30b48a450e20fdc156e0f837f), `apps/movete-cliente/src/domain/g51-chat-inbox-http-gateway.mjs`:
   - Antes de construir `Authorization`, el token de sesión pasa un patrón ASCII estricto compatible con bearer b64token (mínimo 20, máximo 8192 caracteres base); bloquea CR, LF, espacios, tabs y colon para impedir inyección de encabezados o caracteres ambiguos.
   - La página G51 se valida en el propio gateway por orden descendente `updatedAt`, desempatando por `conversationId` descendente, de modo que no se entrega al caller ningún DTO desordenado aunque bypass el store.
   - Un `nextCursor` de respuesta idéntico al cursor enviado se rechaza inmediatamente `INVALID_CHAT_INBOX_DTO` para evitar bucles de replay.
   - Se conservan pin estricto de origen HTTPS, JWT Passenger, respuesta acotada, controles de actor y autorización, cancelación y flags OFF. No establece tope global de usuarios, registros ni conversaciones.
2. [`d78e2007`](https://github.com/mezas3238-hue/Qore-mobile-/commit/d78e20070754b3c2fb363eac48bd5321cb48ed22): cinco pruebas: bearer header injection, orden invertido, orden válido con empate, cursor repetido y continuación distinta/legítima.
3. CI del SHA `d78e2007`: [Cliente/Driver+aislamiento #40048698195](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40048698195), [Admin #40048698193](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40048698193), [ownership #40048698213](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40048698213). **Verificar conclusión exacta y logs antes de declarar PASS o conteo.**

## R27 — pruebas de extremo a extremo de Cliente con backend sintético

1. [`1e638aae`](https://github.com/mezas3238-hue/Qore-mobile-/commit/1e638aaecf02ddb1d62fbf2129e0e37b1a1b4d82), `client-experience.test.mjs`:
   - Cliente→sesión→transporte G51→store consume dos páginas con `X-Qore-Chat-Cursor` y `?limit=100`. Demuestra lectura `unreadCount=151` sin truncar a 99, recupera el orden y no impone cuota total.
   - Cambio de titular de cuenta después de una página borra todos los registros y cursores locales antes de permitir nueva vista, sin hacer petición a nombre del titular antiguo.
2. CI del SHA `1e638aae`: [aislamiento/Cliente/Driver #40048760128](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40048760128), [Admin #40048760159](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40048760159), [ownership #40048760144](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40048760144). **Comprobar estado/conteos al terminar**.

## Pendientes y continuidad sin detenerse

1. Verificar R26 y R27 CI. Si hay fallas, corregir únicamente rutas B y volver a comprobar mismo SHA del arreglo. Documentar diferencias.
2. Solicitar a A evidencia del montaje HTTPS real G51 STAGING con JWT Passenger y control PostgreSQL/RLS de actor/asignación. Aún no habilitar ningún flag de red desde clientes comerciales.
3. A debe confirmar semántica exacta de cursor firmado, `revision`, `expiresAt`, `updatedAt` y desempate UUID descendente; probar 401/403, dos usuarios y revocación de hilo por reasignación.
4. Acoplar GET/POST mensajes G50 y read receipt G51 solo cuando A complete autorización y contrato de idempotencia `requestKey`; Driver permanece separado.
5. Construir y probar Cliente/Admin en QA, móvil Android/iOS real y observabilidad sin PII antes de declarar producto listo. Lovable es interfaz posterior, no reemplaza infraestructura/autorización.
6. PR #7 A y #8 B DRAFT, **NO MERGE/NO LIVE** sin orden Owner.

**Verdad operativa:** la implementación R26/R27 no envía mensajes entre personas, no reserva vehículos y no opera en calle; son protecciones concretas y pruebas sintéticas con backend G51 aún desconectado.

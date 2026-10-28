# QORE Mobile / Movete Fácil — Arquitecto B · Continuidad R5
**Fecha:** 2026-10-23 · Paraguay · **PR #8 DRAFT** · Sin merge ni despliegue.

**Leer primero:** `docs/architect-b/HANDOFF_MAESTRO_B_R3_CLIENTE_ADMIN_TOTAL_2026-10-23.md`, `docs/architect-b/AVANCE_POST_R3_CLIENTE_CATALOGO_G40_2026-10-23.md` y `docs/architect-b/CONTINUIDAD_B_R4_G44_BUYER_BRANCHES_2026-10-23.md`.

## Alcance y responsabilidades
- **B:** `apps/movete-cliente/**`, `apps/movete-admin/**`, `docs/architect-b/**`. No se tocó `apps/movete-driver`, SQL, Node, OpenAPI del backend, ni configuración global.
- **A:** PR #7 DRAFT `feature/mobility-monorepo-isolated-20261016`; backend/Driver/PostgreSQL/Auth/OpenAPI. Usar su HEAD al momento de integrar, no SHA histórico.
- **Movete Fácil:** dos apps móviles INDEPENDIENTES (Cliente y Driver), más Admin Web. No hay producción, operadores/SOS reales, pagos PSP, Auth de proveedor certificado ni servicio HTTPS STAGING comprobado.

## Cambios de B en esta ejecución (R4 → R5)

| SHA | Archivos/acción | Controles |
|---|---|---|
| [7999fae7](https://github.com/mezas3238-hue/Qore-mobile-/commit/7999fae762de1c559651248a60841fa8888159eb) | `g44-buyer-http-gateway.mjs` + tests. Rutas GET G44 exactas de A: branches y catalog. HTTPS pinned, JWT Passenger, revisión/subject antes y después, credenciales omitidas, sin redirects, cuerpo UTF-8 acotado, tipo application/json, DTO filtrado y AbortController. | 11 pruebas nuevas. Workflows B ownership/Admin/two-app-isolation en [Actions](https://github.com/mezas3238-hue/Qore-mobile-/actions) SUCCESS sobre este SHA. |
| [ad646970](https://github.com/mezas3238-hue/Qore-mobile-/commit/ad646970bdf7be84c1f9a2d39aedc8ec7fded083) | Composición del gateway HTTP G44 dentro de `client-experience.mjs` y tipos; fallback a paginador y directorio sin modificar Driver. Hook sobre sesión activa, clear/logout cancela solicitudes. | 3 pruebas nuevas de integración sintética, 401, logout. Workflows del mismo SHA SUCCESS. |
| [b93a135f](https://github.com/mezas3238-hue/Qore-mobile-/commit/b93a135f77c92f842cc350fcb5d7fa0ac7fcdcb0) | Corrección de precedencia de `branchId` para impedir que context sobrescriba sucursal verificada. Tres pruebas sobre Auth pendiente, deadline y retarget. | 3 pruebas nuevas; ownership/Admin/aislamiento SUCCESS en [Actions](https://github.com/mezas3238-hue/Qore-mobile-/actions) de este SHA. |
| [676c05cf](https://github.com/mezas3238-hue/Qore-mobile-/commit/676c05cfd63745d351629bd0a3375956516b8c08) | `g45-order-qa-contract.mjs` + tests para reserva/cancelación G45: body exacto, idempotencia declarada, 1–50 ítems POR PEDIDO, única modalidad AUTO prevista en A, recibos de ensayo sin PSP. | 7 tests declarados; exigir conclusión CI por SHA (no inferir de commits anteriores). No hay gateway POST real, y el checkout sigue bloqueado. |

**Total agregado en esta sesión:** 24 pruebas de dominio Cliente (11+3+3+7). No sumar directamente a métricas históricas si los logs reportan distinto. El CI exacto del último HEAD tiene autoridad.

## Descubrimiento reciente en OpenAPI A

En el SHA A `7fd5be97430bbef7c2a3d35310c7620ab9fad530` verifiqué `1.0.0-g45`, 52 rutas:
- G44: `GET /v1/staging/buyer/branches` y `GET /v1/staging/buyer/branches/{branchId}/catalog`. `x-qore-runtime-wired=false`, `x-qore-qa-only=true`, sin confirmación HTTPS real.
- G45: `POST /v1/staging/buyer/orders/reservations-g45` y `POST /v1/staging/buyer/orders/{orderId}/cancel-reservation-g45`. También `runtime-wired=false`, QA-only y SIN PSP.
- G45 `BuyerReserveOrderG45`: `vehicleKind='AUTO'` únicamente. **Incompatibilidad con el negocio de entregas MOTO** admitidas por G44. B rechaza MOTO en la preparación G45, sin eludir seguridad; el seguimiento está en [issue #9](https://github.com/mezas3238-hue/Qore-mobile-/issues/9).
- G45 fija un máximo de 50 líneas en UNA transacción; no es límite de registros/usuarios/sucursales/ventas del sistema.
- Stock y subtotal PYG son del servidor, el cliente no determina importes transaccionales, reservas ni reembolsos reales.

## Lo que funciona y NO funciona

### Preparado técnicamente en B (QA)
- UI Expo Comercios: elegir municipio/servicio y sucursal, ver catálogo paginado y precios aprobados por DTO, con estado seguro durante Auth/refresco/rotación y logout; apagada por defecto si el gateway no está certificado.
- GET HTTP Buyer G44: gateway integrable por inyección explícita de flags, pinned HTTPS y sesión; validadores y pruebas adversariales. Ninguna llamada si falta cualquiera de las tres compuertas (enabled/contractCertified/stagingRuntimeVerified).
- G45: validadores exactos de solicitudes y recibos QA; NO POST, NO checkout, NO pago.

### Pendiente de A y certificación real
- Proveedor Auth real con sesiones Passenger, validez/issuer/audience/revocación, HTTPS STAGING, RLS SQL, permisos por municipio/zona y pruebas inter-actor.
- Runtime G44/G45 realmente montado, datos sin PII, cursores HMAC, fences de versión/stock/idempotencia concurrente, producto en stock y transacciones de compra.
- Política versionada de **MOTO_DELIVERY** para G45, si se habilita, con reglas de carga, seguridad, zona y precio distintos de AUTO.
- PSP/comercio/legalidad/tratamiento de incidentes/Driver GPS/dispatch antes de operación comercial.
- E2E con navegadores, Android/iOS y servicios reales; los tests de Node/Expo no prueban despliegue real.

## Próximas tareas para Arquitecto B — ejecutar autónomamente

1. Revisar **HEAD actual de PR #8** y CI del commit final (este documento genera SHA adicional). Reparar cualquier FAIL con logs de job Cliente/Admin sin detenerse.
2. G45: preparar flujo de reserva *QA* idempotente con conservación de requestKey en red ambigua y reconciliación verificable SOLO cuando A publique endpoints STAGING montados; mientras tanto tests de pure DTO y sin POST.
3. Auditoría de accesibilidad/usabilidad de Cliente (moto/auto/sucursal/comercios), teclado, pantalla pequeña, textos es-PY, errores de tiempo de espera, caché privada y 120+ páginas sin cuota global.
4. Admin Web: G41 incidentes filtrados, seguridad MFA, auditoría y paginación; no habilitar SOS/decisiones fuera de contrato montado.
5. Sin pisar archivos A: pedir garantías de Auth/JWT/SQL y G45 MOTO por issue #9; revisar OpenAPI del **último SHA de A**, NO asumir versión fija.
6. Mantener PR #8 DRAFT, no merge, no despliegue, no Live, sin credenciales/PII, sin PSP real. Lovable será solo UI definitiva tras certificación de servicios reales.

**Directiva de continuidad:** nunca comenzar de cero; continuar en PR #8 y avanzar a otra tarea B si A mantiene una API bloqueada. Detenerse solo por bloqueo técnico real.

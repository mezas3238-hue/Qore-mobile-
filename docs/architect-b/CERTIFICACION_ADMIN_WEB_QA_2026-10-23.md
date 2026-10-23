# QORE Mobile — Certificación técnica de QA del Admin Web
**Fecha:** 23 octubre 2026 · **Repositorio:** `mezas3238-hue/Qore-mobile-` · **PR:** [#8 DRAFT](https://github.com/mezas3238-hue/Qore-mobile-/pull/8)

## Resultado comprobado
El workflow del Arquitecto A **`Movete Facil Admin web QA`** ya existe en su carpeta `.github/workflows/movete-admin-web-qa.yml`, y permitió ejecutar pruebas reales del panel B aislado del backend y de las dos apps móviles.

**Commit de código evaluado:** `4b86173fb8ea047a3e1ff38e097aa7e937bd4e25`.
**Evidencia oficial:** [GitHub Actions #39893653452 — SUCCESS](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39893653452).

| Gate | Resultado verificado |
|---|---|
| Instalar dependencias solo en `apps/movete-admin`, sin scripts lifecycle | SUCCESS |
| `npm run typecheck` / TypeScript en modo estricto | SUCCESS |
| `node --test src/*.test.mjs` | **79 tests, 79 PASS, 0 FAIL** |
| `npm run build` / Vite web QA | SUCCESS |
| Existe `dist/index.html` y assets compilados | SUCCESS |
| Boundary Architect B #39893653625 | SUCCESS |
| Cliente/Driver isolation #39893653495 | SUCCESS |
| Despliegue o autorización LIVE | **NO REALIZADO** |
| Certificación backend JWT/roles/MFA/ledger/RLS | **PENDIENTE** |
| Pruebas E2E de navegador con servidor real | **PENDIENTE** |

El archivo de salida `dist` se generó únicamente en el runner efímero. **No es un despliegue**, publicación de dominio, login real ni aprobación del propietario para producción.

## Historial de fallos corregidos — no ocultar
1. Primer nuevo CI Admin #39893192186: `npm ERESOLVE`; `@types/react-dom` con rango `^19.2.3` ascendió a 19.3.0 e impuso `@types/react ^19.3.0`. Corrección `936e663a251ed45576600a45802dc4d1d384153a`: fijar `@types/react-dom` a 19.2.3. No se usó `--force` ni `--legacy-peer-deps`.
2. CI #39893321515: TypeScript detectó acceso a `panels[page]` en rama `never` del JSX (todos los Page estaban cubiertos). Corrección `b35e77b6f75df5b041b5f7437dcaee8192c20503`: rama por defecto segura sin indexación imposible.
3. CI #39893440275: 32 fallos de tests de dominio, raíz en expresiones UUID inválidas. Corrección global `60cb01dc77da2e4522ba42e812befdc5a4e29ba5` en Admin Access, Admin Session, Zones e Incidents.
4. CI #39893542340: cinco pruebas restantes en Zones, por uso de identificador `payload` no declarado dentro de `replace(raw, role)`. Corrección `4b86173fb8ea047a3e1ff38e097aa7e937bd4e25` — `replace(payload, role)` sin shadowing, TTL de vehículos conservado. La siguiente re-ejecución pasó 79/79.

## Arquitectura y funciones ya cubiertas por pruebas
- `admin-session`: sesiones efímeras Owner/Admin, MFA exigida por proveedor, invalidación al cambiar cuenta/rol, rechazo de Auth tardío y logout remoto fallido sin exponer token en UI.
- `admin-access`: credenciales omitidas en fetch, HTTPS origin fijo, revisión KYC desactivada hasta certificación de contrato, exclusión concurrente por vehículo y timeout.
- `admin-experience`: composición de KYC, finanzas Owner, zonas, incidentes, auditoría; vistas separadas por rol, borrado de snapshots ante cambio de identidad.
- `owner-finance`: agregados PYG reconciliados por titular, TTL, revisión, pérdidas netas legítimas permitidas, sin PII.
- `kyc-queue`: lectura mínima de estado documental; sin fotos, credenciales o identificación sensible.
- `zone-overview`: `ACTIVE` cobertura **no equivale a disponibilidad**; recuento en línea caduco a 60 s se elimina aunque el snapshot de cobertura siga vigente.
- `incidents-overview`: categorías/gravedad/estado solo lectura; nunca suspensiones automáticas o emergencia real.
- `audit-feed`: pantalla de eventos mínimos recibidos del backend, sin escritura de auditoría desde navegador; verificación de integridad todavía responsabilidad de A.

## Bloqueos que SÍ continúan
1. **No hay Auth Backend certificada** de pasajero, administrador y propietario ni MFA servidor auditada. No basta la verificación de rol del frontend.
2. **No hay DTO/endpoints de lectura reales** para finanzas Owner, zonas, incidentes, auditoría e historial Cliente. Los contratos documentados son propuestas en [issue #9](https://github.com/mezas3238-hue/Qore-mobile-/issues/9).
3. Falta probar autorización efectiva por RLS/DB, JWT roles, MFA real, retries/offline, privacidad, infraestructura de pagos, expedientes legales y auditoría inmutable.
4. Falta E2E de navegación y accesibilidad en navegador real, despliegue STAGING controlado y pruebas nativas para Cliente/Driver.
5. **No ejecutar merge, deploy ni LIVE** sin aprobación Owner. Los dos móviles deben seguir independientes y Admin es **web separada**, no otra app móvil.

## Siguiente fase para Arquitecto B
Preparar escenarios E2E de navegador con datos sintéticos, controles Owner/Admin por rol, validación de expiración y flujos de contingencia; integrar solo cuando A certifique autenticación, contratos y políticas. El trabajo actual queda íntegramente en `apps/movete-admin/**`, `apps/movete-cliente/**` y `docs/architect-b/**`.

**Resultado exacto:** Admin Web compila y supera 79 pruebas unitarias en QA; **no está certificado para operar negocios reales**.
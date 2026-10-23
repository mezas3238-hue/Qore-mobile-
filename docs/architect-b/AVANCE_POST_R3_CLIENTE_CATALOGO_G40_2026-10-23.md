# QORE MOBILE — Arquitecto B: avance de ejecución posterior a Handoff R3

**Fecha:** 2026-10-23 (Paraguay). **Alcance:** apps/movete-cliente/** y docs/architect-b/** únicamente.
**Origen de continuidad:** [HANDOFF MAESTRO R3](./HANDOFF_MAESTRO_B_R3_CLIENTE_ADMIN_TOTAL_2026-10-23.md).
**Rama:** `feature/mobility-cliente-admin-parallel-20261022` · [PR #8 DRAFT](https://github.com/mezas3238-hue/Qore-mobile-/pull/8).
**Base:** Arquitecto A, PR #7 DRAFT, sin merge; respetar ownership y evitar rebase unilateral.

## Hechos ejecutados, sin reiniciar el proyecto

| SHA / enlace | Cambio específico | Evidencia |
|---|---|---|
| [7208513b](https://github.com/mezas3238-hue/Qore-mobile-/commit/7208513b8ada98aae542fc90cc7c07a5caf61b05) | Lock ANTES de await getActor en commerce-catalog-flow; invalida logout/Auth, evita doble tap y dos sucursales en carrera; oculta precios durante refresh y bloquea cambios/preview | 4 pruebas de regresión nuevas. Actions [ownership #39992974463](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39992974463), [Admin #39992974466](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39992974466), [isolation #39992974498](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39992974498) y [#39992967896](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39992967896), todos SUCCESS |
| [cf4b8951](https://github.com/mezas3238-hue/Qore-mobile-/commit/cf4b8951348c64e5c1d9576dffb82e370044ee47) | Contrato de catálogo rechaza campos extra incluso PII de DTO; conserva solo metadato nextCursor excepcional para proyector del paginador, sin exponerlo como producto; 2 tests con 300 mutaciones deterministas | Actions [ownership #39993352183](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39993352183), [Admin #39993352197](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39993352197), [isolation #39993352095](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39993352095), [#39993345166](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39993345166), todos SUCCESS |
| [815d246f](https://github.com/mezas3238-hue/Qore-mobile-/commit/815d246f9c24acf57b3dfc2778e3da54a3bfddfa) | Comercios.tsx: refresh ahora usa load() con estado/feedback único, UI distingue carga de vencimiento, precios y stock anteriores no se exponen | Actions [ownership #39993512477](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39993512477), [Admin #39993512502](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39993512502), [isolation #39993512647](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39993512647), [#39993505250](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39993505250), todos SUCCESS |
| [d6e0e083](https://github.com/mezas3238-hue/Qore-mobile-/commit/d6e0e083450d876103f57503483f22ced0dd8282) | 3 pruebas nuevas G40: límite streaming 8192 bytes sin fallback text(), JSON truncado, ACK después de rotación de actor/JWT | CI del commit en [Actions del repositorio](https://github.com/mezas3238-hue/Qore-mobile-/actions), comprobar conclusión final por SHA |

| [6a2932f2](https://github.com/mezas3238-hue/Qore-mobile-/commit/6a2932f218dfdb8194793aa8ff74a8163d310840) | Admin G41: clear con epoch por sesión, purga al perder MFA, oculta filas antiguas durante pagination; tres tests de carrera/privacidad | [Admin #39994515753](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39994515753), [ownership #39994515642](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39994515642), [isolation #39994515856](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39994515856), SUCCESS |
| [be0d6c52](https://github.com/mezas3238-hue/Qore-mobile-/commit/be0d6c5224720dc3d7a3bf4cdcc7b4da481a5fef) | smoke buyer catalog STAGING, sin ruta inventada, OFF por defecto; 5 pruebas de contrato, HTTP 401/403/404/409/429/503, TTL, privacidad y revocación | [ownership #39994862880](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39994862880), [Admin #39994863074](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39994863074), [isolation #39994863851](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39994863851) y [#39994853749](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39994853749), SUCCESS |
| [d2d09e68](https://github.com/mezas3238-hue/Qore-mobile-/commit/d2d09e68878deecbfe3f8ed15fff0453e64a4e26) | G41 HTTP: cancelPending con AbortController + epoch, flow cancela consulta obsoleta; no libera lock de la nueva sesión. 2 tests nuevos | [ownership #39995250691](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39995250691), [Admin #39995250655](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39995250655), [isolation #39995250692](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/39995250692), SUCCESS |

## Matriz de entrega y seguridad

- **B-P0-01: completado QA** — catálogo lock previo a Auth + pruebas doble tap, sucursales competidoras, logout y pérdida de autenticación; el estado de compra permanece bloqueado.
- **B-P0-02: completado QA básico** — DTO catálogo estricto y mutaciones deterministas; no reemplaza fuzzing de datos reales, pentest ni validación backend.
- **B-P0-03: completado QA** — refresco de Comercios unificado y estado visual seguro. No hay catálogo real habilitado sin el proveedor de A certificado.
- **B-P0-04: completado smoke sintético** — sin endpoint inventado ni llamadas HTTP por defecto; integración REAL sigue BLOQUEADA por GET Buyer sin montar.
- **B-P0-05: ampliado QA** — pruebas de G40 para stream/ACK cruzado. No hay operador/SOS: un recibo `RECEIVED_IN_QA_DATABASE_ONLY` acredita exclusivamente DB de ensayo.
- **B-P0-06: ampliado QA G41** — carreras logout/rotación MFA, cancelación HTTP, ocultación de páginas viejas; servidor real sigue no montado.
- **Registros:** páginas de 50/100 nunca limitan cardinalidad global; el carrito local de 50 líneas sigue siendo restricción explícita de UX, no límite de usuarios/registros.
- **Dos apps independientes:** cliente/pasajero en `apps/movete-cliente`, conductor en `apps/movete-driver` (A). Admin es web separada. Ninguna carpeta A editada.
- **PR #8 continúa DRAFT.** Sin merge, despliegue, usuarios reales, pagos reales, JWT productivo, VPS, datos de documentos ni LIVE.

## Pendientes a continuar SIN esperar bloqueos externos

1. B-P0-04 integración REAL: exigir GET Buyer server-side firmado/versionado, JWT/RLS, cursor sujeto/revisión y prueba STAGING antes de conectar el smoke ya construido; pendiente de A.
2. B-P0-06: ampliar QA G41 con pruebas manuales navegador/lectores de pantalla, datasets extremos y revocación de MFA real. 120+ páginas y tests sintéticos ya cubiertos.
3. B-P1: pruebas E2E en dispositivo Cliente y navegador Admin, accesibilidad, localización es-PY, caídas de red, 10k registros sintéticos.
4. Integración con Auth/contratos servidor A por [issue #9](https://github.com/mezas3238-hue/Qore-mobile-/issues/9), actualizada con faltantes Buyer/G40/G41; únicamente después de verificación STAGING real.
5. Lovable: solo interfaz visual luego de certificar contratos; ni pagos, ni seguridad, ni despacho en frontend.

## Reanudación

Leer R3 y este delta; tomar el HEAD actual del PR #8 (no asumir que d6e0e083 es final); verificar CI del HEAD exacto. Siguiente tarea autónoma recomendada: P0-04. Si falta API A, documentar issue #9 y continuar G41/QA independientes. Seguir SIN detenerse salvo bloqueo técnico real y jamás confundir tests sintéticos con app operativa.


## Verificación de cierre técnico de este tramo

- Corte anterior R3: **313 pruebas Cliente y 180 Admin** (documentado en R3). Este tramo añadió **14 nuevos test() Cliente** (4 catálogo concurrencia + 2 validación DTO + 3 G40 + 5 smoke) y **5 Admin** (3 G41 flow + 2 G41 gateway). La cifra agregada exacta debe extraerse de logs del HEAD; no confundir incremento de casos declarados con certificación end-to-end.
- **Siete commits técnicos + una documentación previa** en este tramo; todos los CI de los SHAs técnicos listados arriba concluyeron SUCCESS. La presente edición documental genera un SHA nuevo y requiere verificación propia.
- La última API A constatada continúa en OpenAPI `1.0.0-g41`, 48 paths, sin GET Buyer branches/catalog. G40/G41 expresamente no montados. PR #7 de A y PR #8 de B continúan DRAFT; no hubo merge, LIVE ni pagos.
- Este tramo no altera `apps/movete-driver`, backend A, `.github`, SQL, root scripts/lockfiles ni configuración de producción.

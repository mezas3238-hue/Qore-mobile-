# QORE Mobile / Movete Fácil — Arquitecto B R4 · Cliente y catálogo G44

**Fecha:** 2026-10-23 · Paraguay. **PR #8:** DRAFT. **No merge, deploy, LIVE, VPS, PSP ni datos reales.**
**Handoff madre:** `docs/architect-b/HANDOFF_MAESTRO_B_R3_CLIENTE_ADMIN_TOTAL_2026-10-23.md`.
**Avance R3 precedente:** `docs/architect-b/AVANCE_POST_R3_CLIENTE_CATALOGO_G40_2026-10-23.md`.
**Repositorio:** https://github.com/mezas3238-hue/Qore-mobile-
**Rama B:** `feature/mobility-cliente-admin-parallel-20261022`; solo editar `apps/movete-cliente/**`, `apps/movete-admin/**`, `docs/architect-b/**`.
**Rama A:** `feature/mobility-monorepo-isolated-20261016`, PR #7 DRAFT, avance concurrente. Nunca asumir un SHA A fijo.

## Hechos nuevos de esta sesión (sin reiniciar trabajo)

| Commit B | Entrega | Pruebas / riesgos |
|---|---|---|
| [f03adf5f](https://github.com/mezas3238-hue/Qore-mobile-/commit/f03adf5fe048c0f227bf2ff10948377949d61806) | Paginador Buyer oculta precios y filas de página anterior mientras se lee otra, no restaura logout viejo | 2 nuevos tests. CI de aislamiento [#40000603774](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40000603774) SUCCESS |
| [e689dceb](https://github.com/mezas3238-hue/Qore-mobile-/commit/e689dceb36a1ca38de662a496add7dbbba1fb107) | Integra paginador Buyer al runtime Cliente, d.mts, navegación en Expo Comercios **solo lectura**; sin carrito multi-página | 3 tests de sesión/paginación. CI [#40000822146](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40000822146) SUCCESS |
| [8dfb32ce](https://github.com/mezas3238-hue/Qore-mobile-/commit/8dfb32ce429e26f7c1825a0d9c8f249188209c4f) | Precios/artículos solo visibles si código UUID seleccionado coincide con catálogo verificado; no conservar sucursal vieja al editar | 1 test. CI [#40001295623](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40001295623) SUCCESS |
| [c4e6a264](https://github.com/mezas3238-hue/Qore-mobile-/commit/c4e6a264d7252d6eaf4c8640c5d1a11016e81a60) | Adaptador G44 exacto: catálogo `version` entero seguro a revisión opaca `g44:<n>`; DTOs de sucursal, cursores, rechazos de PII, stock 0 y flags productivos. No HTTP sin evidencia | 6 tests, 110 páginas sintéticas. CI [#40001749275](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40001749275) SUCCESS |
| [1492fdf7](https://github.com/mezas3238-hue/Qore-mobile-/commit/1492fdf7e98fd0802a2f71a8c0f0ba844999c71b) | Directorio paginado G44 por municipio y AUTO/MOTO_DELIVERY con revisión de sesión, TTL local 30 segundos, 120 páginas sintéticas, sin límite global | 6 tests. **CI detectó 4 FAIL** en [#40002034200](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40002034200) por error UUID; no ocultar |
| [1aa58885](https://github.com/mezas3238-hue/Qore-mobile-/commit/1aa58885ffee187760cb00c8fa44e07b5d424c3a) | Directorio G44 integrado en ClientExperience + d.mts, purga privada en logout/token rotado | 3 nuevos tests; hereda fallo previo hasta fix |
| [e4d70686](https://github.com/mezas3238-hue/Qore-mobile-/commit/e4d70686ea492a393e110b08808cae512a6c6a6f) | Formulario de municipio, elección moto/auto, páginas anterior/siguiente y transferencia del UUID autorizado a las vistas de catálogo/carrito. Interfaz oculta si API OFF | Aún dependía de fix de UUID |
| [204081bc](https://github.com/mezas3238-hue/Qore-mobile-/commit/204081bc909eb58b3a49ba1bdfaddf593b6fcbad) | **Fix exacto**: regex UUID de Directorio G44 debía ser `8-4-4-4-12` y omitía el cuarto segmento, causando AUTH_REQUIRED en pruebas correctas | Comprobar conclusión CI del fix **sobre este SHA**, no imputar SUCCESS previo |

**Añadidos técnicos totales de esta sesión:** ocho commits de código (incluida reparación), 21 pruebas declaradas (2+3+1+6+6+3). Las suites pueden contar distinto por cambios externos: utilizar logs exactos y SHA; nunca inferir SUCCESS por sumar tests. Si las pruebas de 204081bc aún no han terminado, mantener gate pendiente, revisar job Cliente y corregir hasta 0 FAIL.

## OpenAPI de A constatado ahora

**A HEAD consultado:** `9e4f5bd9825437c21df1912c37dc25894f0b3033`. **OpenAPI: `1.0.0-g44`, 50 paths**.
- `GET /v1/staging/buyer/branches` con `municipality`, `serviceKind`, cursor; respuesta BuyerBranchPageG44.
- `GET /v1/staging/buyer/branches/{branchId}/catalog`; 100 ítems/página, cursor HMAC con identidad, rama y revisión; respuesta BuyerCatalogPageG44.
- Los dos endpoints G44 **`x-qore-runtime-wired=false`** y **`x-qore-qa-only=true`** al observarse. No existe evidencia de servicio HTTPS STAGING montado, JWT Passenger autenticado real ni permisión para pedidos.
- G40/G41 siguen `runtime-wired=false`, sin SOS ni operador real; G44 orderEnabled/eligibleByPolicy/productionEnabled FALSE, catalog snapshotConsistent FALSE.
- OpenAPI define `version:int64` y campos de seguridad adicionales, distintos del DTO interno previo de B. El adaptador G44 mapea SOLO un subconjunto seguro y falla cerrado ante int64 fuera del rango representable sin pérdida de precisión.
- **No activar** `stagingRuntimeVerified`, `enabled`, `contractCertified` por la presencia de esquemas o fixtures; todas las vistas nuevas quedan ocultas por defecto.

## Alcance real

- **Cliente:** exploración de sucursales y productos en QA sintética con estado y paginación, selección de sucursal, sin pedidos, reservas de stock o dinero. Carrito de una sola página separado del explorador multi-página.
- **Driver:** aplicación independiente propiedad del Arquitecto A, no editada.
- **Admin Web:** aplicación independiente, no editada en esta sesión; su CI se verifica junto con aislamiento.
- **Base de datos y Auth:** solo A; los tests B NO verifican Auth/JWT real, RLS, PSP, consultas de registros reales, GPS ni nativos Android/iOS.
- 100 sucursales/productos **por respuesta** NO es máximo global; el software debe permitir paginar cuantas páginas autorice servidor sin confundir total de la base.
- En [issue #9](https://github.com/mezas3238-hue/Qore-mobile-/issues/9) se comunicó el nuevo estado de integración y lo requerido a A.

## Siguientes tareas sin detenerse salvo bloqueo real

1. Confirmar en GitHub CI del último HEAD B completo, diagnosticar falla con logs y repararla inmediatamente. Verificar TypeScript + Expo web export Cliente, Admin check/build, Driver aislamiento y ownership.
2. Continuar con QA de contrato G44: respuestas fuera de revisión, cursor cruzado/cuenta distinta, expiración, municipio cambiado, 429/503, representación de 100 filas y selector en pantallas pequeñas. Adaptar a API A solo cuando demuestre runtime STAGING montado y Auth.
3. Preparar pruebas UI E2E en navegador y Android/iOS controlados, teclado/lector pantalla/offline/2G; declarar sin certificar donde no existan capturas/instalaciones reales.
4. Con A: Auth real, JWT y MFA, KYC, despacho, GPS, política de zonas, catálogo/sucursales Buyer firmado y transición de pedido atómica; no tocar API/SQL/CI global de A.
5. Lovable solo interfaz definitiva y navegación cuando contratos funcionales estén certificados; no migrar tarifas/pagos/roles al cliente.
6. Actualizar PR #8, issue #9 y este documento con los nuevos SHAs y CI reales. **Nunca merge/deploy/LIVE sin orden explícita Owner.**

**Continuidad:** nuevo arquitecto B debe leer R3 + el avance previo + R4; empezar desde HEAD de PR #8, no desde cero, sin pedir aprobación por cada test/cambio ordinario, priorizando defectos reales y manteniendo aislamiento A/B.

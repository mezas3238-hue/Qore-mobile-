# QORE Mobile — Arquitecto B R50 · selección segura de sucursales G44

**24 octubre 2026** · Repositorio `mezas3238-hue/Qore-mobile-` · Rama aislada B `feature/mobility-cliente-admin-parallel-20261022` · PR #8 **DRAFT**.

## Problema real identificado

Tras R48, una sucursal que el usuario veía en pantalla se validaba contra el reloj, pero el callback de selección todavía podía aceptar una fila perteneciente a un snapshot G44 antiguo aunque la sesión Passenger, municipio, rubro o la página hubieran cambiado entre un render y el toque. Tener TTL vigente no prueba que la página visible sea todavía la actual.

## Código R50 implementado

- `apps/movete-cliente/src/domain/commerce-branch-selection-guard.mjs`: `guardCommerceBranchSelection(displayed,current, options)` compara al tocar el botón los dos snapshots (último render vs `client.snapshot()`) con los siguientes invariantes: sesión Passenger, subject UUID, revisión de privacidad/JWT; certificación G44, sin lectura/error; expiración de ambas páginas; igualdad estricta de municipio, modo de entrega, paginación y TTL; página de hasta 100 filas; identidad/orden de todas las filas y ausencia de duplicados; esquema sin campos PII; categoría elegida y pertenencia de la sucursal a la página actual. No acepta `ordersEnabled`, `paymentsEnabled`, `availabilityVerified` ni `serverSnapshotConsistent` como true. Devuelve exclusivamente ID de sucursal validado para **consultar posteriormente** el catálogo, nunca una orden.
- `commerce-branch-selection-guard.d.mts`: definiciones seguras del resultado y argumentos.
- `commerce-branch-selection-guard.test.mjs`: 10 pruebas con casos positivos y regresiones adversariales: logout, cambio de actor/JWT, TTL exacto, municipio/modo, rubro equivocado, filas reemplazadas, capacidades indebidas, PII, duplicados, inputs inválidos y 100 filas por página sin techo global.
- `apps/movete-cliente/app/comercios.tsx`: el botón Elegir sucursal ahora invoca el guard contra `client.snapshot()` **justo en onPress** antes de llamar a `onSelect`; al fallar muestra mensaje seguro para volver a consultar. Mejora la indicación accesible de que seleccionar no equivale a comprar ni comprobar disponibilidad.

## Límites y evidencias que faltan

R50 no llama APIs nuevas ni habilita credenciales, LIVE, compra, precio, stock, delivery, PSP o SOS. Backend A es responsable de verificar titularidad y privilegios en cada solicitud futura; la coherencia en cliente no reemplaza autorización de servidor ni prueba E2E real.

Certificar siempre los **tres workflows del mismo SHA final**: Architect B ownership, Admin QA, two-app isolation con Cliente/Driver TypeScript, pruebas Node y Expo export web. La exportación web no equivale a apps nativas firmadas o pruebas TalkBack/VoiceOver.

## Continuidad autónoma R51

Avanzar en Cliente con accesibilidad y consistencia de carrito y mensaje de caducidad sin pisar Driver/backend de A. Mantener issue #9 para los contratos comerciales y sesiones reales. NO MERGE, NO LIVE, NO DEPLOY, NO PSP, NO datos reales sin orden Owner. Continuar sin detenerse salvo bloqueo auténtico.

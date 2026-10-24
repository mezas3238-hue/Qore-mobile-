# QORE Mobile — Arquitecto B · R48: expiración verificable de sucursales G44

**Fecha:** 24 de octubre de 2026 · **Repositorio:** `mezas3238-hue/Qore-mobile-` · **Rama:** `feature/mobility-cliente-admin-parallel-20261022` · **PR #8:** DRAFT, NO MERGED.

## Problema real
El backend consumidor B G44 ya descartaba páginas del directorio transcurridos 30 segundos en `snapshot()`, pero React Native no re-renderiza por el mero paso del tiempo. Una fila y su botón de selección podían permanecer pintados tras el TTL hasta otra actualización. Mostrar sucursales obsoletas puede inducir a pensar que todavía están verificadas.

## Código funcional R48 (archivos propiedad B)
1. `apps/movete-cliente/src/domain/g44-branch-directory.mjs` publica un `expiresAt` local, derivado de `receivedAt + 30000`, sólo si la página es válida, no está en vuelo y el reloj es seguro. En fallo devuelve `expiresAt:null` y vacía la proyección de filas. No altera semántica G44 ni inventa una caducidad del servidor.
2. `apps/movete-cliente/src/domain/client-experience.d.mts` incorpora `branchDirectory.expiresAt:number|null` al contrato del snapshot.
3. `apps/movete-cliente/app/comercios.tsx` reutiliza `useCommerceExpiryClock` R47 y `isCommercePageFresh` para re-renderizar al cumplirse los 30 segundos y al regresar del background; oculta la lista/paginador G44 vencida, muestra error accesible y no permite selección o navegación tras expiración. Además de deshabilitar botones en React, el controlador `onPress` vuelve a comprobar `Date.now()` para cubrir el lapso antes del siguiente render.
4. `apps/movete-cliente/src/domain/g44-branch-directory.test.mjs` añade 3 pruebas: límite exacto de TTL con descarte de filas y cursor, snapshot durante lectura pendiente y reloj no válido/regresivo.

## Invariantes conservadas
- Sucursales G44 son **descubrimiento QA**, NO garantía de repartidor disponible, de horario, ni de checkout habilitado. `eligibleByPolicy:false`, `orderEnabled:false` y `availabilityVerified:false` permanecen.
- No existen endpoints HTTP nuevos, operaciones de comercio ni datos ficticios presentados como reales.
- La validación del servidor y el actor Passenger siguen siendo obligatorios; no se supone que el reloj local certifique stock o precios. Los flags runtime certificados conservan default OFF.
- Paginación por página, sin límite global de clientes/comercios; sin PSP, LIVE, servicio de emergencia o acceso a PII.
- G44 usa expiración **local a 30s del recibo**; la autenticidad y vigencia de la fuente continúan siendo responsabilidad del backend A.

## QA y continuidad
Verificar **mismo SHA final**: a) ownership B, b) Admin QA, c) two-app isolation con Cliente/Driver typecheck, tests y export web. No atribuir al nuevo commit pruebas pasadas; no confundir export web con APK/IPA ni lector de pantalla físico.

**R49 próximo:** mejorar controles de acciones de carrito/sustituciones bajo caducidad o revisión de catálogo, y accesibilidad real, siempre dentro del dominio B. Esperar integración Auth/HTTPS STAGING y contratos de A en issue #9 sin detener trabajos independientes.

**Orden vigente Owner:** seguir desarrollando sin detenerse salvo bloqueo real. NO MERGE, NO LIVE, NO DEPLOY, NO VPS, NO PSP, NO datos reales sin orden expresa.

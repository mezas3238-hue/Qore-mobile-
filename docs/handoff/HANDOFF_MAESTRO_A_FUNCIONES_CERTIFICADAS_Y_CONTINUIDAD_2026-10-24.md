# QORE Mobile — Movete Fácil
# HANDOFF MAESTRO INTEGRAL DEL ARQUITECTO A
## Continuidad G0–G70, KYC, selfie, bloqueo por vencimientos y prioridades para completar la aplicación
**Corte verificado:** 24 de octubre de 2026. **Repositorio:** https://github.com/mezas3238-hue/Qore-mobile- (guion final).

**DIRECTIVA DEL OWNER:** continuar el desarrollo sin detenerse salvo bloqueo real de una acción específica. Priorizar entregar funciones completas y certificadas, **no aumentar commits**. Una falla corregible de CI no es un bloqueo real. Si falta autorización para proveedor externo, datos reales o despliegue, documentar solo esa dependencia y avanzar en otra tarea QA autorizada. No volver a pedir instrucciones respondidas.

**PROHIBICIONES:** NO MERGE, NO LIVE, NO DEPLOY, NO VPS, NO SQL remoto, NO PSP/pagos reales, NO uso de PII/biometría real en QA, NO secretos ni push/SMS reales sin orden, NO publicar binarios ni editar las carpetas del Arquitecto B. PR abiertos DRAFT.

---

## 0. Fuente de verdad y foto actual de GitHub

- Repo: https://github.com/mezas3238-hue/Qore-mobile-
- **A:** rama feature/mobility-monorepo-isolated-20261016, [PR #7](https://github.com/mezas3238-hue/Qore-mobile-/pull/7), base main, DRAFT, no merge.
- **B:** rama feature/mobility-cliente-admin-parallel-20261022, [PR #8](https://github.com/mezas3238-hue/Qore-mobile-/pull/8), base rama A, DRAFT, no merge.
- Coordinación técnica: [issue #9](https://github.com/mezas3238-hue/Qore-mobile-/issues/9).
- Último **SHA funcional** A: **2685e478c606a3b2335a90920965460c7e3ddb41**, 4/4 SUCCESS QA.
- HEAD B observado: **ac7ad3561972e28ddd3b428ba14038fe627f7fdc**, 3/3 SUCCESS QA propia.
- A tenía 761 blobs Git en el corte, árbol no truncado. Es auditoría, no avance de producto.
- Estado comercial: **NO_GO**. Matriz canónica [G61 17 gates](../architecture/MOVETE_FACIL_LAUNCH_GATES_2026-10-24.json) sin evidencia integral; B mantiene 20 recorridos comerciales sin E2E real certificado.
- **Importante:** el commit del handoff es documental, posterior al SHA funcional. **Nunca atribuir el 4/4 del código anterior al nuevo SHA documental** sin comprobar workflows propios.

### Historia obligatoria para el sucesor
- [Handoff A G0–G66, 463 líneas](./HANDOFF_MAESTRO_ARQUITECTO_A_G0_G66_CONTINUIDAD_SIN_PAUSAS_2026-10-24.md): historial técnico exhaustivo G0–G66.
- [Handoff A G0–G58E](./HANDOFF_MAESTRO_ARQUITECTO_A_G0_G58E_CONTINUIDAD_SIN_PAUSAS_2026-10-24.md) y handoffs G55/G48/G42/G36.
- [Anexo histórico G58E→G66](./ANEXO_A_G58E_A_G66_175_COMMITS_2026-10-24.md), [inventario G66](./ANEXO_A_G66_INVENTARIO_709_ARCHIVOS_SHA_2026-10-24.md): son cortes históricos, no HEAD actual.
- [Último Handoff maestro B R1–R66 + F1](../architect-b/HANDOFF_MAESTRO_ARQUITECTO_B_R1_R66_F1_PRIORIDAD_FUNCIONES_CERTIFICADAS_2026-10-24.md), 398 líneas; B continúa en paralelo.

---

## 1. Requisitos soberanos del producto

**Movete Fácil**: movilidad y logística en Paraguay. Objetivo de experiencia superior a Bolt/Uber (no hay benchmark comercial certificado). Dos apps nativas Expo **completamente independientes**: Driver para conductor/repartidor, Cliente para pasajero/remitente/comprador. Tercera superficie Admin WEB. El directorio histórico apps/mobility-expo corresponde a infraestructura/backend compartido de A, NO a una tercera app Driver.

Servicios aprobados: viajes de pasajeros en **AUTO**; envíos particulares/comerciales por AUTO o MOTO de carga; supermercados, farmacias de categorías permitidas, restaurantes y otros. **MOTO PASAJEROS NO AUTORIZADO**. Tarifas y comisiones en Gs/PYG calculadas en servidor, diferenciadas por vehículo, servicio y zona; nada de pagos reales sin PSP aprobado.

Cliente↔Driver/repartidor con chat privado durante servicio vigente. Seguridad/ubicación GPS consentida y servicio SOS con humanos solo cuando exista operación real. La zona cubierta no equivale a disponibilidad de conductores. **Sin límite global de 50 usuarios/registros** (50 solo puede ser tamaño de página). KYC documental centralizado y protegido, nunca documento privado como estado público de app. Lovable únicamente para interfaz final sin rehacer backend.

### Estados de certificación que NO deben confundirse
1. **CODIGO/CONTRATO**: SQL, adaptador, UI, esquema, OpenAPI.
2. **QA_PASS**: pruebas automatizadas locales, PostgreSQL16 desechable, Node, Expo, JWT/test doubles.
3. **STAGING_E2E_PASS**: mismo IdP real autorizado, servidor HTTPS, DB persistente, Cliente y Driver con mismo servicio/estado.
4. **DISPOSITIVO_PASS**: Android/iOS físicos con permisos, cámara, GPS, push, offline/ACK.
5. **COMMERCIAL_GO**: 17 gates, privacidad/legal/seguro/soporte/PSP si aplica, decisión expresa Owner.

**Lo que existe ahora llega a QA para las funciones citadas, NO a STAGING_E2E ni GO comercial.**

---

## 2. Fronteras absolutas Arquitecto A y Arquitecto B

| Ruta / responsabilidad | Arquitecto A | Arquitecto B |
|---|---|---|
| apps/mobility-expo/** backend SQL Node Auth OpenAPI | ESCRIBE | consume contratos |
| apps/movete-driver/** Expo Driver | ESCRIBE | no editar |
| apps/movete-cliente/** Expo Cliente | no editar | ESCRIBE |
| apps/movete-admin/** Admin Web | no editar | ESCRIBE |
| docs/architecture/** y docs/handoff/** | ESCRIBE | solo lectura |
| docs/architect-b/** | no editar | ESCRIBE |
| workflows y scripts compartidos | A edita con coordinación | B coordina |
| issue #9 | informar código, contratos, pruebas y bloqueos | informar consumo y diferencias |

PR #8 tiene de base una revisión de A que puede estar atrasada. No rebasar/mergear/forzar HEAD de B. Actualizar issue #9 con contratos precisos. Los dos arquitectos trabajan en paralelo sin pisarse.

---

## 3. Historia G0–G66 ya implementada y probada en QA — no rehacer

### G0–G22
- G0 repo/ramas/CI/ambientes y aislamiento de apps.
- G1 PostgreSQL/RLS/Auth sintética, esquemas y políticas privadas.
- G2 Driver/vehículo, licencias, seguros, inspección, AUTO/MOTO.
- G3/G4 AUTO solicitud/búsqueda/ofertas/aceptación/llegada/inicio/fin, idempotencia, event ledger, doble aceptación.
- G5 envíos AUTO/MOTO, límites de carga, pickup/deliver/return/dispute/proof.
- G6 comercio/stock/catálogo/preparación.
- G7 tarifas PYG y comisiones contables QA, sin PSP.
- G8/G9 incidentes/SOS/auditoría y alta de comercios.
- G10–G15 courier dispatch, outbox push, fencing, carrera dos repartidores y polling alternativo. No proveedor push real.
- G16/G17 bandeja Driver y KYC metadata privado.
- G18 rol exclusivo Driver y bloqueo Passenger+Driver dual.
- G19/G20 observación de documentación y vigencia de licencia/vehículo.
- G21/G22 navegación Driver y Auth STAGING fail-closed.

### G23–G48
- G23–G26 historial/cursor/keyset/MVCC/paginación sin límite global.
- G27–G30 Owner/Admin RBAC, KYC, incidentes, auditoría con ámbitos.
- G31 zonas/municipios, cobertura vs disponibilidad.
- G32–G35 GPS consentido, cuarentena/replay/fraude, licencia y vehículo.
- G36 slot atómico único por Driver AUTO/DELIVERY (dos conexiones).
- G37/G38 fences DML transaccionales y bloqueo LIVE sin autorización.
- G39–G41 incidentes/soporte/recibos/Admin.
- G42/G43 JWT firmados pinneados, proveedor/sesión verificados, revocación bajo lock SQL, AAL2 Admin.
- G44/G45 catálogos, sucursales, stock/reservas atómicas buyer.
- G46–G48 SQL mínimo privilegio, evidencia KYC, tickets opacos de lectura.

### G49–G66
- G49–G53 chat privado, SEND idempotente, inbox/historia/ACK.
- G54–G57 marcadores READ contiguos por mensaje efectivamente visible, no por notificación.
- G58–G58F pruebas JWT/local HTTP, Host/cookie/origen, token opaco de uso único.
- G59/G59B recuperación READ-ONLY de SEND tras timeout, sin segundo mutador ciego.
- G60A–D Driver chat y gateway SQL mínimo/HTTP local.
- G61 17 gates NO_GO y SDK HTTPS opt-in; G62 runtime Driver autenticado unificado, por defecto deshabilitado.
- G63/G64 accept/decline privado AUTO/DELIVERY y recuperar recibo original después de COMMIT incierto.
- G65 Driver lifecycle AUTO accepted→arriving→in_progress→completed y pantalla de viaje QA.
- G66 Driver delivery pickup→delivered/return/dispute con prueba independiente obligatoria y pantalla de custodia QA.

**La documentación detallada G0–G66 mantiene SHA, SQL, criterios, fallos y pruebas de cada etapa. No repetir esos 66 bloques solo para sumar commits.**

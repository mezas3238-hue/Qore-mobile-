# QORE Mobile — Arquitecto B, R39 · Preferencias ante faltantes (2026-10-24)

## Estado de transferencia

**Rama:** `feature/mobility-cliente-admin-parallel-20261022`. PR #8 DRAFT. Repositorio soberano: `mezas3238-hue/Qore-mobile-`. Arquitecto A en PR #7 mantiene backend, PostgreSQL, Driver y OpenAPI; Arquitecto B únicamente Cliente Expo + Admin Web + documentación B. **NO MERGE / NO LIVE / NO DEPLOY / NO PSP real sin autorización Owner**.

## Objetivo

A partir de las referencias de aplicaciones de comercio y del corte R38, construir en Movete Fácil Cliente la experiencia para indicar cómo gestionar un artículo no disponible **sin fingir que el comercio recibió la preferencia**.

## Implementación

- `apps/movete-cliente/src/domain/commerce-substitution-draft.mjs`: `createCommerceSubstitutionDraft` con `snapshot`, `choose` y `clear`. Decisiones explícitas por artículo: `OMIT_IF_UNAVAILABLE` o `ASK_BEFORE_SUBSTITUTING`. Sin selección = sin autorización de reemplazo. No permite seleccionar sustituto concreto, cambiar tarifa o ejecutar mensajes/POST.
- Validación antes de leer/elegir: se llama al validador R38 `reviewCommerceBasket` (exige Auth, catálogo y carrito vigentes, precio y stock iguales al snapshot del servidor, ausencia de checkout). El ámbito efímero comprende sujeto autenticado, revisión privada/JWT, sucursal, versión, caducidad, vehículo, artículos, cantidad, precio y subtotal. Cambio en cualquiera de estos campos borra preferencias anteriores. Logout o expiración también.
- `commerce-substitution-draft.d.mts`: tipos de decisiones y estado explícitamente `submitted:false`, `contactSent:false`, `orderConfirmed:false`, `preferencesSavedOnServer:false`.
- `commerce-substitution-draft.test.mjs`: regresiones para categorías de preferencia, anulación, cambios de versión/precio/cantidad/sucursal/vehículo, logout, JWT, expiración, ítems ajenos, campos/capacidades peligrosas y ausencia de POST.
- `app/comercios.tsx`: UI de preferencias por cada artículo de un carrito verificado, controles accesibles y aviso persistente de que **no se transmite** ni autoriza sustituciones automáticas. Estado local al componente, purgado por remount cuando cambia `privateViewRevision`, así como al recargar/vaciar carrito y al elegir otro rubro; la elección de rubro limpia también catálogo y paginador antiguos para no mezclar comercios/precios.

## Límites operativos

- Esto es UI + lógica de dominio temporal, no una solicitud real al comercio, conductor ni soporte. No se ha instalado red ni creado endpoints inventados. No hay contacto al cliente desde una tienda, y la opción "consultar" **no envía una notificación**.
- Farmacias siguen limitadas a artículos `PHARMACY_OTC` autorizados. No incorporar recetados, edad restringida ni sustitución farmacéutica sin controles legales.
- Una cantidad de 50 líneas es un límite **por carrito/pedido del contrato de ensayo existente**, no un límite global de usuarios, sucursales, productos ni registros. G44 tiene paginación, no un techo global de 50.
- La pantalla solo aparece con `catalogReadReady` certificado, que permanece OFF hasta que el Arquitecto A monte y apruebe el backend.

## Dependencias A y continuación sugerida

1. Contrato real de preferencias por ítem y cantidades con `requestKey`, versionado y persistencia del servidor, con semántica de autorización. Por defecto no sustituir automáticamente.
2. Notificación/mensajería de sustitución ligada a un pedido real, asignación y roles comprobados; consulta explícita antes de cambio, respuesta auditada y vencimiento.
3. Reprecio/revalidación de artículos y entrega; reserva de stock atómica y conciliación de costos. Validar sustituto permitido (farmacia especialmente restrictiva).
4. Auth Passenger y comercios reales; G44/G45 y catalog-g48 del OpenAPI A G57 permanecían `x-qore-runtime-wired:false` en la auditoría de este corte. No afirmar disponibilidad LIVE.
5. R40: continuar flujos independientes de soporte/seguridad del comercio o Admin, preferentemente con verificadores de estado y pruebas adversariales; no duplicar G0–G57 de A ni reescribir contratos anteriores.

## QA y handoff

El commit de funcionalidad inicial `6f8ebf73` tenía **3/3 workflows SUCCESS**: ownership B, Admin web, aislamiento y checks/export Expo Cliente/Driver. Hubo un commit posterior que limpia el carrito al cambiar categoría; **verificar el HEAD final de este documento de nuevo antes de declarar el corte R39 certificado**. Repositorio, issues #9 y #11 y PRs conservan evidencias de dependencias.

**Instrucción siguiente arquitecto:** verificar HEAD de ambos PR, leer este documento, continuar autónomamente desde R40 con código y pruebas; registrar bloqueos reales en issue #9 y avanzar módulos independientes sin pedir confirmación para cada paso. No realizar merge ni LIVE.

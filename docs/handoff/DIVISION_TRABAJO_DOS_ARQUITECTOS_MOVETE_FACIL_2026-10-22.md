# MOVETE FÁCIL — HANDOFF MAESTRO DE DIVISIÓN ENTRE DOS ARQUITECTOS
**Fecha:** 22 de octubre de 2026. **Repositorio soberano:** `mezas3238-hue/Qore-mobile-`.
**Estado al crear esta división:** PR #7 DRAFT abierto; dos proyectos Expo independientes ya publicados en el commit `6fac68e82a991fa93ae22fea3692011111bd45ee`. CI de aislamiento, PostgreSQL, Node y Expo previo en SUCCESS.
**Objetivo:** finalizar backend e integraciones y terminar DOS aplicaciones instalables: `Movete Fácil Driver` y `Movete Fácil Cliente`, sin duplicar tareas ni editar archivos de otro propietario. El panel Admin será una aplicación WEB separada; no es una tercera app móvil.

> **MANDATO:** Ningún arquitecto puede hacer MERGE, desplegar en LIVE, provisionar VPS, ejecutar SQL remoto, enviar push real, activar pagos reales, recopilar datos personales reales o publicar aplicaciones sin orden del Owner. Usar datos sintéticos y PostgreSQL desechable para CI. Los PR continúan en DRAFT.

## 1. División irrevocable y matriz de propiedad

### ARQUITECTO A (arquitecto actual): BACKEND + DRIVER + INTEGRACIÓN
**Propietario EXCLUSIVO de estas rutas**:
- `apps/movete-driver/**` — app móvil Driver: identidad conductor, documentos, vehículos, disponibilidad, ofertas y ganancias.
- `apps/mobility-expo/**` — laboratorio anterior y sus servidores, SQL, pruebas históricas y contratos de staging. **No convertir este laboratorio mixto en app final**.
- `backend/**`, `database/**`, `packages/**` (si se crean): servidor central, migraciones, contratos versionados, Auth/RLS, almacenamiento privado.
- `.github/**`, `scripts/**`, archivos raíz y `docs/architecture/**`, `docs/handoff/**` — CI, seguridad, integración y decisiones globales.
- Backend para operaciones del panel administrativo, **pero no sus pantallas**.
- Verificación de cambios del Arquitecto B, adaptación de APIs y validación de integración bajo control del Owner.

**PROHIBICIÓN A:** no editar `apps/movete-cliente/**`, `apps/movete-admin/**` ni `docs/architect-b/**`. Si A necesita cambiar la UI de B, abrir issue con contrato y esperar al Arquitecto B.

### ARQUITECTO B (arquitecto colaborador): CLIENTE MÓVIL + ADMIN WEB (PRESENTACIÓN)
**Propietario EXCLUSIVO de estas rutas**:
- `apps/movete-cliente/**` — app independiente Cliente: pasajeros, solicitudes AUTO, envíos, comercios, tarifas, seguimiento, historial, pagos simulados y soporte.
- `apps/movete-admin/**` — **panel web** de administración independiente, solo capa de presentación y adaptadores cliente de endpoints autorizados.
- `docs/architect-b/**` — handoffs, pruebas exploratorias, evidencias y requisitos de APIs que faltan.

**PROHIBICIÓN B:** no editar, mover, copiar o generar cambios bajo `apps/movete-driver/**`, `apps/mobility-expo/**`, `backend/**`, `database/**`, `packages/**`, `.github/**`, `scripts/**`, `docs/architecture/**`, `docs/handoff/**` ni archivos raíz. **Nunca alterar SQL, RLS, Auth, roles, tarifas, comisiones o contratos centrales directamente.** Si necesita uno, solicitarlo mediante issue y usar un adaptador simulado tipado temporal que falle cerrado.

Esta propiedad aplica a cualquier agente, subagente y Lovable. No compartir branch de trabajo, archivo, lockfile, pantalla o dependencia entre los dos arquitectos.

## 2. Estado verificado / no confundir con LIVE

- `apps/movete-driver` y `apps/movete-cliente` existen como proyectos Expo independientes: `package.json`, `app.json`, `app/_layout.tsx`, rutas, domain validation y pruebas separadas.
- DRIVER: `com.movetefacil.driver`, esquema `movetefacildriver`, pantallas `index`, `documentos`, `ofertas`, `ganancias`.
- CLIENTE: `com.movetefacil.cliente`, esquema `movetefacilcliente`, pantallas `index`, `envios`, `seguimiento`, `historial`.
- `scripts/check-mobile-boundaries.mjs` y `.github/workflows/movete-apps-isolation.yml` verifican rutas, identificadores, dependencias y dos builds Expo separados.
- Backend existente (laboratorio `apps/mobility-expo/server/**` y `docs/backend/staging_only/**`): G1-G15 en evolución. G13 fencing de notificaciones, G14 competencia de dos repartidores, G15 fallback privado de ofertas; Node/PG en CI.
- `docs/backend/openapi/movete-facil-staging.openapi.json` es el catálogo **STAGING** existente; su mera existencia **no significa endpoint desplegado**.
- Actualmente NO hay APK/IPA certificadas, pasarelas comerciales reales, tracking real de celulares, aprobación legal por zonas, KYC real ni lanzamiento listo.
- La pantalla de documentación de Driver valida **solo un borrador local**: no almacena actualmente un documento real ni lo aprueba. La pantalla de Cliente solo valida solicitudes DEMO locales.

## 3. Hoja de ruta del ARQUITECTO A (actual) — propietario backend + Driver

### A-P0. Fundaciones seguras e integración de API
1. Mantener el laboratorio `apps/mobility-expo` intacto como referencia y migrar **solo contratos aprobados** a adaptadores de backend central separados de UI. Nunca copiar pantallas de conductor y pasajero a la misma app final.
2. Construir contrato compartido **versionado, tipado y validado** de Auth, roles y endpoints para CLIENTE, DRIVER y ADMIN en `packages/**` o documentos OpenAPI que A controla. No hacer imports directos de backend al bundle.
3. Resolver segregación de roles en servidor JWT verificado: `passenger` no puede aceptar ofertas, `driver` no puede leer datos de terceros, `admin` no puede estar en bundle móvil. Ninguna regla de UI sustituye RLS.
4. Ejecutar migraciones reales en PostgreSQL 16 desechable, probar grants/RLS con `anon`, `authenticated`, `service_role`, tests de actor equivocado, token inválido, expiración, duplicidad, concurrencia y pruebas negativas. No SQL remoto.
5. Publicar para B un catálogo claro de rutas, estructuras y estados de error. Todo contrato faltante se gestiona por issue: A es el **único** que modifica servidor, OpenAPI y esquema.

### A-P1. Completar `apps/movete-driver/**`
6. Registro autenticado DRIVER (identidad y verificación), separación cliente/driver desde entrada, sesión aislada y expiración/revocación segura. Implementar estado pendiente/aprobado/rechazado sin autoaprobar.
7. Documentación: formulario legalmente definido de licencia, cédula, patente/habilitación, antecedentes y seguros según categoría/municipio. **Almacenamiento privado CENTRAL** con ruta por usuario y objeto, whitelist MIME/tamaño, checksum, expiración, roles, URLs temporales y bitácora; no documentos permanentes solamente en teléfono; evitar secretos en cliente. El backend hace verificación y Admin autoriza.
8. Vehículos AUTO/MOTO y repartidores: controles de elegibilidad, revisión, póliza, licencias, cargas permitidas, peso y restricciones. **MOTO pasajeros bloqueado** hasta reglas legales y seguro verificados por localidad; MOTO carga es permiso distinto.
9. Disponibilidad y GPS consentido: permisos mínimos, actualización y caducidad de ubicación, arranque/parada explícitos, sin simular chofer online. Política de zonas: cobertura no significa conductores disponibles.
10. Buzón privado de ofertas y operaciones de decisión: integrar G10/G13/G15 desde Driver con usuario JWT, receptor propietario, TTL, aceptación única, rechazo, expiración, reanudación tras desconexión, re-sincronización al servidor y colisiones. No confundir ACK proveedor con entrega push al dispositivo.
11. Trayecto Driver: navegación externalizada a Google Maps/Waze según autorización, estados aceptado/llegué/recogí/finalicé y prueba de entrega de envíos con evidencia privada y estados persistidos.
12. Ganancias, comisiones y liquidaciones: vistas calculadas desde ledger G7 server-side; cero saldos «reales» cuando son simulados. Precios y porcentajes no los fija el Driver.
13. Pruebas unitarias, API, pantallas, sesión, GPS, modo sin señal, documentos y carreras. Export web CI y builds nativas aisladas **solo si Owner lo autoriza**.

### A-P2. Backend compartido para TODO el producto
14. Viajes AUTO: creación de solicitud, radar elegible, rutas reales/verificadas, precio por categoría, tiempos, aceptación atómica, cancelar/no-show, estado, auditoría, GPS al pasajero y cierres.
15. Envíos: remitente, repartidor, comercios, supermercado, farmacia OTC y restaurante, clasificación, dimensiones, custodia, prueba de entrega, cancelación, reasignación y seguros.
16. Comercios G6/G9: usuarios y sucursales, catálogo, stock, pedidos, preparación y enlace a entregas; integridad económica, catálogo regulado y privacidad por comercio.
17. Tarifa/versionado G7: separar AUTO, MOTO (donde permitido), AUTO delivery, MOTO delivery y comercio; tarifa mínima, km, minuto, tráfico, suplementos/cancelación autorizados, comisión, impuestos y redondeo en Gs desde datos de ruta verificados. Pago **simulado** y ledger equilibrado; sin PSP real.
18. Seguridad G8: informes, incidentes, SOS, suspensiones, revisiones, zonas, trazabilidad, rate limit, retención y accesos privados; pruebas de RLS.
19. Endpoint admin exclusivamente servidor: revisión de KYC/seguros, zonas y suspensiones, auditoría, reportes y control de operaciones con privilegios por acción. El Arquitecto B implementará la UI web solamente.
20. CI e integración: `.github/**`, boundary checks, tests reales de PostgreSQL desechable y Node, test de dos binarios por separado, revisión de contratos B, CI de PR Draft. **NO MERGE** sin orden.

### A: Definition of Done
- Todo cambio A exclusivamente en rutas A.
- API publica estructura validada en contrato único; Auth/RLS real probado en CI y endpoints falsificados se señalan como bloqueados.
- Driver funciona en pruebas completas contra STAGING autorizado y sin operaciones reales; cuenta, docs, elegibilidad, ofertas, navegación y ganancias pasan E2E sintético.
- Panel Admin de B dispone de contratos servidor auditados para sus pantallas; cero llaves service role en navegador o teléfono.
- No declarar producción hasta prueba de dispositivos, permisos, legalidad y autorización Owner.

## 4. Hoja de ruta DETALLADA del ARQUITECTO B — CLIENTE + ADMIN WEB
**Regla inmutable:** solo escribir `apps/movete-cliente/**`, `apps/movete-admin/**` y `docs/architect-b/**`. Puede LEER el resto. No repetir los módulos de A.

### B-P0 (arrancar inmediatamente, sin esperar a backend)
**B01 — Auditoría de base (sin modificar Driver ni el laboratorio)**
- Leer `apps/movete-cliente/package.json`, `app.json`, `app/_layout.tsx`, `app/index.tsx`, `app/envios.tsx`, `app/historial.tsx`, `app/seguimiento.tsx`, `src/domain/capabilities.mjs` y pruebas.
- Leer el OpenAPI STAGING de `apps/mobility-expo/docs/backend/openapi/movete-facil-staging.openapi.json`, pero **no editarlo**.
- Inventariar UI existente y contratos disponibles; publicar `docs/architect-b/STATUS_Y_CONTRATOS.md` con: implementado, bloqueado por A, test, evidencia CI, issue. Nunca dar por lista una pantalla solo por tener un formulario.

**B02 — Arquitectura exclusivamente CLIENTE**
- Organizar rutas Expo dentro de `apps/movete-cliente/app/**`: onboarding cliente, inicio, solicitud de viaje, búsqueda, estado/seguimiento, envío, comercios, pagos simulados, historial, seguridad/soporte y perfil. No introducir registro de licencia, documentos de conductor, aprobación, botón de «Disponible», aceptación de ofertas ni ingresos Driver.
- Construir estados UI independientes: `idle`, `draft`, `quote_pending`, `searching`, `assigned`, `arriving`, `in_progress`, `completed`, `cancelled`, `failed`; toda transición del servidor validada, con número de revisión monotónico y re-sync al reconectar.
- Separar componentes y temas CLIENTE de los de Driver; navegación propia e icono/config propios, sin importar archivos hermanos.

**B03 — Login, sesión y seguridad de la app CLIENTE**
- Implementar componentes y adaptador inyectado de Auth y estado de sesión; usar EXCLUSIVAMENTE claves publicables, nunca service role. Mientras A no publique endpoint auditado, usar mocks tipados y mensajes «no disponible».
- Cerrar sesión, credenciales expiradas, cambio de cuenta, estado 401/403/429/503, eliminación de estado privado de una cuenta anterior y bloqueo de operaciones sin token verificado.
- Tests: token ausente, expirado, privilegio DRIVER/ADMIN intentando pasar por cliente, requests con identidad falsa, servidor caído y lectura cruzada. No almacenar documentos Driver en Cliente.
- **Dependencia de A:** endpoint/canal de Auth y contrato de permisos client_role; issue a A si falta.

**B04 — Solicitar viaje (AUTOMÓVIL)**
- Pantalla con origen/destino, opción de servicio, confirmación, estado `searching`, cancelación y mensajes de disponibilidad; no inventar conductores.
- Integrar SOLO con un adaptador basado en la operación existente `POST /v1/staging/rider/trips/request`, y `GET /v1/staging/rider/trips/{tripId}/status` cuando A lo declare disponible. Campo actor siempre server-derived.
- No montar solicitudes de pasajeros MOTO mientras permanezcan bloqueadas legalmente. Distinguir «zona cubierta» de «auto efectivamente disponible».
- Idempotencia de solicitudes con requestKey estable tras timeout. Tests de doble toque, respuesta duplicada, rechazo, sin conductores, expiración, cambio de red.

**B05 — Tarifas, estimaciones y comparación**
- Vista de tarifa Gs, estimación por distancia/tiempo/tráfico/categoría y versión de tarifa; diferenciar viaje AUTO de MOTO delivery. La tarifa la calcula y firma el backend, nunca el dispositivo.
- Conectar a `POST /v1/staging/fares/quote` mediante contrato A; exponer estados de cotización no disponible y desactualizada, precio tentativo vs confirmación.
- Tests de unidad Gs, importes negativos, importes irreales, cotizaciones caducadas, comisión no recibida desde servidor y manipulación de kilometraje.

**B06 — Búsqueda y seguimiento de servicio CLIENTE**
- Visualizar buscando, oferta aceptada, conductor/vehículo verificados, ETA verificado y tracking solamente con consentimiento GPS vigente y estado permitido; ocultar posición cuando caduca evidencia.
- Eventos deben procesarse por `tripId` autorizado, secuencia/revisión monotónica y reconciliación de eventos fuera de orden; no mostrar chapa o identidad antes de la aceptación.
- La notificación push nunca es prueba de asignación; polling/resync desde estado servidor es autoridad. Sin mapas ficticios que aparenten GPS real.
- Tests: usuario ajeno, dos conductores intentan aceptar, ETA obsoleto, conductor cambia estado, cancelado, reembolso en simulación.

**B07 — Solicitud de ENVÍOS particular**
- Formulario CLIENTE de origen/destino, tipo DOCUMENTS/PARCEL/GROCERIES/PHARMACY_OTC/RESTAURANT, AUTO vs MOTO carga, peso, tamaño y restricciones; flujo de cotización, solicitud, preparación, retiro, custodia, comprobante y entrega.
- Consumir adaptadores de `POST /v1/staging/sender/deliveries/request` y `GET /v1/staging/deliveries/{deliveryId}/status`; no acceder a tablas del conductor ni afirmar recibido sin persistencia.
- Mostrar distintivamente «MOTO envíos autorizado» versus «MOTO pasajeros prohibido». Confirmar categorías reguladas/cobertura en backend.
- Tests de carga excesiva en moto, artículos restringidos, evidencia inexistente, cancelación/rechazo, doble petición y comprobante con permisos.

**B08 — COMERCIOS para cliente**
- Exploración de supermercados, farmacias OTC, restaurantes y otros comercios habilitados, categorías, sucursales por zona, carrito, importes server-owned, pedido y seguimiento de preparación/entrega.
- API solo servidor G6/G9 con autorizaciones verificadas. No inventar stock, precio, disponibilidad o artículos médicos regulados.
- Pruebas de stock cero, ítems ilegales, múltiples sucursales, carrito desactualizado, idempotencia de compra y falla de entrega.
- Bloqueos de API se documentan a A, sin implementar SQL ni duplicar un servicio G6.

**B09 — Pagos, historial, calificación y soporte CLIENTE**
- UI de medio de pago **SIMULADO**, autorización/rechazo/cancelación/captura/reembolso de prueba y recibos del ledger, sin guardar tarjetas ni disparar PSP.
- `POST /v1/staging/payments/authorize` y rutas de status G7 únicamente cuando A exponga los contratos.
- Historial exclusivo del cliente, filtros por tipo, comprobantes autorizados, reportar incidente, calificación provisional sin publicar si falta endpoint.
- Tests de doble cobro, cambio de usuario, desincronización, permiso ajeno, error de pago, cancelación, recibo sin datos sensibles.

**B10 — UX profesional y pruebas Expo**
- Navegación, accesibilidad Android/iOS, estados de carga y vacío, errores claros en español paraguayo, guaraníes, mapas/datos verificados, permisos explícitos, modo offline sin operaciones engañosas.
- Ejecutar `cd apps/movete-cliente && npm install && npm run check && npx expo export --platform web`; sin importar páginas del Driver. Si la instalación requiere cambiar archivos raíz, A lo resuelve.
- Mantener pruebas de componentes, dominio, adaptadores HTTP, auth/roles, deep links y flujos completos ficticios. No subir capturas con identidad de personas reales ni claves.

### B-P1 — PANEL ADMIN WEB (NO otro móvil)
**B11 — Proyecto independiente `apps/movete-admin/**`**
- Crear proyecto web autónomo (React/TypeScript, sin Expo Driver/Cliente) y su `package.json`, rutas y tests propios; usuario exclusivamente ADMIN.
- Login Admin, MFA/roles si el backend lo certifica; nunca service role en JavaScript del navegador. No mostrar pantalla administrativa desde Cliente ni Driver.
- Adaptador HTTP inyectado para endpoints admin que A provea, con protección 401/403, permisos por acción, CSRF según arquitectura final, timeouts, auditoría y no guardar documentos sensibles en caché.
- Panel de métricas: solicitudes, conductores pendientes, documentos vencidos, autos/motos elegibles, envíos por estado, zonas y cobertura ≠ disponibilidad, incidencias/SOS y ledger sintético.
- Flujo de KYC: cola de revisión, metadatos de licencia/cédula/vehículo/seguros, vista segura de **URL temporal** autorizada, decisión aprobar/rechazar con razón y trazabilidad. No subir/guardar documentos en el navegador como fuente oficial ni permitir aprobar por modificador local.
- Zonas/categorías: ver estado de zonas, habilitación del tipo de servicio, requisitos por municipio. Solo cambios por API auditada de A, con doble confirmación donde sea sensible.
- Incidentes, suspensión, revisión, soporte y reportes con redacción de PII; no revelar documentos completos o contacto de terceros en listas.
- Panel debe usar **mocks sintéticos identificados** hasta que A entregue endpoints; sin falsificar datos operativos o conectar producciones.

**B12 — Lovable (solo UI)**
- Preparar dos diseños separados para Driver y Cliente; **B solo controla Cliente y Admin web**. Si genera artefactos Lovable, deben guardarse/adaptarse EXCLUSIVAMENTE en sus rutas.
- Lovable no define RLS, SQL, servidor, Auth privilegiado, reglas de cobro ni estructura de documentación. No ejecutar despliegue sin Owner.
- Guía de accesibilidad, navegación, mobile safe areas, estados de red y tema. Mantener consistencia de marca sin compartir código cross-app en secreto.

### B-P2 — Validación e integración sin invadir A
**B13 — Evidence checklist final B**
- Tests `npm run check`, web export Expo, auth/fail-closed, E2E sintético de viaje/envío/comercio/pago, y panel Admin web sin service keys.
- Corrida contra backend A SOLO cuando A apruebe contrato y ambiente desechable/QA. No escribir migraciones o endpoints para «destrabar».
- Actualizar `docs/architect-b/STATUS_Y_CONTRATOS.md` con SHA/PR, tests exactos, capturas sin PII, cambios, errores, bloqueos (issue enlazado), pendientes y riesgos.
- PR propio DRAFT, **base = rama del Arquitecto A**. Nunca forzar push, cherry-pick cruzado, merge ni actualizar PR #7.

## 5. Contratos compartidos: propietario único A

| Contrato funcional existente en OpenAPI STAGING | Consumidor | Dueño de backend | Estado |
|---|---|---|---|
| `POST /v1/staging/rider/trips/request` | B / Cliente | A | Contrato de laboratorio; no asumir despliegue |
| `GET /v1/staging/rider/trips/{tripId}/status` | B / Cliente | A | Contrato de laboratorio; GPS real pendiente |
| `POST /v1/staging/sender/deliveries/request` | B / Cliente | A | Contrato de laboratorio |
| `GET /v1/staging/deliveries/{deliveryId}/status` | B / Cliente | A | Contrato de laboratorio |
| `POST /v1/staging/fares/quote` | B / Cliente | A | Precios server-side, evidencia ruta requerida |
| `POST /v1/staging/payments/authorize` | B / Cliente | A | Simulación, NO cobro real |
| `POST /v1/staging/buyer/orders/request` | B / Cliente | A | Comercios/stock server-side |
| `GET /v1/staging/orders/{orderId}/status` | B / Cliente | A | Acceso por participante |
| `GET /v1/staging/courier/delivery-offers` | A / Driver | A | G15 consulta privada / Auth |
| `POST /v1/staging/courier/delivery-offers/accept` | A / Driver | A | G10 aceptación exclusiva |
| Contratos Admin (revisiones, zonas, incidentes) | B / Admin web | A | Revisión puntual de OpenAPI; sin cliente privilegiado |

**Proceso de contrato:** B registra petición en issue (endpoint, método, campos mínimos, datos prohibidos, rol, códigos, test y criterio de cierre). A implementa solo backend/contrato y avisa SHA estable. B integra solo su UI y test. Si A cambia payload, entrega versión compatible o aviso explícito; B no cambia la respuesta por su cuenta. Nunca inferir disponibilidad de endpoint a partir de un esquema.

## 6. Estrategia GitHub sin pisarse

### Rama A: control soberano de integración
`feature/mobility-monorepo-isolated-20261016` con **PR #7 DRAFT** (base main). Solo A escribe aquí, y exclusivamente rutas A.

### Rama B: trabajo aislado de frontend
`feature/mobility-cliente-admin-parallel-20261022`, creada desde el SHA preciso de rama A al registrar el handoff. **Solo B escribe aquí** y exclusivamente sus rutas. Crear PR **DRAFT** con **base = `feature/mobility-monorepo-isolated-20261016`**, NO `main`.

### Restricciones técnicas
1. B no edita rama A. A no edita rama B, salvo corregir un bloqueo que explícitamente impida entrar al trabajo inicial y quede documentado.
2. B no importa `apps/movete-driver`, `apps/mobility-expo`, `backend`, archivos de servidor o SQL a su app. Se comparte por contratos HTTP/API, no por copiar carpetas del otro.
3. Ningún arquitecto edita `package.json` raíz, workflow, CODEOWNERS, contrato central o base de datos «por comodidad» si no es propietario.
4. CI de límites del PR B debe rechazar cualquier archivo fuera de `apps/movete-cliente/**`, `apps/movete-admin/**`, `docs/architect-b/**`.
5. Ambos dejan commits pequeños, descripción de pruebas y riesgos, sin credenciales, imágenes con PII, datos reales o claves de mapas incrustadas.
6. No rebase/force-push de la rama del otro; siempre revisar `git diff BASE...HEAD --name-only` antes de pedir revisión.
7. **NO MERGE** en PR B ni #7 sin autorización expresa del Owner. El PR B es una propuesta verificable pendiente de integración.
8. Si necesitan el mismo cambio, A recibe issue, lo implementa en su rama y B reajusta su consumo después de revisar contrato/SHAs. **No se hacen dos implementaciones del mismo backend**.

### Protocolo breve de sincronización
Cada entrega incluye: número de issue, carpetas editadas, commit SHA, CI exacto, contrato leído/vigente, bloqueo y próximo paso. No detenerse por preguntas menores; avanzar con componentes simulados y pruebas. Solo escalar bloqueo real: seguridad, API no definida, acceso revocado, ley/permisos, falta de datos confiables o dependencia de Owner. No usar un merge como «forma de actualizarse».

## 7. Primeras acciones del ARQUITECTO B en su propio chat

1. Abrir la rama `feature/mobility-cliente-admin-parallel-20261022`, su PR DRAFT y **este handoff completo**. Verificar la lista de rutas permitidas antes de escribir.
2. Ejecutar aislamiento y CI de `apps/movete-cliente` sin tocar Driver.
3. Crear `docs/architect-b/STATUS_Y_CONTRATOS.md` con matriz B01–B13; anotar endpoints existentes y faltantes.
4. Completar CLIENTE en orden: B02 → B03 → B04/B05 → B06 → B07/B08 → B09 → B10. Implementar mock/adapter con falla segura cuando falte A, en vez de improvisar backend.
5. Crear ADMIN WEB separado cuando la estructura CLIENTE y los contratos de acceso estén saneados; avanzar por componentes UI mock mientras A termina endpoints administrativos. B11–B12.
6. Reportar pruebas y correcciones por commit hasta dejar Client/Admin listos para QA integrada; no solicitar merges ni despliegues.

## 8. Criterio global de terminación para DOS apps

**Driver**: build instalable propio, registro/doc central seguro, estado KYC real certificado, GPS consentido, ofertas privadas, asignación exclusiva, navegación, trazabilidad, ingresos y soporte según rol.

**Cliente**: build instalable propio, login, AUTO cotización/solicitud/asignación, envíos, comercios, GPS verdadero/verificado, historial, pagos simulados, soporte, fallos y sesiones seguras.

**Admin**: panel web aislado, funciones autorizadas de verificación documental, gestión de zonas, incidentes, operación, auditoría.

**Backend**: permisos reales RLS, datos privados, idempotencia y pruebas concurrencia, tarifas diferentes y ledger, observabilidad, entorno QA. Seguridad/legal y autorización Owner antes de LIVE.

La existencia de pantallas, un export web, datos sintéticos y workflows SUCCESS es **evidencia de desarrollo**, no prueba de operación 100% ni autorización de lanzamiento.

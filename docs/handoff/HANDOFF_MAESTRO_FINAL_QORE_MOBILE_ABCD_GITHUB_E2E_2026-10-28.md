# HANDOFF MAESTRO DE EJECUCIÓN — QORE MOBILE / MOVETE FÁCIL
## Relevo sin pérdida de contexto — corte verificable: 28-oct-2026
**Prioridad absoluta del Owner: TERMINAR LA APP FUNCIONAL EN GITHUB, NO MÁS MÓDULOS AISLADOS.**

> Este documento es un mandato operativo para el siguiente arquitecto de ChatGPT. No es un certificado de salida ni una petición de producir más handoffs. La siguiente acción debe ser código de integración real, ejecución GitHub Actions y corrección de errores hasta obtener el recorrido completo. Continuar sin pedir datos que ya estén documentados. No afirmar que todo funciona cuando solamente se prueban partes.

### 0. DECISIONES DEL OWNER — INAMOVIBLES

- **PRIMERO GITHUB:** todo desarrollo, integración, backend Node, esquema PostgreSQL16 desechable, compilación de las cuatro aplicaciones y E2E en GitHub antes de Render o Supabase. No crear proyectos ni servicios de Render/Supabase, no desplegar ni utilizar sus credenciales, no producir gastos externos ni activar transacciones reales.
- **NO MERGE** de PR #7, #8, #19 o #20 ni ramas de integración sin orden expresa. No LIVE, no producción, no cobros PSP, no publicación Play Store/App Store, no compra de créditos Geoapify/Google sin aprobación.
- **NO MÁS PRUEBAS AISLADAS COMO OBJETIVO:** las pruebas unitarias pueden proteger cambios, pero la única condición de avance funcional es la **misma operación persistida** desde Cliente → Backend → Driver → Admin → ledger, repetida en los cinco flujos.
- **NO inventar** viajes completados, conductores, documentos, GPS, ETA, cobertura, pagos, saldos, reseñas, pruebas de entrega, permisos municipales ni conciliaciones. Fail closed ante evidencia incompleta.
- **Legalidad/seguridad:** G38 y G71 NO pueden ser desactivados para obtener verde. La autorización de MOTO_RIDE para pasajeros es independiente de MOTO_DELIVERY de paquetes.
- **Comisiones editables por Owner desde Admin Web** para todos los servicios/vehículos y categorías, con versionado, controles de acceso y auditoría. Política actual: subsidio al cliente de **10 % fijo tomado de la comisión**; ejemplo AUTO pasajeros 15 % ⇒ cliente 10 % / plataforma 5 %; MOTO pasajeros 12 % ⇒ cliente 10 % / plataforma 2 %. Los 15 % y 12 % son valores iniciales **configurables**, nunca porcentajes inmutables; no inventar tasa para envíos y comercios.
- Plataforma nativa Cliente + Driver para Android e iOS, distribución final por Play Store y App Store, no repartir APK manual como producto. Admin Web independiente. Objetivo de infraestructura fuerte y evolución regional Mercosur; costos/capacidad progresivos bajo autorización.
- Geoapify Free elegido para mapas/rutas de QA/MVP, Google no activar. Clave ya reportada en GitHub Secrets; no copiar secretos al repo, chat, frontend ni logs. Geoapify mode=drive no prueba por sí mismo una ruta comercial, peajes, tráfico en vivo ni legalidad MOTO.
- **Velocidad:** implementar verticales completas, arreglar errores observados, no crear cien PRs/comentarios/commits ornamentales; reportar fallos exactos, soluciones, estado medido. No volver a preguntar si se permite pasar a Render/Supabase: la respuesta es NO hasta cerrar GitHub E2E y que el Owner lo ordene.

### 1. REPOSITORIO, PROPIEDAD Y RAMAS EXACTAS

Repositorio: https://github.com/mezas3238-hue/Qore-mobile-

| Arquitecto / función | PR / Issue | Rama | HEAD comprobado 28-oct-2026 |
|---|---|---|---|
| A — Backend / SQL / Auth / CI / Geoapify / contratos | PR #7 / Issue #15 | feature/mobility-monorepo-isolated-20261016 | b3fabd3632b5f1ff5735d689783edf519b2d1385 |
| B — Cliente Expo + contratos de consumo | PR #8 / Issue #16 | feature/mobility-cliente-admin-parallel-20261022 | 5c66e1616e0e75ac73b88b0b4ab6683536406bb6 |
| C — Driver Expo | PR #19 / Issue #17 | feature/mobility-arquitecto-c-driver-e2e-20261026 | e025177f6125a9322bc90e763578f4d9d770f92e |
| D — Admin Web | PR #20 / Issue #18 | feature/mobility-arquitecto-d-admin-e2e-20261026 | 2f71f6672ac6f29b4092bddb8a31df9c000be75a |

Todos PR **OPEN DRAFT; sin merge**. A+B unificados bajo un arquitecto de ese carril según Issue #15, C+D bajo el otro; el siguiente arquitecto debe coordinar **los cuatro** y construir una versión única sin sobrescribir trabajo ajeno.

**CRÍTICO: DOS RAMAS DE INTEGRACIÓN ACTIVAS, NO CONFUNDIRLAS.**

1. **Candidata principal de ÁRBOL ÚNICO**: integration/qore-mobile-e2e-four-apps-20261027, HEAD funcional conocido **d8ea9caaaa147d0cb03c1a26324ae2135c657cab** antes de este handoff. Contiene físicamente apps/mobility-expo, movete-cliente, movete-driver y movete-admin. Workflow qore-four-apps-unified.yml verifica una misma revisión, TS Cliente/Driver y check+build de Admin.
   - Build ABCD: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40624974134 **SUCCESS**.
   - HTTP + PostgreSQL16 completo: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40624974139 **SUCCESS**.
   - G131 unifica **verdadero createAdminExperience.loadF1RideAudit de D**, Cliente B, A G75 y una misma reserva/cancelación PostgreSQL; incluye limpieza tras revocación Admin. No es solamente GET directo al backend.
   - Documento previo: docs/handoff/G131_INTEGRACION_GITHUB_SIN_RENDER_SUPABASE_2026-10-28.md.
2. **Rama paralela C+D con mejoras de ENVÍOS G132**: integration/qore-mobile-abcd-github-e2e-20261027, HEAD **448a055d6b2e7c1658370f225d3868f93817b6db**. Workflow #40624917116 **SUCCESS**: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40624917116 . Los cuatro HEAD A/B/C/D se descargan por SHA en el runner y comparten PostgreSQL16. Esta rama agrega:
   - g98 F1 real D audit y C G106 con misma reserva Cliente B.
   - g109 controlador C real G65 + G106 de doble sesión en un viaje histórico pre-G38; historial real B en el mismo ID.
   - **G132** en apps/mobility-expo/server/g121-delivery-reconcile-pg-http-ci.mjs: Cliente B real G5 POST/G121 GET para **MOTO_DELIVERY y AUTO_DELIVERY**, mismo deliveryId persistido, prueba de no duplicidad y G66 real C que rechaza custodia sin asignación.
   - Corrección de expiración inmutable de sesión Admin durante dos lecturas F1; la primera corrida falló (40622794674), la corrección aprobó (40622904061).
   - Archivo diferencial central: g121-delivery-reconcile-pg-http-ci.mjs y su paso workflow G132. **PORTAR G132 A LA CANDIDATA DE ÁRBOL ÚNICO** sin reemplazar la implementación más avanzada G131 A+B+D; evitar checkout por SHA si el módulo ya está físicamente dentro de un solo commit.
   
**Primer trabajo REAL del sucesor: consolidar G131 de árbol único + G132 de envíos en UNA rama/version, ejecutar build + HTTP/PG16 ambos verdes.** No hacer merge de PR draft; integración quirúrgica de archivos/funciones revisando diffs. No emitir falso GO porque ambos branches individuales estén verdes. Validar siempre HEAD y el estado de Actions actualizado antes de actuar.

### 2. ESTADO QUE SÍ ESTÁ DEMOSTRADO

- Backend A: esquema real PostgreSQL16 desechable, RPC restringidas, HTTP loopback, identidad ficticia de QA verificada por adapters locales y bastantes fences/controles SQL; no proveedor de Auth real certificado, no despliegue.
- **AUTO_RIDE nueva reserva G73**: Cliente B cotiza/solicita → A crea tripId, calcula tarifa/subsidio → D AdminExperience lee ese mismo tripId y quoteId por G75/MFA sintético → B cancela → G94 revierte e historial actualiza; C G106 constata **correctamente que NO hay conductor asignado**. El bloqueo es real G38/G71. No hay aceptación del conductor.
- **AUTO_RIDE positiva preexistente G109**: fila QA asignada **antes de G38** → C G65 hace arrive/pickup/complete HTTP sobre A PG16 → B recupera historial y verifica revisión final 5 → slot G36 liberado. **NO es el mismo tripId recién reservado por B**, no equivale al recorrido comercial completo.
- **MOTO_RIDE G100/G101/G118/G119**: cotización/reserva/cancelación, contabilidad de reversos y estado HTTP en PG16 de QA, tarifa 12 %, subsidio 10 %, beneficio plataforma 2 % inicial. **Aún no prueba Driver MOTO_RIDE legalmente autorizado ni recogida/finalización de pasajeros**.
- **ENVÍOS AUTO + MOTO G132**: B G5 real crea/recupera a través de A G121; un mismo deliveryId y una fila en PG16 por vehículo; C G66 rechaza abrir custodia sin repartidor. Separadamente G125/G126/G122/G123 prueban cotización y consentimientos QA por vehículo sobre PG16, pero **no constituyen un único flujo precotización → pedido → asignación → prueba de entrega → Admin D**.
- **COMMERCE**: existen tablas/contratos y piezas Buyer G44, Merchant G6, órdenes, catálogos, sucursales y algunas pruebas; **no existe viaje integral comprado/preparado/recogido/entregado/ledger Admin certificado con tienda real**.
- D Admin: lee F1 AUTO bajo G75, soporta configuración Owner G116 de comisión pasajeros y G124 tarifa de envíos, triage/QA y pantalla de trazas de cinco servicios; **endpoint universal /v1/staging/admin/services/{serviceKind}/{serviceId}/trace aún propuesto/no montado**, conciliación de ingresos general sin backend confirmado. No habilitar lectura inventada.
- CI de árbol único confirma compilación y Admin Web build. CI individual de D PR #20 antes no arrancaba por trigger solo hacia base A; el nuevo workflow unificado NO soluciona automáticamente el trigger de PR #20. Workflow de ownership B marca erróneamente PR C→A como B: corregir filtro de HEAD.
- Apps móviles Expo y Admin pueden compilar, pero **ningún resultado de Actions constituye prueba de interacción en dispositivo Android/iOS real o disponibilidad pública**.
- Geoapify: G128 resolver y G130 cuota duradera PostgreSQL16 CI existen; G129 llegó a comprobar una ruta real previa, según antecedentes; eso **no certifica** geocoding/peajes/cobertura/consumo en runtime integrado ni tráfico en vivo. No llamar al proveedor sin permiso.
- No Render, no Supabase, no PSP, no Stores ni servidores persistentes por orden Owner.

### 3. ARQUITECTURA CANÓNICA Y CONTRATOS

**Flujo soberano:** Cliente autenticado elige tipo/vehículo → origen/destino geocodificados y zona legal → precio Owner versionado y consentimiento ANTES de reservar → POST idempotente y persistencia PostgreSQL → dispatcher transaccional → oferta PRIVADA solamente a Driver habilitado → aceptación única sin carreras → lifecycle real / custodia → estado privado Cliente → auditoría Admin sobre el MISMO id/quoteId/version/revision → ledger reconciliado y recuperación ante ACK perdido → cierre, liberar slot, permitir siguiente solicitud.

Cinco flujos independientes:
1. AUTO_RIDE — pasajero en AUTO; oferta/conductor/licencia/seguro/cobertura/fare propios.
2. MOTO_RIDE — pasajero en MOTO; legalidad municipal/seguro/KYC pasajeros, **no deriva de permiso de repartidor**.
3. AUTO_DELIVERY — paquete por AUTO, precio/carga/custodia/prueba.
4. MOTO_DELIVERY — paquete por MOTO, límites de peso/dimensiones/seguro propios.
5. COMMERCE — supermercados, farmacias, restaurantes y otros; Buyer/merchant/stock/branch/fulfillment/courier, reglas por categoría y mismo orderId asociado con deliveryId cuando aplique.

Persistencia:
- UUID único por operación; no generar IDs independientes para que parezca E2E. Correlacionar requestKey, quoteId, tripId/deliveryId/orderId, driverId verificado, vehicleKind, revisión, precio/moneda, versión de comisión, eventos y ledger.
- Mutaciones idempotentes, lectura propietaria, no repetir POST si el ACK se pierde; recovery GET original. Proteger transacciones, límites de slots G36, concesión atómica de ofertas, recuentos SQL, aislamiento de roles y cancelación.
- JWT, role exclusivo, sesión no revocada, RLS/ACL, AAL2 Owner/Admin; nada de service_role en apps. MFA/Admin y roles deben venir del servidor/IdP, no del checkbox UI.
- No confundir ledger QA con dinero bancario/PSP; no mostrar ganancias de Driver hasta que backend devuelva agregados privados reales reconciliados.
- La infraestructura objetivo será capaz de escalar a Mercosur, pero **primero completar Paraguay de extremo a extremo en GitHub**.

### 4. BACKLOG P0 — IMPEDIMENTOS DE FUNCIONAMIENTO. HACER EN ESTE ORDEN

#### P0.1 — UNA SOLA VERSIÓN INTEGRADA EN GITHUB
- Usar integration/qore-mobile-e2e-four-apps-20261027 como candidata por estar en un solo árbol con verdadero D AdminExperience. No tocar main ni hacer merge PR draft.
- Inspeccionar HEAD contemporáneo y git diff con integration/qore-mobile-abcd-github-e2e-20261027. Portar G132 (envíos AUTO/MOTO con B real, A PG, C real) preservando D unificado.
- Workflow GitHub Actions: Node22 + PG16 efímero + cuatro apps del MISMO SHA, no pinning de snapshots viejos. Ejecutar g98 + g109 + g121 integrado, TypeScript y build de las tres interfaces; comprobar jobs y logs de cada paso.
- Unificar esquema/SQL, contratos, imports y configuración, y corregir en el lugar de la falla. **No GREEN solo por compilar**.

#### P0.2 — CERRAR AUTO_RIDE DESDE UNA RESERVA NUEVA (PRIMER GO VERDADERO)
- En g98 G73, tras quote y booking B, verificar DRIVER ELEGIBLE *de verdad* conforme a políticas G20/G38/G71; autoridad legal/territorial, vehículo, seguro, vigencia de documentos, no dual role; en PG16 CI usar autoridades QA explícitas con evidencia de fuente, no marcar CLEARED con un boolean de frontend ni revocar constraints.
- A conectar worker G85/G111/G112/G113, offer G4/G16, claim único, guard G36, aceptación privada C G4 y recuperación G64; comprobar que se trata de la **nueva** reserva original, no G109.
- C ejecutar G65 arrive → pickup → complete con mismo tripId, fuente real SQL y eventos/revisión únicos, sin inventar GPS/ETA. B recibir los cambios y confirmar G26 terminal. D AdminExperience leer al comienzo, en transiciones y al final el MISMO tripId y quoteId (G75 ampliado o contrato apropiado) y ledger versionado.
- Validar tarifa Owner, subsidio 10 %, comisión versionada, reversos/cancelación, slot libre y nuevo viaje posible. Una corrida ininterrumpida, nada de mezclar dos tripIds.
- Sin permiso/marcadores legalmente verificables para habilitar una oferta nueva, dejar BLOCKED y diseñar la autoridad/evidencia concreta; jamás falsificar approval.

#### P0.3 — MOTO_RIDE PASAJEROS COMO SERVICIO AUTÓNOMO
- A integrar G100/G101/G118/G119 desde reserva nueva, cupo de pasajeros, cobertura municipal, clase de vehículo, KYC/seguro pasajero, tarifa/subsidio y revocación.
- C crear inbox/aceptación de MOTO_RIDE propia y lifecycle de pasajero, NO reutilizar MOTO_DELIVERY ni etiquetas de paquete. B selección explícita MOTO, seguimiento y cancelación. D trazabilidad y contabilidad propia.
- Misma secuencia E2E completa con un tripId MOTO nuevo, rechazo legal cuando corresponda y ningún cross-service.

#### P0.4 — ENVÍOS AUTO Y MOTO PRECOTIZADOS ANTES DE RESERVAR
- El flujo actual B G5 registra QA sin precio. A debe conectar geocoding de direcciones normales y rutas/cobertura G128 (Geoapify Free) y cuota G130 segura/durable, peajes y elegibilidad G38. G124 tarifas Owner por AUTO/MOTO y G125 G7 tarifa/quote + G126 recuperación + G122 consentimiento deben ejecutarse **ANTES de la orden de reparto**; evitar cobrar o cambiar de tarifa en el reintento.
- B app/envios.tsx: permitir selección AUTO/MOTO, dirección libre geocodificada por A, mostrar total versión original, aceptar expresamente, guardar key opaca antes de red, crear envío con quote relacionada, recuperar G121, impedir duplicados; B25 liberar claves solo con pruebas independientes G121+G68 terminal genuinas.
- A conectar G10/G123 private offer y controlador de cupo/compliance; C obtener oferta privada, aceptar una sola vez, G66 custody pickup y delivery. Para delivery G67 exige prueba de entrega auténtica, objeto privado validado/escaneado y registro de autoridad de backend; no fixture generado localmente ni botón que fabrique proofRef.
- A montar GET/POST G66 en transport/runtime seguro y G68 sender readback real y G26. B ver progreso/status/entrega y posibilidad de segundo envío. D mostrar deliveryId original, actor autorizado, tarifa y prueba del ledger. 
- Hacer por separado AUTO_DELIVERY y MOTO_DELIVERY, límites de carga, documentos y tarificación propios, sin intercambiar vehículo.

#### P0.5 — COMMERCE END-TO-END (NO SOLO CATÁLOGO)
- Comercios por categorías (supermercado, farmacia, restaurante, otros). A desplegar dentro de GitHub CI los contratos merchant/Buyer G6/G44, alta/validación de merchant, sucursales y horarios, stock/precio, carrito, pedido idempotente, aceptación, preparación, ready-for-pickup, courier elegible y entrega/retorno.
- B Cliente comprar y seguir pedido con detalles/total verificados; no ofertar comercios inexistentes. C aceptar solamente delivery elegible vinculada a orderId y cumplir custodia. D aprobar/suspender comercios, incidencias, auditoría de catálogo/orden y liquidación.
- Prohibir supuestos de productos de farmacia sujetos a receta sin cumplimiento normativo; no asumir permiso farmacéutico por cuenta merchant.
- Ledger de COMMERCE distingue precio bienes, servicio de entrega, comisión al comercio, subsidio, reembolso y payout real. Ejecución mismo orderId y deliveryId vinculado si procede.

#### P0.6 — ADMIN WEB D, COMISIONES Y TRAZA AUTORITATIVA
- Contrato universal requerido: GET /v1/staging/admin/services/{serviceKind}/{serviceId}/trace para los cinco flujos, derivado de **PostgreSQL**, MFA AAL2/RBAC/revocación/verificación de rol. Actualmente el gateway D es propuesto; no activar por flags sin backend.
- Respuesta de servicio incluye identidad en scope, tipo, bookingKey/quoteId, revisión/estado/evidencias de eventos, assignment/legalGate, ledger real del mismo id, timestamps frescos y conciliación. D con anti-rollback, privacidad; nunca mostrar saldo ficticio.
- **Editor Owner unificado:** porcentajes modificables para AUTO_RIDE, MOTO_RIDE, AUTO_DELIVERY, MOTO_DELIVERY y COMMERCE por supermercado/farmacia/restaurante/otros; tarifas de envíos por zona/vehículo. Mantener subsidio cliente 10 % fijo de acuerdo a Owner. A construir endpoints Owner AAL2, CAS/revision/versionado effective-at/rollback, límites válidos, auditoría inmutable, protección de cambio concurrente y lectura posterior; D editor con confirmación/readback. No derivar importes pasados de una comisión nueva.
- KYC Driver, permisos, incidencias, operación, order/merchant approval, zonas y auditoría/historial: enlazar con fuente SQL real, diferenciar MOTO_RIDE legalGate de MOTO_DELIVERY y COMMERCE merchantEligibilityVerified; no contar vehículos como tiendas.
- Owner finance dashboard: neto reconciliado, comisiones/subsidios, pagos/reembolsos, por servicio, período, moneda PYG y versión de rule, SQL real y controles anti-duplicado; si backend no atesta, UI muestra NO VERIFICADO.
- UI Admin accesible y utilizable: menús, permisos, formularios, filtros/estado en cinco tipos, mensajes de error/recuperación, relectura tras mutation.

#### P0.7 — DRIVER C, IDENTIDAD, CUENTA, GANANCIAS Y EXPERIENCIA DE CAMPO
- Ofertas privadas G16 AUTO/G10 delivery + nuevo MOTO_RIDE pasajero sin contaminación de modalidades; documentos KYC G17/G20/G71, expiración/suspensión/renovación, único slot G36, rechazo de ofertas expiradas o ajenas.
- Reconexión, nueva sesión, logout, JWT refresh, recovery G106/G64, POST sin replay en ACK desconocido, navegación al viaje realmente asignado. Revisar provider auth original G106, no presentar viaje de otro conductor.
- G66 pickup/deliver/return y G67 prueba real. Pantallas ruta, recogida, dirección, comunicación autorizada, privacidad, seguridad y GPS consentimiento.
- Ganancias: GET privado JWT Driver desde ledger mismo serviceId + versión de comisión, suma PYG, payouts/resúmenes por período, sin declarar Gs.0 ni total del precio de oferta como salario. Mantener “Saldo no verificado” mientras no exista fuente.
- Completar login/registro KYC, background/foreground, permisos de ubicación, push/realtime, reintentos con límites, servicios offline y notificaciones, sin reclamar certificados nativos hasta tener dispositivos.

#### P0.8 — AUTENTICACIÓN, RLS, SEGURIDAD, COBERTURA, SISTEMA DE PAGOS
- Roles exclusivos Cliente, Driver, merchant, Admin/Owner; JWT y sesión no revocada y scope exacto. Supabase como plataforma futura NO es una excusa para omitir contratos de Auth/SQL verificables en GitHub.
- Legal G38/G71/G118: generar evidencia válida de póliza, documento, transporte de pasajero AUTO/MOTO, ámbito territorial, renovación y suspensión; no confundir cobertura Google/Geoapify con habilitación municipal.
- Geoapify Free: no exponer API key, usar servidor, validar coordenadas y geocerca por país/ciudad/servicio, peajes, reglas de cuota G130 y prevención de replays. Presupuesto interno de diseño previo 100 consultas/300 créditos diarios, no deducir de ahí la cuota real del proveedor. El modo drive para MOTO es estimación carretera, no garantía de ruta motocicleta.
- Pagos comerciales/PSP: por Owner **OFF** en GitHub. Diseñar autorización, webhook idempotente, captura/liquidación, reversión/disputas con ledger balanceado y simulación explícita; no simular cargo bancario como real. Integración con PSP solo después de nueva orden.

### 5. CRITERIOS E2E DE ACEPTACIÓN: SIN ESTO NO HAY 'TERMINADO'

El siguiente arquitecto debe construir UNA MATRIZ DE EJECUCIÓN en GitHub con estas filas sobre el MISMO SHA de árbol único:

| Nº | Flujo | Debe demostrar |
|---|---|---|
| 1 | AUTO_RIDE nuevo | B quote→book G73 → A PG/dispatch → C offer/accept→arrive→pickup→complete → B G26 → D audit+ledger, mismo tripId |
| 2 | MOTO_RIDE nuevo | Cotización/subsidio y aprobación municipal MOTO pasajeros → C MOTO_RIDE → B → D/ledger, mismo tripId |
| 3 | AUTO_DELIVERY nuevo | Precio antes de booking → C recoge / G67 entrega probada → B cierre G68 → D audit+ledger, mismo deliveryId |
| 4 | MOTO_DELIVERY nuevo | Ídem con vehículo/carga/legalidad propia, mismo deliveryId |
| 5 | COMMERCE nuevo | Buyer pedido→merchant stock/preparación→Driver entrega→Cliente recepción→Admin/ledger, mismo orderId (+ deliveryId si existe) |
| 6 | Owner comisión pasajeros AUTO | Cambiar % con AAL2 CAS; nueva reserva aplica nueva versión, antigua conserva la previa; subsidio 10 % |
| 7 | Owner comisión pasajeros MOTO | Igual, sin uso de reglas AUTO |
| 8 | Owner tarifa/comisión envíos AUTO | Regla versionada y precio firme antes de registro |
| 9 | Owner tarifa/comisión envíos MOTO | Regla independiente y límites carga |
| 10 | Owner COMMERCE por categoría | Supermercado/farmacia/restaurante/otros con reglas propias |
| 11 | Seguridad y privacidad | Otro Cliente/Driver/merchant no ve operación; Admin revocado no lee; documentos vencidos no reciben trabajo |
| 12 | Recuperación y carreras | Dos sesiones PG disputan oferta: un ganador; ACK perdido: un POST; reinicio mismo ID; reserva cancelada cierra oferta y ledger |
| 13 | Contabilidad | versioned commission + 10 % subsidy + driver/merchant payout + platform share cierran en PYG; reversos balanceados; nunca 2 cargos |
| 14 | Interfaz integral | Cliente, Driver, Admin muestran la misma realidad; navegación, errores, estados, botón y segundo servicio usable |

**Para cada fila:** guardar commit SHA, workflow run URL, Service ID, bookingKey/quoteId relacionados, revisiones PG, evento terminal, prueba de autorización, ledger y excepciones. Datos QA deben estar marcados explícitamente; no prometer operación comercial.

**Prohibiciones de certificación:** G131 GREEN + G132 GREEN en distintas ramas NO equivale a GO; G109 pre-G38 NO equivale a nuevo viaje legal; una DB temporal NO equivale a Supabase real; compilar Expo Web NO demuestra GPS/push/segundo plano en teléfono; una fila delivered sin prueba G67 NO es entrega verificada; G75 F1 no equivale a Admin trace universal.

### 6. CI / AUTOMATIZACIÓN PENDIENTE

- workflows principales: .github/workflows/qore-four-apps-unified.yml, mobility-g4-postgres-disposable.yml, mobility-g130-geoapify-free-quota.yml, movete-apps-isolation.yml y movete-admin-web-qa.yml.
- Reparar trigger de Admin PR #20 D→base B: movete-admin-web-qa.yml solo incluye base A. Agregar base B sin alterar políticas y usar HEAD exacto; no inferir que el workflow de árbol único equivale a CI del PR.
- Reparar movete-architect-b-boundary.yml: filtro que aplica reglas de titularidad B a PR C #19. Mantener separación A/B/C/D y no desactivar el boundary.
- Consolidar G132 en el CI de árbol único. No descargar pin SHA antiguo B ni montar módulos de rutas ficticias como sustituto de backend; errores reales del workflow deben cambiar código real.
- Ampliar GitHub CI desde un servidor de prueba a un **smoke de aplicación operable** temporal, con arranque/parada, puertos no públicos, Auth QA explícito, persistencia de toda la operación, navegabilidad de Admin web/Cliente y Driver cuando sea técnicamente posible. GitHub Actions no es un hosting permanente.
- Reproducir fallos, registrar timestamps/ID/SQL revisiones y arreglar causas, no simplemente aumentar timeouts o marcar flags de contractCertified.
- Guardar secrets en GitHub Secrets; nunca en artifacts ni salida.
- Si se propone GitHub Codespaces/preview o consumos que generen costos, obtener aprobación Owner primero.

### 7. PRIORIDAD P1 — CALIDAD DE USO TRAS LOS CINCO FLUJOS FUNCIONALES

- Cliente: mapa/ETA basados en evidencia, favoritos/direcciones persistidas con privacidad, notificaciones, cancelación/reembolso visible, historial y búsqueda por ID, flujos de recuperación, accesibilidad y español/guaraní/portugués futuros.
- Driver: GPS consentimiento/background, ofertas en foreground, timeout/acercamiento, llegada, rutas, chat/push, fotos y comprobantes inmutables, identidad, documentos, soporte y ganancias reales.
- Admin: zonas, operación en tiempo real (con freshness/unknown), aprobación KYC, conductor/vehículo, comercios, pedidos, incidentes, auditoría, pagos y conciliación por servicio; Owner cambia todo parámetro configurable sin hardcode.
- Resiliencia: límites por API/Geoapify, reconexión, latencia/escala, TTL expiración, idempotencia, datos atrasados, cumplimiento local y seguridad, backups/migraciones compatibles y sin filtración.
- Diseño de expansión Mercosur: país/moneda/idioma/legalidad/tarifas separados por configuración, no por listas rígidas de ciudades.

### 8. POST-GITHUB — SOLO CON ORDEN NUEVA DEL OWNER

1. Congelar build E2E y reproducibilidad de migraciones/export en GitHub; revisar política y costos con Owner.
2. Supabase STAGING: PostgreSQL/Auth/RLS/Storage según esquema ya aprobado; secreto server-side, migration/smoke y QA legal. Render STAGING: backend HTTPS y hostname pinned, sin LIVE, desplegar solo cuando Owner lo solicite. No hay proyecto Supabase visible ni servicios Render visibles en la última comprobación; esto **NO autoriza crearlos ahora**.
3. Repetir los cinco recorridos y los casos negativos sobre entorno STAGING real: sesiones, MFA, geocoding autorizado, dispositivo GPS/Push y pagos sandbox si se aprueba.
4. Solicitar aprobación explícita antes de habilitar PSP/producción/LIVE, integración de App Store/Play Store, gastos y rollout real. Un CI verde no implica autorización.
5. Publicación nativa final por tiendas, no APK distribuida directamente.

### 9. EVIDENCIA / VÍNCULOS DE CONTINUIDAD

- Rama árbol único: https://github.com/mezas3238-hue/Qore-mobile-/tree/integration/qore-mobile-e2e-four-apps-20261027
- Integración unificada último corte funcional: https://github.com/mezas3238-hue/Qore-mobile-/commit/d8ea9caaaa147d0cb03c1a26324ae2135c657cab
- Workflows unificados: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40624974134 y https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40624974139
- Rama paralela G132: https://github.com/mezas3238-hue/Qore-mobile-/commit/448a055d6b2e7c1658370f225d3868f93817b6db
- G132 CI: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40624917116
- Backend Owner issue: https://github.com/mezas3238-hue/Qore-mobile-/issues/15
- Cliente issue: https://github.com/mezas3238-hue/Qore-mobile-/issues/16
- Driver issue: https://github.com/mezas3238-hue/Qore-mobile-/issues/17
- Admin issue: https://github.com/mezas3238-hue/Qore-mobile-/issues/18
- Handoff global previo: docs/handoff/HANDOFF_MAESTRO_GLOBAL_A_B_C_D_G0_G129_GEOAPIFY_2026-10-27_CONTINUIDAD_E2E.md
- Handoff C+D previo: docs/architect-d/HANDOFF_MAESTRO_ARQUITECTOS_C_D_2026-10-26_E2E_QORE_MOBILE.md
- Handoff integración G131: docs/handoff/G131_INTEGRACION_GITHUB_SIN_RENDER_SUPABASE_2026-10-28.md
- SQL de integración: apps/mobility-expo/docs/backend/staging_only/
- Backend HTTP integración: apps/mobility-expo/server/g98-f1-auto-postgres-loopback-e2e-ci.mjs, g109-driver-auto-completion-pg-http-ci.mjs, g121-delivery-reconcile-pg-http-ci.mjs, g125-cargo-road-fare-pg-http-ci.mjs
- Código Cliente B: apps/movete-cliente/src/domain/client-experience.mjs, g5-g121-verified-delivery-booking-gateway.mjs, g121-delivery-registration-gateway.mjs, g122-delivery-price-consent-flow.mjs, g68-terminal-delivery-release.mjs
- Código Driver C: apps/movete-driver/src/domain/driver-trip-lifecycle.mjs, driver-current-trip-http.mjs, driver-current-trip-session.mjs, driver-custody-http.mjs, driver-custody-controller.mjs
- Código Admin D: apps/movete-admin/src/admin-experience.mjs, service-trace-gateway.mjs, f1-auto-ride-audit-gateway.mjs, auto-ride-cross-evidence.mjs, owner-finance.mjs

### 10. ORDEN EJECUTIVA PARA EL SIGUIENTE ARQUITECTO — ARRANQUE SIN DEMORAS

**Asume de inmediato coordinación técnica integral A+B+C+D; la misión es dejar Movete Fácil funcionando de extremo a extremo en GitHub y corregir todos los bloqueos P0.**

1. Leer ESTE handoff y verificar en GitHub los HEAD de las 4 PR y ambas ramas de integración.
2. Continuar el **árbol único** integration/qore-mobile-e2e-four-apps-20261027. Integrar los cambios reales G132 de la rama paralela y conseguir CI unificado BUILD + HTTP PG16 **SUCCESS** sobre el MISMO SHA.
3. Sin crear más handoffs ni módulos aislados, hacer que un **AUTO_RIDE NUEVO** reserve, reciba oferta, sea aceptado legalmente por un Driver, complete el viaje y llegue a Cliente/Admin/ledger con un solo tripId. No usar G109 fixture pre-G38 para declararlo.
4. Extender el mismo patrón a MOTO_RIDE, AUTO_DELIVERY, MOTO_DELIVERY y COMMERCE. Encadenar precotización real QA-before-order, autoridad legal y prueba de entrega, comisiones Owner por cinco flujos.
5. Si un gate legítimo bloquea, resolver su adaptador autoritativo o marcar bloqueo exacto; NO convertirlo en mock "CLEARED" o en boolean de frontend. Si aún falta proveedor real externo, hacer TODO lo verificable dentro de GitHub sin invocar Render/Supabase.
6. Dar estado concreto al Owner con evidencia: qué cambió en código, un solo SHA, run links, qué escenarios están PASS/BLOCKED y próxima corrección; no llenar la conversación con “ok avanza” convertido en cientos de commits sin resultado.
7. **PROHIBICIÓN VIGENTE:** nada de Render, Supabase, merge, LIVE, PSP, Google/Geoapify gasto ni tiendas sin orden nueva del Owner.

**Única definición válida de "TERMINADO EN GITHUB":** cinco flujos E2E con operaciones nuevas reales sobre una única versión integrada, identidad/legalidad intactas, Admin y ledger coherentes por ID, rutas y reglas versionadas, interfaz utilizable, CI integral sin fallos y limitaciones externas documentadas con precisión. Después el Owner decidirá la migración.

FIN DEL HANDOFF. EL SUCESOR DEBE PROGRAMAR Y VERIFICAR, NO REESCRIBIR ESTE DOCUMENTO.

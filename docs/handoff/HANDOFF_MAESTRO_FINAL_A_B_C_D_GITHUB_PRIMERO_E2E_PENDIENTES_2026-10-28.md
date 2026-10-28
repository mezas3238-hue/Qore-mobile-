# HANDOFF MAESTRO DE CONTINUIDAD — QORE MOBILE / MOVETE FÁCIL
## Arquitectos A+B unificados; coordinación con C Driver y D Admin · 28 OCTUBRE 2026
**PRIORIDAD MÁXIMA DEL OWNER: TERMINAR LA APP COMPLETA, NO MÁS PRUEBAS AISLADAS.**

> **ORDEN VIGENTE Y SOBERANA**: Todo el desarrollo, integración y certificación de ingeniería se hace **PRIMERO EN GITHUB** en una sola versión que funcione de extremo a extremo. **NO PASAR A RENDER NI SUPABASE** hasta cerrar los recorridos completos dentro del entorno ejecutable de GitHub, y aun entonces necesitar autorización expresa del Owner para cada despliegue, recursos, gastos y pruebas externas. Nunca fingir que una prueba sintética equivale a un viaje comercial o que los CI verdes eliminan todos los riesgos de despliegue. No merge de PR de origen, no LIVE, no PSP real, no producción, no EAS submit, no uso de personas/vehículos reales sin consentimiento y verificación legal.

**Este es un handoff de ejecución, NO una solicitud para escribir otro handoff. El próximo chat debe leerlo, comprobar HEADs actuales y comenzar a implementar de inmediato el primer tramo E2E no cerrado.**

## 0. Índice operativo del siguiente arquitecto
1. **Leer §1–§4 y comprobar los SHAs; no reconstruir el proyecto desde cero.**
2. **Atacar §5 (P0-AUTO: la nueva solicitud de B no llega a aceptación C legal en el mismo tripId).**
3. Extender gradualmente a MOTO pasajeros (§6), ENVÍOS AUTO/MOTO (§7), COMERCIOS (§8) y Owner comisiones (§9).
4. Certificar mismas identidades, PG, tarifario y ledger en D (§10–§12).
5. Seguir secuencia de ejecución del §16 y matriz de aceptación del §15.
6. Usar mensaje de arranque del §19 en el nuevo chat.

## 1. Producto y mandato comercial no negociable

**Marca:** Movete Fácil / QORE Mobile. **Repositorio fuente:** `mezas3238-hue/Qore-mobile-`.
**Lanzamiento inicial previsto:** Paraguay, precios en guaraníes enteros `PYG / Gs.`. Arquitectura multi-país/moneda/jurisdicción extensible a Paraguay, Argentina, Brasil, Uruguay y Bolivia en expansión gradual, sin desplegar ahora esos países.
**Aplicaciones:** dos Expo nativas totalmente separadas (**Cliente** y **Driver**) y **Admin Web** independiente; backend HTTP + PostgreSQL. La publicación futura debe ser **Play Store y App Store**, no entregar un APK como versión definitiva.

**CINCO SERVICIOS** (cuatro familias comerciales):
1. `AUTO_RIDE`: pasajeros en automóvil.
2. `MOTO_RIDE`: pasajeros en motocicleta; jamás clasificarlo como envío.
3. `AUTO_DELIVERY`: paquetes enviados en automóvil.
4. `MOTO_DELIVERY`: paquetes enviados en motocicleta.
5. `COMMERCE`: supermercados, farmacias, restaurantes y otros comercios; pedidos + preparación + entrega + contabilidad.

El usuario elige explícitamente AUTO o MOTO donde corresponda. Ningún tipo se cambia automáticamente al otro por escasez de conductores. No copiar mecánicamente precios de Bolt/Uber: las capturas son referencia de experiencia y alternativas de movilidad, no tarifas verificadas ni propiedad de terceros.

**OWNER controla desde WEB ADMIN TODAS LAS COMISIONES**, configurables, versionadas, auditadas e independientes:
- Pasajeros AUTO: **15% nominal inicial** editable.
- Pasajeros MOTO: **12% nominal inicial** editable.
- **Subsidio permanente de 10% al cliente pasajero** separado de la comisión nominal; con 15/12 la retención bruta correspondiente es 5/2 puntos, NO beneficio neto garantizado ni tasa fija de plataforma. Cambiar comisión no cambia el 10% de subsidio. La aplicación debe aplicar límites/política explícita si una comisión cae por debajo del subsidio, nunca pérdidas inadvertidas.
- ENVÍOS AUTO y MOTO: comisiones y tarifarios propios **configurables**, no heredan el 10% de pasajeros.
- COMERCIOS: comisiones separadas por supermercado, farmacia, restaurante y otros; por zona/comercio cuando A apruebe reglas. **No inventar porcentajes comerciales.**
- Sólo nuevas cotizaciones aplican una nueva versión; cotizaciones aceptadas, histórico, repartos, reembolsos y ledger guardan su versión original.

## 2. Fuente de verdad: SHAs, ramas, PR e issues VERIFICADOS 28/10/2026

**RAMA DE EJECUCIÓN INMEDIATA E2E, ÚNICA:** `integration/qore-mobile-e2e-four-apps-20261027`
**HEAD último certificado:** `d8ea9caaaa147d0cb03c1a26324ae2135c657cab`
**Abrir:** https://github.com/mezas3238-hue/Qore-mobile-/tree/integration/qore-mobile-e2e-four-apps-20261027

Integró los árboles de código y se corrigieron imports desfasados `ci-b-client` que antes ejecutaban Cliente/Admin de otros commits. Conserva aislamiento lógico de apps y un solo árbol/commit de integración. **NO asumir que los PR #7/#8/#19/#20 quedaron fusionados.**

| Autoridad | Rama original | HEAD verificado | PR / Issue |
|---|---|---|---|
| A Backend/PG/CI | `feature/mobility-monorepo-isolated-20261016` | `b3fabd3632b5f1ff5735d689783edf519b2d1385` | PR #7 DRAFT / issue #15 |
| B Cliente | `feature/mobility-cliente-admin-parallel-20261022` | `5c66e1616e0e75ac73b88b0b4ab6683536406bb6` | PR #8 DRAFT / issue #16 |
| C Driver | `feature/mobility-arquitecto-c-driver-e2e-20261026` | `e025177f6125a9322bc90e763578f4d9d770f92e` | PR #19 DRAFT / issue #17 |
| D Admin | `feature/mobility-arquitecto-d-admin-e2e-20261026` | `2f71f6672ac6f29b4092bddb8a31df9c000be75a` | PR #20 DRAFT / issue #18 |

En la conversación Owner designó **una misma responsabilidad A+B**. La coordinación de C y D sigue siendo por sus responsabilidades funcionales. Cambios transversales para resolver E2E se hacen en la **rama integrada** y deben trasladarse/consolidarse luego de resolver conflictos con los PR originales; **no editar a ciegas los árboles C/D originales**.

**GitHub CI exacto del HEAD integrado (ambos SUCCESS):**
- A+B+C+D mismo árbol: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40624974134
- HTTP/PG16 integrado y concurrencia: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40624974139
- Commit G131: https://github.com/mezas3238-hue/Qore-mobile-/commit/d8ea9caaaa147d0cb03c1a26324ae2135c657cab

**Aclaración estricta:** lo anterior **NO certifica operación comercial completa**. La CI usa PostgreSQL16 descartable, red localhost, cuentas QA, rutas sintéticas, sin PSP, sin GPS autentificado, sin conductor con KYC/permiso territorial real. La aplicación aún no está desplegada. Los flujos positivos del Driver de G109 son sobre una fila QA aceptada *antes* de instalar G38; **NO aceptan una nueva oferta del viaje creado por el Cliente**.

**Otras referencias:** PR #13 scoped dispatch retry DRAFT; PR #14 perfiles Store AAB/iOS DRAFT; PR #3 Expo MVP heredado, PR #2 foundation. No merge ni confundir esos prototipos con el HEAD integrado.

## 3. LO QUE YA ESTÁ HECHO — reutilizar, no repetir

### A Backend / PostgreSQL
- HTTP real Node + PostgreSQL16 descartable en Actions, Auth simulado *declarado QA*, RLS, roles, auditoría, transición, idempotencia y gateways.
- F1 AUTO G73/G98: ruta/prequote, tarifa/split/sobre 10% subsidio, reserva `tripId`, historial, status, G75 Admin read, G95 cancelación y G94 anulación financiera. G85/G111/G112 worker de despacho; no inventa Driver asignado si legal bloquea.
- G116 comisiones pasajeros editables por Owner; G124 tarifario/comisión de carga AUTO/MOTO por zona; reglas versionadas y QA de PostgreSQL. Falta COMMERCE Owner.
- G5 registro QA envío; G121 GET remitente propietario mismo `deliveryId`; G7 tarifa de envío sobre entrega ya persistida; G122 consentimiento aparte; G123 bloqueo de dispatch sin consentimiento; G125 contexto de ruta; G126 recuperación por misma clave; G68 lectura custodia; todavía sin contratación comercial prequote completa.
- G128 resolver Geoapify Free con adaptador/control de cuota G130 en PG16 descartable; **sin enlace a un proveedor/ruta/contenido geocodificado externo de producción**, peajes independientes ni cuota STAGING real. No consumir créditos para repetir tests de CI.
- G36 slot exclusivo de Driver; G38 legal/geocerca; G71 documentación/KYC. No desactivarlos.

### B Cliente nativo
- Selección AUTO/MOTO pasajero y envíos, borrador de carga, seguimiento e historial privados; reserva AUTO QA G73/G95, lectura G26/G4/G119 y estado financiero.
- B18–B25: recuperación segura de envio G5 por requestKey con G121, consentimiento G7/G122, G126 clave persistida en Keychain/Keystore antes de POST, marcas duraderas de intento para no duplicar, G68 liberación local de clave tras entrega acreditada, segundo borrador QA. **Esto NO significa que el botón comercial de pedir repartidor esté activado.**
- `app/envios.tsx` solo permite registro QA bajo certificaciones y zonas de prueba; `Cotizar y solicitar repartidor` sigue **OFF** por ausencia de precotización real antes del booking, precio Owner vigente, pickup/destination geocodificados y legal/dispatch.
- El Cliente no define tarifas ni comisiones por su cuenta; recibos PYG del servidor y subsidio 10% pasajero.

### C Driver nativo
- `app/ofertas.tsx`, ofertas privadas, TTL, aceptación/reconciliación, prevenciones de duplicado y actor ajeno; G10 detalle carga AUTO/MOTO y preflight; G106 recuperación AUTO de viaje activo, G65/driver lifecycle; G66 custodia, G67 prueba de entrega **aún no autorizada realmente**; KYC caducado bloquea.
- `app/ganancias.tsx` informa "Saldo no verificado", no inventa ingresos.
- G109 integra transiciones de viaje Driver AUTO previamente aceptado en PG16 con Cliente status/historial y G36 slot liberado, pero **ninguna asignación nueva G73→C bajo G38/G71** en la misma sesión.

### D Admin Web
- Admin con separación de roles, MFA, colas/revisión KYC QA, operaciones, auditoría, finanzas, trazabilidad cinco servicios propuesta.
- `OwnerCommissionEditor.tsx` G116 para pasajeros; `OwnerCargoRateEditor.tsx` G124 para envíos; POST→GET con coincidencia de regla/versión, protecciones ACK ambiguo, identidad y CAS. `service-trace-gateway.mjs` para cinco clases **es contrato propuesto, ruta genérica aún NO montada por A**. `merchantCases:null` en `admin-experience.mjs`.
- **G131 NUEVO:** `g98-f1-auto-postgres-loopback-e2e-ci.mjs` llama a la máquina de estados REAL D `createAdminExperience.loadF1RideAudit`, que consume G75 del mismo PostgreSQL que Cliente B. Comprueba viaje original y segunda reserva, `tripId/bookingRequestKey/quoteId/amountGs/revision`, cancelaciones y revocación de sesión que borra estado privado. Evidencia: Actions 40624974139, log `G131 UNIFIED A+B+D PASS`.

## 4. BLOQUEO CENTRAL Y DÓNDE ENTRAR AL CÓDIGO

**NO EXISTE TODAVÍA UNA DEMOSTRACIÓN ÚNICA DE:**
`B: reservar viaje NUEVO → A: oferta privada a Driver elegible → C: acepta y completa ESA MISMA reserva → B: ve estados y cierre → D: ve mismo ID y ledger`.

Hay dos recorridos separados que **NO deben presentarse juntos como un E2E completo**:
1. **G131**: B crea una reserva AUTO nueva y D la ve/cancela/audita. Driver está legítimamente no asignable; G38/G71 no demuestran elegibilidad territorial real.
2. **G109**: C Driver llega/recoge/completa un viaje **QA preexistente aceptado antes de G38**, respaldado por PG16. No es la reserva creada por B en G131.

**Archivos inmediatos:**
- `apps/mobility-expo/server/g98-f1-auto-postgres-loopback-e2e-ci.mjs` — B→A→D misma transacción G131, NO nueva aceptación C.
- `apps/mobility-expo/server/g109-driver-auto-completion-pg-http-ci.mjs` — C ciclo ya aceptado, histórico QA.
- `apps/mobility-expo/server/g4-trip-command-gateway.mjs`, `g4-offer-gateway.mjs`, `g65-driver-trip-status-qa.mjs`, `g106-driver-current-trip-qa.mjs`, `g75-f1-admin-audit-gateway.mjs`.
- `apps/movete-cliente/src/domain/client-experience.mjs` y `f1-auto-ride-continuation.mjs`.
- `apps/movete-driver/app/ofertas.tsx`, `src/domain/driver-trip-lifecycle.mjs`, `src/domain/driver-offer-actions.mjs`.
- `apps/movete-admin/src/admin-experience.mjs`, `f1-auto-ride-audit-gateway.mjs`, `service-trace-gateway.mjs`.
- `.github/workflows/mobility-g4-postgres-disposable.yml` y `.github/workflows/qore-four-apps-unified.yml`.

**LA PRIMERA TAREA TÉCNICA** del próximo chat NO es agregar un dashboard o otra documentación; es inspeccionar la cadena real G73/G85/G38/G71/G16/G4/G65/G36 y especificar/integrar **el primer permiso de oferta verificable** para el `tripId` recién persistido en G98, sin dar permisos falsos. Exigir la misma sesión del Driver C y observación D antes/durante/después de la finalización. Si G38 exige certificaciones que solo puede emitir autoridad legal fuera de GitHub, marcar ese paso BLOCKED y dejar **implementada la transición con un proveedor de evidencia autenticado, fijado y verificable**, sin inventar documentos legales para que CI pase. No afirmar "todo funciona" por un bypass.

## 5. P0 — AUTO PASAJEROS: completar vertical REAL C sobre mismo viaje

Responsable principal A+B, C Driver, D Admin.

**Pendientes ejecutables**:
1. Seguir flujo `F1/G73/G98` para una **reserva AUTO nueva**. Identificar exactamente qué RPC/contrato bloquea oferta después de G38 (territorio/autoridad), G71 (ocho documentos/vehículo), roles, vencimientos y autorización. No debilitar SQL.
2. Implementar la resolución autenticada de candidato/vehículo/capacidad/territorio; consultar mismo `tripId` y `offerId`; canal privado visible solo al Driver correcto, TTL y revocación. No asignar si no hay evidencia.
3. Transacción de aceptación única: dos Drivers compitiendo, gana uno, otro 409; G36 exclusividad incluyendo viajes y envíos; idempotencia y ACK perdido sin segundo POST, offer expiry/reject/cancel race.
4. Con Driver real `driver-trip-lifecycle`: arrive→pickup→complete para **este tripId**, validando G65/G106 y PG revisions; no reutilizar la aceptación PRE-G38 de G109 para certificar la reserva nueva.
5. B observa el mismo `tripId` en tracking, historial, state monotónico y finalización; no GPS/ETA hasta evidencia auténtica. D Admin D lee estados/quote/version/assignment/ledger del mismo `tripId`; red/timeout/rol cambiado se niega.
6. Validar cancelación por pasajero antes/después de aceptación y settlement/rollback idempotente, recuperación tras reinicio, retención/disputa.
7. **Cierre**: una CI continua con mismo ID en B→A→C→B→D y PostgreSQL16; si elegibilidad real no está disponible en GitHub, registrar BLOCKED LEGAL en lugar de resultado fabricado y completar todas las piezas técnicamente comprobables alrededor del bloqueo.

## 6. P0 — MOTO PASAJEROS (separado de DELIVERY)

1. A cerrar contrato `MOTO_RIDE`: cotización, G100/G101 booking, G118/G119 status, G16 oferta privada, aceptación G38/G71 específica de moto y pasajeros; revocar si casco, licencia, seguro, habilitación municipal o vehículo no cumplen.
2. B elección explícita MOTO, ruta y tarifa moto independientes, aceptación de condiciones específicas y cancelación/historial; no fallback AUTO.
3. C inbox/aceptación `MOTO_RIDE` propia; no reciclar G10 entrega de paquetes; transición Driver hasta completar.
4. D traza en el mismo `tripId` y tarifa/subsidio Owner MOTO independientes.
5. Negativos: Driver AUTO recibiendo MOTO, repartidor MOTO sin licencia de pasajeros, estado stale, 2 conductores, riesgo de zona, casco y seguro incompletos.

## 7. P0 — ENVÍOS AUTO Y MOTO: prequote ANTES del pedido + entrega acreditada

**Bloqueo de diseño**: G5 registra un pedido QA con `pickupTag/deliveryTag` de zona; G7 cotiza DESPUÉS sobre un `deliveryId` persistido. La operación comercial requiere **mostrar y aceptar tarifa ANTES de contratar/activar repartidor**. Nunca habilitar el botón B para sortearlo.

**Secuencia a construir y certificar por separado para AUTO_DELIVERY/MOTO_DELIVERY**:
1. B recoge direcciones origin/destination reales y datos del bulto; A geocodifica y valida Place ID/lat-lon **desde autoridad servidor**, origen y destino legales, geofence, cobertura por vehículo y seguridad. El texto de dirección del usuario no constituye prueba de ruta.
2. A verifica distancia, tiempo, **peajes independientemente**, cambios de ruta, restricciones AUTO/MOTO, acceso a comercio, cuota. Geoapify API key en secrets según el Owner; **NO asumir que disponer de secreto significa autorización de gasto ni ruta oficial vigente**. G128/G130 todavía CI; integrar repositorio real solo en la fase autorizada. GitHub puede demostrar el enlace con provider controlado sin llamar API externa.
3. A emite `prequote` legal, PYG entero, `quoteId, amountGs, fareVersion, expiresAt, roadEvidenceId, ownerRuleVersion, vehicleKind`, límites carga/zonas, comisión propia. Identificador estable antes de booking; no emitir tarifa artificial por fallback.
4. B muestra desglose/vehículo/TTL y solicita **consentimiento explícito**; A debe crear reserva/idempotencia por `requestKey` vinculando el mismo quote/version en transacción. G122 actual corresponde a consentimiento QA posterior; diseñar puente atómico sin romper G121/G126.
5. Completar GET seguro por `confirmationKey` + `deliveryId` de G122 ante ACK incierto para no duplicar confirmación. B23/B25 SecureStore ya marcan `prepared/recovery_attempted/consent_attempted`; no limpiar cerrojos con un 404 sin resolución terminal. Mantener G123 fence despacho.
6. A genera oferta privada G10, C Driver aceptando SOLO vehículo elegible (preflight exacto sobre peso/medidas y actor), G36 slot único, G66 custodia, **G67 prueba independiente real**, entrega/devolución/disputa y conciliación.
7. B sigue entrega en G68 y A G26 historial, libera claves solo con G121+G68 terminal concordantes, sin inventar prueba. D traza y audita el mismo `deliveryId`, ETA/cargos/commission/ledger, sin editar repartos en navegador.
8. Errores: quote caducada, peaje desconocido, no ruta, sin conductor, peso excedido, intento duplicado, dueño ajeno, JSON adulterado, crash, rotación JWT, entrega sin prueba, refund/return; fail closed.

**E2E de ambos vehículos obligatorio**, no aprobar moto usando evidencia de auto.

## 8. P0 — COMERCIOS (supermercados, farmacias, restaurantes, otros)

1. A completar APIs reales de comercios verificados, zonas, horarios, catálogo, inventario por SKU, imágenes, disponibilidad, precios y restricciones sanitarias/legales donde correspondan; B consulta solamente datos del servidor.
2. Carrito/checkout: subtotal productos + delivery + descuentos/impuestos/peajes según reglas Owner; stock reservado **exactamente una vez** en PG, quote/TTL, pedido/orderId persistente e idempotente, cambios de precio sin consentimiento rechazados.
3. Estados: `requested, confirmed, preparing, ready_for_pickup, in_transit, delivered, returned, cancelled`; Merchant valida preparación sin suplantar Owner/Driver, privacidad de cliente, reembolso y cancelación con motivos.
4. C entrega pedido con su mismo `orderId/serviceId`, Driver autorizado y vehículo elegible; G66/G67 cadena de custodia; ningún medicamento restringido o producto regulado sin controles y permisos.
5. D Admin vista operativa de comercios, casos, pedidos, stock, soporte, disputa y conciliación; `merchantCases` hoy null: construir contrato API/PG, no interfaz vacía.
6. A+D comisiones Owner por rubro y, de aprobarse, por tienda/zona; editable sin despliegue ni actualización móvil; versionado/CAS/auditoría/readback; no porcentaje inventado ni subsidio 10% automático.
7. Ledger separa ingresos de comercio, costos de entrega, Driver, plataforma, pasarela, impuestos y devoluciones; nunca confundir comisión nominal con utilidad neta.

## 9. P0 — COMISIONES 100% CONFIGURABLES DESDE WEB OWNER

**Ya hay piezas:** A G116 pasajeros, A G124 carga y editores D. **Falta terminar y verificar contra backend integrado**:
1. Unificar lectura/escritura de tasas nominales `AUTO_RIDE`, `MOTO_RIDE`, `AUTO_DELIVERY`, `MOTO_DELIVERY`, `COMMERCE` con catálogo de rubros y vigencia/zonas opcionales. Acciones **Owner únicamente**, JWT servidor verificado + MFA AAL2, RBAC, auditoría y revocación.
2. COMMERCE necesita migración y RPC/HTTP A de tasas por supermercado, farmacia, restaurante, otros, versionado por categoría, CAS/Idempotency-Key, GET tras POST y política de conflictos/ACK incierto.
3. D construir editor que muestre tasa servidor actual, porcentaje editable, cambios pendientes/aprobados, versión y fechas; conversión exacta bps; selector de categoría, validación de rango; Admin ordinario y Driver no pueden modificar.
4. B/Driver jamás mantienen defaults monetarios. Cálculo server-side: 10% subsidio **solo pasajero**; las cinco comisiones se alteran independientemente; gasto/recibo del Cliente y ledger siguen reproducibles.
5. Prueba integral: Owner cambia AUTO; B obtiene **nueva** quote AUTO con regla nueva, MOTO y envíos/comercios no cambian, antigua quote no cambia, D puede comprobar ambas versiones; repetir para MOTO/carga/comercios, con dos ediciones en conflicto.
6. Sin configuración Owner/tarifa en una zona o rubro, debe quedar NO_QUOTE, nunca una tarifa hardcoded ni copiar Bolt.

## 10. P0 — ADMIN D realmente operativo para los cinco IDs

1. A montar **realmente** `GET /v1/staging/admin/services/{serviceKind}/{serviceId}/trace` con PostgreSQL consistente, Auth Admin MFA, RBAC/RLS, eventos/assignments/ledger, revisión monotónica y sin PII; hoy el gateway D existe pero este endpoint general es **solo propuesto**.
2. G131 prueba únicamente `AUTO_RIDE` mediante ruta F1/G75. Extender a MOTO_RIDE, envíos AUTO/MOTO y COMMERCE, lectura en D de los mismos IDs creados por B/aceptados por C; no reconstituir estados con fixture admin.
3. Colas KYC, elegibilidad, expiración, documentos privados, incidentes G41 y disputas, zonas reales, suspensión/rechazo auditado y escalación; permisos, sesiones y revisiones correctos. No exponer KYC a pasajeros.
4. Búsqueda por `serviceId`, filtros y paginación con cursores firmados; auditoría de acción/identidad/antes/después; tolerar red/reintento GET y no inventar "conductor asignado" cuando G38/G71 bloquea.
5. Comisiones, ingresos, pagos/conductores/proveedores/tasas Owner con ledger financiero exacto, no suma de textos de frontend ni mostrar `confirmed_qa` como `paid`.
6. Comprobar build D EXACT SHA integrado en GitHub Actions (ya SUCCESS 40624974134), pero aún faltan pruebas de operación de las pantallas con backend y tipo de datos/rol real; no inferirlo solo por compilación.

## 11. P0 — Autenticación, seguridad, legal y contratos de infraestructura

1. Implementar y endurecer proveedor JWT Passenger/Driver/Merchant/Admin/Owner auténtico en servicio autorizado cuando corresponda: revocación, expiración, refresh, cambio de cuenta, MFA AAL2 Owner/Admin, exclusividad de roles, RLS por sujeto y tenant, audit logs; frontend nunca otorga permisos por banderas.
2. G38: evidencia **territorial/regulatoria real** por Paraguay, municipio, servicio y clase AUTO/MOTO; habilitación/cobertura **no** implica Driver disponible.
3. G71: ocho documentos/factores KYC Driver verificables, licencias, registro del vehículo, seguro adecuado, vigencia, suspensión, inspección, casco/seguridad moto pasajeros, revisión humana cuando proceda. No usar `eligible:true` de prueba como certificación legal.
4. GPS real, permisos, precisión, frescura, hora local, antisuplantación, tracking privado y cálculo ETA con fuente verificable; errores geofence, drop de señales, límites de velocidad y seguridad sin indicar GPS ficticio.
5. Rutas y tarifas Geoapify: geocodificación de direcciones, territorio, distancias, tiempos, peajes, cuota/billing controlada, mapa fiable y modo de movilidad explícito. G130 PG cuota atómica **solo en CI descartable**; proveedor externo se habilita después de autorización. No enviar API key ni service_role a aplicaciones.
6. Cancelaciones, soporte, fraude, reembolsos, soporte offline/reconexión, costes, seguro, inspección legal; evidencias e integridad histórica.
7. Seguridad de datos: no filtrar documento, teléfono, dirección privada, JWT, contraseñas, API keys, GPS ni KYC en logs, archivos Github, URLs o datos de otro actor. Rutas y revisión autenticadas. Stripe/PSP/transferencias **no** habilitadas por una simulación financiera.

## 12. P0/P1 — FINANZAS, LEDGER, PAYOUTS, PRUEBAS DE RECEPCIÓN

1. Libro mayor PG append-only por `serviceId`, `quoteId`, regla/versión Owner, monto bruto PYG, subsidio pasajero, fee, impuestos, reembolso, comisión plataforma, Driver y Merchant; diferenciación `PENDING`, `AUTHORIZED`, `SETTLED`, `RECONCILED`; solo declarar pago tras respuesta de PSP auténtica autorizada.
2. Backend contrato **Driver-only** `GET` de ganancias históricas/ledger por `driverId` verificado y mismo ID, paginado y revocable; C `app/ganancias.tsx` deja "No verificado" únicamente cuando A entrega el endpoint confiable.
3. A+D reportes Owner, auditoría CAS de tasas, conciliación temporal, devoluciones y reversos; evitar múltiple cargo/reembolso por ACK perdido.
4. Seleccionar/autorizar métodos de pago en Paraguay, estados de autorización/captura y privacidad, políticas de efectivo si aprobadas; ninguna operación real hasta fase externa.
5. Rentabilidad no equivale a tarifa: peajes, recogida vacía, km sin pasajero, soporte, seguro, PSP, impuestos y demanda se evalúan con datos medidos antes de lanzamiento.

## 13. P1 — Experiencia móvil REAL y publicación posterior

**B Cliente:** onboarding y login genuino, accesibilidad, idiomas español/guaraní, elección vehículo, búsqueda de lugares, mapa/rutas, precio/TTL, selección de pagos, confirmación, Driver/ETA reales, historial, recibos, soporte, notificaciones, zonas, cancelación y mensajes correctos para fallos/NO_DRIVER/NO_COVERAGE. No mantener botones que dicen contratar pero solo crean un borrador QA.

**C Driver:** onboarding KYC/vehículos, estado online/offline, ofertas exclusivas TTL, mapa, aceptación/rechazo, revisión por tipo, navigation, estado de viaje/entrega, prueba G67, retorno, recuperación crash, ganancias servidor, seguridad SOS/soporte, push privado, background GPS, batería/consentimiento y conflictos de dos apps.

**D Admin:** interfaz comprensible para las cinco modalidades, comisiones Owner, pricing zones, KYC, disponibilidad, incidentes, merchant support, auditoría inmutable y métricas reales.

**Dispositivos:** comprobar Android/iOS nativos, background/foreground, permisos GPS/cámara/notifications, internet inestable, cierres y reanudación, push, seguridad y accesibilidad. GitHub CI compila pero no equivale a instalación física; correr pruebas de dispositivos en fase autorizada con credenciales/firma.

**Tiendas:** PR #14 contiene candidatos AAB/iOS separados, no significa release. Distribución SOLO por Play Store y App Store, firmas y cuentas aprobadas, políticas, revisión de contenido, datos del usuario/privacidad, crash reporting y soporte después de GO de producto. No publicar APK como sustituto.

## 14. P1/P2 — RESILIENCIA, OBSERVABILIDAD, ESCALA MERCOSUR

- Concurrencia alta: una sola asignación G36 entre RIDE/DELIVERY/COMMERCE, Redis/cola solo si hacen falta y aprobados, DLQ/reintentos seguros, jobs temporizados, reconciliación por clave original y outbox.
- Migraciones reproducibles PG16, RLS sin bypass, backups/PITR, monitoreo, SLO, trazabilidad `requestKey→quoteId→serviceId→offerId→ledger`, métricas latencia/error, rate-limit y presupuestos externos.
- Costo gradual, feature flags en servidor, separación DEV/QA/STAGING/PROD, recuperación ante fallo, protección de datos y de sesiones; resiliencia ante proveedor Routes/PSP caído (bloquear contratación si tarifa no verificable).
- Diseño regional configurado por país para moneda, IVA/tributos, regulación y seguros, teléfonos y mapas; NO abrir Mercosur antes de demostrar Paraguay.

## 15. MATRIZ DE ACEPTACIÓN OBLIGATORIA — NO CERRAR POR COMILACIONES

| Servicio | GitHub situación verificada | Falta para E2E aprobado |
|---|---|---|
| AUTO_RIDE | **PARCIAL REAL PG16:** B→A→D mismo viaje/cancelación G131; C sobre viaje QA previo G109 | NUEVA oferta/aceptación C de MISMA reserva bajo G38/G71, cierre B/D ledger |
| MOTO_RIDE | Precio, booking, status QA parciales | C aceptación MOTO_RIDE independiente, legal moto pasajero, lifecycle misma ID y Admin |
| AUTO_DELIVERY | G5/G121/G7/G122/G126/G68 QA, B flag comercial OFF | precotización antes de booking, C oferta/custodia G67 real, Admin/ledger mismo deliveryId |
| MOTO_DELIVERY | Mismos contratos con vehículo MOTO | misma cadena completa, límites moto, identidad y entrega G67 |
| COMMERCE | piezas catálogo/orden QA parciales | carrito/stock/orderId+entrega+Merchant+Admin+ledger, comisión rubros Owner |

**CADA UNO debe demostrar en UNA SOLA ejecución**: B request → A quote PYG/version/TTL → consentimiento → PG una fila → G38/G71 decisión → C oferta privada/aceptación única → estado/entrega final → B tracking/history → D same-ID trace/ledger; fallos 401/403/404/409/429/503, dos conductores, idempotencia, ACK perdido y auth revocada. Si G38/G71 no tienen evidencia externa autorizada, ese paso se consigna **BLOCKED**, nunca PASS por fixture. La ejecución GitHub puede probar código e integración con autoridad de ensayo claramente identificada; no emitir certificación legal por una prueba local.

**Criterio de progreso:** por cantidad de servicios que ejecutan ese recorrido, NO líneas, commits, pruebas unitarias aisladas o nuevas pantallas.

## 16. PLAN DE ACCIÓN DE EJECUCIÓN INMEDIATA — PRIORIDAD Y ORDEN

### Bloque 0: abrir un SOLO entorno de integración Github
1. Consultar en GitHub HEAD actual de `integration/qore-mobile-e2e-four-apps-20261027` y de PR #7/#8/#19/#20; **no fijarse en SHAs históricos si cambiaron**. Cualquier cambio de C/D original se incorpora con revisión de conflictos, sin destruir integración actual.
2. Reejecutar workflows `qore-four-apps-unified.yml` y `mobility-g4-postgres-disposable.yml` sobre mismo HEAD; último baseline conocido: **40624974134 y 40624974139 SUCCESS**. No leer las CI previas fallidas como estado final.
3. Crear/usar una sola prueba E2E que ejerza acciones del actor B/C/D REAL desde sus módulos en el mismo árbol y PG16, no `ci-b-client` ni checkout antiguo ni dos viajes separados. Construir detector de **misma ID y mismo ledger**. Si requiere un helper CI, este es parte de integración, no entregable principal.

### Bloque 1: cerrar AUTO_RIDE como primera vertical COMPLETA
4. En G98, localizar bloqueo nuevo Driver G38/G71; diseñar/implementar proveedor verificador server-only por contrato y su prueba negativa. **No relajar políticas** para lograr aceptación ficticia.
5. Integrar inbox C con G85/G16 y recibo de aceptación SQL del **mismo** tripId creado por Cliente B; G36 one-winner. Si evidencia legal externa es imposible en GitHub, aislar el verdadero bloqueo como `EXTERNAL_LEGAL_EVIDENCE_BLOCKED` y completar todos los enlaces técnicos restantes.
6. Driver C usar ciclo G65/G106 arrive/pickup/complete, B y D leen misma revisión, mismo quote/version; reconstrucción tras crash y caso dos conductores.
7. Comprobar una sola operación desde inicio a final; no pasar a nuevas features hasta esta vertical integrada esté cerrada o documentada como bloqueada por fuente externa **única**.

### Bloque 2: extender al resto en orden de valor
8. MOTO_RIDE con elegibilidad independiente y contrato C real; prueba B→A→C→D.
9. Envíos AUTO/MOTO: prequote antes de pedido, consentimiento, G123, G10 oferta, G66/G67, entrega, B/C/D misma ID. No "completada" si G67 real falta.
10. COMMERCE: merchant catálogo/stock → pedido/entrega → D/ledger; configurar categorías de comisión.

### Bloque 3: Owner Admin, finanzas y cierre técnico
11. A+D conectar editor Owner comisiones por cinco modalidades/categorías, probar cambios de versión sin alterar cotizaciones existentes.
12. A montar trace genérico cinco servicios y Driver earnings por ledger; D/C consumir mismos estados.
13. Revisar auth, RLS/MFA/roles, KYC, consentimientos, subsidio 10%, GPS/ETA y peajes; pruebas negativas y fault injection del **mismo recorrido E2E**.
14. Publicar **una matriz corta de PASS/BLOCKED** con URL al run integral y el primer fallo causal por modalidad. Corregir ese fallo antes de generar otro handoff o multiplicar commits.

### Bloque 4: sólo después de pasar GitHub
15. Presentar al Owner evidencia GitHub de los cinco recorridos, costos/proveedores/condiciones pendientes y pedir **autorización nueva y explícita** antes de crear cualquier servicio en Render/Supabase. En esa segunda fase se valida entornos reales/credenciales/GPS/KYC/PSP; no prometer cero bugs de infraestructura por tener CI verde.

## 17. EVIDENCIA/REFERENCIAS DE ALTO VALOR

- Rama integrada: https://github.com/mezas3238-hue/Qore-mobile-/tree/integration/qore-mobile-e2e-four-apps-20261027
- HEAD integrado: https://github.com/mezas3238-hue/Qore-mobile-/commit/d8ea9caaaa147d0cb03c1a26324ae2135c657cab
- Compilación A+B+C+D: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40624974134 — **SUCCESS**
- Cadena PostgreSQL/HTTP/G131: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40624974139 — **SUCCESS**, log G131 y G109 (distintos viajes).
- G130 cuota Geoapify PG16: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40620163341 — laboratorio, no proveedor externo.
- A issue https://github.com/mezas3238-hue/Qore-mobile-/issues/15 ; B #16 https://github.com/mezas3238-hue/Qore-mobile-/issues/16 ; C #17 https://github.com/mezas3238-hue/Qore-mobile-/issues/17 ; D #18 https://github.com/mezas3238-hue/Qore-mobile-/issues/18
- C+D handoff anterior `docs/architect-d/HANDOFF_MAESTRO_ARQUITECTOS_C_D_2026-10-26_E2E_QORE_MOBILE.md`.
- B políticas `docs/architect-b/B21_COMISIONES_OWNER_ADMIN_CONFIGURABLES_EN_TODOS_SERVICIOS_2026-10-26.md`.
- G131 detalles `docs/handoff/G131_INTEGRACION_GITHUB_SIN_RENDER_SUPABASE_2026-10-28.md`.
- Integración inicial `docs/handoff/INTEGRACION_UNICA_A_B_C_D_NO_MAS_TESTS_AISLADOS_2026-10-27.md`.

**No navegar a Render/Supabase ni pedir permisos de despliegue en el próximo chat: la orden ya es trabajar en GitHub y cerrar E2E antes.** La anterior consulta Supabase devolvió `projects: []`; no usarla como excusa para detener ingeniería local.

## 18. REGLAS DE HONESTIDAD Y EFICIENCIA

- No decir "App funciona" porque `npm run build`, Expo export o 1.164 pruebas pasaron. Solo declarar **parcial** mientras no exista mismo `serviceId` desde B→A→C→D/ledger.
- No mezclar `g109` (viaje pre-G38 aceptado) y `g131` (viaje nuevo sin Driver) para construir un PASS falso.
- No confundir `G7/G122 confirmed_qa` con despacho, pago autorizado o finalización de entrega.
- No confundir cobertura Geoapify ni radio de zona con conductor disponible, permiso territorial, peaje cero o tracking real.
- No ofrecer valores de comisiones comerciales no proporcionados por Owner. No fijar 15%/12% en Cliente; configurables desde D.
- No reintentar automáticamente POST si el ACK se perdió; GET de conciliación, clave original y restricciones de replay. Proteger G36 multi-servicio.
- No modificar G38/G71 para conseguir tests verdes; legal, identidad y privacidad nunca se falsifican.
- No enviar otra cadena de informes sin trabajo funcional; cada avance debe responder **(a)** tramo B/A/C/D que funciona, **(b)** URL ejecución mismo ID y estado PG, **(c)** primer bloqueo real, **(d)** corrección siguiente. Mantener continuidad dentro de la sesión de trabajo sin prometer labores autónomas después.
- **No iniciar otro handoff**: usar este y comenzar código.

## 19. PROMPT EXACTO PARA INICIAR CHAT NUEVO

> **SOS EL ARQUITECTO PRINCIPAL A+B Y COORDINADOR DEL E2E QORE MOBILE / MOVETE FÁCIL.** Abrí GitHub `mezas3238-hue/Qore-mobile-` y leé de inmediato el handoff oficial `docs/handoff/HANDOFF_MAESTRO_FINAL_A_B_C_D_GITHUB_PRIMERO_E2E_PENDIENTES_2026-10-28.md` en la rama `integration/qore-mobile-e2e-four-apps-20261027`. No reinicies proyecto ni hagas otro handoff. GitHub es la ÚNICA plataforma de ingeniería por ahora; NO Render, NO Supabase, NO merge, NO LIVE, NO PSP ni recursos pagos. Trabajá en la rama integrada A+B+C+D manteniendo las apps separadas; revisá los HEAD/PR #7,#8,#19,#20 y los issues #15–#18 para cambios posteriores. Baseline `d8ea9caaaa147d0cb03c1a26324ae2135c657cab`, Actions 40624974134 y 40624974139 SUCCESS. **PRIMER TRABAJO:** cerrar la NUEVA reserva AUTO del Cliente B→Backend A→oferta privada y aceptación legal C bajo G38/G71→llegada/recogida/completado→estado/historial B→Admin D/ledger, TODO CON EL MISMO tripId EN UNA SOLA EJECUCIÓN POSTGRESQL16. NO confundas G109 pre-G38 con G131 nuevo viaje. Si una autoridad legal externa impide la aceptación positiva, preservá ese bloqueo y completa el contrato técnico sin falsear KYC. Después cerrar MOTO_RIDE, ENVÍOS AUTO/MOTO con prequote y G67, COMERCIOS, y TODAS las comisiones Owner configurables en Admin, con subsidio fijo 10% SOLO pasajeros. No cuentes commits ni pruebas aisladas como progreso. Repará fallas de integración y verificá el SHA exacto en GitHub. Solo avisame cuando tengas código funcional y primer bloqueo concreto.

---
**Handoff cerrado como referencia de ejecución, no certificación GO. Próximo arquitecto: empezar directamente el bloque §16.**

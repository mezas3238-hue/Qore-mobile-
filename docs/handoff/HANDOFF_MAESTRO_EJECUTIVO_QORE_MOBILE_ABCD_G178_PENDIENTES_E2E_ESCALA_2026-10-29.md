# HANDOFF MAESTRO SOBERANO — QORE MOBILE / MOVETE FÁCIL
## Arquitecto ejecutivo A+B+C+D · Continuidad de ejecución inmediata · 29 OCT 2026

> **ORDEN DEL OWNER:** TERMINAR LA APP, NO SEGUIR PREPARANDO HANDOFFS NI PROTOTIPOS. Este documento existe solo para transferir el contexto entre chats. El nuevo arquitecto debe empezar **implementando en GitHub** los bloqueos pendientes, lograr recorridos de punta a punta con la MISMA operación original para los cinco servicios, estabilizar las cuatro superficies, proteger el antifraude y escalar sin duplicar operaciones. NO preguntar otra vez requisitos ya registrados. NO utilizar fixtures de aceptación prelegal para afirmar que un conductor nuevo pasó KYC. NO merge, LIVE, PSP ni Render/Supabase sin autorización posterior explícita.

**Repositorio:** https://github.com/mezas3238-hue/Qore-mobile-  
**Rama operativa única:** `integration/qore-mobile-e2e-four-apps-20261027`  
**HEAD VERIFICADO ANTES DE PUBLICAR ESTE HANDOFF:** `4f470c6d28cc27ae538bd822b942eaa6ae85383c` (G178, tests de timeout/stream Driver). **Este SHA es histórico a partir del primer commit posterior: consultar HEAD nuevamente.**  
**CI para ese mismo HEAD:** A+B+C+D compilación/tipos **SUCCESS** [40855495307](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40855495307). Última cadena PostgreSQL16 comprobada **SUCCESS** [40855184348](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40855184348) para el SHA previo `341aa7e22ab1a5c2894b4936a3077ec0dabded75`; G178 no alteró SQL y su último commit activó compilación, **no afirmar prueba PG16 del HEAD 4f470c si no se ejecutó**.  
**VEREDICTO REAL:** integración de código QA avanzada, **NO GO** comercial ni plataforma externa certificada. Código original conectado parcialmente; falta operación nueva completa B→A→C→B→D en cinco verticales, PSP, permisos legales, proveedores externos, móviles reales y escalabilidad.

---

## 0. ARRANQUE OBLIGATORIO DEL PRÓXIMO CHAT — NO RECONSTRUIR

1. Aceptar rol **Arquitecto Ejecutivo Integrador A+B+C+D** (A Backend/PostgreSQL, B Cliente, C Driver, D Admin+Comercio); la responsabilidad de finalizar los cinco servicios no se fragmenta.
2. Abrir HEAD real de `integration/qore-mobile-e2e-four-apps-20261027`. Leer primero **este archivo**, luego **`apps/mobility-expo/server/g4-staging-runtime.mjs`**, **`g4-staging-runtime.test.mjs`**, **`g4-loopback-http-transport.mjs`**, y los resultados **DEL HEAD** de los workflows `.github/workflows/qore-four-apps-unified.yml` y `.github/workflows/mobility-g4-postgres-disposable.yml`.
3. Abrir `apps/mobility-expo/server/g98-f1-auto-postgres-loopback-e2e-ci.mjs`, `g109-driver-auto-completion-pg-http-ci.mjs`, G73/G111/G112/G38/G71 y `apps/movete-driver/src/domain/driver-trip-lifecycle-http.mjs`. Verificar si **LA MISMA nueva reserva** ya obtiene oferta privada legal, aceptación y terminación. Hasta el último corte no.
4. **Primer cambio debe ser código del camino crítico**, no otro documento, comparativa de servicios ni nueva suite aislada. Extender el circuito unificado existente y comprobarlo en un único PostgreSQL original. No sustituir una reserva B nueva por el viaje histórico prelegal G109.
5. Si el siguiente eslabón exige permiso municipal, documento verificado o proveedor real inexistente, declarar **EXTERNAL_BLOCKED** para ese eslabón, conservar FAIL-CLOSED y continuar el próximo trabajo **implementable**. Nunca convertir un rechazo legal correcto en PASS artificial.
6. Preservar commits de colegas sobre la rama compartida. Operar con SHA/blob actualizado, sin force push; no sobrescribir avances concurrentes.
7. Proveer en cada avance: commit publicado, función de negocio realmente conectada, ID original, resultado CI DEL SHA, prueba negativa y bloqueo restante. El objetivo es entrega funcional, no contar pruebas.

## 1. PRODUCTO Y REGLAS DEL OWNER — NO CAMBIAR SIN AUTORIZACIÓN

**QORE Mobile / Movete Fácil**; mercado inicial Paraguay, importes PYG/Gs enteros, futuro multirregional sujeto a nueva habilitación por jurisdicción.

**Cinco servicios distintos e imprescindibles:**
- `AUTO_RIDE`: pasajeros en auto.
- `MOTO_RIDE`: pasajeros en moto; licencia, casco, seguro y habilitación de pasajeros propios, nunca inferidos de moto-carga.
- `DELIVERY_AUTO`: encomiendas/paquetes en auto.
- `DELIVERY_MOTO`: encomiendas/paquetes en moto.
- `COMMERCE`: comercios, supermercados, restaurantes y farmacias OTC, catálogo/stock, compra, preparación, repartidor, entrega, pago y soporte.

El CLIENTE elige AUTO/MOTO; jamás cambiar tipo unilateralmente. Solo servidor emite cotización versionada/vigente y registra consentimiento explícito antes del compromiso/cobro. Geoapify se eligió para rutas; la credencial se reportó en GitHub Secrets, **no confirmar cobertura/cuota/conexión externa por esa afirmación**. No filtrar keys al frontend.

**Comisiones y economía:** Todo porcentaje/configuración editable desde **Admin Web por Owner autorizado y MFA** para AUTO_RIDE, MOTO_RIDE, DELIVERY_AUTO, DELIVERY_MOTO y COMMERCE. Parámetros históricos: AUTO pasajero 15 % nominal, MOTO pasajero 12 % nominal, y subsidio de 10 **puntos porcentuales** en pasajeros según regla Owner (confirmar fuente vigente). No asignar subsidio a carga o comercios por inferencia. No inventar comisión COMMERCE. Cotización, versión de regla, comisión, subsidio, liquidación, reembolso y asiento histórico tienen origen server-side, idempotencia, auditoría y protección contra cifras negativas no autorizadas.

**Antifraude y confianza:** El cliente califica conductor, repartidor y comercio; conductor/repartidor/comercio califican al cliente tras servicio real completado. Una denuncia o estrella solo genera señal para revisión, NO condena, bloqueo permanente ni manipulación automática sin corroboración, proceso y apelación. Exigir identidad, trazabilidad y pruebas de entrega independientes para reducir estafas.

**Secuencia de release:** GitHub funcional y verificable PRIMERO → aprobación expresa Owner → Render/Supabase **STAGING** auténtico + migraciones seguras → pruebas de dispositivos/IdP/GPS/legal/PSP → aprobación Owner independiente de LIVE y Stores. Nada de merge a main, LIVE, deploy externo, compras ni activación de PSP sin orden Owner.

## 2. CÓDIGO ÚNICO — NO DUPLICAR CUATRO APPS

| Componente | Carpeta | Responsable/propósito |
|---|---|---|
| A autoridad Backend | `apps/mobility-expo/server/`, `apps/mobility-expo/docs/backend/staging_only/` | Node HTTP, SQL PG16, RBAC/IdP, precios, despacho, KYC, GPS, reputación, fraude, ledger |
| B Cliente Expo | `apps/movete-cliente/` | Alta, cotización, viaje/envío/comercio, consentimiento, historial, tracking, rating, pagos |
| C Driver Expo | `apps/movete-driver/` | Auth/KYC, vehículo, ofertas privadas, aceptar/declinar, estados viaje, custodia, foto, ganancias |
| D Admin + portal Merchant | `apps/movete-admin/` | Owner comisiones, Admin MFA/KYC/incidentes/finanzas, staff comercio pedidos |
| CI A+B+C+D | `.github/workflows/qore-four-apps-unified.yml` | Una revisión, tipos, builds nativos, web Admin, suites; no ejecución calle |
| CI PostgreSQL | `.github/workflows/mobility-g4-postgres-disposable.yml` | PG16 **descartable**, HTTP loopback, suites de concurrencia y estado; NO Supabase persistente |

**No usar `*_POSTGRES_CI_ONLY.sql` como migraciones de producción**: contienen restricciones a `qore_disposable_chain` / `qore_ci_disposable_chain`, autoridades y datos QA. Preparar por separado migraciones reales auditables y reversibles cuando se autorice STAGING externo.

## 3. QUÉ SE IMPLEMENTÓ HASTA G178 — INVENTARIO DE CONTINUIDAD

**Antes de este ciclo:** G73/G98 booking AUTO B→A, G160/G111/G112 despacho acotado original; G100/G102/G118/G119 MOTO QA; G5/G121/G122/G125/G126 envío/quote; G45/G139/G148 comercio y stock, G150/G153/G154 comercio→envío; G155 ratings, G156 inbox commerce, G157/G158 denuncias privadas/Admin AAL2, G116/G136 comisiones, G124 tarifas carga, G128–G134 Geoapify, G159 cámara/timeout JS, G162–G169 recuperaciones y estados de viaje/worker. Son componentes QA; **no confundir integración sintética con operación comercial**.

**Conexiones/fixes recientemente publicadas, NO REHACER:**
- **G155** [`be55fac`](https://github.com/mezas3238-hue/Qore-mobile-/commit/be55fac519d2930c8bdc65cf58f318f681ac7ec7) / [`20d95bb`](https://github.com/mezas3238-hue/Qore-mobile-/commit/20d95bb870dc4b8d905af775a8b53c7c2702b3e5): `ratingTrust` opt-in en G4, IdP independiente, sesión revocable, SQL original `mobility_stage_g155_submit_rating_qa`. Sin confianza 503.
- **Recíproca Merchant→CLIENT** [`7655f91`](https://github.com/mezas3238-hue/Qore-mobile-/commit/7655f910e2a17332972839b11d163e9ce37dd827): `apps/movete-admin/src/merchant-main.tsx` muestra rating tras `delivered`; flags G155 OFF por defecto. **Pendiente UI Driver→CLIENT** y habilitación IdP.
- **G156** [`09ed235`](https://github.com/mezas3238-hue/Qore-mobile-/commit/09ed235578f4239d893e7c992982471169c68a04): inbox de personal comercial original G42, distinta sesión IdP y filtro SQL; requiere autoridad externa.
- **G158** [`878129e`](https://github.com/mezas3238-hue/Qore-mobile-/commit/878129e9fbcf12f81227f11347b921b8c723846a): lectura privada de denuncias G157 por Admin AAL2/RBAC; no hay sanción automática.
- **G170** [`219493a`](https://github.com/mezas3238-hue/Qore-mobile-/commit/219493aa0d9bd1d0d2cf6f420d1af59e77ea1407): conexión de G106 recuperación trip AUTO del Driver al runtime principal, solo de fila original realmente asignada y sesión revocable. Pruebas y fixes posteriores del runtime G170 en la rama; consultar HEAD. consultar HEAD.
- **G171** [`8425cd3`](https://github.com/mezas3238-hue/Qore-mobile-/commit/8425cd31307ac87408789de8e22048051d8e9b04): lector Driver current trip con bytes/timeout y cancelación no bloqueante.
- **G172** [`d1f94aa`](https://github.com/mezas3238-hue/Qore-mobile-/commit/d1f94aab48714b6638e933553c83b9ebf7ab7b80): lector Merchant inbox/transition/rating acotado, pruebas de stuck stream.
- **G173** [`690a47b`](https://github.com/mezas3238-hue/Qore-mobile-/commit/690a47b2e2eb86f872601b8e111be159747ef0db): transiciones Merchant G6 y vinculación G150 montadas en runtime tras IdP staff independiente + G42 locked SQL; ex empleado no puede repetir evento viejo aunque tenga requestKey. G173 CI PG16 SUCCESS [40814600536](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40814600536).
- **G174** [`cac25e7`](https://github.com/mezas3238-hue/Qore-mobile-/commit/cac25e7edf83ffa8fe350b6d1f9534e98d8ea229): G45 reserva stock Cliente y G144 recovery montados en G4 con Buyer IdP independiente, sin checkout/PSP; CI A+B+C+D y PG16 SUCCESS [40814934700](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40814934700) / [40814934709](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40814934709).
- **G175** [`319b3ca`](https://github.com/mezas3238-hue/Qore-mobile-/commit/319b3cac1a7be76c154080e4049138b14bc94ffd): bloqueadas las **rutas Buyer legadas G6** que mutaban pedidos fuera del G45/G139. No reabrir autoridad duplicada. CI A+B+C+D y PG16 SUCCESS [40853297019](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40853297019) / [40853297190](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40853297190).
- **G176** [`1dba863`](https://github.com/mezas3238-hue/Qore-mobile-/commit/1dba863a26821e24b9f84aea0c032fc420ca5c41): ruta legada G5 ya no permite a courier `pickup/deliver/return` sin G66/G67; remitente mantiene `cancel` y lecturas. CI A+B+C+D y PG16 SUCCESS [40853791239](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40853791239) / [40853791279](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40853791279).
- **G177** [`341aa7e`](https://github.com/mezas3238-hue/Qore-mobile-/commit/341aa7e22ab1a5c2894b4936a3077ec0dabded75): avance Driver AUTO `arrive→pickup→complete` en runtime principal requiere independiente IdP/revocación/rol Driver y SQL G42 transaccional sobre **un viaje G3 ya asignado**. Prueba con decoder nativo C G65, receipt EXACTO seis campos. No es nueva aceptación legal G38. PG16 SUCCESS [40855184348](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40855184348). *Nota histórica: fallos intermedios de CI fueron arreglados; fixture G109 no persiste entre jobs, no inventar fixture para un test de G177.*
- **G178** [`4f470c6`](https://github.com/mezas3238-hue/Qore-mobile-/commit/4f470c6d28cc27ae538bd822b942eaa6ae85383c): `apps/movete-driver/src/domain/driver-trip-lifecycle-http.mjs` usa lector GET/POST con máximo de bytes y deadline; un POST incierto NO se reintenta, requiere recuperación G65/G106. CI A+B+C+D SUCCESS [40855495307](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40855495307).

**LIMITACIONES de estas conexiones:** opt-in sin proveedor real, STAGING QA, no servicio en calle ni dinero; G175–G178 cierran bypasses/estabilidad, pero NO constituyen un nuevo viaje E2E certificado. El runtime `g4-staging-runtime.mjs` es **LOCAL QA ONLY** y `liveTripsEnabled=false`. La UI `apps/movete-cliente/app/pagos.tsx` expresa “Pago no habilitado”; `envios.tsx` mantiene registro/pricing QA sin despacho, y el portal Merchant exige flags externos de verificación por defecto OFF.

## 4. MATRIZ P0 DE LOS CINCO SERVICIOS — QUÉ FALTA EXACTAMENTE

| Servicio | Base existente verificable | Cierre de negocio que FALTA (NO disimular) |
|---|---|---|
| **AUTO_RIDE** | G73 booking B→A, G160 G111/G112 despacho, G16 oferta, G106/170 recovery Driver, G177 fases de viaje previamente asignado, G138 Admin | **MISMO viaje nuevo** G73→G112→oferta privada C→KYC/legal G38/G71 genuino→aceptación C→arrive/pickup/complete G177→estado B + historial B + traza D + slot liberado + quote/commission/ledger. G109 prueba fixture histórica prelegal, NO resuelve el eslabón. |
| **MOTO_RIDE** | G100/G102/G118/G119/G142 y G169 MOTO Driver QA | Misma reserva MOTO nueva, oferta privada, Driver legal para **pasajeros MOTO**, aceptar y completar, cliente/historial/Admin mismo tripId, casco/seguro/licencia/geocerca, economía versionada y cancelaciones. |
| **DELIVERY_AUTO** | G5/G121/G122/G123/G125/G126 y G66/G67 pruebas de custodia; G176 bloquea ruta débil | Ruta real origen→destino, quote **antes de booking comercial**, consentimiento exacto, oferta a courier AUTO legal, aceptar→pickup G66→prueba G67 y **confirmación independiente destinatario**→delivered, B/D mismo deliveryId; devoluciones y disputas. |
| **DELIVERY_MOTO** | Igual base G5 + elección MOTO y control peso/categoría | Misma cadena con MOTO **carga** habilitada (no permiso moto pasajero), capacidad/zona/precio específicos, courier legal, recibido/confirmación, cierre y conciliación. |
| **COMMERCE** | G45/G139/G148 original catálogo/stock y orderId, G150/153/154 enlace priced delivery, G156/G173 Merchant staff, G174 Buyer IdP, G175 elimina G6 Buyer bypass | Cliente compra sin duplicados, comercio confirma/prepara, paid checkout solo tras PSP autorizado, vincular orderId+deliveryId, despacho courier legal, G66 pickup, Merchant `handed_to_courier`, G67 entrega/confirmación destinatario, estado terminal consistente B+Commerce+D, comisión Owner y refund/stock rollback. |

**Criterio E2E que importa:** misma requestKey y misma identidad/transacción originales desde un Cliente B nuevo hasta el Driver C elegido **server-side**, Merchant D cuando aplica, Admin D y estado terminal, con evidencia de cada transición. No unir ejecuciones distintas por IDs parecidos. No presentar mocks / 200/201 / build como certificación comercial.

## 5. P0-AUTO — PRIMER TRABAJO REAL DEL PRÓXIMO ARQUITECTO

**Abrir primero:** `apps/mobility-expo/server/g4-staging-runtime.mjs`, `g4-staging-runtime.test.mjs`, `g73-f1-auto-gateway.mjs`, `g111-after-booking-auto-dispatch.mjs`, `g112-scoped-auto-dispatch-repository.mjs`, `g98-f1-auto-postgres-loopback-e2e-ci.mjs`, `g109-driver-auto-completion-pg-http-ci.mjs`, `g177-verified-auto-driver-step-gateway.mjs`, `apps/movete-driver/app/ofertas.tsx`, `app/viaje.tsx`, `src/domain/driver-trip-lifecycle-http.mjs` y `apps/movete-admin/src/service-trace-gateway.mjs`.

**Implementación, no simulacro:**
1. Trazar G73 nueva reserva/versioned fare/consent desde B hasta G112, asegurar una única fila nueva y ninguna oferta duplicada tras retry/ACK perdido.
2. Hacer que G85/G16 ofrezca **esa** operación privada al Driver C y que el contrato nativo realmente se alimente del mismo servidor.
3. Exigir G38/G71: permiso/autorización/licencia/seguro real, consentimiento, geocerca/cobertura, disponibilidad y vehículo. La política G38 intencionalmente rechaza faltantes; **no cambiar `eligible_by_policy=false` para ganar un test**. Si solo hay fixture, marcar EXTERNAL_BLOCKED.
4. C con token propio acepta oferta original exactamente una vez. G177 avanza únicamente fila ya aceptada: llegar→recoger→completar, sin actor id aportado por cliente; B lee mismo estado, C recupera tras reinicio G106, D audita mismo tripId, G36 libera slot.
5. Repetir con actor ajeno, dual-role, KYC expirado, oferta caducada, dos Drivers concurrentes, cancelación, suspensión/idioma/red, quote vencido, cambio de comisión tras booking, pérdida de ACK y revocación entre SQL y respuesta. Ningún doble viaje ni comisión reescrita.
6. Un test único HTTP→PG16 con B experiencia nativa→A G73/G112→C experiencia original→A G177→B estado+historial→D trace, por **MISMA** ID y session scopes. Si legal externo ausente, verificar que el **rechazo** es correcto; no contar como operación completada.

**Definición DONE AUTO**: nueva reserva real funcional, conductor legalmente elegible del mismo viaje y estado completo en B/C/D, no solo G109; así sucesivamente para otros servicios.

## 6. P0-MOTO Y ENVÍOS — LÓGICA Y PERMISOS SEPARADOS

**MOTO_RIDE:** conectar todo G100/G118/G169 nativo hasta terminal; licencia de transporte de pasajeros en moto independiente de motodelivery, equipo casco/seguro/legal, cotización 12 % inicial editable y subsidio 10 pp según Owner, identidad del Driver, ruta consentida, cancellation, refund. D verifica mismo original.

**DELIVERY_AUTO/MOTO:** `apps/movete-cliente/app/envios.tsx` aún registra **“envío de prueba QA (sin repartidor)”**, y el precio G161 se revisa luego del registro; falta diseño comercial de **cotizar ANTES de reservar**, cobertura/geocoding real, total + comisión + versión, aceptación expresa, dispatch/assignment y seguimiento. Unir G5/G121/G122/G123/G125/G126 y G10/G66/G67/G68; verificar límites por categoría, peso, volumen y vehículo; rutas y permisos; mismo deliveryId. Corregir toda segunda ruta de mutación que eluda identidad Courier revocable; **G176 ya cerró una**, auditar aceptación/retornos legados restantes.

**Prueba final de entrega**: una referencia UUID autodeclarada por Driver NO demuestra entrega al destinatario. Diseñar confirmación independiente (PIN one-time o desafío verificado por parte autorizada), hash/no PII, TTL/intent counters, rate limiting, aceptación/denegación/remedios por teléfono perdido o disputa; G67 prueba consumida exactamente una vez; Admin puede investigar. Sin confirmación real no afirmar entregado comercial.

## 7. P0-COMMERCE — CERRAR EL CICLO MULTIACTOR

1. B: `apps/movete-cliente/app/comercios.tsx`, `src/G148CommerceQaPanel.tsx`, `g139-commerce-qa-http-gateway.mjs`: catálogo/sucursal actual, carrito, stock y precios de servidor, sustituciones explícitas, caducidad, compra durable, recuperación por clave, nunca cobrar por UI local.
2. A: G45/G139/G144/G148 reserva idempotente stock, G174 integrado; G175 cerró petición Buyer G6 legacy. Comprobar cancelación/reversión exacta sin restock doble, actor diferente y replay de distinta carga.
3. Portal staff D: `apps/movete-admin/src/merchant-main.tsx`, G156 inbox/IdP + G173 write G42 transaccional; UI confirm/preparing/ready, sin empleados ajenos. Importante: flags STAGING deshabilitados por defecto; no afirmar despliegue funcional por CI.
4. G150/G153/G154: orderId original `ready`, deliveryId original, peso total real, tarifa G122 consentida y prueba de legalidad antes de offer. Crear/entregar oferta courier, pickup G66, merchant handoff, G67 destinatario; marcar ambos estados de pedido y entrega `delivered` una sola vez en SQL con revision consistency.
5. D Admin: seguimiento end-to-end de ambos IDs sin inventar settlement; comisión comercio y repartidor configurable por Owner, margen, cancelaciones, backorders, refund parcial, chargeback, soporte y eventual PSP.
6. Ratings Merchant→CLIENT después de entrega están ya en `merchant-main.tsx`, G155 opt-in. Conectar estado verdadero/IdP; Driver→CLIENT UI sigue pendiente.

## 8. P0/P1 — PAGOS, TARIFAS Y PROTECCIÓN ECONÓMICA

- **PSP no habilitado** `apps/movete-cliente/app/pagos.tsx`. No procesar dinero con fixture. Implementar primero contrato server-only: un paymentIntent por order/ride/delivery, idempotencia durable, método tokenizado/PSP hosted, autorización y captura separadas, webhook firmado/replay fence, reembolso parcial/total, chargeback, settlement/payout, reconciliación y ledger inmutable; elegir proveedor disponible/permitido Paraguay solo con autorización y verificación.
- Owner Admin: `apps/movete-admin/src/OwnerCommissionEditor.tsx`, `OwnerCargoRateEditor.tsx`, G116/G136/G124. Verificar pantalla usable de cinco servicios y comisión COMMERCE por vertical/comercio con MFA y RBAC. Tarifas de carga independientes, subsidio pasajeros 10 pp, cotización VERSIONADA y snapshot no mutable; calcular reparto y costos con límites/pisos.
- Driver `app/ganancias.tsx`, B historial y D finanzas: no mostrar ganancias PSP ficticias; solo valores conciliados servidor, diferenciando cotización, autorización, cobro, settlement y pago al proveedor.

## 9. P1 — CALIFICACIONES, ANTIFRAUDE Y SOPORTE

- G155 Cliente→Driver/Courier/Merchant y Merchant→CLIENT QA (G42/IdP/same-service, 1–5). Completar Driver/Courier→CLIENT nativo, errores UX, post-servicio elegible, sin calificaciones de no-show o por usuario ajeno.
- G157/G158: denuncias **alegaciones privadas**, Admin GET lectura AAL2/RBAC sin sanción. Completar expediente con caseId, evidencias no manipulables, estado OPEN→INVESTIGATING→DECISION→APPEAL, SLA, responsable, notificación, remedios proporcionales, retención/privacidad y auditoría. Nunca publicar acusación sin investigación.
- Detección antiestafa: duplicación cuentas, KYC falsificado, GPS imposible, prueba entrega manipulada, fraude PSP/chargeback, anulaciones sistemáticas, colusión/rating coordinado, device & session anomalies **solo con señales lícitas y corroboradas**. Reglas de enforcement graduadas y reversibles, false positives medidos, nunca auto-ban por una estrella.
- Buyer y Driver seguros: emergencia/contacto/soporte, reporte en viaje, PIN de inicio y entrega cuando proceda, privacy-minimization y apelación.

## 10. P1 — GEOAPIFY, GPS Y REPUTACIÓN OPERATIVA

- Geoapify G128/G129/G130/G134 y key reportada en GitHub Secrets. Demostrar proveedor real en entorno autorizado: geocoding pickup/dropoff, ruta, distancia, duración y cobertura Paraguay, perfiles AUTO/MOTO, limitación de peajes/tráfico si el servicio no lo provee, ETA sin ficción, cuotas/latencia/fallback. Nunca exponer service secrets al móvil.
- Aplicaciones B/C: ruta dibujada desde servidor, ubicación del Driver SOLO consentida y temporal, polling/backoff y WebSocket/eventos cuando estén preparados, foreground/background, zonas municipales realmente habilitadas, seguimiento sin GPS falso, borrado/retención de historial.
- No inferir habilitación legal de una coordenada ni usar ubicación vieja para enviar oferta. La elegibilidad se decide en transacción A/G38/G71, no en dashboard de reputación.

## 11. P0 TRANSVERSAL — ESTABILIDAD, SEGURIDAD Y NO DUPLICACIÓN

- G159 cámara/documentos: timeouts JS y limpieza de fotos tardías en C; falta validación Expo/Android/iOS física, permiso cámara, modal nativo cancelable, liveness/IdP autorizado y Storage privado externo. No usar cámara conduciendo.
- G170/G171/G178: Driver reanuda estado por G106, G65 fase segura; timeout/bytes. Extender patrones a TODOS los fetch B/C/D: DNS lento, abort, respuesta grande, memoria limitada, pantalla en background, doble tap, error claro; ninguna cancelación de stream debe bloquear UI.
- POST de booking, aceptación, carga documento, evento de viaje, custodia o PSP con ACK desconocido => NO reintento con nueva key ni confirmación local. Registrar key durable, GET por autoridad SQL y permitir retry idempotente solo cuando contrato garantice. Publicar tests de pérdida respuesta DESPUÉS de commit.
- Rol exclusivo Passenger/Driver/Merchant/Admin/Owner, sesión proveedor independiente revocable, AAL2 Owner/Admin, RLS, rate limit por usuario/IP/operación, perfiles legales/seguro/licencia, KYC, idempotency/unique constraints, bloqueo row/serialization, no secrets/PII/GPS/JWT/KYC en logs ni en cliente.
- Revisar especialmente rutas de legado aún accesibles: G175 bloquea Buyer pedidos no-G45; G176 bloquea Courier G5 transiciones; G177 protege Driver G3 fases. Investigar **otras** mutaciones que salten despacho privado, confirmación destinatario o autorización de pago; NO quitar checks para obtener verde.

## 12. ESCALA MILLONES — PRIORIDAD DE DISEÑO, NO EVIDENCIA DE CAPACIDAD

**Owner exige ingeniería para millones**, no solo 10k. Estado Github:
- [PR #21 DRAFT](https://github.com/mezas3238-hue/Qore-mobile-/pull/21) laboratorio **5.500** requests HTTP loopback (500/2000/3000, concurrencias 25/80/120); handlers sintéticos, no 5 servicios PostgreSQL E2E. El propio PR cita un límite de ~**4.096 identidades/buckets** en ingress para investigar. NO asegurar millones por ese bench.
- [PR #22 DRAFT](https://github.com/mezas3238-hue/Qore-mobile-/pull/22) modelo teórico **>2M cuentas y horizonte 1M conectados**, escenarios 2M/5M/10M; explícitamente **no es load test de un millón de actores**. No fusionar ni presentar como soporte demostrado.

**Trabajo de ingeniería P0/P1 real requerido:** índices/paginación/cursor para inbox y status, pooling PgBouncer/conexiones, colas durables/transactional outbox con dispatcher multinstancia, dedup, garantías de exactly-once effect/no lost order, bloqueos/race en estados, retención/archivado/GPS, límites de rate distribuidos (no solo memoria Node), storage privado, backpressure, métricas y tracing, health/readiness/liveness, circuit breaker, retries con jitter y DLQ, contingencia offline, backups/restore verificados/DR y seguridad multi-tenant. Laboratorios **reales** PostgreSQL disposable con cargas progresivas 10k→100k→1M operaciones/identidades mediante simulación controlada, escenarios 5 servicios por misma ID, sin afirmar usuarios reales; medir RPS, p50/p95/p99, CPU/RAM/IO, errores, latencia dispatch, integridad y cero operación duplicada. Multi-instancia, reinicios, failover y hot-spot; probar capacidad de desacoplar GPS de transacciones críticas. Evitar costes de carga o tráfico externo sin orden Owner.

**Puerta de salida para capacidad:** objetivos SLO aprobados, métricas reproducibles, sin pérdida ni duplicación bajo fallos y capacidad demostrada **por dimensión** (cuentas registradas, sesiones concurrentes, RPS, GPS updates), no un número agregado imaginario.

## 13. DEPENDENCIAS EXTERNAS — NO_GO HASTA EVIDENCIA

| Dependencia | Qué se necesita | Estado al corte |
|---|---|---|
| Real IdP/Supabase Auth + revocación | JWT, MFA, sesiones autónomas Buyer/Driver/Staff/Admin, RLS, tenant | **EXTERNAL_BLOCKED**, adaptadores G42 QA; no probar IdP real con mocks |
| KYC/G38/G71 legal | licencias, seguros, habilitación jurisdiccional AUTO y MOTO pasajeros/carga, documento vigente y verificador independiente | **EXTERNAL_BLOCKED**; G38 rechaza por diseño; NO hacer bypass |
| GPS/Geoapify externo | rutas, cuota, términos de uso, zonas y tracking en dispositivos reales | **EXTERNAL_BLOCKED** para certificación física |
| PSP Paraguay | proveedor autorizado, cuenta, método tokenizado, settlement, reembolsos y webhooks | **EXTERNAL_BLOCKED**; UI pagos OFF |
| Render/Supabase STAGING externo | permisos de workspace, recursos/costos aprobados, migraciones no-CI, backups, dominio HTTPS, secrets | **NO DESPLEGADO/NO APROBADO**; no activar desde handoff |
| Cámara/almacenamiento/dispositivos | Android/iOS reales, camera & Storage, eventos nativos y degradaciones de red | **PENDIENTE / no certificado** |
| Legal/privacy/Stores | términos, consentimientos, retención, soporte y requisitos regulatorios | **PENDIENTE revisión real** |

**Alusión histórica:** en 27-OCT el conector Supabase devolvió `projects: []` y Render tenía workspace sin selección aprobada, según `docs/handoff/INTEGRACION_UNICA_A_B_C_D_NO_MAS_TESTS_AISLADOS_2026-10-27.md`. **Es dato histórico**, no afirmar conectividad actual sin reconsultar cuando Owner autorice STAGING.

## 14. ORDEN DE EJECUCIÓN — P0 IMPLEMENTABLE ANTES DE CUALQUIER NUEVO HANDOFF

**Iteración 1 — cerrar bloqueos de código en el camino principal:** una única solicitud nueva AUTO B/G73→A/G112→C/G16 y G38/G71→G177→B status/history→D G138, con evidencia real de la MISMA identidad de recurso, sin legal falso. Identificar punto exacto fail-closed para externa. Preservar G175–G178.

**Iteración 2 — cerrar 4 caminos restantes:** MOTO_RIDE G169, DELIVERY_AUTO, DELIVERY_MOTO G66/G67 + confirmación destinatario, COMMERCE G174/G173/G150/G154 hasta delivered; integrar **las pantallas reales** de B/C/D y recuperación. No escribir test independiente que nunca sea llamado desde la app.

**Iteración 3 — economía y confianza:** Owner 5 comisiones y tiers, quote consent-before-commit, ledger auditable; ratings bidireccionales, antifraude expediente/appeal; PSP adapter durable listo pero desconectado sin credenciales/autorización; no fake settlement.

**Iteración 4 — calidad y escala:** universal deadlines, ANR/observabilidad, legal privacy, pruebas de dispositivo y escala PG16 progresiva; fallos de workers, doble dispatch, mensajes perdidos y multinstancia. Demostrar límites, no marketing.

**Iteración 5 — autorización Owner independiente:** solo cuando Github integrado y bloqueos de código P0 estén cerrados, presentar reporte de requisitos/servicios/costo/riesgos y solicitar autorización concreta para Render/Supabase STAGING. Después validar Auth/KYC/GPS/PSP reales y decidir GO/NO_GO separadamente.

### Orden estricto para reportar cada iteración
- SHA nuevo + rutas/archivos modificados + qué operación ahora hace B/C/D realmente.
- Prueba de integridad mismo requestKey, tripId, deliveryId, orderId, version y actor, si la operación corresponde.
- Workflows **del mismo SHA**; FAIL y errores no se esconden; reparación y rerun.
- Estado operativo: `CODE_COMPLETE_QA`, `EXTERNAL_BLOCKED`, `CERTIFIED_STAGING`, o `NO_GO` con evidencia. No inventar categoría “listo para producción” si queda algún bloqueo.

## 15. CRITERIOS DE ACEPTACIÓN Y FALLAS NEGATIVAS (NO NEGOCIABLES)

Se considera “**app terminada para solicitar despliegue STAGING**” solo con:
- Las 5 verticales ejecutadas desde **la UI real** de Cliente B al backend integrado y Driver C/Commerce cuando corresponda, con estado terminal y conciliación con Admin D del mismo recurso original, sin bajar G38/G71/G67/G42.
- Comisiones Owner configurables por cinco servicios aplicadas a quote/historial/ledger con snapshot de versión.
- Mensajería/recuperación/no-replay tras reinicios y caídas; dos aceptaciones simultáneas no asignan dos Drivers, único consumo de prueba de entrega, una sola reserva/cobro; stock/slots liberados.
- B/C/D sin pantallas colgadas ante timeout/red muerta; feedback útil y recovery real; pruebas de dispositivos aún serán requisito adicional.
- Fraude reportable y calificable bilateralmente con expediente privado, revisión humana/appeal y sin sanciones automáticas.
- El mapa y GPS no muestran posiciones/ETA inventados y no envían Driver si hay falta de cobertura, documentos o autorización.
- CI de HEAD GREEN en matrices de integración y PG16; no mezclar PASS de otro SHA. Test positivo sin permisología auténtica solo puede catalogarse **QA_DEMO**, no GO legal.
- Habilitación externa se analiza **solo tras orden Owner** y requiere tests adicionales de HTTPS, Auth, KYC, dispositivos, PSP y restore real.

**Fallas obligatorias:** 401 usuario ajeno o sesión revocada; 403 rol/KYC/tenant negado; 409 estado/quote/replay conflictivo; 429 abuso; 503 proveedor externo no disponible; ninguna debe crear pedido doble ni cobro fantasma. Comprobar sobrecarga, latencias, reintentos y colas por separado.

## 16. PRs, ISSUES Y FUENTE DE VERDAD

**PRs abiertos DRAFT verificados 29-OCT:** [#7 Backend](https://github.com/mezas3238-hue/Qore-mobile-/pull/7), [#8 Cliente B](https://github.com/mezas3238-hue/Qore-mobile-/pull/8), [#19 Driver C](https://github.com/mezas3238-hue/Qore-mobile-/pull/19), [#20 Admin D](https://github.com/mezas3238-hue/Qore-mobile-/pull/20), [#13 dispatch G115](https://github.com/mezas3238-hue/Qore-mobile-/pull/13), [#14 Store candidates](https://github.com/mezas3238-hue/Qore-mobile-/pull/14), [#21 LAB HTTP 5.500](https://github.com/mezas3238-hue/Qore-mobile-/pull/21), [#22 LAB scale 2M](https://github.com/mezas3238-hue/Qore-mobile-/pull/22), además [#2](https://github.com/mezas3238-hue/Qore-mobile-/pull/2) / [#3](https://github.com/mezas3238-hue/Qore-mobile-/pull/3) legacy. **No fusionar ni reemplazar rama** porque el usuario no lo autorizó. Mantener trading Flutter separado de movilidad.

**Issues del Owner:** [#15 A Backend](https://github.com/mezas3238-hue/Qore-mobile-/issues/15), [#16 B Cliente](https://github.com/mezas3238-hue/Qore-mobile-/issues/16), [#17 C Driver](https://github.com/mezas3238-hue/Qore-mobile-/issues/17), [#18 D Admin](https://github.com/mezas3238-hue/Qore-mobile-/issues/18); complementarios #4/#5 tarifas/vehículos y #9/#10/#11/#12 benchmarking.

**Handoffs anteriores, SOLO ANEXOS:** `docs/handoff/HANDOFF_MAESTRO_EJECUTIVO_OPERATIVO_ABCD_G160_APP_FUNCIONAL_2026-10-28.md`; `docs/handoff/HANDOFF_MAESTRO_OPERATIVO_E2E_G158_COMERCIO_ANTIFRAUDE_2026-10-28.md`; `docs/handoff/INTEGRACION_UNICA_A_B_C_D_NO_MAS_TESTS_AISLADOS_2026-10-27.md`. Sus SHAs/CI son históricos; este handoff incorpora G155–G178 y el **siguiente HEAD real prevalece**.

## 17. GUÍA GITHUB PARA ACELERAR SIN REGRESIONES

- Fuente única: GitHub rama soberana; consultar `HEAD`, árbol y blob SHA antes de escribir. Actualizar un archivo concreto con blob SHA y base actual; ante 409/concurrencia, **volver a leer y rebasear cambios**, jamás forzar.
- Trabajar directamente en `apps/mobility-expo/server/g4-staging-runtime.mjs`, sus contratos nativos B/C/D, PG16 y un test **positivo/negativo de flujo original**; minimizar archivos nuevos si se puede reparar la integración existente.
- Para CI usar los dos workflows anteriores y obtener logs reales del job fallido. Fallas históricas del nuevo código fueron corregidas y lograron GREEN, pero un HEAD nuevo siempre necesita nueva evidencia.
- No usar web ni suposiciones para sustituir archivos privados ni afirmar configuración real. No compartir credenciales, datos personales, fotos, secretos PSP, tokens ni información GPS.
- Mantener `LIVE=false` y autorización externa explícita; no introducir escrituras directas que salten RPC, RLS, locks, G38, G71 o G67.
- Reservar documentos solo para cambios de fase o petición expresa del Owner. Tras leer este archivo, **volver a codificar inmediatamente**.

## 18. PROMPT PARA COPIAR COMO PRIMER MENSAJE DEL NUEVO CHAT

> **ARQUITECTO EJECUTIVO A+B+C+D — CONTINUIDAD INMEDIATA QORE MOBILE / MOVETE FÁCIL.** Repositorio `mezas3238-hue/Qore-mobile-`, rama `integration/qore-mobile-e2e-four-apps-20261027`. Abre en el HEAD actual `docs/handoff/HANDOFF_MAESTRO_EJECUTIVO_QORE_MOBILE_ABCD_G178_PENDIENTES_E2E_ESCALA_2026-10-29.md` y verifica los workflows A+B+C+D y PostgreSQL16. Este documento ya identifica los trabajos y los avances G155–G178: NO hagas otro handoff ni vuelvas a empezar. Tu primera tarea es **implementar el circuito faltante de la misma reserva nueva AUTO G73/G160→G112/G16→Driver C legal G38/G71→G177→Cliente B y Admin D**, sin usar G109 histórica como sustituto. Luego cierra MOTO_RIDE, DELIVERY_AUTO, DELIVERY_MOTO y COMMERCE, comisiones Owner en cinco servicios, antifraude/rating bilateral, mapa/GPS, resiliencia sin pantallas colgadas y arquitectura para millones. Publica commits funcionales y pruebas integradas de la misma operación; bloquea explícitamente IdP, licencias, GPS o PSP no certificados, sin fabricar permiso o pago. **GitHub primero; NO merge, LIVE, Render, Supabase ni PSP sin orden del Owner.** Quiero funcionamiento real y reporte verificable, no promesas ni suites aisladas.

---
**FIN — Handoff de continuidad ejecutiva.** El siguiente paso es implementar código en el nuevo chat, no escribir otro documento.

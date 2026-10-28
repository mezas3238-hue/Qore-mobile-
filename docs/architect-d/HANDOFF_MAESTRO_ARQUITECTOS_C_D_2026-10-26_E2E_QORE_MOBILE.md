# HANDOFF MAESTRO OPERATIVO — ARQUITECTOS C + D
## QORE MOBILE / MOVETE FÁCIL — 26 OCTUBRE 2026
**MANDATO DEL OWNER:** acelerar funcionalidad real, no seguir multiplicando commits, pantallas simuladas o handoffs. El siguiente arquitecto asume C (Driver) y D (Admin Web) y continúa directamente en GitHub hasta cerrar cada recorrido integrado. Este texto no equivale a aprobación de despliegue.

**REPOSITORIO:** https://github.com/mezas3238-hue/Qore-mobile-

**PUNTOS DE TRABAJO**
- Arquitecto A, Backend y PostgreSQL16: PR #7 DRAFT, rama `feature/mobility-monorepo-isolated-20261016`, HEAD verificado al redactar `376175b73cf571fe7a0a6f569cde617bcd8063d8`; issue #15. No editar código A desde C/D.
- Arquitecto B, Cliente Expo: PR #8 DRAFT, rama `feature/mobility-cliente-admin-parallel-20261022`, HEAD `66a8dff310031cd7f8f871ce044d239afd77f725`; issue #16. No editar código B desde C/D.
- **C, Driver Expo independiente**: PR #19 DRAFT, rama `feature/mobility-arquitecto-c-driver-e2e-20261026`, HEAD funcional de entrada `fd9d85749773bcd1d842138fd7abb75941cc49b0`; issue #17. Propiedad exclusiva `apps/movete-driver/**` y `docs/architect-c/**`.
- **D, Admin Web**: PR #20 DRAFT, rama `feature/mobility-arquitecto-d-admin-e2e-20261026`, HEAD funcional anterior a este documento `e7e81878349850786d61d95bf38338498f9ae5af`; issue #18. Propiedad exclusiva `apps/movete-admin/**` y `docs/architect-d/**`. Este documento se archiva en D sin fusionar ramas.
- Coordinación de contratos e incidencias: https://github.com/mezas3238-hue/Qore-mobile-/issues/15 ; /issues/16 ; /issues/17 ; /issues/18.
- No confundir ramas: C nace de A y D de B; un PASS sobre la rama B o A **no certifica** automáticamente el SHA D ni la convergencia A+B+C+D.

## 1. Objetivo no negociable y servicios
La solución comprende **dos aplicaciones Expo nativas separadas** (Cliente y Driver), **Admin Web separado**, backend HTTPS y PostgreSQL persistente y auditable; lanzamiento inicial Paraguay, expansión multi-país preparada. No APK como entrega final: distribución eventual vía Play Store y App Store, luego de certificación y aprobaciones.

Cinco tipos de servicio contractuales (cuatro familias comerciales):
1. `AUTO_RIDE`: pasajeros en automóvil.
2. `MOTO_RIDE`: pasajeros en motocicleta; **NO equivale a reparto DELIVERY**.
3. `AUTO_DELIVERY`: paquetes transportados en AUTO.
4. `MOTO_DELIVERY`: paquetes transportados en MOTO.
5. `COMMERCE`: supermercados, farmacias, restaurantes y otros comercios, con pedidos, preparación, entrega y liquidación.

El Cliente elige vehículo AUTO/MOTO, visualiza tarifa y disponibilidad *verificadas*, contrata y sigue el servicio; Driver recibe una oferta exclusiva, acepta legalmente, ejecuta transiciones; Admin ve **la misma ID**, trazabilidad y ledger. Cobertura NO implica conductor disponible. No GPS ficticio, tarifa inventada ni pruebas de entrega generadas localmente.

## 2. Estado real y evidencia al asumir
| Frente | Evidencia comprobada | Lo que NO prueba |
|---|---|---|
| A | HEAD `376175b7`; Node, contratos PostgreSQL16 efímeros, staging-contracts, aislamiento y Driver/Cliente typecheck SUCCESS en acciones GitHub, p.ej. https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40430160586 | Staging externo funcionando, rutas Google reales, permiso territorial, PSP, servicios comerciales |
| B | HEAD `66a8dff3`, 1.149 pruebas Cliente PASS, Expo SUCCESS: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40431145866 ; Admin de rama B SUCCESS en https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40431145777 | Certificación de C/D branches ni viaje verdadero entre cuatro módulos |
| C | HEAD `fd9d8574`; dos ejecuciones Driver TS+domain tests+export SUCCESS, p.ej. https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40430633815 | Ensayo teléfono/tienda, PG16 E2E, MOTO_RIDE comercial |
| D | HEAD `e7e81878`; **cero check-runs propios** por workflow que no abarca PR D→B; pruebas locales aisladas y tests fuente agregados | TypeScript/npm build oficial en SHA D, PostgreSQL, operación autorizada |
| Global | PR #7/#8/#19/#20 permanecen DRAFT, no merge, NO_GO | Integración completa, pago real, despacho operativo o disponibilidad de Driver |

Fallo conocido: workflow **Reject edits outside Client/Admin ownership** aparece FAIL en PR C→A porque su alcance es incorrecto para esa rama. Responsable A/B de ajustar filtro sin debilitar separación. No confundir con job Driver exitoso. El workflow Admin no se dispara sobre D→B. Exigir CI exacta antes de certificar D.

## 3. Qué está hecho en C — no duplicar
- `app/ofertas.tsx`, `DriverOfferActionsProvider.tsx`: bandeja de ofertas privadas JWT Driver, TTL, poll solo en primer plano; aceptación idempotente con `requestKey`, reconciliación G64 sin reenviar automáticamente, rechazo de doble toque, KYC fresco antes de aceptar. Oferta AUTO_RIDE y tipo genérico DELIVERY; **no hay clase MOTO_RIDE aceptada por Driver**.
- `src/domain/driver-private-delivery-detail.mjs`: consulta privada G10 `GET /v1/staging/courier/delivery-offers/{offerId}`, coincide oferta y envío, revela vehículo AUTO/MOTO, categoría, peso, dimensiones y expiración; oculta PII, vehículo identificado y tags. `driver-delivery-accept-preflight.mjs`: segunda consulta de mismo paquete + JWT/inbox antes de POST.
- `driver-auto-accept-flow.mjs` y `driver-accepted-ride-resume.mjs`: AUTO aceptado solo navega tras confirmar asignación privada G106 del mismo tripId.
- `DriverCustodyProvider.tsx`, `app/entrega.tsx`, `driver-custody-controller.mjs`: G66 consulta `GET /v1/staging/courier/deliveries/{deliveryId}/custody`, transiciones de recogida/devolución, monitoreo de cancelaciones/disputas, revisión SQL monotónica, protección contra GET stale y repetición tras ACK incierto. `driver-delivery-navigation.mjs`: confirmar asignación misma deliveryId antes de abrir custodia. **Deliver bloqueado** mientras no exista prueba G67 independiente verificada en backend.
- `DriverKycExpiryProvider.tsx` + `driver-kyc-expiry.mjs`: estado KYC fresco, bloqueo por documentación vencida y cuenta bloqueada; backend G38/G71 sigue autoridad.
- `driver-staging-runtime.mjs`/Native: composición privada de servicios STAGING; sin fallback LIVE ni JWT embebidos.
- `app/ganancias.tsx`: retirado falso saldo `Gs. 0`; ahora indica **Saldo no verificado** y no inventa ingresos. Espera API de ledger Owner-auditado desde A.
- Web-export de Expo **no** demuestra instalación Android/iOS, dispositivos GPS, push ni aprobación de stores.

## 4. TRABAJO C PENDIENTE — lista ejecutable por prioridad
### C-P0: flujo real F1 AUTO_RIDE Driver
1. Con A+B fijar DTO y estados de F1: quoteId → bookingRequestKey → tripId único en PostgreSQL → oferta privada Driver → aceptación única → ruta/seguimiento → llegada → inicio → finalización → historial. Usar misma ID y ningún UUID de servicio simulado desde UI.
2. Ejecutar contra backend HTTPS STAGING y PostgreSQL persistente real con cuentas diferenciadas Passenger, Driver y Admin, revocación, 401/403/404/409, conflicto de dos conductores y reconexión tras POST incierto.
3. Asegurar que G38 territorio y G71 KYC se prueben en servidor para cada transición, no solo en botones; consultar estado al recuperar después de reinicio. Registrar pruebas y evidencia de mismo tripId en Admin.
4. Sin autorización Owner y licencias verificadas, la app permanece NO_GO; las pruebas pueden ser sintéticas y aisladas.

### C-P0: MOTO_RIDE pasajero, servicio distinto de DELIVERY
1. A debe entregar/certificar contratos G118/G119 para oferta exclusiva, asignación/aceptación y lifecycle `MOTO_RIDE` con Driver elegible, vehículo MOTO documentado, G38/G71, capacidad de pasajeros y zona.
2. C integrará `MOTO_RIDE` en inbox, decision receipt, recuperación y viaje, **sin reutilizar endpoints/escenario de paquetes** ni aceptar estados de A no certificados.
3. B ya expone selección AUTO/MOTO: prueba E2E comparativa con el mismo tipo elegido por pasajero. Comprobar rechazo de AUTO por motociclista y viceversa.
4. GPS/ruta/tracking y llegada/finalización exclusivamente de backend; no habilitar pasajero en motocicleta por mera existencia de reparto.

### C-P0: envíos AUTO y MOTO
1. Consumir cadena A G121 reserva original → G125/G127 ruta + tarifa G124 → G7 quote inmutable → G122 consentimiento remitente → G123 barrera SQL → oferta G10 privada → aceptación exclusiva Driver → custodia G66 → prueba G67 → entrega terminal + Admin ledger. B23 conserva claves G7/G126 en SecureStore. Sin pasos faltantes no declarar envío contratado.
2. Confirmar que el vehículo mostrado en G10 concuerda con `requested_vehicle_kind`, tarifa aceptada y licencia del Driver; revalidar justo antes de aceptar (preflight ya implementado).
3. Recuperación Driver tras crash: A debe certificar lectura privada de entrega activa actual `GET /v1/staging/courier/deliveries/current` (propuesta, **NO asumir montada**) filtrada en SQL por courier_id JWT, misma deliveryId/revisión, no resucitar oferta vencida.
4. Con A implementar G67 **prueba real verificable** de recepción/entrega vinculada a (deliveryId, courierId), objeto privado, consentimiento/privacidad, prueba firmada o verificada independiente, revocación, autorización. **Nunca** generar un proofRef UUID local.
5. Disputas, cancelaciones, retorno, expiración, sin conectividad, pérdida de ACK, eventos terminales e historial: reconciliar solo lectura; jamás segundo POST automático.
6. COMMERCE: exigir asignación/custodia de pedido real que vincule orderId/serviceId, productos autorizados, separación supermercado/farmacia/restaurante/otros, entrega/reembolso y responsabilidad de comercio. No reutilizar estado de paquete si el contrato comercial lo contradice.

### C-P1: operatividad móvil, seguridad, ganancias y tiendas
1. Completar driver online/offline, disponibilidad por zona, registros de vehículo AUTO/MOTO por credenciales, push privado con token/consentimiento/TTL, no fuga de ubicaciones, navegación real segura, chat Driver/Cliente por servicio y read markers con autorización.
2. Para **mis ganancias**, solicitar a A `GET` Driver-only (nombre de ruta a formalizar, NO existente verificado) con ledger PostgreSQL por actor JWT, serviceId, currency PYG, comisión versionada y estados conciliados; rechazar cálculo local, monto de oferta como ganancia o cero inventado.
3. Pruebas Expo nativas en dispositivos físicos Android/iOS: permisos de ubicación, red débil, background/foreground, reconexión segura, notificaciones, sesiones revocadas, accesibilidad. Export web no cubre esto.
4. Preparar EAS/firmas, privacidad, textos legales y revisión Play Store/App Store sólo **después** del GO técnico y autorizaciones. No APK como producto entregable.

## 5. Qué está hecho en D — no duplicar
- `admin-experience.mjs`, `AdminRuntime.tsx`, `main.tsx`: panel de backoffice con roles exclusivas `admin` / `owner`, MFA, colas KYC, zonas, incidentes, auditoría, finanzas y F1; deniega acciones locales sin backend certificado.
- `service-trace-gateway.mjs`, `.d.mts`, `.test.mjs`: vista QA de cinco servicios por mismo serviceId, reserva/quote/historial, G38/G71, asignación y ledger. **La ruta A `GET /v1/staging/admin/services/{serviceKind}/{serviceId}/trace` es PROPUESTA / NO MONTADA**. Flags OFF en `.env.example`.
- `service-trace-integrity-fence.mjs`: defensa de anti-rollback por serviceId/revisión, no cambiar quoteId o bookingRequestKey, no reescribir eventos, no revivir terminal, no alterar ledger conciliado.
- `OwnerCommissionEditor.tsx` + `owner-commission-gateway.mjs` + `owner-commission-readback.mjs`: edición Owner AAL2 de porcentajes **AUTO_RIDE/MOTO_RIDE** via G116; exige GET después de POST y revisión/valor exactamente coincidentes para confirmar. Subsidio pasajero `subsidyBps=1000` = 10% fijo.
- `OwnerCargoRateEditor.tsx`, `owner-cargo-rate-gateway.mjs`, `owner-cargo-rate-readback.mjs`, `owner-cargo-percent.mjs`, `owner-policy-scope-fence.mjs`: edición G124 tarifaria ENVÍOS AUTO/MOTO por zona, base/km/minuto/mínimo, comisión (puntos base), vigencia, lectura previa, recibo verificado/relectura y bloqueo si identidad/objetivo cambian; no inventa subsidio para carga. Debe comprobarse montaje HTTP/PG de A antes de habilitar.
- `merchantCases:null`, `merchantCaseContractReady:false` en `admin-experience.mjs`: soporte COMMERCE real todavía NO conectado.
- **CI D sigue en 0 check-runs** en HEAD `e7e81878`. Smoke V8 aislado no certifica npm tests, TypeScript, navegador o PostgreSQL.

## 6. TRABAJO D PENDIENTE — lista ejecutable por prioridad
### D-P0: recuperar CI oficial del PR D→B
1. A/B (propietarios de `.github/workflows/**`) deben configurar job Admin para PR #20 con base B: ejecutar `npm run check && npm run build` en `apps/movete-admin`, exact SHA D, dependencias instaladas desde lockfile; aislar ownership.
2. Probar errores TS, unit tests G116/G124/trace, render sin datos privados, focus, logout, expiración y E2E navegador. Sin SHA D CI SUCCESS no declarar Admin certificado.
3. Mantener PR D DRAFT. No usar CI de B como evidencia de D.

### D-P0: trazabilidad real mismo serviceId y contabilidad
1. A debe **implementar y montar** `GET /v1/staging/admin/services/{serviceKind}/{serviceId}/trace`; DTO esperado:
   `mode:STAGING_DEMO_ONLY, viewerId, serviceId, serviceKind, bookingRequestKey, quoteId, status, revision, observedAt, expiresAt, serverPersisted:true, productionEnabled:false, assignment:{state,legalGate}, events:[{eventId,serviceId,sequence,status,at}], ledger:null|{serviceId,currency:PYG,grossGs,platformCommissionGs,customerSubsidyGs,driverPayoutGs,reconciliationStatus}`.
2. A obtiene todos los campos de una **misma transacción/snapshot PostgreSQL16** con Admin JWT + IdP AAL2, RBAC/revocación/RLS, sin PII. Permisos sin heredar acceso Passenger/Driver; 401/403/404/429/503. Correlacionar quote, booking, asignación, eventos y ledger por ID.
3. Cargar y pintar la respuesta real solo tras certificación, sin mutar estados ni traducir `confirmed_qa` a `paid` o `dispatched`; entregas deben distinguir G7/G122/G123 y tarifa/revisión. Integridad anti-rollback existente.
4. Ensayo A+B+C+D de AUTO_RIDE, MOTO_RIDE, AUTO_DELIVERY, MOTO_DELIVERY, COMMERCE; al principio P0 completar **un AUTO_RIDE entero** y **un envío MOTO y AUTO**; después expandir, no declarar éxito por mocks.
5. Sin endpoint, mostrar "No conectado" de manera fiel; jamás fixture como conciliación real.

### D-P0: comisiones Owner de **todas** las modalidades
1. Validar con A GET/POST G116 pasajeros, autorización Owner exclusivo + MFA AAL2, versión inmutable, auditoría, revocación y readback. Parámetros objetivo iniciales **AUTO 15%, MOTO 12%**, ajustables Owner; de esas comisiones el subsidio pasajero es **10%**; plataforma retiene el resto (5% AUTO; 2% MOTO bajo dichos parámetros), sin inferir rentabilidad, PSP ni habilitación comercial.
2. Validar montaje/capacidad de G124 para **AUTO_DELIVERY y MOTO_DELIVERY** con reglas Owner por zona; tasas de entrega distintas de las pasajeras, NO trasladar automáticamente subsidio del 10% a envíos. Política no configurada = bloqueo, no tarifa por defecto.
3. **COMMERCE PENDIENTE**: A debe exponer API Owner AAL2+PostgreSQL versionada, transaccional CAS/idempotencia y auditada **por subcategoría supermercado/farmacia/restaurante/otros** y, si corresponde, por zona/comercio. D construir editor separado y/o matriz unificada para esas tasas sin inventar porcentajes. No permitir modificación por Admin general.
4. Evitar que un POST con ACK incierto provoque doble tarifa: reconsultar por clave original/versión, bloquear cambios hasta prueba; cotizaciones aceptadas mantienen versión anterior.
5. Auditoría Owner: actor, before/after, versión, fecha, zona, categoría, y resultados 401/403/409; cifras y ledger del servidor, no sumar balances de UI.

### D-P0/P1: Admin operativo, KYC, incidentes, tiendas y Google
1. Con A activar lecturas/escrituras **autorizadas** de drivers, licencias KYC (cédula, registro, cédula verde, habilitación, foto rostro), vencimientos, bloqueo/reactivación; workflow de revisión humana y automático solo cuando evidencia verificable, manual override auditado y conforme a ley.
2. Incidencias: contrato G41 triage/acciones todavía sin montaje certificado; resolver por mismo servicio y actor Admin, escalación, motivo, historial inmutable; estados realistas y SSE/paginación/poll según A. Reembolsos y disputas NO autorizan PSP por mostrar botón.
3. COMMERCE: backoffice de comercios/categorías, verificación, pedidos, tiempos, cancelaciones, reclamos, repartidor, entrega, reconciliación y auditoría, siempre con API real (en Admin merchantCases sigue null).
4. Zonas/coordenadas: reglas G38 por servicio y municipalidad, cobertura y disponibilidad independientes. Control de conductor real por estado asignable, no fixture.
5. Google Routes G127: **orden Owner más reciente es referencia DRIVE común para cálculos viales AUTO/MOTO**, pero conservando vehículo/eligibilidad/tarifa por tipo y verificando restricciones de moto por separado; no interpretar DRIVE como permiso de circular en MOTO. G127 aún usa transporte simulado sin cuenta/secretos/cuota/peajes/cobertura reales. Control de presupuesto, cuota durable, peajes y zonas debe validarlo A con aprobación previa de costes; D expone informes Owner sin API key frontend.
6. Reportes de ganancias, comisión, subsidio, costos, retiros, neto y conciliaciones por servicio y conductor; sin confundir comisión con beneficio neto, ni settlement con pago bancario verificado.
7. Seguridad: prueba 401/403, degradación rol Owner→Admin, revocación MFA, rotación JWT, consultas cruzadas, CSRF/CORS/headers HTTP, no PII en mensajes ni logs, anti-rollback por revisión.

## 7. Contratos A/B BLOQUEANTES; NO declararlos montados por tener código
- **A G38/G71:** permiso municipal/territorial, actividad legal y KYC Driver real por vehículo; fixture de QA no habilita operar.
- **A G118/G119:** MOTO pasajeros con JWT/estados/asignaciones propios, no `DELIVERY`.
- **A G121, G7, G122, G123, G125, G126, G127:** cadena de envío con reserva, cotización y consentimiento; G123 bloquea oferta antes del consentimiento. B23 guarda claves G7/G126 del mismo deliveryId en SecureStore, pero sigue faltando a B/A GET privado de consulta G122 por confirmationKey tras ACK perdido, lectura idempotente y cierre terminal. No duplicar POST.
- **A G127 y Google:** orden Owner posterior usa `travelMode:DRIVE` para precio viales de AUTO y MOTO; contrato de ruta realmente activado requiere cuenta, credenciales servidor, cobertura, Place IDs, verificador peajes y cuotas durables con coste aprobado. Sin ellos OFF.
- **A G124:** modulo `apps/mobility-expo/server/g124-owner-cargo-rate-gateway.mjs` existe; verificar montaje efectivo, RLS, auditoría y PG antes de D habilitar editor.
- **A Admin trace:** ruta `/v1/staging/admin/services/{serviceKind}/{serviceId}/trace` propuesta, falta API real validada.
- **A Driver earnings:** lectura privada de ledger por Driver y serviceId, falta contrato certificado.
- **A COMMERCE:** API Owner para porcentajes por categoría, soporte real merchantCases y ledger, faltan contratos certificados.
- **A/B workflows:** Admin SHA D→B CI y guard ownership C→A; la autoridad para editar workflows es A/B.
- **B Cliente:** selector de los cinco flujos, SecureStore de recuperación G7/B23, quote/consent/rastreo; pruebas 1149 PASS de B no son E2E multidominio.

## 8. MATRIZ E2E mínima de certificación (por serviceId)
Registrar un solo ID servidor para cada escenario:
| Paso | Entrada/acción | Evidencia obligatoria | Responsable |
|---|---|---|---|
| 1 | Cliente autenticado elige AUTO o MOTO / modalidad | role JWT Passenger y serviceKind distinto | B/A |
| 2 | Cobertura real verificada y conductor legal | G38/G71, zona + licencia real | A |
| 3 | Cotización PYG versionada | quoteId, fareRuleVersion, TTL, tarifa Owner, ruta verificada | A/B |
| 4 | Consentimiento/solicitud del cliente | bookingRequestKey única, quote asociado, PG durable; envíos G122 | A/B |
| 5 | Oferta privada conductor elegible | offerId ligado al mismo serviceId, oculto a terceros, sin dispatch prematuro | A/C |
| 6 | Aceptación exclusiva transaccional | 1 Driver gana, otro 409/403, KYC/territorio; idempotency | A/C |
| 7 | Estado actual y GPS/tracking autorizado | mismo serviceId, versión monotónica, actor correcto, red intermitente | A/B/C |
| 8 | Llegada, inicio, recogida o preparación | transición legal y custodias propias del tipo | A/C |
| 9 | Finalización / entrega + G67 si aplica | estado terminal; prueba válida; sin resurrección | A/C |
| 10 | Historial del Cliente y Driver | identificador y actor coincidentes; reinicio y ACK perdido | A/B/C |
| 11 | Admin, contabilidad, auditoría | trace PG mismo ID, ledger PYG, comisión versionada, subsidio donde aplica, reconciliación | A/D |
| 12 | Negativos + recuperación | 401/403/404/409/429, roles revocados, doble clic, timeout, TTL, dos Drivers | A/B/C/D |

**Primer F1 prioritario:** AUTO_RIDE completo. Inmediatamente MOTO_RIDE, AUTO_DELIVERY, MOTO_DELIVERY y COMMERCE con sus contratos independientes. No añadir una nueva serie de cientos de unidades de UI sin cerrar 1→12.

## 9. Riesgos y reglas operativas
- **NO MERGE, NO LIVE, NO producción, NO VPS, NO recursos pagos/PSP/GCP/Render/Supabase sin autorización explícita de Owner y revisión de costes.** Primero GitHub y CI; después STAGING autorizado con PostgreSQL y HTTPS; solo luego aprobación de despliegue comercial.
- Nunca filtrar JWT, refresh token, API keys, documento KYC, dirección privada, ubicación, datos médicos ni PII en GitHub/CI/UI ajena.
- No imponer tarifas externas ni copiar precios exactos privados Bolt/Uber. Implementar tarifas propias por tipo, distancia, tiempo, zona, demanda permitida y regla versionada aprobada por Owner.
- No confundir esquema/RPC/proof sintético con servicio LIVE, rutas viales reales, conductor disponible, cobro procesado o entrega demostrada.
- No convertir categoría MOTO_RIDE en MOTO_DELIVERY; la ruta Google DRIVE común para cotizar NO autoriza navegación legal en moto.
- Preservar separación de propiedad C y D. Si A/B debe cambiar backend o workflow, crear solicitud verificable en issue #15 o #16 y seguir trabajando dentro de C/D.
- PRs DRAFT; ningún merge implícito por objetivo de publicar en tiendas. Seguridad, licencias, verificación y consentimiento comercial son gates necesarios.

## 10. Plan secuencial acelerado para el siguiente arquitecto
**Bloque de trabajo 1 — sin más vueltas documentales:**
1. Abrir los dos PR #19/#20, leer cabezas de rama/CI y último issue A #15 / B #16. Comprobar que no hubo nuevas actualizaciones. Validar discrepancias A/B/C/D.
2. En D, conseguir que A/B ejecuten **npm run check y npm run build del SHA exacto D**. Si hay fallo TS/tests, corregir SOLO D. No contar smoke V8 como CI.
3. En paralelo, inspeccionar A para saber si existe realmente endpoint G124/trace o solo módulo aislado; integrar D lectura real solo si ya hay contrato certificado. Si falta, dar a A DTO/test negativo exactos; no construir otra fachada sin backend.
4. Cerrar primero **F1 AUTO_RIDE**: provocar solicitud pasajero persistida → oferta privada → aceptación Driver → ciclo viaje → Admin same-ID con PG16. Resolver exactamente el primer bloqueo verificable y repetir test, sin inventar métricas.
5. Integrar siguientes 2 envíos AUTO/MOTO con G122/G123/G66 y dejar G67 bloqueado hasta prueba real.
6. Con contrato certificado, habilitar en C MOTO_RIDE distinto de DELIVERY y pruebas KYC moto pasajero, incluyendo restricción de territorio.
7. En D unir editores Owner de pasajeros/envíos y COMMERCE tan pronto exista API Owner categorizada; hacer POST→GET y auditoría.
8. Implementar ganancias Driver desde ledger mismo ID, y panel Admin financiero consistente; no balance ficticio.
9. Ejecutar matriz 1–12 por los cinco tipos contra PostgreSQL, roles y HTTPS verificados; reportar solo fallas reales con URL de Actions exacta, no número de commits.
10. Tras DO-DONE técnico en staging, preparar solicitud de autorización de recursos/tiendas, presupuestos y gates G38/G71/PSP legales. Ningún deploy sin orden expresa.

**Criterio "HECHO":** funcionalidad usable con actor correcto, backend persistido y un test de contrato + negativo, TypeScript/build CI exact SHA, cero PII/fallback no autorizado, prueba A/B/C/D mismo serviceId. Documentación sin evidencia cuenta "PENDIENTE", aunque tenga 100% tests unitarios.

## 11. Primeras rutas de código
C:
- `apps/movete-driver/app/ofertas.tsx`
- `apps/movete-driver/app/viaje.tsx`
- `apps/movete-driver/app/entrega.tsx`
- `apps/movete-driver/app/ganancias.tsx`
- `apps/movete-driver/src/DriverOfferActionsProvider.tsx`
- `apps/movete-driver/src/DriverCustodyProvider.tsx`
- `apps/movete-driver/src/domain/driver-private-delivery-detail.mjs`
- `apps/movete-driver/src/domain/driver-delivery-accept-preflight.mjs`
- `apps/movete-driver/src/domain/driver-custody-controller.mjs`
- `apps/movete-driver/src/domain/driver-staging-runtime.mjs`

D:
- `apps/movete-admin/src/main.tsx`
- `apps/movete-admin/src/AdminRuntime.tsx`
- `apps/movete-admin/src/admin-experience.mjs`
- `apps/movete-admin/src/service-trace-gateway.mjs`
- `apps/movete-admin/src/service-trace-integrity-fence.mjs`
- `apps/movete-admin/src/OwnerCommissionEditor.tsx`
- `apps/movete-admin/src/OwnerCargoRateEditor.tsx`
- `apps/movete-admin/src/owner-commission-readback.mjs`
- `apps/movete-admin/src/owner-cargo-rate-readback.mjs`
- `apps/movete-admin/src/owner-policy-scope-fence.mjs`
- `apps/movete-admin/.env.example`

## 12. Mensaje para iniciar el NUEVO CHAT (copiar completo)
> Asume inmediatamente como Arquitecto C (App Driver) y Arquitecto D (Admin Web) del repositorio `mezas3238-hue/Qore-mobile-`. Lee el handoff maestro `docs/architect-d/HANDOFF_MAESTRO_ARQUITECTOS_C_D_2026-10-26_E2E_QORE_MOBILE.md` en PR #20 y los PR #19/#20, issues #15–#18. No reinicies arquitectura ni redactes otro handoff antes de corregir funciones. Verifica ramas/SHAs/CI actuales, mantén C y D aislados, trabaja en GitHub con cambios mínimos verificables, no hagas merge ni LIVE ni gastos sin mi autorización. Prioridad F1 AUTO_RIDE real Cliente→Driver→PostgreSQL→Admin con mismo tripId; luego MOTO_RIDE, envíos AUTO/MOTO y COMMERCE. Driver: ofertas privadas, aceptación idempotente, KYC/G38, custodia G66/G67, GPS, ganancias y tiendas. Admin: CI SHA D, trace PG/ledger de cinco servicios, operación/KYC/incidencias/comercios y comisiones Owner 100% configurables con 10% subsidio solo a pasajeros. Investiga A/B antes de pedir cosas ya hechas; resuelve código y bloqueos concretos sin detenerte salvo impedimento verdadero. Informa qué funciona end-to-end y su prueba oficial, no cantidad de commits. Mantén estado NO_GO hasta evidencia y autorización.

## 13. Resumen obligatorio para continuidad
**Hecho en C:** ofertas AUTO + envíos privados de AUTO/MOTO, prevalidación paquete y KYC, aceptación/reconciliación no duplicada, custodia monitoreada, reversión stale bloqueada, navegación tras verificación, ingresos no falsos; Driver CI oficial SUCCESS.
**Hecho en D:** Admin estructura + trace por cinco servicios con defensa de integridad, editor Owner G116 pasajeros con subsidio 10%, editor G124 carga AUTO/MOTO por zona con readback; D **sin CI oficial propia**.
**No hecho:** MOTO_RIDE Driver E2E, G67 entrega probada, earnings Driver ledger, COMMERCE Admin/Owner categoría, montaje trace A, prueba PG16 cuatro partes mismo ID, G38/G71 externos certificados, Google facturable/cuota/peajes/cobertura reales, PSP legal, aplicaciones distribuidas en stores.
**No concluir:** que miles de tests QA equivalen a launch, que ROUTES DRIVE sirve como navegación moto legal, que cobertura implica disponibilidad o que un pedido `confirmed_qa` está pagado.
**Orden Owner:** trabajo integrado primero; menos commits, más flujos certificados; sin pausas salvo bloqueo real.

---
*Handoff C+D preparado sobre las ramas y CI observadas el 26-10-2026. Si las cabezas cambian, verificar GitHub antes de modificar código. No es acta de GO.*

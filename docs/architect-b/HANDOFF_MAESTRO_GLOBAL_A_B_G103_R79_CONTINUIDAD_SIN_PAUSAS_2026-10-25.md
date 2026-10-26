# QORE MOBILE / MOVETE FÁCIL — HANDOFF MAESTRO GLOBAL A+B
## Continuidad obligatoria para iniciar otro chat — A G0–G103 / B R1–R79

**Fecha de corte:** 25 octubre 2026, Paraguay; en GitHub algunos controles tienen fecha 26/10 UTC.  
**Owner:** máxima autoridad de producto, legalidad, costos y despliegue.  
**Objetivo:** construir Movete Fácil completo, instalable, seguro y competitivo con Bolt y Uber, **sin copiar código, diseños protegidos ni información interna de terceros**; superarles mediante arquitectura y experiencia **medibles**, no mediante afirmaciones sin pruebas.  
**Gobernanza:** NO MERGE; PR DRAFT; NO LIVE/PRODUCCIÓN/PSP/COBROS; NO VPS; NO datos personales reales; NO recursos facturables ni servicios externos sin presupuesto y aprobación expresa. QA desechable y commits en ramas de trabajo sí están autorizados.

> **MANDATO ABSOLUTO DEL OWNER:** «NO QUIERO MÁS CIENTOS DE COMMITS SIN FUNCIONES COMPLETAS Y OPERATIVAS». Un SHA verde o cientos de pruebas **no sustituyen** una ruta Cliente→Driver→PostgreSQL persistente→Admin certificada en dispositivos físicos. Continuar **sin detenerse**, salvo bloqueo real; en un bloqueo, registrar la evidencia y cambiar inmediatamente a otra actividad que acerque una función a certificación E2E. No hacer otro inventario por inercia.

---

## 0. REANUDACIÓN INMEDIATA: FUENTE DE VERDAD GITHUB

- Repo **literal con guion final:** https://github.com/mezas3238-hue/Qore-mobile-
- **Arquitecto A** — Backend Node, SQL/PostgreSQL, OpenAPI, Driver Expo, infraestructura y CI: PR [#7 DRAFT](https://github.com/mezas3238-hue/Qore-mobile-/pull/7); rama \`feature/mobility-monorepo-isolated-20261016\`; **HEAD verificado previo al handoff:** \`5b1e887b18d7b67a371a12308e468c2abdee3066\`; **4/4 SUCCESS** sobre ese SHA: [Node STAGING 40250548728](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40250548728), [PG16 desechable 40250548768](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40250548768), [aislamiento apps 40250548711](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40250548711) y [Expo aislado 40250548725](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40250548725).
- **Arquitecto B** — Cliente Expo y Admin Web: PR [#8 DRAFT](https://github.com/mezas3238-hue/Qore-mobile-/pull/8); rama \`feature/mobility-cliente-admin-parallel-20261022\`; **HEAD verificado previo al handoff:** \`01fe7f3c19a7c7ccac832ae6602b67aee35e41e0\`; **3/3 SUCCESS** sobre ese SHA: [ownership 40250109358](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40250109358), [Admin web 40250109317](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40250109317), [Cliente/Driver aislamiento y export web 40250109391](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40250109391).
- **Coordinación A↔B**: [issue #9](https://github.com/mezas3238-hue/Qore-mobile-/issues/9). R79 final documentado en [comentario 6405626712](https://github.com/mezas3238-hue/Qore-mobile-/issues/9#issuecomment-6405626712). Otros issues de seguimiento: #10, #11 y #12, comprobar su estado.
- **Atención temporal:** la publicación de ESTE archivo crea un nuevo SHA B posterior al mencionado. El sucesor debe consultar de nuevo ambos PR, el HEAD y CI del SHA exacto; las ramas avanzan en paralelo. **No atribuir automáticamente CI de un SHA a otro.**
- Base histórica: [handoff A+B G91/R67](../handoff/HANDOFF_MAESTRO_A_B_G0_G91_R67_F1_FUNCIONES_INSTALABLES_CONTINUIDAD_2026-10-25.md), [A G0–G66](../handoff/HANDOFF_MAESTRO_ARQUITECTO_A_G0_G66_CONTINUIDAD_SIN_PAUSAS_2026-10-24.md), [B R1–R66](./HANDOFF_MAESTRO_ARQUITECTO_B_R1_R66_F1_PRIORIDAD_FUNCIONES_CERTIFICADAS_2026-10-24.md), [inventario R1–R62](./HANDOFF_MAESTRO_INTEGRAL_ARQUITECTO_B_R1_R62_CONTINUIDAD_SIN_PAUSAS_2026-10-24.md). Los cortes antiguos no reemplazan órdenes del Owner posteriores.

### Primera acción del sucesor, sin pedir otra autorización para leer o probar en QA
1. Abrir PR #7, PR #8, issue #9, CI de los nuevos HEAD y comparar contratos. **NO rebase/merge** de A↔B sin permiso.
2. Inspeccionar ruta F1 AUTO Cliente+Driver+Admin y ruta MOTO G101. Listar exactamente qué lectura/POST real falta para certificar **un mismo tripId**.
3. Elegir la primera operación productiva faltante, hacer cambios en los **archivos propios**, probar respuesta server real en QA y publicar evidencia con PASS/FAIL. Sin “siguiente etapa” meramente documental.
4. Si el backend externo/credenciales/ley/PSP dependen de una aprobación o recurso, NO inventarlos: emitir solicitud concreta con costo, contrato y riesgo, **continuar con pruebas o funcionalidades no bloqueadas**.

---

## 1. CONTRATO PRODUCTO VIGENTE Y REGLAS INNEGOCIABLES

**Marca:** QORE Mobile / Movete Fácil. Paraguay primero; arquitectura multi-país preparada para Paraguay, Argentina, Brasil, Uruguay y Bolivia (Mercosur/vecinos), **sin comprar capacidad regional antes de usarla**.

**CUATRO SERVICIOS OBLIGATORIOS Y DIFERENTES:**
1. **AUTO** — transporte de pasajeros en automóvil; categorías económicas/confort/XL según disponibilidad y autorizaciones.
2. **MOTO** — transporte **de pasajeros en motocicleta**. Este servicio SÍ está aprobado por Owner en las instrucciones más recientes; documentos viejos que lo prohibían están **SUPERADOS**. Habilitar solo cuando cobertura, ley local, casco, seguro, KYC y Driver estén verificados.
3. **ENVÍOS** — paquetes/carga mediante **AUTO O MOTO**, modalidad independiente de viajes de pasajeros; validación de artículos, peso, custodia y prueba de entrega.
4. **COMERCIOS** — supermercados, farmacias dentro de rubros legalmente permitidos, restaurantes y otros negocios; catálogo, stock, pedido, preparación, recogida, entrega, soporte y conciliación.

**Elección explícita del Cliente:** primero seleccionar **AUTO o MOTO para trasladarse**. En envíos, AUTO/MOTO son medios de carga; en comercios, transportista asignado según reglas. **Nunca sustituir MOTO_RIDE por MOTO_DELIVERY**, ni esconder pasajeros MOTO. Las apps finales son **dos Expo NATIVAS totalmente separadas**: \`apps/movete-cliente\` y \`apps/movete-driver\`, más \`apps/movete-admin\` Web y backend PostgreSQL+Node. «No van juntas». La demo \`apps/mobility-expo/app/conductor.tsx\` no es Driver final.

**Política económica Owner (PYG/Gs.), calculada por servidor:**
| Modalidad | Comisión nominal | Subsidio permanente cliente | Retención bruta Movete Fácil | Conductor |
|:--|--:|--:|--:|:--|
| AUTO pasajeros | **15 %** | **10 %** de tarifa original | **5 %** | 85 % de tarifa original |
| MOTO pasajeros | **12 %** | **10 %** de tarifa original | **2 %** | 88 % de tarifa original |

Ejemplo MOTO comprobado G100: original **11.000 Gs.**, subsidio **1.100**, **cliente 9.900**, **conductor 9.680**, **plataforma 220**. Son importes QA y **no equivalen a cobros PSP**. Para ENVÍOS/COMERCIOS definir comisiones, subsidios y costo de entrega por modalidad con aprobación expresa, NO aplicar porcentajes de pasajeros por suposición.

No limitar usuarios/conductores/productos a 50 registros; usar cursor y páginas de 50 si corresponde, sin límite de universo. **Cobertura NO es disponibilidad**: geocerca habilitada no equivale a conductor cercano. No inventar viajes, precio, ETA, GPS, conductores, pedidos ni reembolsos.

**KYC Driver y elegibilidad:** cédula de identidad, registro/licencia, cédula verde, habilitación, selfie facial y las pruebas de seguro/inspección/casco cuando correspondan. Vencimiento => **bloqueo automático efectivo en aceptación/asignación**, alerta privada en Driver; renovar fotos/evidencias => análisis documental auténtico, reactivación automática **solo si** verificaciones independientes y antifraude superadas. Evidencia insuficiente => revisión humana Admin. Nunca aprobar solo por fecha digitada ni selfie aislada.

**Seguridad:** Passenger/Driver/Admin/Owner segregados; JWT/IdP verificados server-side, RBAC/RLS, MFA AAL2 en Admin, aislamiento por propietario, secretos en gestor, session fencing, antifraude, pagos y liquidaciones autorizados, SOS/soporte sin falsas promesas. Flags comerciales OFF.

---

## 2. FOTO DE REALIDAD — NO CONFUNDIR CI VERDE CON APP LISTA

**Estado actual: NO_GO; 0/4 servicios certificados comercialmente de extremo a extremo con instalación nativa, Driver real, mapa/ruteo legal, PSP y una misma DB STAGING externa.** No existe evidencia de un único viaje físico Cliente↔Driver↔Admin bajo PostgreSQL persistente remoto. No se ha confirmado que Android APK/AAB/iOS IPA firmados estén instalados y funcionando en dos móviles; CI exporta web de Expo, NO binarios nativos firmados.

**Escala de evidencia para toda afirmación:**
- **IMPLEMENTADO** = código/pantalla/DTO, no operativo.
- **QA_PASS** = tests, HTTP loopback, SQL PG16 desechable, mocks, typecheck, export web.
- **STAGING_E2E_PASS** = MISMO IdP + PostgreSQL persistente + HTTPS externo + Passenger/Driver/Admin auténticos y operaciones reconciliadas.
- **DEVICE_PASS** = dos apps instaladas separadas, móviles reales, GPS, notificaciones, background, pérdida de red, permisos y rendimiento verificados.
- **COMMERCIAL_GO** = además legal, privacidad, KYC, pagos, seguros, soporte, auditoría, observabilidad, DR, presupuesto y orden Owner.

**Estado por vertical:**
| Servicio | Backend/QA | Cliente UI + transporte | Driver | Admin | STAGING E2E |
|--|--|--|--|--|--|
| AUTO pasajeros | G73/G4/G75/G90/G93–G99 y KYC, PG16 local | R67–R77 QA, HTTPS opt-in OFF | G63–G65, G78+ QA; no 2 teléfonos | G75 R77 QA, OFF | **NO** |
| MOTO pasajeros | G100–G103, G101 HTTP loopback/PG16 | R69 draft, R78 transacción, R79 G101 transport OFF | sin asignación MOTO pasajero certificada | sin auditoría MOTO instalada E2E | **NO** |
| ENVÍOS AUTO/MOTO | G5/G10/G66–G69 custodia/roles QA | R52/R63–R66 UI+recibo QA | flujo de entrega QA | sin cierre comercial real | **NO** |
| COMERCIOS | G6/G9/G44–G46 stock y pedidos QA | catálogo/carrito/sucursal/substitución R1–R66 | repartidor/comercio QA | paneles y soporte QA | **NO** |

Render consultado el 24/10: **0 servicios** en workspace en esa consulta histórica; revalidar antes de referirse al estado actual. Railway no estaba utilizable; infraestructura preferida para evaluación **Render Node HTTPS + Supabase Auth/PostgreSQL/Storage** conforme a las anteriores propuestas, pero **NADA contratado/aprobado**. Presentar desglose exacto de costo previo, incluidas tiendas y mapas, al Owner; no crear recursos.

---

## 3. TRABAJOS DE A HECHOS — INVENTARIO FUNCIONAL G0–G103

**Dominio A exclusivo:** \`apps/mobility-expo/**\`, \`apps/movete-driver/**\`, \`docs/handoff/**\`, \`docs/architecture/**\`, \`.github/workflows/**\`, backend, DB, KYC, push y deployment configs. B no los modifica.

### A G0–G22 — fundación
Monorepo Expo aislado de trading, entornos CI/STAGING/dev, PG/RLS/Auth/roles, onboarding y documentación Driver, viaje/despacho AUTO, ofertas privadas, aceptación atómica, ubicación/estado con límites, envíos y custodia AUTO/MOTO, comercios/catálogos, tarifas versionadas, ledger QA, incidentes, seguridad, inbox Driver, liveness y vigencia documental. Expo Driver y Cliente se desarrollan por separado.

### A G23–G48 — dominio y antifraude
Historial privado G26 (cursor y paginación sin límite global), backoffice roles/JWT/MFA G27–G30, cobertura y disponibilidad observada separadas G31, ubicación Driver consentida G32–G35, exclusión de trabajo simultáneo del mismo Driver G36, transiciones G37, controles legales y fraude G38, ofertas firmadas G39, incidentes G40/G41, proveedor JWT pinneado/revocación G42/G43, catálogo G44/G45, privilegio mínimo G46–G48.

### A G49–G70 — chat, entrega y ciclo Driver
Chat privado Cliente↔Driver asociado a asignación G49–G58E, inbox G51, historial G52, envío durable G53, ACK/read-marker G54/G55, UX e inbox Driver G56–G60, errores por respuesta/comit incierto, G61 gates de lanzamiento, G62 Driver Auth runtime QA, G63–G64 ofertas y aceptación/reconciliación, G65 \`arriving→in_progress→completed\`, G66–G69 custodia entrega y lectura remitente, G70 chain HTTP Passenger JWT local. No equivale a mensajería/custodia probada con usuarios reales.

### A G71–G91 — KYC completo y F1 AUTO
KYC con evidencias, rostro, vencimiento, bloqueo/revalidación G71+, tarifas/ruta/reserva \`G73\` con \`routeId,quoteId,bookingKey,tripId\`, estado \`G4/G74\`, Admin \`G75\`, proveedor opcional Google Routes \`G77\` (apagado, puede tener costo), Driver elegibilidad real G78+, dispatch \`G90\`, aceptación y lifecycle. Handoff legado detallado en \`docs/handoff/HANDOFF_MAESTRO_A_B_G0_G91_R67_F1_FUNCIONES_INSTALABLES_CONTINUIDAD_2026-10-25.md\`. Todos los ensayos QA, no movilidad de calle.

### A G92–G99 — subsidios, ledger, cancelación, mismo viaje HTTP/PG
- **G93 AUTO:** 15% comisión y 10% subsidio de campaña Owner, recibo privado server-issued; 5% retención bruta.
- **G94:** ledger 4 asientos de reserva y reversión atómica QA; \`RESERVED_QA/VOIDED_QA\` no implica PSP pagado o devuelto.
- **G95:** cancelación Passenger idempotente, \`requestKey\` fijo, recibo GET propio, sin duplicar cancelación.
- **G96:** revoca oferta/cola Driver de forma atómica tras cancelar, evita aceptación tardía.
- **G97:** rutas HTTP privadas G93/G94/G95 montadas **solo loopback**.
- **G98:** prueba **PostgreSQL16 real desechable sobre HTTP local** de AUTO quote→subsidio→booking→cancel→reversión→cierre de oferta y aislamiento de otro Passenger.
- **G99:** verifica mismo \`tripId\` y estado entre lectura privada Cliente G73/G4 y Admin G75 con MFA sintético mediante PG real local, antes/después de cancelar.

### A G100–G103 — MOTO pasajeros real a nivel laboratorio
- **G100:** tablas/funcciones **MOTO_RIDE** independientes de AUTO/MOTO_DELIVERY: cita/ruta/quote, 12/10/2, booking propio y cancelación idempotente, 4 asientos provisionales y 4 de reversión, RLS/propietario y exclusión; todo PG16 desechable.
- **G101:** gateway Node HTTP Passenger exclusivo, firmado por identidad Auth, quote/book/GET booking/cancel/GET cancellation y OpenAPI \`1.0.0-g101\`, rutas:
  - \`POST /v1/staging/rider/moto/quotes\`
  - \`POST /v1/staging/rider/moto/book\`
  - \`GET /v1/staging/rider/moto/bookings/{bookingKey}\`
  - \`POST /v1/staging/rider/moto/bookings/{bookingKey}/cancel\`
  - \`GET /v1/staging/rider/moto/bookings/{bookingKey}/cancellation\`.
  OpenAPI: \`x-qore-runtime-wired:false\`, \`x-qore-loopback-wired:true\`, \`x-qore-external-staging-certified:false\`.
- **G102:** prueba real PG16 + HTTP loopback Passenger MOTO quote/book/cancel y ledger 12/10/2; **NO terminal de motorista**.
- **G103:** exclusión transaccional cruzada **un pasajero con máximo un viaje activo AUTO O MOTO**, incluso carrera entre dos transacciones PG16 reales, reutilización de keys, y nuevo viaje tras cancelar. Último SHA A \`5b1e887...\` corrige identidad fixture de carrera; 4/4 SUCCESS. FENCE aún del entorno desechable hasta migración/atestación externa.

**Archivos inmediatos A:** \`apps/mobility-expo/server/g4-staging-runtime.mjs\`, \`g4-loopback-http-transport.mjs\`, \`g73-f1-auto-gateway.mjs\`, \`g75-f1-admin-audit-gateway.mjs\`, \`g101-moto-passenger-gateway.mjs\`; SQL \`docs/backend/staging_only/G100_*\`, \`G103_*\`; OpenAPI \`apps/mobility-expo/docs/backend/openapi/movete-facil-staging.openapi.json\`. No ejecutar archivos \`*_CI_ONLY.sql\` contra una DB remota. \`render.yaml\` y render-staging-ingress son propuestas **NO desplegadas**.

---

## 4. TRABAJOS DE B HECHOS — R1–R79

**Dominio B exclusivo:** \`apps/movete-cliente/**\`, \`apps/movete-admin/**\`, \`docs/architect-b/**\`. A no necesita modificar esos archivos para suministrar contratos; coordinar por issue #9.

### B R1–R66 + F1 previo (historia funcional, no reescribir)
- **Cliente Expo:** navegación Inicio/Viaje/MOTO/Envíos/Comercios/Cotización/Seguimiento/Historial/Chat/Pagos/Soporte/Cuenta; Auth Passenger separada; componentes accesibles, modo simple; editor de ruta y selección de vehículo; formularios privados con invalidación por cambio de JWT/Owner.
- **AUTO QA:** cotización y tiempo/frescura/TTL, reserva idempotente, seguimiento G4, cancelación bajo confirmación y recuperación sin duplicados; historial G26 con cursor y ventana RAM, sin tope de población.
- **ENVÍOS:** borradores AUTO/MOTO de **paquetes**, selección, restricciones, estados de custodia, confirmación de remitente y seguimiento G66/G68 como QA; no prueba de entrega física.
- **COMERCIOS:** directorio G44 de sucursales y tipologías, catálogo G45, stock/TTL/paginación, carrito, sustituciones/preferencias, confirmación local sin cobro, lectura de casos/sugerencias.
- **Chat:** conversación asignada y privada, G51 inbox, G52 historial, G53 envío idempotente, marcadores G54/G55, reconexión, ACK, no exponer teléfonos, revocación al reasignar.
- **Admin Web:** Auth Supabase memoria navegador, roles Admin/Owner, MFA, KYC y revisión segura, incidentes G41, zonas, paginación sin límite global, auditoría, finanzas OWNER, soporte comercial, vista de viaje G75, rechazo a vista fake/PII/cobro sin evidencia. Acciones reales OFF por defecto.
- **R67–R69:** G90 dispatch AUTO de A→ Cliente, transición solo tras G4 server, menú de 4 servicios **incluido MOTO pasajeros** y borrador MOTO independiente de MOTO ENVÍOS. Handoff antiguo que prohibía MOTO pasajeros ha sido sustituido por Owner.

### B R70 — recuperar viaje AUTO tras reiniciar
\`ClientRuntime.tsx\` enlaza historia propia G26 + estado G4 con permisos STAGING independientes, lectura Owner/JWT, revisión monotónica. No asumir viaje completado por una página de historia sin G4.

### B R71 — subsidio AUTO G93 verificado
\`f1-g73-http-gateway.mjs\` + \`client-experience.mjs\`: lee recibo G93 sólo desde servidor, verifica 15% nominal, 10% descuento y 5% plataforma; muestra aceptación de precio subvencionado, nunca calcula una tarifa autónoma.

### B R72 — contabilidad AUTO G94
Lectura autenticada G94 unida al mismo booking G73 y recibo G93; estados \`RESERVED_QA,VOIDED_QA,COMPLETED_UNSETTLED_QA\`, importes y revisiones deben coincidir. No declara pago/reembolso PSP sin PSP.

### B R73 — cancelar AUTO G95
Después de reserva+G4 auténticos, confirmación explícita, un solo POST con cancellationKey estable; estado \`ambiguous\` si pierde ACK, recuperación únicamente GET; preparar/desestimar la cancelación antes de enviar es seguro, después ya no.

### B R74 — recuperar con G4 envejecido y doble lectura
Se conserva identidad G73 para recuperar G95 incluso con G4 vencido; no se exige G4 fresco para GET. Para **verificación doble** solicita G4 \`cancelled\` + G94 \`VOIDED_QA\` y revisiones/importe concordantes; NO confundir comprobante G95 aislado con liquidación probada. Documentado \`R74_G95_RECUPERACION_Y_VERIFICACION_DOBLE_2026-10-25.md\`.

### B R75 — recuperación G95 incluso tras cierre del proceso móvil
\`NativeG95RecoveryStore.ts\` guarda SOLO UUIDs y revisión en \`expo-secure-store\` Keychain/Keystore **antes** del primer POST; si falla escritura, bloquea POST. Al reiniciar: Auth Passenger→GET G73 para revalidar booking/quote/route/trip/revisión→GET G95, sin POST repetido. Borra en logout/confirmación. Nunca almacenar JWT, PII, rutas reales o GPS. No usar AsyncStorage. Documentado \`R75_G95_RECUPERACION_POST_REINICIO_SECURESTORE_2026-10-25.md\`.

### B R76 — lectura G4 después de reinicio
Si se recuperó G95 tras reinicio, una lectura G4 autenticada del MISMO tripId puede acreditar viaje \`cancelled\` y revisión suficiente; permanece **finanza G94 NO verificada** al no existir aún prueba G93 recuperable. No falsificar devolución de dinero.

### B R77 — Admin Web G75 conectado al runtime QA
Antes existían gateway y pantalla Admin “Viajes AUTO” pero no estaban inyectados en el runtime. \`AdminRuntime.tsx\` ahora pasa opciones \`f1RideAuditOptions\` a \`createAdminExperience\` bajo flags Owner/HTTPS/PG/AAL2/RBAC/revocación todos OFF. Transport GET privado, MFA y prueba exacta \`tripId/routeId/quoteId\`, DTO sin PII, no writes. TypeScript, tests y build PASS.

### B R78 — MOTO pasajeros G100 UI y dominio
\`app/moto.tsx\` + \`src/domain/g100-moto-passenger-flow.mjs\`, separado de AUTO y entregas. Formulario origen/destino + seguridad, quote source-backed 12/10/2, aceptación, reserva, cancelación, claves idempotentes y GET sin repetir POST ante ACK incierto; rechazo de dueño, precio, servicio o PSP manipulado. Predeterminado OFF sin servidor real.

### B R79 — cinco rutas G101 HTTP conectadas al Cliente
\`src/domain/g101-moto-passenger-http-gateway.mjs\` + \`.d.mts\`, tests, \`ClientRuntime.tsx\`, \`client-experience.mjs\`. Enlaza las 5 rutas exactas de A: GET sin body, POST quote/book/cancel con consentimiento explícito, JWT y Owner revalidados, origen HTTPS pinned, no cookies/redirects, tamaño y plazo acotados, DTO final validado por G100, sin precios del cliente. **Siete \`EXPO_PUBLIC_MOTO_*\` OFF en \`.env.example\`**; se activa solo con auditoría externa real (no por CI G101).
- Primer SHA R79 \`f0fa9b2...\` encontró fallo de helper \`pinnedOrigin\` sombreado (CI rojo); **corregido** en \`01fe7f3c19a7c7ccac832ae6602b67aee35e41e0\`; **3/3 SUCCESS confirmado** en el commit corregido.
- Doc \`docs/architect-b/R79_MOTO_G101_HTTP_PASSENGER_2026-10-25.md\`.
- **Límite visible:** memoria transaccional MOTO R78/R79 todavía no persistente ante *reinicio del proceso* como R75 AUTO; solo readback en la sesión actual. A debe autorizar contrato de recuperación durable y B adaptarlo al almacén cifrado antes de dispositivos reales.

---

## 5. BRECHAS PENDIENTES — PRIORIDAD Y RESPONSABLES

### P0.1 — un viaje AUTO verdaderamente COMPLETO, no otro test aislado (A+B)
**A**: HTTPS STAGING autorizado/observado, IdP real con roles Passenger/Driver/Admin y revocación, PG persistente con backups, rutas reales y tarifas vigentes, KYC de Driver elegible, ofertas push/poll, aceptación atómica, estados Driver, ubicación real autorizada, ledger G94 y recibo Admin G75 del mismo tripId. **B**: Cliente reserva y seguimiento G73→G4→G95, Admin consulta G75; controlar cancelaciones/race, UX offline/readback. **Criterio:** un pasajero real de prueba y un conductor real de prueba en DOS APPS INSTALADAS, misma DB, \`quoteId,routeId,tripId,bookingKey\` ligados, Driver acepta/completa y Admin ve el mismo evento. Un viaje cancelado no equivale a uno completado. Ensayar ambos.

### P0.2 — MOTO pasajero completo, vinculado a G100/G101/G103 (A+B)
A certificar que MOTO pasajeros es legal en zona elegida, requisitos de casco, habilitación, seguro, documentos, seguridad y cobertura; ruteo independiente, tarifas versionadas, G101 HTTPS persistente real, KYC y Driver motociclista recibe/acepta/termina con mismo tripId, ubicación y Admin. B habilitar con acta Owner los gates y probar R78/R79 **en dispositivos**; añadir recuperación de idempotencyKeys cifrada tras reinicio y rechazo de AUTO simultáneo G103 en UX. **No confundir permiso de reparto MOTO con pasajeros MOTO.**

### P0.3 — recobro contable AUTO tras reiniciar
Falta \`GET\` server-side Owner-scoped de **G93 histórico/recibo inmutable para el bookingKey** (o prueba financiera firmada equivalente). Tras R75/R76 la app acredita G95 y G4, pero no puede recomponer importes G93 para verificar G94. A define contrato read-only y audita RLS; B implementa reconciliación monetaria independiente y pruebas de cifra falsa. No usar PSP hasta licencias, integración y aprobación.

### P0.4 — seguridad del conductor y documentos
KYC real end-to-end: captura segura foto/documentos, autoridad/expiración, selfie/liveness y biometría de forma legal, cola Admin de excepciones, revocación/renovación, bloqueo automático **en SQL de asignación y aceptación** aunque el dispositivo esté sin conexión, notificación sin datos sensibles y reactivación solo tras verificación real. Moto requiere pruebas adicionales. Casos adversariales: documento vence justo al aceptar, reconexión, dos Driver, vehículo distinto.

### P0.5 — ENVÍOS AUTO/MOTO de principio a fin
Cliente pide envío con origen/destino y carga legal/peso, cotización separada, reserva y motorista/conductor, recogida con prueba válida, cadena de custodia, entrega con prueba y opción de incidencia/retorno, remuneración/soporte/Admin persistentes. Vínculo transaccional mismo envío; no confundir “pedido mostrado” con “paquete entregado”.

### P0.6 — COMERCIOS de principio a fin
Cliente elige sucursal/mercadería y modalidad entrega, stock server versionado reservado atómicamente, sustitución/agotado, comision/tarifa/checkout aprobados, Merchant confirma preparación, Driver recoge y entrega, Admin concilia, reembolso/disputa seguros. Farmacias: exigir clasificación regulatoria y controles; no vender productos restringidos sin legal. No inventar tienda abierta ni tiempo de entrega.

### P0.7 — identidad, seguridad, pagos y operación
Se requieren Key Management, tokens cortos, roles RLS end-to-end, observabilidad sanitizada, pruebas negativas 401/403/replay/revocación/geo/spoofing, privacidad y retención de documentos, notificaciones push reales, incidentes y soporte 24/7 si se ofrece, aceptación términos, plataforma PSP autorizada y ledger reconciliable, backups+restore, rate-limit distribuido, antifraude, costo por viaje, medidas fiscales y legales Paraguay. El crecimiento multi-país necesita configuración explícita país/moneda/impuestos/idioma/zona horaria/seguro/ley.

### P1 — producto UX equivalente/superior Bolt/Uber
El Cliente puede elegir AUTO o MOTO, ver precio FINAL subvencionado y antes de consentir, ruta comprobada, pickup/destino, ETA real, categorías, conductor/vehículo autorizados, estado continuo, mensajería, seguridad/SOS real, cancelaciones, recibos/historial, calificación, soporte accesible. Driver necesita registro de vehículos, disponibilidad, ofertas con tiempo, aceptación exclusiva, navegación, ganancias y documentación; Admin operaciones en vivo, fraudes/KYC, tarifas, incidentes y conciliación. **Lovable solo interfaz final** cuando las funciones subyacentes estén implementadas; no copiar pantallas o signos distintivos protegidos, solo inspiración de patrones de UX generales.

### P1 — calidad medible «superior», no declarada
- Separación de servicios, actor/vehículo/country por reglas, motor tarifa único server-side, ofertas idempotentes con transacciones PG y outbox, eventos reintentos seguros, sin doble asignación ni doble cobro.
- Observabilidad con métricas por fase \`quote→book→offer→accept→arrive→start→finish\`, tiempos percentiles, errores 4xx/5xx, disponibilidad verdadera, ubicación fresca, tasa de no asignación, cancela/recupera, tiempo de restauración. SLO definidos por piloto y monitoreados, no inventar números exitosos.
- Diseñar multi-zona/país con rollout por bandera, partición lógica por país, API contratos versionados y pruebas de compatibilidad, circuit breakers, colas/outbox y escalado horizontal **solo cuando carga justifique costos**. Cifrado y retención sensible, restore ensayado, redundancia y respuesta a incidentes.
- Benchmark competitivo real (mercado Paraguay) tras contar con servicio propio: latencia, asignación, estabilidad, cancelación segura, tarifa clara, subsidio constante, seguridad y tasa de éxito. Nunca afirmar superioridad sin medir contra referencia.

---

## 6. MATRIZ DE CERTIFICACIÓN QUE DEBE LLENAR EL SIGUIENTE ARQUITECTO

| Prueba obligatoria | AUTO | MOTO | ENVÍOS | COMERCIOS |
|---|---|---|---|---|
| Contratos seguros + CI QA | Parcial PASS | Parcial PASS | Parcial PASS | Parcial PASS |
| HTTPS externo/IdP+PG persistente mismo ambiente | NO | NO | NO | NO |
| Reserva y readback tras ACK perdido + reinicio | AUTO G95 parcial QA; falta finanza | MOTO sesión QA; falta reinicio | QA parcial | NO |
| Driver/merchant real elegible y aceptación atómica | NO certificado | NO certificado | NO certificado | NO certificado |
| Ciclo físico completo en 2 móviles instalados | NO | NO | NO | NO |
| Admin ve misma entidad, fecha, precio y ledger | G99 PG local, no E2E | NO | NO | NO |
| Casos de adversario, permisos, GPS, notificaciones | QA parcial | QA parcial | QA parcial | QA parcial |
| Owner firma lanzamiento legal y económico | NO | NO | NO | NO |

**Pauta PASS de un escenario F1:** registrar \`sha A/B\`, IdP \`env\`, PG \`instance-id\` no secreto, clientes de prueba sintéticos/autorizados, tiempo de pedido, \`routeId\`, \`quoteId\`, \`bookingKey\`, \`tripId\`, Driver \`assignmentId\` anonimizado, G4 estados y revisiones, G94/G95 ledger, G75 Admin, evidencias de eventos y HTTP status, resultados de fallo de red y KYC vencido, app build ID y dispositivo. No difundir PII/JWT. Si falta un eslabón = **PARTIAL**, no \`E2E_PASS\`.

**Gates antes de LIVE:** pruebas STAGING_E2E y DEVICE_PASS, revisión legal/seguro, threat model, backups/restore, plan de contingencia, monitoreo y alertas, soporte/atención, costo e infra aprobados, PSP/test→prod segregado, publicación tienda autorizada y aprobación final escrita Owner. Si algo falta: **NO_GO**.

---

## 7. PLAN DE EJECUCIÓN INMEDIATO POR ARQUITECTO

**Arquitecto A (Backend + Driver)**
1. Revisar HEAD actual y G103; definir una instalación STAGING externa reproducible de G73/G4/G75/G93–G95/G101 sin costear ni desplegar antes de presupuesto y orden Owner. Preparar migraciones idempotentes separadas de \`*_CI_ONLY\`, secreto server-side, rollback, backups; certificación de SQL real en entorno autorizado.
2. Completar Driver real: sesión y documentos vigentes, recibir oferta, una aceptación, ruta/ubicación, estados \`arriving/in_progress/completed\`, chat push y contabilidad de un AUTO. Probar dos procesos Driver compitiendo y vencimiento KYC durante aceptación.
3. Montar MOTO G101 HTTPS separado, fuentes legales de ruta/cobertura, Driver de pasajeros MOTO y G103 exclusión; enviar a B contrato EXACTO y payloads/errores, recuperación durable.
4. Diseñar GET histórico G93 de monto subvencionado para \`bookingKey\` (R75/R76), aislamiento RLS y compatibilidad G94.
5. Tras P0, completar servicios ENVÍOS y COMERCIOS, delivery/pedidos y ledger.

**Arquitecto B (Cliente + Admin)**
1. Verificar G101 OpenAPI/DTO exacto contra \`g101-moto-passenger-http-gateway.mjs\`, R78/R79; **mantener todos los gates OFF** hasta test externo A y Owner. Añadir recuperación durable MOTO tras reinicio siguiendo modelo cifrado R75, vinculada a G101 \`GET booking\` y \`GET cancellation\`, sin POST duplicado ni guardar JWT.
2. Cerrar gap de finanzas AUTO tras reinicio solo después del GET histórico G93 firmado de A, verificando G94 sin declarar PSP refund.
3. Completar experiencia de viaje desde selección explícita AUTO/MOTO hasta tracking/historial/calificación/soporte sin estado ficticio. Comprometer E2E de un AUTO con Driver A y Admin B en idéntica PG.
4. Probar Admin MFA G75 real e identificar mismo tripId sin exponer identidad pasajero; estado y ledger sincronizados.
5. Cuando exista contrato A/merchant, completar checkout pedidos y custodia de envíos E2E; no más pantallas sin backend.

**Coordinación/QA**
- Actualizar issue #9 con cada dependencia especificando endpoint, schema, SHA, CI, esperado/real y responsable.
- Limitar trabajos a una vertical útil por iteración; commits mínimos con cambio ejecutable, tests adversariales, CI en SHA final, evidencia E2E o razón exacta de bloqueo.
- No abrir otro handoff al decir “avanza”; ejecutar cambios. Al iniciar nuevo chat, reutilizar este documento y el resumen de última implementación; no solicitar información ya disponible.

---

## 8. CÓMO ACTUAR ANTE BLOQUEO REAL

**Es bloqueo real:** falta autorización Owner de pagar/desplegar, credenciales IdP en entorno externo no conectado, ley que exige revisión profesional, ausencia de endpoint de A o contrato incongruente, proveedor inaccesible, incapacidad de probar un móvil físico no conectado. Registrar prueba y un desbloqueo mínimo propuesto.

**No es bloqueo real:** escoger nombre de archivo, ordenar documentación, tests sintéticos disponibles, errores de TypeScript, puertos de laboratorio, DTO manipulable con funciones existentes. Arreglarlo sin pedir nueva autorización. Si la infraestructura externa no existe, **continuar en QA** con seguridad/recuperación/contratos compatibles; no declarar servicio operativo.

**Prioridad exclusiva:** funciones completas certificadas, no conteo de commits. Reportar por **AUTO/MOTO/ENVÍOS/COMERCIOS** con \`DONE_QA / STAGING_E2E / DEVICE_PASS / BLOCKED\` y enlace a las pruebas. **Nunca confundir cobertura, driver disponible, PSP, despliegue, export web ni CI.**

---

## 9. MENSAJE DE ARRANQUE PARA EL SUCESOR

«Asumís continuidad operativa de **QORE Mobile / Movete Fácil** con el Owner. Fuente GitHub \`mezas3238-hue/Qore-mobile-\`, PR #7 A DRAFT, PR #8 B DRAFT, coordinación issue #9. Leé este handoff; verificá los HEAD/CI actuales. El Owner exige cuatro servicios: AUTO pasajeros, MOTO pasajeros, ENVÍOS por AUTO/MOTO y COMERCIOS; dos apps Expo separadas, Admin Web, PostgreSQL y backend robusto. Mantener subsidio al cliente constante 10%, AUTO 15/10/5, MOTO 12/10/2, precios exclusivamente desde servidor. NO LIVE, NO MERGE, no gastos/recursos antes de presupuesto aprobado. Priorizá terminar **un viaje AUTO real Cliente→Driver→PG persistente→Admin** y después MOTO. No sumes commits cosméticos. Elegí una función pendiente, implementala, comprobala y registrá evidencia. Si existe bloqueo externo real, documentalo en issue #9 y avanzá inmediatamente en otra tarea permitida. Ningún QA_PASS se reporta como E2E. Queremos experiencia comparable Bolt/Uber y arquitectura superior **demostrada por métricas**, sin replicar sistemas propietarios. Continuá sin pausa salvo bloqueo real».

**Estado final antes de este handoff documental:** A \`5b1e887...\` 4/4 CI PASS; B \`01fe7f3...\` 3/3 CI PASS; **0/4 servicios E2E**; **NO_GO**. Volver a comprobar SHA nuevo B y CI después de añadir este documento.

# QORE MOBILE / MOVETE FÁCIL
# HANDOFF MAESTRO GLOBAL DE CONTINUIDAD — A G91 + B R67
**Corte:** 25-10-2026, Paraguay. **Owner:** dirección de Movete Fácil. **Estado comercial:** NO_GO.
**Fuente soberana:** https://github.com/mezas3238-hue/Qore-mobile- (con guion al final).
**Propósito:** permitir iniciar un NUEVO CHAT con un sucesor que continúe programando donde terminaron los arquitectos A y B, sin repetir el trabajo, sin detenerse por obstáculos corregibles y sin confundir pruebas con apps instalables.

---

## 0. ORDEN VIGENTE DEL OWNER — LEER ANTES QUE NADA

- **La prioridad es entregar funciones terminadas y certificadas**, no acumular commits, archivos, líneas ni handoffs. El primer resultado exigido es UN viaje AUTO de punta a punta con Cliente, Driver, backend, PostgreSQL y Admin, TODO sobre el mismo identificador tripId.
- Hay **dos aplicaciones móviles Expo independientes** (Cliente y Driver), **Admin Web** y backend/DB común. Deben poder instalarse por separado. Un export web no equivale a una APK/AAB/IPA nativa certificada.
- Trabajar sin detenerse excepto por **bloqueo real** de una acción concreta: costo/provisión remota, falta de credenciales, acceso a servicio de terceros, autorización legal o acción que Owner no aprobó. Ante bloqueo puntual, registrar evidencia y continuar de inmediato otro trabajo QA/desarrollo sin esa dependencia. Fallos de tests, mismatch de DTO y bugs son problemas para corregir, no motivo para pausar todo.
- **Prohibiciones sin nueva autorización explícita:** MERGE, LIVE, producción, desplegar, crear/pagar recursos cloud, correr SQL QA en bases remotas, cargar documentos o rostros reales, usar secretos en móvil, push/SMS reales, PSP/cobros/reembolsos/payouts reales, publicar builds a tiendas, saltar autorización de zonas, editar archivos de otro arquitecto o forzar una rama.
- Permisos actuales: modificar código de la rama DRAFT de su dominio, pruebas sintéticas, PostgreSQL16 desechable, HTTP loopback QA, inspección de GitHub, builds de QA sin publicación, coordinación issue #9.
- No pedir de nuevo decisiones ya conocidas. No prometas realizar tareas en segundo plano. Publicá avances reales dentro del turno con commit y resultado de CI del **SHA exacto**.
- **Barrera de negocio:** la app debe cubrir AUTO y MOTO; la prueba F1 de lanzamiento comienza con pasajero AUTO para certificar UNA vertical completa. Transporte remunerado de pasajeros en MOTO permanece jurídicamente bloqueado hasta autorización legal y de seguro verificable; no eliminar del roadmap ni habilitar a ciegas.

## 1. FOTO VERIFICADA DE GITHUB ANTES DE PUBLICAR ESTE HANDOFF

| Dominio | PR, rama y base | SHA de código verificado | CI |
|---|---|---|---|
| A: Driver + backend/SQL/infra/CI global | [PR #7 DRAFT](https://github.com/mezas3238-hue/Qore-mobile-/pull/7), feature/mobility-monorepo-isolated-20261016, base main | 1307f3e406b9bf752c5d38cd22580581d1e86c88 | **4/4 SUCCESS** |
| B: Cliente + Admin Web | [PR #8 DRAFT](https://github.com/mezas3238-hue/Qore-mobile-/pull/8), feature/mobility-cliente-admin-parallel-20261022, base rama A | d07d68ff9f27cd569502ab7297190653c1534abd | **3/3 SUCCESS** |

CI A para el SHA 1307f3e:
- PostgreSQL16 desechable: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40207321820 — SUCCESS.
- Node STAGING: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40207321878 — SUCCESS.
- Dos apps aisladas: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40207321837 — SUCCESS.
- Expo aislado: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40207321847 — SUCCESS.

CI B para el SHA d07d68:
- Driver+Cliente, typecheck, contratos y export web: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40207702573 — SUCCESS.
- Boundary de propiedad A/B: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40207702667 — SUCCESS.
- Admin Web QA: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40207702592 — SUCCESS.

**Coordinación obligatoria:** https://github.com/mezas3238-hue/Qore-mobile-/issues/9.
**Nota:** este documento creará OTRO commit. No atribuirle la CI de los SHAs anteriores. Cualquier nuevo sucesor debe comprobar el HEAD y CI vigentes antes de afirmar PASS. Los PR continúan DRAFT, sin merge ni deploy.

**Estado lanzamiento verificable en matrices:**
- docs/architecture/MOVETE_FACIL_LAUNCH_GATES_2026-10-24.json: **17 gates, 15 BLOCKED, 2 QA_ONLY, 0 GO**.
- docs/architect-b/CERTIFICACION_INTEGRAL_R60_MATRIZ_VERIFICABLE_2026-10-24.json: **20 recorridos comerciales BLOCKED**, aunque haya código y tests de QA.
- No hay evidencia de un solo recorrido físico Cliente→Driver→Admin con UNA base PostgreSQL STAGING remota y persistente y dos móviles instalados.

Cinco niveles diferentes: (1) código escrito; (2) QA unit/Node/SQL efímero; (3) STAGING_E2E con HTTPS/IdP/DB persistente; (4) NATIVE_PASS con teléfonos Android/iOS; (5) COMMERCIAL_GO con permisos, seguros, PSP, soporte, acta Owner. Solo el segundo nivel está confirmado para los contratos recientes.

---

## 2. CONTRATOS DE PRODUCTO Y MODELO DE NEGOCIO APROBADO

1. **País inicial Paraguay**, activación por zonas; arquitectura preparada para Mercosur (Paraguay, Argentina, Brasil, Uruguay, Bolivia) de forma progresiva y coste escalable. Ningún despliegue multi-país sin nueva orden.
2. **App Cliente:** viajes AUTO, futura MOTO pasajeros al validar ley, envíos de carga AUTO/MOTO, compras en supermercados/farmacias OTC/restaurantes/otros; ruta, disponibilidad, PYG/guaraníes, consentimiento, reserva, búsqueda, seguimiento, chat, historial, soporte y cancelación.
3. **App Driver:** conductor o repartidor, identidad, ocho evidencias documentales incluyendo selfie, vehículo, permiso, ofertas privadas, aceptación, navegación, GPS, chat, recogida, finalización, custodia.
4. **Admin Web:** roles/MFA, KYC, zonas y cumplimiento, seguimiento de viajes, incidentes/SOS, soporte, catálogo/comercio, auditoría, finanzas y Owner.
5. **Cobertura NO es disponibilidad**. Listar una zona no promete autos/motos cercanos, ni un comercio catálogo/stock verificados.
6. **Sin tope global de 50 usuarios.** Tamaños de página y límites de memoria del cliente no deben crear límite de registro.
7. **KYC/renovación:** el vencimiento desactiva elegibilidad en el servidor y avisa al Driver; el reemplazo queda pendiente hasta verificación independiente de autenticidad, fecha, selfie/vínculo documental, seguro/vehículo y ausencia de sanciones. No reactivar automáticamente por foto recién cargada sin verificar.
8. **Precio:** calculado en backend PYG, versión/TTL/ruta/categoría y consentimiento. Diferentes modalidades requieren tarifas distintas; no inventar precio, GPS, ETA, aceptación de conductor o cobro.
9. **Estrategia Owner de subsidio:** descuento constante del **10 % del precio del viaje al Cliente**, financiado desde la comisión: AUTO nominal **15 %**, de los cuales 10 puntos son descuento Cliente y **5 %** ingreso de plataforma; MOTO nominal **12 %**, 10 puntos descuento Cliente y **2 %** plataforma. El Owner consideró un lanzamiento con subsidios de **60 o 90 días** y pagar infraestructura más publicidad YouTube/Facebook por 2–3 meses. Deben modelarse redondeos de PYG, ejemplos, devoluciones y conciliación; **no está implementado/certificado ni existe PSP aprobado**. Confirmar solo duración/reglas de excepciones antes de ejecutar dinero real.
10. Lovable únicamente como posible interfaz final cuando los circuitos estén operativos; no confundir maquetas con productos terminados.

---

## 3. SEPARACIÓN ESTRICTA A / B

**Arquitecto A controla:** apps/mobility-expo/** (backend Node, OpenAPI, SQL, Auth/RLS, seguridad, integración), apps/movete-driver/**, docs/handoff/**, docs/architecture/**, .github/workflows, infraestructura, migrations en sus rutas.

**Arquitecto B controla:** apps/movete-cliente/**, apps/movete-admin/**, docs/architect-b/**.

**Ambos:** coordinar en issue #9 con nombre de endpoint, método, request, response, errores, JWT/rol, revisión/versiones, evidencia exacta del SHA/CI. El PR #8 tiene como base la rama de A; **NO** sincronizar por merge/despliegue espontáneo. Comprobar HEAD antes de editar, usar actualización condicional de SHA para no borrar trabajo paralelo.

Documento original: docs/handoff/DIVISION_TRABAJO_DOS_ARQUITECTOS_MOVETE_FACIL_2026-10-22.md.

---

## 4. HISTÓRICO COMPLETO DE ARQUITECTO A (IMPLEMENTACIONES Y LÍMITES)

### G0–G22 — cimentación
- Aislamiento de la movilidad frente al trading y dos apps Expo; CI Node/Expo/PostgreSQL16; configuración staging aislada y secretos protegidos.
- Supabase/Lovable legado: auditoría de roles/RLS/RPC, cierre del acceso SDK a operaciones peligrosas; migraciones históricas de seguridad. Nunca asumir que el antiguo Lovable es el futuro STAGING.
- Vehículos AUTO/MOTO, documento/licencia/seguro, ofertas y asignación G3/G4 con identidad server-side e idempotencia.
- Envíos G5, pedidos de comercio G6, cotización/tarifas G7, seguridad/SOS G8, comercios G9, courier G10; QA sin operación comercial.
- Flujos Driver de documentos y soporte. No se crearon viajes/cobros reales.

### G23–G48 — controles de lectura, sesión y concurrencia
- Historial de viajes, miles de filas sin tope 50, cursores firmados, keyset/revisiones monotónicas y bloqueo de cross-account.
- Roles Admin/Owner, MFA/AAL2, KYC y auditoría; zonas/cobertura versus disponibilidad, consentimientos de ubicación y política antisuplantación.
- **G36** exclusividad atómica de un Driver por servicio; **G37** prohibición de DML directo a viajes/entregas; **G38** veto de aceptación sin habilitación legal de zona/vehículo. **G39** admisión firmada de oferta. No debilitar estos gates.
- G42/G43 revocación de sesión/JWT bajo lock y carreras. G44/G45 catálogo, sucursales y stock atómico; G46 privilegios commerce; G47/G48 Storage privado y acceso por tickets de uso único.

### G49–G66 — chat seguro, estados, recibos
- Chat por asignación, envío e historial privado, ACKs idempotentes, read markers y cursor, no-leídos, revocación al cambiar de Driver; NOLOGIN scoped capabilities.
- Recuperación de respuestas inciertas, G59/G59B, G60C (no duplicar SEND/accept).
- G61 gates explícitos NO_GO. G62 sesión Driver; G63 aceptación/rechazo privado; G64 recuperación del resultado tras ACK perdido sin duplicación.
- G65 ciclo AUTO Driver accepted→arriving→in_progress→completed (SQL/Node local); G66 entregas pickup/custodia/delivered/return/dispute en QA.
- No prueba de GPS, chat, SOS o push en teléfonos físicos.

### G67–G80 — custodia, ocho documentos, F1
- G67 prueba de custodia consume evidencia válida dentro del mismo COMMIT; impide UUID fabricado, reuse/replay y revocación.
- G68 lectura privada del estado de envío remitente; G69 SQL NOLOGIN mínimo privilegio, G70 transporte HTTP localhost.
- Driver: ocho tipos documentales y selfie, upload privado/límites MIME, expiración y notificación UI, renovación pendiente y verificación independiente; G71 obliga KYC vigente en despacho/aceptación bajo SQL QA, sin levantar sanciones. **Verificar todos los caminos legacy/RPC**; no confiar solamente en botones UI.
- G72 cotización server-side; **G73** ruta atestada → precio PYG → aceptación explícita → reserva atómica idempotente; **G74** misma reserva visible para Passenger, **G75** lectura y acta Admin AAL2 del mismo tripId, **G77** proveedor Routes externo opcional no activado; **G78/G80** bloqueo por KYC/slots/zona jurídica y prueba de ausencia de asignación ilegal.
- Un test negativo G38/G71 PASS no es viaje Driver completado.

### G81–G91 — últimos trabajos de A (la parte crítica del sucesor)
- **G81** SQL de oferta privada desde booking G73 original; **G82** candidato elegible elegido server-side sin aceptar ID Driver del Cliente.
- **G83 — commit 6d5b54ca...:** bloqueo HTTP de antigua solicitud /v1/staging/rider/trips/request sin precio/consentimiento; reserva G73 es camino permitido.
- **G84 — commits 46ead4f4... y cbb55405...:** tras receipt G73 persistido, Server invoca despacho privado G82, offerKey estable para reintentos; test HTTP enlaza mismo tripId en reserva Cliente, oferta G82, inbox privado Driver G16 y detalle G4. No implica Driver aceptado ni push entregado.
- **G85 — 2c83014b... y 12309135...:** durable outbox SQL por reserva y recovery/backoff; no duplicar ofertas en ACK ambiguo.
- **G86 — ac092c28... y a61a2c44...:** runner manual QA, dos conexiones PG SKIP LOCKED y cancelación; estado Rider seguro después de aceptación persistida aunque proveedor perfil/GPS esté caído: se muestra assigned/arriving/in_progress SIN PII, ubicación ni ETA fingidos.
- **G87 — d3ded628..., fb12912..., 335bda...:** si Driver ignora/rechaza y oferta vence, cierre del job cuando viaje está terminal; rotación de offerKey para siguiente candidato y backoff. Máximos 12 intentos/5 ofertas; KYC/zona inalterados. Tests reales PostgreSQL dos sesiones. Sin scheduler remoto.
- **G88 — b3aaf8de...:** revalidación de elegibilidad Driver/KYC tras lookup de dispositivo y antes de push Expo; NO evidencia entrega de push físico.
- **G89 — 0a530f6c...:** arregla 404 falso de viaje ante fallo de PostgreSQL. Solo 404 si SQL own-trip confirma ausencia; 503 si DB falla; HTTP test owner/foreign/status.
- **G90 — 6573ed48... y 74c1e9a...:** nueva API de QA **GET /v1/staging/rider/auto/bookings/{bookingKey}/dispatch**, limitada a cuenta Passenger y reserva G73/G85 original. DTO estricto: mode, commercialEnabled=false, ownerId, bookingKey, tripId, tripState, dispatchState, attempts, offerPendingAcceptance. Estados SEARCHING_DRIVER, OFFER_PENDING, RETRY_PENDING, SEARCH_EXHAUSTED, CLOSED. No expone DriverID, patente, offerId, ubicación ni KYC. Tests SQL/Node, sin base remota.
- **G91 — 1307f3e... (4/4 PASS):** proyección de oferta privada G84 visible como OFFER_PENDING aun ANTES de que la cola G85 haya reconciliado la oferta. Corrige lag de UX; no equivale a asignación.

**Archivos A críticos para próximo sprint:** apps/mobility-expo/server/g73-f1-auto-gateway.mjs, g73-auto-f1-repository.mjs, g4-staging-runtime.mjs, g4-rider-status-gateway.mjs, g4-loopback-http-transport.mjs, g82-f1-auto-candidate-dispatch.mjs, g86-manual-dispatch-runner.mjs, g65-driver-trip-status-qa.mjs, g75-f1-admin-audit-gateway.mjs; apps/mobility-expo/docs/backend/staging_only/G71*, G73*, G75*, G81*, G82*, G85*, G87*, G90*; .github/workflows/mobility-g4-postgres-disposable.yml.

**La verdad de A:** postgres CI es desechable y el runtime principal está bajo loopback QA; no existe aceptación legal positiva en móviles con un mismo backend remoto, GPS físico, comisión pagada ni cierre operativo certificado.

---

## 5. HISTÓRICO COMPLETO DE B — CLIENTE Y ADMIN WEB

### R1–R33
- APP Cliente Expo independiente con pantalla de inicio, viaje, envíos, seguimiento, historial, cotización, pagos, comercios, mensajes, cuenta y soporte. Session Passenger JWT y revisión privada, logout, revocación y rechazo de respuestas tardías.
- HTTP HTTPS origin pinned, AbortController, límites de JSON, fail-closed y no secretos en móviles. Tarifas PYG solo desde el servidor, nunca desde mapa local.
- Borrador de viaje AUTO con Económico/Confort/XL, requestKey estable, consentimiento y recuperación de POST incierto. Estados Cliente monotónicos, GPS/ETA ocultos si inválidos. Cancelación confirmada e idempotente; historial propio paginado sin tope de registros.
- Chat Cliente↔Driver/G53, mensajes privados, drafts/ACK/read markers, bandeja, no-leídos, hints sin PII, revocación al cambio de asignación.
- Admin Web React/Vite/TypeScript propio: KYC, zonas, seguridad, incidentes, auditoría, Owner y sesiones RBAC+MFA. Sin aprobación de expediente real ni operaciones financieras activadas.

### R34–R50
- UX accesible de rutas/paradas, chat G55, comercios multirrubro, catálogo G44, stock/TTL de sucursal, carrito local sin compras inventadas, sustituciones, revisión previa, soporte/incidentes G40 y casos comerciales.
- Admin con colas privadas, paginación, control de permisos y estado de lectura; no activar checkout ni pagos por fixture.

### R51–R66
- Editor de envíos y viaje, bloqueo de cambios después de reservar, cancelación condicionada a estado actual, composition HTTPS pinned chat, booking idempotente y reconciliación read-only después de timeout.
- Pantalla de reserva incierta con mismo requestKey y SIN reenvío automático; matriz de gates R60.
- Adaptación G65 Driver status a Rider; historial y custodia G66/G68/G69 ligados al autor/TTL y sin prueba falsa. Admin KYC con revisión condicional, recibos y rol; captura segura de incidentes y soporte.
- **F1 G73 en B:** f1-g73-http-gateway.mjs integra ruta verificada, tarifa PYG, consentimiento, booking y GET de conciliación bajo todos los gates STAGING externos apagados por defecto.

### R67 — ENTREGA RECIENTE CERTIFICADA
- **331fce082...:** el gateway HTTPS Cliente añade lectura privada G90 de la misma reserva/G73, JWT sujeto y origen pinned; rechaza recibos con campo extra PII, ID distinto, trip distinto, sesión rotada, redireccionamiento o servidor no certificado.
- **d07d68ff... (CI 3/3 PASS):** client-experience.mjs aporta refreshAutoDispatch() y snapshot revocado al logout/JWT. Solo disponible tras booking oficial G73 confirmado y el mismo subject+sessionRevision+bookingKey+tripId. Consulta GET sin generar otro POST.
- **apps/movete-cliente/app/viaje.tsx** enseña botón **Actualizar búsqueda de conductor** después del booking y los estados buscando / esperando respuesta / buscando otro / búsqueda agotada. No promete conductor, GPS ni tiempo si no están verificados.
- TypeScript/QA: pruebas HTTP y dominio de ruta correcta, recibos extraños, JTW rotado, bloqueo antes de reserva, aislamiento Driver y Admin web. Sigue OFF si no hay STAGING real/IdP/ruta/PG autorizado.

**Archivos B clave:** apps/movete-cliente/src/domain/client-experience.mjs y .d.mts, f1-g73-http-gateway.mjs y .d.mts, f1-auto-prequote-consent.mjs, ride-status-gateway.mjs, f1-focused-tracking-sync.mjs; apps/movete-cliente/app/viaje.tsx y seguimiento.tsx; apps/movete-admin/**.

**Handoff histórico completo B:** docs/architect-b/HANDOFF_MAESTRO_ARQUITECTO_B_R1_R66_F1_PRIORIDAD_FUNCIONES_CERTIFICADAS_2026-10-24.md; ver STATUS_Y_CONTRATOS.md y los más de cien archivos de hitos R1–R66. No se sustituye la auditoría histórica por este resumen.

---

## 6. QUÉ FALTA (MATRIZ DE LOS 20 RECORRIDOS NO CERTIFICADOS EN CAMPO)

**Los veinte figuran BLOCKED para E2E comercial; ninguno se vuelve GO solo por CI:**
1. AUTH_PASSENGER — autenticación real Cliente e identidad revocable en dos móviles.
2. AUTH_DRIVER_KYC — registro Driver + documentos privados/expiración/renovación validados y Admin.
3. FARE_QUOTE_GS — ruta y tarifa oficial PYG real, diferencial AUTO/MOTO, versión, TTL y consentimiento.
4. AUTO_BOOKING — booking único en PostgreSQL remoto persistente y recuperación tras timeout.
5. DRIVER_DISPATCH — oferta real Driver, aceptación legal única, sin carreras ni doble adjudicación.
6. GPS_TRACKING — permisos/dispositivo, precisión, ETA, reasignación, pérdida de red y privacidad.
7. TRIP_COMPLETION_CANCELLATION — llegada, inicio, finalización y cancelación con historial.
8. MOTO_CARGO_DELIVERY — carga MOTO habilitada, pickup/entrega/custodia.
9. AUTO_CARGO_DELIVERY — carga AUTO, tarifa, peso/custodia/incidentes.
10. SUPERMARKET_ORDER — catálogo real, stock, sustituciones, picking, entrega y cobro autorizado.
11. PHARMACY_OTC_ORDER — OTC habilitado, legalidad, privacidad y entrega.
12. RESTAURANT_ORDER — pedido preparado/aceptado/despachado/entregado y conciliación.
13. CUSTOMER_DRIVER_CHAT — chat bidireccional real + push/read con un mismo servicio.
14. PAYMENTS_REFUNDS — PSP, capturas, anulaciones, reembolsos, conciliación.
15. COMMISSIONS_PAYOUTS — comisión, subsidio 10 %, balances PYG y pagos a conductores.
16. ADMIN_KYC_ZONES — MFA, aprobación KYC real, zona y evidencia/auditoría.
17. EMERGENCY_RESPONSE — SOS con operador, llamadas, escalamiento y ensayo en campo.
18. DATA_PRIVACY — cifrado, consentimiento, retención, borrado, evidencia regulatoria.
19. SIGNED_NATIVE_RELEASES — Android APK/AAB/iOS IPA firmados y probados en teléfonos físicos.
20. ZONE_ACTIVATION_SUPPORT — activación por cobertura/Driver, capacidad, turnos de soporte y operación.

**Los 17 gates P0 que aún prohíben GO:** IDP_BACKEND_AUTH, HTTPS_BACKEND, POSTGRES_PERSISTENCE (QA_ONLY), DRIVER_ONBOARDING, DRIVER_LIVE_TRIPS, CLIENT_LIVE_BOOKINGS, PAYMENT_SETTLEMENT, PRIVACY_KYC, EMERGENCY_SAFETY, MAPS_GPS_DEVICE, DELIVERY_MERCHANTS, CHAT_PHYSICAL (QA_ONLY), ADMIN_OPERATIONS, NATIVE_RELEASES, LEGAL_COMPLIANCE, OPS_24_7_MONITORING, PROD_GO_NOGO. Ver manifiesto canónico antes de cambiar un estado.

---

## 7. PRIMER VERTICAL F1 — PASOS QUE DEBEN FUNCIONAR EN EL MISMO AMBIENTE

1. Dos cuentas sintéticas de QA reales en IdP autorizado, Passenger y Driver con JWT revocable/roles independientes y test de intrusión.
2. Driver con KYC ocho documentos verificados, vehículo aprobado, slot único G36 y cobertura/permiso legal G38; suspensiones/expiraciones deniegan aceptación incluso si la UI muestra botón.
3. Cliente obtiene ruta real proveedor independiente, tarifa/version/TTL PYG y acepta expresamente; no local price, no reserva por antiguo endpoint sin precio.
4. G73 persiste UNA reserva PostgreSQL con tripId invariante y requestKey; timeout concilia por GET sin segundo POST.
5. G85/G87 procesa cola durable y G82 elige Driver; G16 Driver lee oferta privada y G90/G91 Cliente observa búsqueda/oferta/reintento, **mismo tripId** y sin IDs Driver prematuros.
6. Driver acepta oferta dentro de TTL; fila trip pasa searching→accepted bajo legal/KYC y exclusividad; dos Drivers concurrentes no ganan simultáneamente.
7. Cliente ve assigned persistido, luego GPS/ETA solo cuando consentidos, verificados y frescos; prueba desconexión, spoof y revocación.
8. Driver arriving/pickup/in_progress/completed; Cliente observa cada revisión monotónica. Chat autorizado solo mientras relación esté vigente.
9. Historial propio tras reiniciar app; Admin AAL2 lee G75 del **mismo tripId**, con auditoría.
10. Tarifas/comisiones/compensación PYG auditables, sin cobrar ni simular PSP si no autorizado.
11. Cancelación antes/después de aceptación y cambios por documento vencido, zona revocada, retorno de red y ACK incierto, sin duplicación y con recibos.
12. Acta por paso: SHA, workflow, URL no secreta, entorno, timestamp, estado DB, actor, negativa cruzada y prueba en dispositivo, sin datos personales.

**Hoy solo hay QA de subtramos.** No existe un test E2E positivo de los pasos 1–12 sobre un servidor persistente físico. No alterar G38/G71 para fabricar el resultado.

---

## 8. INFRAESTRUCTURA, COSTOS Y BLOQUEOS REALES (NO CREAR RECURSOS)

- En el último diagnóstico del entorno conectado, **Render My Workspace no tenía web services, PostgreSQL ni Redis/Key Value**. El conector funcionó, pero no hay backend remoto disponible, dominio HTTPS ni health E2E.
- Supabase: la cuenta vinculada anteriormente devolvió lista de proyectos vacía; el proyecto Lovable STAGING mostró una ficha de base potencialmente habilitada pero las lecturas SQL de prueba fallaron 400. **No asumir Supabase PostgreSQL existente y utilizable sin verificar conexión y privilegios**.
- Railway tuvo dificultades de conexión reportadas por Owner. Render+Supabase está propuesto para STAGING; **no contratado ni desplegado**.
- A tiene propuestas de ingress Render y launcher en apps/mobility-expo/server/render-staging-ingress.mjs y run-g4-render-staging.mjs, pero tests locales y un archivo de configuración no prueban servicio remoto. Nunca confundir liveness de proceso con readiness de booking.
- No hay acuerdo de precios para crear recursos; Owner exige **informar costos exactos antes de provisionar**. Preparar comparativo documentado (Render instancia Node, Supabase Auth+DB+Storage privado/backup, Maps/rutas, push, correo/SMS, observabilidad, EAS/builds y tiendas, escalado por zona, publicidad, contingencia de tráfico). Tarifas deben confirmarse en fuentes oficiales del momento; no inventarlas.
- No PSP, no almacén documental real certificado, no notificación física ni geolocalización real aprobada; tienen costos/secretos/permisos pendientes.
- **Bloqueo real:** la aceptación positiva con dos teléfonos y persistencia remota exige recurso y acceso autorizado por Owner. **No es bloqueo para seguir en QA** con contratos, pruebas SQL concurrentes, recuperación, UX, mocks de entorno e instrumentación. No reiniciar todo el proyecto por falta de servidor.

---

## 9. ORDEN DE EJECUCIÓN DEL SIGUIENTE ARQUITECTO — NO MÁS PAUSAS

### PRIORIDAD P0-A (puede hacerse ahora sin gastar): unir contrato y prueba transaccional
1. Refrescar PR #7 y PR #8, comparar G91/G90 contra B R67 y los DTO exactos en uso. Verificar OpenAPI y evitar regresiones de ofertas antes de conciliación G85.
2. Implementar/fortalecer en A un ensayo **transaccional completo** en PostgreSQL CI desechable de G73→G81/G82/G85→G16 inbox→aceptación G4 legal y KYC→G65 estados→G75 Admin, mismo tripId y verificaciones negativas para usuario ajeno, múltiples conductores, expiración y cancelación. Si no hay fixture positiva legal certificable, registrar qué atestación falta y cerrar primero el test de coherencia/preventiva sin desactivar controles.
3. En B, completar traducción de G90/G91 a una experiencia de seguimiento coherente al pasar de búsqueda→assigned; evitar estado estancado, polling duplicado y mostrar información de conductor antes de respuesta de status G4 verificada. Mantener estado privado invalidado al rotar JWT o cambiar trip.
4. Publicar la diferencia de contrato/DTO en issue #9; un avance se considera terminado cuando tests exactos del mismo SHA pasan y la funcionalidad está unida, no porque se añadió otro endpoint.

### PRIORIDAD P0-B (preparación técnica sin desplegar): seguridad y migración
5. Auditar RPC legacy/role grants y todos los caminos de aceptación/despacho para G36/G38/G71 y garantías de vencimiento KYC. Hacer tests que simulen cambios entre oferta y aceptación.
6. Preparar migraciones seguras e idempotentes para futuro STAGING **separadas** de archivos POSTGRES_CI_ONLY; revisar RLS/roles/Storage/backup/restore y scripts de diagnóstico. No ejecutar en remoto todavía.
7. Definir plan real de QA móvil: dos binarios independientes, datos sintéticos, IdP, misma base, GPS consentido, push privado, conexiones interrumpidas, Admin MFA, soporte y actas.

### BLOQUEO REAL Y DESBLOQUEO EXPLÍCITO DE OWNER
8. Solo con autorización de presupuesto y provisión, crear servicios separados de STAGING, IdP, Postgres+Storage y HTTP TLS. Validar conectividad, autenticación, migraciones, persistencia, dos dispositivos y retomar F1. No hacer esto antes de aprobación.
9. No autorizar MOTO de pasajeros comercial, PSP, promociones monetarias, publicidad o GO hasta sus propias aprobaciones legales/comerciales.

### P1 DESPUÉS DEL PRIMER F1 REAL
10. Envíos AUTO y MOTO, supermercados/farmacias/restaurantes, pagos y comisiones/subsidio, tickets/soporte, chat push físico y seguridad/SOS, App Store/Play Store, monitoreo 24/7 y despliegue progresivo por zonas, con QA por vertical.

**Criterio de informe en cada turno:** “Qué fallaba → qué corregí → endpoint/archivo → commit → CI mismo SHA → qué funciona ahora en QA o dispositivo → siguiente bloqueo/prioridad”. Sin marketing de porcentajes basados en commits.

---

## 10. RUNBOOK DE ARRANQUE INMEDIATO EN EL NUEVO CHAT

1. Leer este archivo y las matrices en GitHub. Confirmar último HEAD real A/B (cualquier SHA de aquí es histórico).
2. PR A: https://github.com/mezas3238-hue/Qore-mobile-/pull/7; PR B: https://github.com/mezas3238-hue/Qore-mobile-/pull/8; coordinación: https://github.com/mezas3238-hue/Qore-mobile-/issues/9.
3. Revisar fuente de A G91 SQL, G90, G73 y G85; comparar con código de Cliente B R67, archivos exactos indicados arriba.
4. Escoger inmediatamente el bug funcional/recorrido P0 sin bloqueo real. Modificar solo dominio de propiedad y crear commit con comparación de SHA esperada; un PR DRAFT, ninguna rama principal.
5. Ejecutar/consultar GitHub Actions del nuevo commit: A Node STAGING, PG16 desechable, Expo, dos apps; B Cliente+Driver + ownership + Admin. No atribuir CI del parent.
6. Ante failure, leer workflow/job logs y corregir. Frente a bloqueo real externo, declarar dependencia específica y avanzar otra prueba/función autorizada. Coordinar issue #9.
7. No inventar status de proveedor cloud, Driver online ni ruta/ETA. No publicar nada a usuarios comerciales.

### Handoff histórico de detalle que debe quedar accesible
- [A G0–G66](./HANDOFF_MAESTRO_ARQUITECTO_A_G0_G66_CONTINUIDAD_SIN_PAUSAS_2026-10-24.md): inventario técnico y pruebas históricas.
- [A funciones KYC y vencimientos](./HANDOFF_MAESTRO_A_FUNCIONES_CERTIFICADAS_Y_CONTINUIDAD_2026-10-24.md): RLS, KYC, documentos, bloqueos, cobertura.
- [A Render/Supabase F1](./HANDOFF_MAESTRO_A_RENDER_SUPABASE_F1_CONTINUIDAD_SIN_PAUSAS_2026-10-24.md): diagnóstico remoto y planes.
- [B R1–R66+F1](../../docs/architect-b/HANDOFF_MAESTRO_ARQUITECTO_B_R1_R66_F1_PRIORIDAD_FUNCIONES_CERTIFICADAS_2026-10-24.md): historial por etapa B y deuda técnica.
- [B global A+B](../../docs/architect-b/HANDOFF_MAESTRO_GLOBAL_A_B_F1_OPERATIVO_CONTINUIDAD_2026-10-24.md).
- [B 20 recorridos](../../docs/architect-b/CERTIFICACION_INTEGRAL_R60_MATRIZ_VERIFICABLE_2026-10-24.json).
- [A 17 gates](../architecture/MOVETE_FACIL_LAUNCH_GATES_2026-10-24.json).

---

## 11. ORDEN TEXTUAL PARA INICIAR EL NUEVO CHAT

Continuá el desarrollo de QORE Mobile / Movete Fácil como Arquitecto sucesor. La fuente de verdad es mezas3238-hue/Qore-mobile- (con guion final) y el Handoff Maestro Global A G91 / B R67 del 25-10-2026 en docs/handoff. Revisá HEAD y CI actuales de PR #7 Arquitecto A y PR #8 Arquitecto B (ambos DRAFT), y coordinación issue #9. NO quiero más cientos de commits sin funciones completas: avanzar inmediatamente en F1 AUTO con tarifa PYG verificada → G73 booking persistido → G81/G82/G85/G87/G90/G91 despacho/búsqueda e inbox G16 Driver → aceptación legal G38 y KYC G71 → seguimiento GPS/llegada/inicio/finalización → historial Cliente y recibo Admin G75, siempre el mismo tripId. Tenemos dos apps Expo independientes, Cliente y Driver, más Admin Web y backend/DB común, con AUTO y MOTO en producto (MOTO pasajeros requiere autorización legal). No hacer MERGE, LIVE, infraestructura nueva/pagada, SQL remoto, notificaciones o pagos reales sin mi autorización expresa. Seguí trabajando sin detenerte salvo bloqueo real de la operación; ante él documentá evidencia y continuá una tarea QA autorizada. Certificá el SHA exacto y diferenciá QA sintética de pruebas reales en dos teléfonos. Empezá con código funcional y pruebas, no otro handoff.

**Fin. Este documento es de continuidad, no acta de GO, despliegue ni certificación física.**

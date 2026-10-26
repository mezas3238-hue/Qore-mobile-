# QORE MOBILE / MOVETE FÁCIL
# HANDOFF MAESTRO GLOBAL A + B — G103 / R79
## Continuidad inmediata, cuatro servicios, UX de elección de vehículo y arquitectura regional superior por evidencia
**Corte de auditoría:** 25 de octubre de 2026, zona Paraguay.
**Repositorio fuente de verdad:** https://github.com/mezas3238-hue/Qore-mobile- (el guion final es parte del nombre).
**A, PR #7 DRAFT:** https://github.com/mezas3238-hue/Qore-mobile-/pull/7 — rama feature/mobility-monorepo-isolated-20261016.
**B, PR #8 DRAFT:** https://github.com/mezas3238-hue/Qore-mobile-/pull/8 — rama feature/mobility-cliente-admin-parallel-20261022.
**Coordinación obligatoria A↔B:** https://github.com/mezas3238-hue/Qore-mobile-/issues/9.
**HEAD A, ANTES de publicar este handoff:** 5b1e887b18d7b67a371a12308e468c2abdee3066.
**HEAD B, al momento de la verificación:** 57ea8169ee19c3d3242418ed26dcb02173e5ace7.
**Estado comercial:** NO_GO. Este handoff no autoriza producción, gastos, cobros, publicación de apps ni modificaciones de los PR a READY.
**Regla Owner:** entregar funciones completas, integradas y certificadas; NO medir progreso por cantidad de commits.

---

## 0. ORDEN SOBERANA DEL OWNER — LEER ANTES DE TRABAJAR

El siguiente arquitecto debe continuar la construcción y certificación de Movete Fácil SIN DETENERSE SALVO POR UN BLOQUEO TÉCNICO, LEGAL O DE AUTORIZACIÓN REAL. No volver a empezar, no hacer cientos de commits de módulos inconexos, no sustituir código funcional por otros planes, ni pedir reiteradamente decisiones ya aprobadas.

La plataforma debe ofrecer:
1. AUTO — personas viajan en automóvil.
2. MOTO — personas viajan en motocicleta (no confundir con mensajería).
3. ENVÍOS — paquetes con vehículos AUTO o MOTO, según reglas y seguro.
4. COMERCIOS — supermercados, farmacias, restaurantes y otras tiendas autorizadas.

Debe haber 2 apps Expo nativas INDEPENDIENTES: Cliente y Driver, además de Admin Web y un backend central con PostgreSQL persistente y operaciones autorizadas. No reunir Cliente y Driver en una sola app. Paraguay es el primer mercado, zonas habilitadas gradualmente. Evolución Mercosur: Paraguay, Argentina, Brasil, Uruguay y Bolivia; arquitectura preparada sin aprovisionar cinco países prematuramente.

**Última corrección visual Owner (PRIORITARIA):** la persona elige qué vehículo quiere usar. La interfaz, tomando como REFERENCIA las seis capturas de Uber y Bolt remitidas por el Owner, debe presentar un mapa, origen/destino, lista o tarjetas de modalidades AUTO y MOTO, cada una con precio y ETA solo si fueron verificados, y botón de selección/confirmación. Cambiar libremente AUTO ↔ MOTO antes de contratar. No copiar marcas, recursos visuales propietarios, logos, iconografía distintiva o código privado de Bolt/Uber. Adoptar el patrón funcional, pero diseño e infraestructura propios y superiores por medición.

**G103 NO decide el vehículo por el cliente:** solo prohíbe una SEGUNDA RESERVA ACTIVA ya confirmada sobre la misma cuenta; jamás impide comparar, elegir, pre-cotizar, cambiar de modalidad, navegar o cancelar expresamente un viaje. NO reemplazar un viaje activo sin voluntad del pasajero.

**Beneficio competitivo objetivo:** alcanzar o superar Bolt/Uber en confiabilidad, claridad tarifaria, disponibilidad real, seguridad, tiempos de respuesta, soporte y operación regional. Es una META QUE SE MEDIRÁ, NO un resultado ya logrado ni conocimiento de arquitectura interna de esas empresas.

## 1. FOTO DE GITHUB VERIFICADA (NO CONFUNDIR CÓDIGO CON SERVICIO COMERCIAL)

### Arquitecto A
- PR #7 OPEN / DRAFT, HEAD PREVIO A ESTE DOCUMENTO 5b1e887b18d7b67a371a12308e468c2abdee3066.
- 4/4 workflows SUCCESS SOBRE ESTE MISMO SHA:
  - Node STAGING 835/835 PASS: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40250548728.
  - PostgreSQL16 disposable / esquema real / SQL concurrencia G103: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40250548768.
  - Expo isolated CI: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40250548725.
  - Two independent apps isolation: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40250548711.
- Prueba PG G103 en log: AUTO gana/MOTO denegado; al cancelar AUTO, MOTO reserva. Segunda carrera MOTO gana/AUTO denegado; tras cancelar MOTO, AUTO reserva. Prueba determinista G103 PASS, dos transacciones PG16 PASS. No requiere ni declara Driver auténtico.

### Arquitecto B
- PR #8 OPEN / DRAFT, HEAD 57ea8169ee19c3d3242418ed26dcb02173e5ace7; último trabajo identificado R79.
- 3/3 workflows SUCCESS SOBRE SU HEAD:
  - Frontera de archivos: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40250109358.
  - Admin Web QA 268/268 Node PASS: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40250109317.
  - Aislamiento apps: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40250109391.
- R78/R79: pantalla y flujo MOTO Cliente conectados por adaptador HTTP bajo flags bloqueados; no hay servidor HTTPS externo ni autorización legal MOTO instalable. Ver docs/architect-b/R78_MOTO_G100_PASSENGER_QUOTE_BOOK_CANCEL_2026-10-25.md y R79_MOTO_G101_HTTP_PASSENGER_2026-10-25.md.
- El Home Cliente consultado en apps/movete-cliente/app/index.tsx AÚN PRESENTA botones separados hacia /viaje y /moto. Eso NO ES TODAVÍA el selector unificado comparable al patrón mostrado por el Owner. Corregir en B, no declarar diseño final por existir los botones.

### Matrices de aceptación más recientes existentes
- docs/architecture/MOVETE_FACIL_LAUNCH_GATES_2026-10-24.json, consultada en A: 17 P0; 15 BLOCKED, 2 QA-ONLY; decision NO_GO.
- docs/architect-b/CERTIFICACION_INTEGRAL_R60_MATRIZ_VERIFICABLE_2026-10-24.json, consultada en B: 20 flujos, 20 BLOCKED en evidencia comercial; decision NO_GO.
- Fechadas 24-oct. Las nuevas funciones G98–G103 no transforman automáticamente un bloqueo comercial en un PASS; actualizar actas SOLO con evidencias de nivel correcto.
- El SHA de A CAMBIARÁ al publicar este documento: el SUCCESS del SHA anterior NO se atribuye automáticamente al nuevo SHA. Siguiente arquitecto debe consultar HEAD y CI actuales inmediatamente. B trabaja en paralelo y su HEAD puede avanzar.

## 2. GOBIERNO DE RAMAS, PERMISOS Y SEGURIDAD

**A únicamente:** apps/mobility-expo/**, apps/movete-driver/**, SQL/backend/Auth/JWT/RLS/PSQL, OpenAPI central, .github/workflows/**, docs/architecture/**, docs/handoff/**, integraciones e infraestructura. A NO cambia Cliente/Admin B.
**B únicamente:** apps/movete-cliente/**, apps/movete-admin/**, docs/architect-b/** y pruebas de esas apps. B NO modifica servidor, Driver, SQL, OpenAPI A ni workflows A.
**Interoperabilidad:** issue #9 con SHA fuente, ruta/método, DTO exacto, JWT/rol, códigos 400/401/403/404/409/429/503, TTL, idempotencia, replay y evidencia CI.

**NO sin autorización explícita del Owner:** merge, activar producción, VPS o despliegue, crear Render/Supabase/Railway/Lovable/Maps/PSP u otros recursos facturables, migrar DDL QA al remoto, credenciales/proveedores reales no autorizados, push/SMS reales, operaciones de cobro/transferencia/reembolso, datos personales/biométricos reales para CI, APK/AAB/IPA comercial, live GPS de pasajeros, cambios destructivos de ramas.
**SÍ en continuidad:** editar en DRAFT según propiedad, ejecutar PostgreSQL16 disposable, CI Node/Expo/Android simulable sin publicación, tests SQL concurrentes, auditorías GitHub/read-only y documentar blockers con pruebas.
Los SQL nombrados *_CI_ONLY.sql exigen DB qore_disposable_chain y application_name qore_ci_disposable_chain; NO son migraciones listas para producción. El parche G96 de G4 con CHECK NOT VALID es compatibilidad SOLO de CI; antes de cualquier migración real exige backfill/validación, jamás reproducirlo como solución productiva.

## 3. PRODUCTO, FLUJO UX Y COMPETENCIA — LA REFERENCIA DE LAS SEIS IMÁGENES

### Experiencia del pasajero — COMPORTAMIENTO OBLIGATORIO
1. HOME: mapa y localización solo con consentimiento; arriba o abajo accesos evidentes AUTO, MOTO pasajeros, ENVÍOS y COMERCIOS. Buscar origen y destino sin declarar mapas oficiales por texto ingresado.
2. Al obtener destino verificable, cotizar las modalidades AUTO y MOTO para las que realmente haya reglas y cobertura habilitadas. Mostrar en un panel inferior desplazable vehículos/opciones y precios independientes, como en las capturas. Si una no está disponible, indicarlo sin falsa oferta.
3. El pasajero toca AUTO o MOTO para elegir; puede alternar ANTES de confirmar. La selección es local. No crear viaje hasta pulsar confirmar y aceptar precio.
4. Cada opción muestra nombre, foto/icono propio con derechos, asientos (auto) o casco/plaza moto (cuando se certifique), PYG/Gs, base y subsidio real de 10%, precio final y tiempo estimado solo si la API/Driver verificado lo proporciona. Disponibilidad = conductores elegibles dentro de cobertura, nunca cobertura sola.
5. Puede optar por AUTO normal/económico, confort y XL solo si la flota/regla lo permite, y otras clases más adelante con Owner. No fingir servicios adicionales.
6. Antes de confirmar: método de pago y condiciones, cobertura/legal, precio final, identidad autenticada, sin revelar Driver todavía si no asignado. Después de aceptar: reserva idempotente, búsqueda, llegada, recorrido, finalización, recibo, historial y soporte con mismo tripId.
7. ENVÍOS AUTO y ENVÍOS MOTO se presentan separados de viajes de PERSONAS (ej. paquete en maletero vs moto mensajería); COMERCIOS lleva a catálogos y checkout propios.
8. Pantalla Actividad similar al concepto mostrado: viajes anteriores persistidos, fecha, precio, tipo de vehículo, ruta/recibo y repetir SOLO si hay datos fuente; no inventar rutas históricas, precios cero, mapa o rating. Calificaciones solo para viajes realmente completados y autorizados.
9. Filtros recomendados/más rápido/más económico únicamente si existan suficientes cotizaciones actuales comparables. Sin fingir ranking ni conductor cercano.
10. Accesibilidad, texto legible y contrastes, estados de loading/error/offline, reanudación de borradores, cancelación explícita, recuperación de ACK, notificaciones reales solo bajo proveedor autorizado.

### Distinción de G103
- Antes de reservar: AUTO y MOTO son opciones libres; comparar y elegir NO supone transacción ni bloqueo.
- Al reservar: el cliente debe tener como máximo un viaje de pasajeros activo. Si existe uno, mostrar el activo y ofrecer cancelar expresamente antes de hacer uno nuevo. No impedir consultar precios ni pasar de una tarjeta a otra.
- Después de cancelar: comprobar en GET origen que la reserva está cancelada y su contabilidad provisional se revirtió; entonces liberar el segundo booking.
- El backend A G103 es el cerrojo transaccional; B UX debe tratar error de conflicto de forma comprensible, sin saltarse G103 ni repetir ciegamente el POST.

## 4. ECONOMÍA APROBADA POR OWNER Y LÍMITES REALES

Política comercial de referencia del Owner, expresada sobre tarifa base F y previa a impuestos, PSP, seguros, fraude, devoluciones, soporte y otros costos:

| Viaje pasajeros | Comisión nominal | Subsidio al cliente | Retención bruta Movete Fácil | Parte bruta conductor | Cliente paga |
|---|---:|---:|---:|---:|---:|
| AUTO | 15% de F | 10% de F | 5% de F | 85% de F | 90% de F |
| MOTO | 12% de F | 10% de F | 2% de F | 88% de F | 90% de F |

Ejemplo meramente explicativo F=Gs 30.000: AUTO paga cliente Gs 27.000; conductor Gs 25.500; plataforma Gs 1.500; subsidio Gs 3.000. MOTO paga cliente Gs 27.000; conductor Gs 26.400; plataforma Gs 600; subsidio Gs 3.000. Para MOTO el ensayo SQL G100 de F=Gs 11.000 validó cliente Gs 9.900, conductor Gs 9.680, plataforma Gs 220. Aplicar redondeos enteros simétricos de PYG según ledger, no calcular en móvil.
- El Owner exige 10% constante para clientes. Las campañas G93/G100 de QA vigentes en fixtures usan periodo de 60 días y eventual extensión a 90 SOLO con autorización; el producto real necesita una política/renovación coherente con el 10% sostenido, sin engañar ni fingir una promoción perpetua activa cuando el servicio no está operativo.
- Ningún precio, ETA, descuento o Driver real existe por el solo hecho de mostrar UI o aprobar SQL. Precio siempre backend verificado; montos PSP nunca simulados como facturados.
- Diferenciar comisiones/valores para ENVÍOS y COMERCIOS mediante reglas propias aprobadas; NO extrapolar 15/12 por intuición a otros servicios.

## 5. TRABAJOS HISTÓRICOS REALIZADOS POR ARQUITECTO A — MAPA G0–G103

Este mapa resume las familias funcionales sin inventar certificaciones comerciales. El historial línea por línea, commits y archivos está en los handoffs antiguos enlazados en sección 13.

**G0–G10 / fundación:** repositorio soberano y monorepo aislado, configuración de ambientes, identidades/roles, PostgreSQL de QA, RLS, reglas auto/moto y documentación legal, contratos iniciales de viajes/envíos, oferta privada y ACK idempotente, aislamiento de Driver y Cliente, servicios por zona.
**G11–G26 / APIs y persistencia:** contratos OpenAPI/STAGING, transporte loopback y DTO estricto, asientos de tarifas simuladas, idempotencia de reservas, conflictos/concurrencia, lectura/cancelación de viajes, historial paginado por cursores sin límite TOTAL de 50 registros, cotización server-side en PYG y recuperación de respuestas perdidas.
**G27–G38 / seguridad y despacho:** backoffice roles/RBAC, restricciones contra divulgación y suplantación, elegibilidad y cupos de Driver transaccionales, no sobreventa/reparto simultáneo, permisos de zonas, documentos/KYC, firmas o evidencias Ed25519, G38 niega legítimamente aceptación sin emisor externo legal y geocerca/GPS fiables; jamás producir firma positiva falsa en producción.
**G39–G49 / operación y comercios:** incidentes/seguridad/soporte privado, auditorías, transportistas y vehículos, zonas y sucursales, catálogo paginado, stock, pedidos idempotentes, anulaciones, precios server-side, protecciones de sucursales y privilegios.
**G50–G70 / mensajería, sesiones y custodia:** chat Cliente–Driver/repartidor privado por identidad y asignación válida, inbox, lectura, marcadores, cursores firmados, expiraciones, rotación/revocación de sesión, concurrencia, firma de entrega/custodia, controles de mensajería del Driver detenido y sin exponer PII. Todo QA hasta proveedor HTTPS/IdP real.
**G71 / KYC y vencimiento:** elegibilidad Driver bloqueada cuando licencia/cédula/seguro/habilitación/doc. vigente no está verificado, incluidas pruebas de concurrencia sobre oferta y asignación. Documentos de identidad, registro, cédula verde, habilitación y foto rostro conforme requerimiento Owner; se requiere validación genuina por emisor y revisión humana ante inconsistencias. Expiración notificada, bloqueo y re-habilitación automática SOLO tras nueva evidencia auténtica/aprobación permitida. No interpretar fixtures como OCR/fraude real aprobado.
**G72–G80 / primera transacción F1 AUTO:** G72 prequote y booking atómico/idempotente; G73 enlaza origen/destino verificados en QA, quote Gs, consentimiento y tripId canónico; G74 enlaza Passenger status a reserva real; G75 Admin fuente SQL/rol/MFA sintético; G78/80 bloquean Driver no autorizado incluso con documentos QA aparentemente completos.
**G81–G92 / búsqueda Driver:** oferta privada del viaje G73 G81; selección candidato G82; cola G85 duradera y retries; G87 recupera ofertas expiradas/declinadas; G90 indica búsqueda al propietario; G91 corrige estado OFFER_PENDING si ya existe oferta pero todavía no se concilió la cola. Ningún proveedor de push comercial ni Driver legalmente habilitado por estas pruebas.
**G93 / descuento AUTO:** campaña Owner y subsidio 10% al cliente en ledger provisional, comisión nominal 15%, retención bruta 5%, idempotencia y disclosure previo, SIN PSP.
**G94 / reversión AUTO:** cuatro contra-asientos provisionales en cancelación, estados VOIDED_QA y lecturas sin atribuir reembolso PSP.
**G95 / cancelación por Passenger:** POST/GET originales del G73 booking; evento único en trip G3, registro financiero G94, replay misma requestKey, aislamiento propietario, recibo rastreable.
**G96 / fence despacho Driver:** cancelación cierra cola G85, retira oferta pendiente, niega push ACK tardío y Driver acceptance; trabajador debe comprobar elegibilidad antes de enviar push real. La compatibilidad G4 CHECK NOT VALID es **solo QA** y necesita migración certificada distinta para producción.
**G97 / gateway loopback QA:** rutas F1 de descuento/finanzas/cancelación conectadas a transporte HTTP local, no equivalen a STAGING HTTPS comercial.
**G98 / F1 HTTP → PostgreSQL16 real:** misma reserva AUTO, cotización/precio/subsidio, búsqueda, cancelación, 4 contra-asientos, cierre G85, replay, privacidad y lectura de finanzas, sin respuestas SQL simuladas. Provider de ruta/JWT sigue sintético.
**G99 / integración Cliente y Admin por HTTP:** ambos leen el mismo tripId y revisión searching → cancelled de PostgreSQL16; el Admin requiere rol distinto y validación AAL2 ficticia de QA; revocación de sesión y suspensión de rol impiden lecturas. No es MFA real.
**G100 / MOTO pasajero propio:** crea 3 tablas separadas quotes/trips/entries para MOTO_RIDE, exige tarifa MOTO 12% y campaña Owner/10%, transacciones booking y cancellation, 4 asientos reserva y 4 reversión, actor-bound, idempotencia y sin mezclar AUTO/DELIVERY. Estado searching/cancelled: Driver todavía NO asignable.
**G101 / HTTP privado MOTO:** gateway Node, adaptador RPC, rutas propias MOTO en loopback, importes exclusivamente PG, rechazo de campos driverId/precio/courier, control JWT, caducidad y recuperación GET; OpenAPI 1.0.0-g101, x-qore-runtime-wired:false, x-qore-external-staging-certified:false.
**G102 / prueba MOTO HTTP → PG16:** quote/book/cancel contra funciones reales, mismo tripId, 12/10/2 %, 4+4 entradas, sin crear viaje AUTO ni ENVÍO; ruta y JWT de prueba explícitamente sintéticos.
**G103 / último avance:** triggers sobre tablas AUTO/G3 y MOTO/G100 con FOR UPDATE en auth.users bloquean SEGUNDA RESERVA ACTIVA de pasajeros entre servicios de forma serializable por identidad bajo transacciones concurrentes. Tras cancelar, otro vehículo sí puede reservar. Dos carreras reales opuestas verificadas en PostgreSQL16; NO bloquea la elección visual AUTO/MOTO. Último código 5b1e887b18d7b67a371a12308e468c2abdee3066, 4/4 SUCCESS. Ruta de prueba apps/mobility-expo/server/g103-cross-service-two-postgres-sessions-ci.py, SQL G103_ONE_ACTIVE_PASSENGER_AUTO_MOTO_* en docs/backend/staging_only.

**Regla de lectura:** una secuencia de submódulos QA no demuestra que un usuario pudo conducir, comprar, pagar, chatear o terminar un viaje real en celulares. No usar esto para afirmar una app 100% completa.

## 6. TRABAJOS REALIZADOS POR ARQUITECTO B — CLIENTE Y ADMIN (R1–R79)

**R1–R33:** esqueleto y rutas de la app Cliente Expo y Admin Web, sesiones aisladas, validación de DTO, historial privado paginado sin límite total de 50, soporte, carrito/comercios, seguimiento, cotización PYG, cancelación idempotente y accesibilidad.
**R34–R66/F1:** consumo de mensajería y marcadores G55, chat privado, autorización por cuenta y revocación, checkout protegido, QA de catálogo/stock y sucursales, Cliente/Admin con seguridad e incidentes, pruebas por sesión/race; Admin tipado y separado de Driver; F1 libro de booking/estado.
**R67–R77:** búsqueda G90, lectura Client sobre mismo booking, recuperación G73/G95/G94 tras ACK perdido/reinicio; Admin G75 lectura MFA QA de auditoría del AUTO. No usar estado fake Driver ni PSP.
**R78:** módulo MOTO_RIDE Cliente con estado y comprobantes G100 12/10/2, cotización aceptada, reserva, cancelación, readback y límites por identidad; pantalla apps/movete-cliente/app/moto.tsx. Está bloqueada por gate API MOTO externo no certificado, apropiadamente.
**R79:** gateway HTTPS fijado a origen, JWT Passenger, revisión de sesión, cinco rutas G101 independientes, control MIME/redirects/timeout y recuperación; siete flags MOTO false por defecto, sin activarlos en ausencia de PostgreSQL persistente y legal MOTO.
**Admin Web:** roles y vistas de backoffice, KYC, zonas, incidents, comercios/finanzas bajo gating; falta flujo real operativo de supervisión, reembolsos, soporte en vivo y postviaje contra backend autorizado.

**Hecho importante con respecto al último Owner UX:** R79 conecta una pantalla /moto separada y el Home tiene botones para /viaje y /moto. **NO sustituye el requisito más reciente:** listado comparativo AUTO/MOTO elegibles en la misma experiencia con destino, precios y elección libre antes de confirmar. Esta función está PENDIENTE de B en el corte.
**Contrato y orden UX enviado en issue #9:** https://github.com/mezas3238-hue/Qore-mobile-/issues/9#issuecomment-6405766000. Ese comentario parte de seis imágenes reales que Owner adjuntó en chat; revisarlo antes de cambiar UI.

## 7. LOS CUATRO SERVICIOS: MATRIZ DE CIERRE FUNCIONAL

| Servicio | Funciones en código/QA | Faltantes E2E reales, responsables | Estado de salida |
|---|---|---|---|
| AUTO pasajeros | G73→G103 cotización, reserva, subsidio, estados y cancelación, colas Driver y lecturas Admin; B Cliente/Admin | A: IdP/JWT, HTTPS, PG persistente, ruta/GPS autenticados, Driver G38/KYC, llegada/inicio/completado, pagos; B: selector con precio, app real instalada, historial/calificación; E2E mismo tripId | PARCIAL_QA / NO_GO |
| MOTO pasajeros | G100–G103 cotizar, reservar, cancelar, 12/10/2 y bloqueo de doble reserva; B R78/R79 | A: gate legal de pasajeros/seguro/casco, flota/Driver MOTO, rutas MOTO reales, despacho y tracking, HTTPS/PG; B: selector unificado y UX física; toda la cadena E2E | PARCIAL_QA / NO_GO |
| ENVÍOS AUTO/MOTO | Contratos SQL/Node, oferta/repartidor y custodia/reintentos en QA, pantallas B | Cotización oficial, prueba pickup/entrega, custodia de paquete, foto/firma autorizadas, reintentos, trazabilidad, cancelación/refund, soporte, QA con 2 equipos+Admin | PARCIAL_QA / NO_GO |
| COMERCIOS | Catálogos/stock/pedidos/checkout de QA, supermercados/farmacias/restaurantes frontend B | Comercios autenticados y stock reales, checkout transaccional, pago autorizado, preparación→courier→entrega, sustituciones, reclamos y Admin, trazabilidad E2E | PARCIAL_QA / NO_GO |

**Transversal:** chat, notificaciones, historial, KYC/vencimientos, emergencia, precios, cobros y soporte requieren pruebas con proveedor/evidencia real y dispositivos.

## 8. INVENTARIO DE FUNCIONES TODAVÍA NO TERMINADAS — SIN OCULTAR BLOQUEOS

### P0-A (arquitecto A: backend, DB, Driver, infra)
A1. Backend central accesible por HTTPS desde Cliente/Driver/Admin usando entorno STAGING autorizado, no localhost; configurar secrets, certificados, origen, rate limits, JWKS/verificación real JWT, logging PII-safe.
A2. PostgreSQL persistente STAGING con migraciones de producción separadas de *_CI_ONLY.sql, backup cifrado, PITR, retención, restore probado, RLS de mínimo privilegio y cola fiable; costo previo al aprovisionamiento.
A3. Mapas/ruteo/GPS oficiales con proveedor autorizado, geocerca de cobertura real y distinción cobertura vs disponibilidad. No aceptar geografía de fixtures como validación.
A4. Integrar Driver autenticado, vehículo verificado, KYC real de 8 documentos/aplicación PY, fecha de vencimiento/notificación, suspensión atómica en oferta y aceptación y recertificación automática solo con evidencia independiente válida. Verificar políticas locales AUTO/MOTO y seguro/moto casco.
A5. G38 resolver emisor confiable de autorización legal/geocerca con evidencia externa auténtica y GPS real. No agregar backdoor para forzar aceptaciones positivas.
A6. Hacer viaje AUTO completo en un MISMO tripId y SAME DB: quote→consent→book→offer→accept→arriving→in_progress→completed→receipt/historia/Admin→liquidación simulada y, cuando Owner autorice PSP, conciliación real.
A7. Adaptar MOTO_RIDE para búsqueda de motociclista, despacho, consentimiento/casco/seguro y ciclo completo; hoy G100 booking solo searching/cancelled. Reutilizar componentes comunes seguros, no confundir servicio ni auto habilitar.
A8. ENVÍOS AUTO y MOTO end-to-end: remitente → cotización→repartidor→retiro→custodia→entrega confirmada por receptor→Admin con identidad, cronología, prueba y controversia.
A9. COMERCIOS end-to-end: tienda, catálogo, stock bloqueado, carrito, pedido, preparación, courier, entrega, recibo y cierre; protección de farmacia por categoría regulatoria.
A10. Comunicación bidireccional real: chat cifrado/privado con asignación válida, notificaciones push autorizadas, revocación, idempotencia y logs de entrega/lectura, fallos/reconexión y abuso.
A11. Cobro/PSP y payout aprobados: tarifa/campaña, ledger inmutable, conciliación contable, charge/refund, disputas y comisiones correctamente definidas por servicio, sin exposición de datos de tarjeta.
A12. Seguridad operativa: SOS, denuncias, anticlonación/anti-fraude, seguro, seguridad vial, privacidad, auditoría, retención/borrado, RBAC/MFA proveedor real, firmas, rate limits, rotación de claves, alertas.
A13. Pruebas de carga, restore, failover, caos controlado, latencia y costes; instrumentalización productiva sin secretos ni PII en logs; publicación condicionada al GO Owner.
A14. Evolución de esquema: evitar acoplamiento indefinido de dos tablas de viajes; planificar contrato de estados/IDs universal por service_kind, manteniendo compatibilidad G73/G100 y restricciones G103, sin refactor riesgoso antes de F1 cerrado.

### P0-B (arquitecto B: Cliente/Admin)
B1. Implementar pantalla nativa principal de selección visual de movilidad conforme a las SEIS CAPTURAS Owner: mapa y destino, tarjetas/listado AUTO/MOTO con clases, precio final y subsidio 10% si fuente auténtica, disponibilidad real, botón SELECCIONAR. Alternar antes de reservar sin bloqueo G103.
B2. Integrar precio separado de AUTO G73 y MOTO G101 según elección, sin cálculo local, sin perder selected service al navegar; descartar/reconsultar cotización al cambiar modalidad/origen/destino. No crear segunda reserva hasta confirmación.
B3. Estado activo legible: búsqueda, oferta, Driver verificado, ETA real, trayecto, cancelación, reanudación tras reinicio, comprobante e historial; errores/conflictos G103 deben mostrar viaje activo, sin elección automática.
B4. MOTO seguridad/helmet/1 plaza conforme requisitos, accesibilidad, sin mezclar con moto envío; no activar gate remoto mientras A no certifique.
B5. ENVÍOS AUTO/MOTO: flujos, paquete, tipo de vehículo, recogida/entrega, prueba autorizada y tracking; COMERCIOS: categorías, tiendas, carrito, checkout, confirmación, entrega/historial.
B6. Admin conectado a backend HTTPS: revisión auténtica KYC, zonas/cobertura, control de flota, incidentes, soporte, pedidos/entregas, disputa/comisión/finanzas; MFA real y permisos por rol.
B7. Historial tipo Actividad con datos completos y paginación sin topes, detalle rutas y recibos comprobados, repeticiones y calificaciones solo tras completion.
B8. Pruebas nativas físicas en Android/iOS, posicionamiento, cámara/documents, permisos, background/foreground, falla de red, sesión, accesibilidad, datos protegidos; builds instalables STAGING solo con autorización y app Driver separada.

### Dependencias OWNER/externas (bloqueos reales para activar STAGING)
E1. Presupuesto y autorización previa por proveedor/recursos: elegir infraestructura (Render/Supabase/etc.), DB gestionada, dominio/HTTPS, auth, mapas, notificaciones, PSP; no crear nada pago sin aprobación. En consulta antigua no había servicios Render ni proyectos Supabase; verificar estado actual read-only antes de afirmar.
E2. Credenciales, emisor/seguro/documentos legales y obligaciones municipales reales PY para AUTO/MOTO y paquetería; no simular firma G38 ni declararse legalmente autorizado.
E3. Aprobación de tarifas comerciales, zonas y programa constante de subsidio 10% con financiamiento; aprobación final del Owner para STAGING físico, distribución y GO comercial tras certificación.
E4. Inscripción/distribución en stores, operaciones de soporte/seguridad, onboarding y políticas públicas; exposición de PII y datos reales solo con base legal, controles y autorización.

**Si E1–E4 bloquean una acción:** registrar dependencia exacta en issue #9 con condición de desbloqueo, NO desplegar ni gastar, avanzar un test/función P0 dentro del dominio permitido, sin pausas artificiales.

## 9. ARQUITECTURA OBJETIVO PARA SER SUPERIOR A BOLT/UBER: MEDIBLE, NO PUBLICITARIA

**Estado:** arquitectura PROYECTADA, no implementada/medida toda ella. No atribuir estas tecnologías al producto hasta que los archivos/certificaciones lo demuestren. Las APIs comerciales de Bolt/Uber no son públicas como código y no se propone copiar stack propietario.

### 9.1 Planos y responsabilidades
- Apps: Cliente y Driver Expo separadas, Admin Web, auth fuerte, sesiones revocables, colas/offline controlado, GPS consentido, acceso por rol, app móvil accesible.
- API: edge HTTPS autenticada, control de origen/token/caducidad/nonce, limitadores, versionado de contratos, idempotency keys, captcha/risk cuando corresponda, API por país y servicio bajo same source contract.
- Negocio: servicios de pricing/quotes, booking/trip state machine, dispatch/offers, Driver KYC/compliance, zones/coverage, payments/ledger, shipments/custody, commerce/catalog/orders, chat/notifications, incident/safety, analytics/audit. Pueden iniciar en monolito modular bien delimitado; microservicios solo cuando los límites y carga los justifiquen.
- Datos: PostgreSQL administrado, índices B-tree/geoespaciales cuando exista autorización, transacciones ACID, outbox transaccional para side effects, workers idempotentes, snapshots y almacenamiento sensible cifrado. Prohibir SQL cliente sin RLS y prohibir usar SDK directo para saltar negocio.
- Operación: colas durables, reintentos acotados, dead-letter, cancelación de ofertas ya vencidas, reconciliador, health checks, métricas RED, trazas con correlación tripId/requestKey, alertas, runbooks, backup+restore y auditoría.
- Multi-país: countryId, currency (PYG/ARS/BRL/UYU/BOB), timezone, locale, servicios/seguros/retenciones/regulaciones/zona/versión tarifaria por país, particionado/aislamiento gradual. Paraguay primero; capacidad y réplica/region extra solo según uso y permiso.

### 9.2 Objetivos SLO PROPUESTOS para aprobación y benchmark
No son SLAs existentes ni resultados comprobados: disponibilidad backend objetivo >=99.95% mensual tras madurez de operaciones; tiempo de respuesta P95 endpoints internos críticos <=500 ms SIN confundir latencia externa de mapas/PSP; cotización P95 medida end-to-end y presupuesto por proveedor; cero dobles booking/charge por idempotencia; cero asignaciones Driver con KYC vencido; entrega de push con métricas de éxito/reintento y sin leaks; restauración de backup ensayada con objetivo RPO <=5 min y RTO <=60 min cuando presupuesto y servicio lo permitan. Medir por ciudad/red móvil real y comparar UX y éxito de flujo con experiencias propias observables de mercado (no afirmar benchmarks Bolt/Uber sin datos).

**Atributos competitivos que debe perseguir Movete Fácil:**
- Mejor UX: un selector AUTO/MOTO visible, precio/subsidio transparente, menos pasos, estado confiable y cancelación sin opacidad.
- Seguridad: bloqueo documental ANTES de toda oferta/asignación, verificación legal real, SOS, soporte e historial íntegro.
- Confiabilidad: reservas/idempotencia y recuperación ante ACK perdido, reintentos acotados, GPS sin fantasías y cero viajes fantasmas.
- Escalado económico: zona a zona y país a país, infra compartida segura y consumo progresivo, costes medidos por viaje, protección frente a abuso.
- Observabilidad: flujo rastreable Cliente→Driver→Admin con mismo identificador, métricas de latencia/error/venta/driver supply y alertas accionables.

### 9.3 Costos y regla de aprovisionamiento
A entregar antes de gastar: comparativa por proveedor de región y latencia real Paraguay, cuotas de PostgreSQL/backup, HTTPS, auth mensual y SMS, mapas geocoding+routing+ETA, almacenamiento de KYC cifrado, SMS/push, observabilidad, comisiones PSP y firma de apps/stores; costos fijos y variables en rangos para 100/1.000/10.000 viajes/día; límites de presupuesto y alertas. Presentar al Owner y obtener consentimiento expreso ANTES de crear servicios. No habilitar multi-región sin demanda operativa y seguridad suficientes.

## 10. PLAN DE EJECUCIÓN INMEDIATA — SIN MÁS CIENTOS DE COMMITS INCONEXOS

### Fase 0: 15 minutos de auditoría (no hacer otro handoff antes de código)
- Leer ESTE handoff y los históricos, PR #7/#8, issue #9, HEAD y CI actuales. Validar G103 y OpenAPI 1.0.0-g101 sobre HEAD, el estado B del selector, rutas actuales, flags externos y gates.
- Clasificar por función: IMPLEMENTADO_QA / BLOCKED_EXTERNAL / STAGING_E2E_CERTIFIED / NATIVE_CERTIFIED / COMMERCIAL_GO. NO_GO si faltan pruebas.
- Si existe trabajo paralelo, no pisar HEAD; usar expected_sha y ramas independientes.

### Fase 1: B selector + A contratos de 2 opciones, EN PARALELO
- B implementar Home→destino→tarjetas AUTO/MOTO→cotización propia→elección libre→confirmación y precio. Test de UI interactivo, persistencia de elección, accesibilidad, caducidad, errores, G103 solo en booking, screenshot/inspección en emulador/QA.
- A consolidar API cotizaciones comparables AUTO/MOTO sin habilitar mapas falsos, preservar backend authoritative pricing, verificar G103 y contrato uniforme de disponibilidad; integrarlo en staging real solo tras E1/E2. A no modifica UI B.
- Critério PASS: cambiar AUTO/MOTO 20 veces no crea ni una reserva; confirmar AUTO solo produce AUTO, confirmar MOTO solo produce MOTO; las cotizaciones expiran correctamente; 10% se divulga correctamente donde existe campaña certificada.

### Fase 2: F1 AUTO end-to-end real
- A cierra Driver acceptance G38 y seguridad legal/issuer, PostgreSQL autorizado y HTTPS; B conecta Cliente/Admin al mismo servidor; escenarios happy path y negativos cancel/retry/revocation.
- 2 dispositivos físicos Cliente/Driver + Admin Web en sesión independiente; mismo tripId/quote/booking y no fugas; estado searching→accepted→arriving→in_progress→completed; KYC vigente, GPS/trip location consent, chat, comprobante e historial; batch contable coherente.
- Si falta aprobación E1/E2: no fingir END-TO-END. Registrar bloqueo; seguir cerrando contratos/observabilidad/QA con pruebas de transporte de valores reales no mutados.

### Fase 3: MOTO de pasajeros E2E y transportes/logística
- MOTO con licencia/seguro/casco/emisor legal, Driver adecuado, oferta/aceptación y estados completos. Coste/transferencias autorizados.
- ENVÍOS particulares con AUTO y MOTO, prueba de recogida/custodia/entrega.
- COMERCIOS de restaurante/supermercado/farmacia: pedido, autorización, stock, repartidor, entrega e incidencias.

### Fase 4: hardening, carga y despliegue gradual (requiere permisos)
- Tests adversariales y concurrencia de reservas/dispatch/mensajes; red lenta, pérdida de red, reinicio, GPS, documento vencido, fraude y cancelación; backup/restore, secretos, MFA, privacidad, pruebas nativas, observabilidad, SLO.
- Recalcular 17 gates P0 y 20 recorridos, hacer reporte de costes, preparar rollout por zonas PY, canary, rollback, kill switches; Owner decide GO.

## 11. EVIDENCIA Y CRITERIO DE ACEPTACIÓN POR FUNCIÓN

- **AUTO y MOTO selección:** VIDEO/QA UI + screenshot de pantalla unificada, selección sin booking, dos presupuestos distintos fuente backend o marca de indisponibilidad, confirmación modal, tratamiento conflicto; CI B exacto.
- **Quote/booking:** POST solo en confirmación; JWT Passenger, quote_id, serviceKind y requestKey; READ propietario mismo tripId/revisión; segunda confirmación duplicada no crea trip nuevo; cotizaciones alteradas denegadas.
- **G103:** test cross-service ida y vuelta, dos conexiones PG con carrera y serialización, lectura estado tras cancelación, nunca usado como bloqueo de UX.
- **Driver:** evidencias de identidad/vehículo/seguro/KYC/issuer, verificador oficial, prueba física, oferta invisible a otros, aceptación sin duplicación, revocación inmediata. Nunca "verified" de un fixture.
- **GPS/ETA:** origen/destino reales con proveedor, GPS consentido, sin dummy, estado de exactitud y desconexión, update chronology.
- **Mensajería:** dos móviles, ambos JWT, asignación válida y vigente, read/ACK server, bloqueo tras cancelación/reasignación.
- **Finanzas:** montos redondeados correctamente, 10% subsidio y 5%/2% retención sobre F, contra-asientos reversados, PSP independiente autorizado, mismo ledger en Admin.
- **COMERCIOS/ENVÍOS:** transacción de cada servicio cerrada con event_id, idempotencia, prueba entrega y lista en Admin.
- **Operación:** endpoints/DB misma región o justificación, métricas logs sin secretos, disparadores de alerta, rollback, soporte y emergencia.
- **Reporte:** función completada, PR/sha, tests y workflows del mismo sha, SQL/HTTP/2 teléfonos/HTTPS y roles, estatus real, bloqueos y siguiente acción. No números de commits como resultado.

## 12. RIESGOS ABIERTOS CON PRIORIDAD

- RISK_P0_EXTERNAL: no hay evidencia de PostgreSQL remoto autorizado, IdP JWKS/HTTPS funcional móvil, GPS/route provider y firma legal KYC. No resolver con variables fake, RLS desligada ni mocks.
- RISK_P0_OWNER_UX: hoy B usa rutas AUTO y MOTO separadas; seis screenshots Owner exigen selector conjunto y comparador de precios, NO bloqueado por G103.
- RISK_P0_MOTO_LAW: servicio de pasajeros MOTO requiere validar legalidad local, casco, seguro, habilitación y zona antes de activar asignación; no confundir courier moto con moto taxi.
- RISK_P0_FINANCE: ledger provisional G93/G100 y reversos no son PSP ni evidencia de dinero movido; 10% constante exige política real de financiación y vencimiento.
- RISK_P0_G38: emisor/firma GPS legal independiente no disponible; no falsificar certificación para lograr happy path.
- RISK_P0_CLOUD_COST: servicios nuevos facturables requieren presupuesto y consentimiento; Render/Supabase 0 a corte previo, revalidar.
- RISK_P0_SECURITY: datos KYC/rostro sin controles reales de cifrado/retención/residencia/no-logs/consentimiento; Admin MFA QA stub no real.
- RISK_P1_SCHEMA: G100/MOTO y G3/AUTO tablas separadas; G103 serializa por auth.users; monitorear bloqueos/deadlocks, no asumir escalabilidad producción hasta prueba de carga y una migración de esquema planificada.
- RISK_P1_G4_G96: compatibilidad NOT VALID del push check es QA, nunca migración de producción directa. La consulta de elegibilidad antes de envío tiene carrera potencial con cancelación; definir política real con lease idempotente y auditar proveedor.
- RISK_P1_ROUNDING: entero PYG y descuentos/comisiones con redondeo; definir política uniforme antes del PSP.
- RISK_P1_GEO: regiones/PY reales y cambios entre ubicaciones; cobertura ≠ disponibilidad.
- RISK_P1_B_DEP: B consume OpenAPI QA G101 con flags externos false; evitar activación de bandera por estética/para mostrar screenshot.

## 13. ARCHIVOS, DOCUMENTOS Y ENLACES IMPRESCINDIBLES

**Repositorio:** https://github.com/mezas3238-hue/Qore-mobile-
**A PR #7:** https://github.com/mezas3238-hue/Qore-mobile-/pull/7
**B PR #8:** https://github.com/mezas3238-hue/Qore-mobile-/pull/8
**Issue #9:** https://github.com/mezas3238-hue/Qore-mobile-/issues/9
**Instrucción exacta de UX Owner para B:** https://github.com/mezas3238-hue/Qore-mobile-/issues/9#issuecomment-6405766000

**Historial detallado A:**
- docs/handoff/HANDOFF_MAESTRO_ARQUITECTO_A_G0_G66_CONTINUIDAD_SIN_PAUSAS_2026-10-24.md.
- docs/handoff/HANDOFF_MAESTRO_ARQUITECTO_A_G0_G70_KYC_RENOVACION_CONTINUIDAD_2026-10-24.md.
- docs/handoff/HANDOFF_MAESTRO_A_B_G0_G91_R67_F1_FUNCIONES_INSTALABLES_CONTINUIDAD_2026-10-25.md.
- docs/handoff/HANDOFF_MAESTRO_GLOBAL_A_B_G91_R67_CONTINUIDAD_2026-10-25.md.
- docs/handoff/ANEXO_A_HISTORIAL_GITHUB_714_COMMITS_AL_HEAD_G48_2026-10-23.md y ANEXO_A_G58E_A_G66_175_COMMITS_2026-10-24.md.
- apps/mobility-expo/docs/backend/staging_only/G72_*, G73_*, G81_*, G82_*, G85_*, G87_*, G90_*, G93_*, G94_*, G95_*, G96_*, G100_*, G103_*.
- apps/mobility-expo/server/g98-f1-auto-postgres-loopback-e2e-ci.mjs.
- apps/mobility-expo/server/g101-moto-passenger-gateway.mjs.
- apps/mobility-expo/server/g102-moto-passenger-pg-http-ci.mjs.
- apps/mobility-expo/server/g103-cross-service-two-postgres-sessions-ci.py.
- apps/mobility-expo/docs/backend/openapi/movete-facil-staging.openapi.json.
- .github/workflows/mobility-g4-postgres-disposable.yml.

**Historial detallado B:**
- docs/architect-b/HANDOFF_MAESTRO_ARQUITECTO_B_R1_R66_F1_PRIORIDAD_FUNCIONES_CERTIFICADAS_2026-10-24.md.
- docs/architect-b/R78_MOTO_G100_PASSENGER_QUOTE_BOOK_CANCEL_2026-10-25.md.
- docs/architect-b/R79_MOTO_G101_HTTP_PASSENGER_2026-10-25.md.
- apps/movete-cliente/app/index.tsx, viaje.tsx, moto.tsx, envios.tsx, comercios.tsx, historial.tsx.
- apps/movete-cliente/src/domain/g100-moto-passenger-flow.mjs, g101-moto-passenger-http-gateway.mjs.
- apps/movete-admin/**.
- docs/architect-b/CERTIFICACION_INTEGRAL_R60_MATRIZ_VERIFICABLE_2026-10-24.json.

## 14. NIVELES DE EVIDENCIA QUE NUNCA SE DEBEN CONFUNDIR

1. DESARROLLADO: existe código/ruta/pantalla.
2. QA_PASS: pruebas sintéticas, SQL disposable y HTTP localhost, con SHA y log exactos.
3. STAGING_E2E_PASS: servicio HTTPS real autorizado, proveedor JWT, PostgreSQL PERSISTENTE y operaciones con cuentas reales de prueba separadas sobre un mismo ambiente, sin dinero comercial.
4. NATIVE_PASS: 2 apps instaladas en 2 dispositivos Android/iOS permitidos, GPS/push/sesión/reintentos probados, Admin separado.
5. COMMERCIAL_GO: legal, seguros/KYC, prevención de fraude, PSP contabilidad, soporte/SOS, carga/DR, 17 gates y 20 recorridos actualizados, autorización Owner.

Estado HOY: funciones G95–G103 QA_PASS, partes A/B desarrolladas y QA_PASS, SIN pruebas 3–5 suficientes para un GO. La palabra SUPERIOR a Bolt/Uber solo puede utilizarse luego de mediciones y aceptación.

## 15. INSTRUCCIÓN AUTOSUFICIENTE PARA PEGAR EN EL NUEVO CHAT

ASUMÍ el rol de arquitecto sucesor de QORE Mobile / Movete Fácil y continuá TRABAJANDO EN GITHUB, NO SOLO PLANIFICANDO. Fuente soberana: https://github.com/mezas3238-hue/Qore-mobile-. Abrí primero este Handoff Maestro Global A+B G103/R79 en docs/handoff, PR #7 Arquitecto A y PR #8 Arquitecto B, ambos DRAFT, issue #9 y los respectivos HEAD/CI actuales. Respetá separación A Backend/Driver/PostgreSQL/OpenAPI/infra, B Cliente Expo/Admin Web. Último código A 5b1e887b18d7b67a371a12308e468c2abdee3066, 4/4 CI y 835/835 Node; B 57ea8169ee19c3d3242418ed26dcb02173e5ace7, 3/3 CI y 268/268 Admin. No declares terminada una app por pasar QA local.

MANDATO OWNER: Movete Fácil para Paraguay con cuatro servicios: AUTO personas, MOTO personas, ENVÍOS particulares con AUTO/MOTO, COMERCIOS de supermercado/farmacia/restaurantes. Dos apps nativas separadas Cliente/Driver, Admin Web, backend + PostgreSQL persistente. La experiencia de elección debe ser como las seis capturas de Bolt/Uber que el Owner adjuntó: mapa, origen/destino, opciones AUTO/MOTO en el mismo panel, tarifa y 10% de subsidio verificados, el pasajero ELIGE libremente el vehículo, confirma SOLO cuando quiere. G103 limita DOS RESERVAS ACTIVAS, NO prohíbe comparar/cambiar AUTO ↔ MOTO antes de confirmación. No copiar logos ni código, hacer sistema propio mejor por UX, seguridad, confiabilidad, costos, escalabilidad y benchmarks verificables.

PRIORIDAD: (1) B construye y prueba selector real unificado; A asegura cotización/availability independientes, (2) F1 AUTO completo Cliente→Driver→Admin con mismo tripId, quote/consent/idempotencia, G38/KYC real, GPS legal, llegada/inicio/completado, ledger/historial; (3) MOTO pasajeros equivalente con permisos/seguro/casco; (4) ENVÍOS/COMERCIOS completos, (5) instrumentación y resiliencia regional. Iniciar por función P0 disponible, realizar cambios de código/pruebas CI y reportar SHA y nivel de evidencia. Si el proveedor legal, STAGING persistente o costo necesita autorización Owner: dejar bloqueo EXACTO documentado en issue #9 y continuar otra acción que sí se puede realizar, SIN PAUSAS. Prohibido MERGE, LIVE, despliegue/provisión de recursos facturables, PSP/pagos, datos privados reales, distribución de apps sin autorización. No alterar rama del otro arquitecto. Terminar mostrando función cerrada, CI del mismo SHA, bloqueos y siguiente paso.

---

**FIN DEL HANDOFF MAESTRO. No equivale a GO. El siguiente arquitecto comienza EJECUTANDO FUNCIONES CERTIFICABLES; no redacta otro plan antes de avanzar.**

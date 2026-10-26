# QORE MOBILE / MOVETE FÁCIL — HANDOFF MAESTRO GLOBAL A+B
## Entrega de continuidad, código realmente probado, faltantes por vertical y orden de ejecución
**Corte:** 26 de octubre de 2026 — hora de Paraguay.
**Soberanía:** https://github.com/mezas3238-hue/Qore-mobile- (incluir el guion final).
**A:** PR https://github.com/mezas3238-hue/Qore-mobile-/pull/7 — rama feature/mobility-monorepo-isolated-20261016.
**B:** PR https://github.com/mezas3238-hue/Qore-mobile-/pull/8 — rama feature/mobility-cliente-admin-parallel-20261022.
**Issue de interfaz A/B:** https://github.com/mezas3238-hue/Qore-mobile-/issues/9.
**HEAD A comprobado ANTES de publicar este documento:** 3500c8019cf953ce9ef9197e1593e21b773088f8.
**HEAD B comprobado:** 5aa117dda5af35ff2d934d4b926a8faae0704791.
**Decisión comercial vigente:** NO_GO. No autoriza merge, producción, gastos, infraestructura de terceros, pagos ni publicación.
**Política del Owner:** entregar funciones operativas de extremo a extremo, no cientos de commits, módulos aislados o documentos para aparentar avance.

---

## 0. ORDEN INNEGOCIABLE AL SIGUIENTE ARQUITECTO

CONTINUAR INMEDIATAMENTE SIN DETENERSE, excepto por un bloqueo REAL que no pueda resolverse con trabajo autorizado en GitHub. Si aparece un bloqueo legal, de credenciales o de recursos aún no contratados: dejar evidencia precisa, NO saltar controles y pasar inmediatamente a la siguiente tarea independiente que aporte funcionalidad. NO preguntar otra vez decisiones ya aprobadas; NO reabrir debates ya cerrados; NO reiniciar el proyecto.

**Primero GitHub, TODO el trabajo técnico posible ahí:** desarrollar, conectar A+B, ejecutar Node/TypeScript/SQL/PostgreSQL16 desechable y tests de integración; preparar código y configuración nativa. **Después**, solamente cuando las funciones estén correctamente integradas y con autorización expresa de costos, conectar infraestructura externa como Render/Supabase y efectuar STAGING remoto, dispositivos reales, test de distribución, despliegue y tiendas. Un servicio real no puede validarse completamente sin un backend accesible y persistente: documentar esta dependencia sin fingir que GitHub Actions equivale a producción.

**Distribución aprobada por el Owner:** el cliente y el conductor descargarán sus DOS apps independientes desde Google Play Store y Apple App Store. NO distribuir APK sueltos como producto final ni proponer APK por WhatsApp como salida. Preparar Android AAB para Play y iOS IPA firmado para App Store/TestFlight cuando corresponda; NO inscribir cuentas, firmar, subir ni lanzar sin aprobación. GitHub web export NO ES build Android/iOS.

**Prohibiciones:** no merge PR #7/#8, no READY, no LIVE, no activar pagos, no VPS, no recursos de Render/Supabase/Railway/Lovable sin presupuesto previo y autorización, no probar con PII/biometría real en CI, no diluir RLS/JWT/MFA/KYC/G38 por aprobar tests, no credenciales en repo, no afirmar disponibilidad/ETA/GPS/PSP a partir de mocks, no cobros ni reversión PSP real. Lovable únicamente apoyo visual de interfaz final si el Owner lo autoriza: jamás reemplaza backend o apps Expo.

---

## 1. PRODUCTO APROBADO Y META DE COMPETENCIA

**Marca:** Movete Fácil / QORE Mobile. Mercado inicial Paraguay por zonas autorizadas. Preparar arquitectura multi-país gradual para Paraguay, Argentina, Brasil, Uruguay y Bolivia sin pagar infraestructura regional prematuramente.

**Cuatro verticales, todas obligatorias:**
1. AUTO: transporte de PERSONAS en automóviles, modalidades solo donde flota/cobertura/legal lo soporten.
2. MOTO: transporte de PERSONAS en motocicletas. NO sustituir ni confundir con entregas MOTO. Exige condiciones legales, casco, seguro y KYC específicos.
3. ENVÍOS: paquetes/documentos por AUTO o MOTO, elegidos según capacidad, custodia, peso, elegibilidad y seguro; flujos independientes de pasajeros.
4. COMERCIOS: supermercados, farmacias, restaurantes y otros negocios: alta/compliance, catálogo, variantes, stock, carrito, sustituciones, pedido, preparación, asignación, entrega y conciliación.

**Apps separadas y soberanía de dominios:**
- App Cliente Expo: apps/movete-cliente/** — selección explícita AUTO/MOTO, también ENVÍOS y COMERCIOS; historiales y soporte.
- App Driver Expo: apps/movete-driver/** — conductor/repartidor según permisos, documentos, turnos, ofertas, viaje/entrega, chat y estados.
- Admin Web: apps/movete-admin/** — operación, KYC, zonas, incidentes, tarifas, pedidos, auditoría.
- Backend Node/contratos + PostgreSQL16: apps/mobility-expo/** (contiene backend histórico; la demo Expo allí NO es la app Driver definitiva).

La interfaz debe usar patrones funcionales familiares de Bolt/Uber: origen/destino, mapa verificado, selector claro AUTO/MOTO, tarjetas precio/servicio, seguimiento, conductor confirmado y actividad. **No copiar código, marca, activos gráficos, apariencia distintiva propietaria ni asumir conocimiento de sus sistemas internos.** Aspirar a superar a Bolt/Uber en seguridad, estabilidad, soporte, claridad de tarifas, cobertura auténtica y observabilidad con métricas verificables; NUNCA declarar que ya somos superiores sin datos comparables.

**Regla G103:** Cliente decide libremente AUTO/MOTO y cotiza ambos ANTES de reservar. Se limita a UNA reserva de pasajeros activa por usuario después de confirmar; al cancelar por acción explícita y verificar en servidor se libera la posibilidad de una nueva. Esto no bloquea comparar vehículos ni presupuestos.

---

## 2. ECONOMÍA COMERCIAL SOBERANA (SE CALCULA EN BACKEND, NUNCA EN MÓVIL)

| Transporte de personas | Comisión nominal sobre tarifa base | Subsidio CONSTANTE al Cliente | Retención bruta Movete Fácil | Parte bruta Driver | Pago Cliente |
|---|---:|---:|---:|---:|---:|
| AUTO | 15% | 10% | 5% | 85% | 90% |
| MOTO | 12% | 10% | 2% | 88% | 90% |

Ejemplo QA MOTO base Gs. 11.000: subsidio 1.100, Cliente paga 9.900, Driver 9.680, Movete Fácil retiene 220. Montos brutos antes de posibles impuestos, procesamiento de pagos, seguros, soporte y fraude. **No es margen neto ni recaudación real.** Comisión y subsidio se anclan a precio/versión y ledger oficial, nunca a cálculo mutable de UI.

**Corrección A G93 verificada:** el recibo de subsidio referencia el mismo fareVersion del presupuesto G73, mientras campaignId identifica independientemente la campaña. Antes se confundían versión de campaña y versión de tarifa; la integración B fallaba su comprobación. Corregido y contrastado por SQL CI.

**Política 10% constante:** la vigencia de campañas/promociones de QA no satisface por sí sola la política sostenida del Owner. Antes de LIVE, diseñar fondeo, vigencia/renovación real y auditoría financiera sin falsos plazos, junto con coste de subsidios. ENVÍOS/COMERCIOS tienen tarifas diferenciadas propias pendientes de validación comercial; NO extrapolar automáticamente 15% o 12%.

---

## 3. FOTO DE GITHUB CONFIRMADA EN ESTE CORTE

### Arquitecto A — PR #7 DRAFT
- HEAD base del corte: 3500c8019cf953ce9ef9197e1593e21b773088f8.
- Cuatro workflows SUCCESS en ese SHA:
  1. Node STAGING: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40365706258
  2. PostgreSQL16 disposable: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40365706072
  3. Expo aislado: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40365706108
  4. Dos apps aisladas: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40365706229
- Log Node principal: 852/852 PASS; otras baterías separadas: 106/106, 5/5, 8/8, 9/9. Son distintos jobs/cortes, NO sumar sin controlar duplicados.
- Script QA G109 contiene prueba G111 de las clases REALES de dominio de la app Driver (G65), no solo llamadas Node ad hoc.
- Trabajador G113 validado: reintento debido con backoff PostgreSQL, cierre irrevocable tras cancelación, bajo guardas CI y sin habilitación LIVE.

### Arquitecto B — PR #8 DRAFT
- HEAD base del corte: 5aa117dda5af35ff2d934d4b926a8faae0704791.
- Tres workflows SUCCESS en ese SHA:
  1. Límite de ownership: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40358318847
  2. Admin QA y build: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40358318740
  3. Apps aisladas/Cliente: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40358318729
- Log Cliente: 1.076/1.076 tests PASS, 0 fallos; Admin 268/268 PASS. Typecheck/export web NO implica apps móviles firmadas.
- Último progreso: Cliente verifica automáticamente un viaje completado contra su historial privado, una vez por identidad y viaje, tras confirmación autorizada.

**GitHub Actions de este corte no exhibe artefactos nativos firmados (AAB/IPA):** las 4 ejecuciones A consultadas tenían 0 artifacts. La matriz de lanzamientos declara NATIVE_RELEASES bloqueado. No confundir WEB export con lanzamiento. Los primeros tres niveles de QA nunca sustituyen DEVICE_PASS ni COMMERCIAL_GO.

**IMPORTANTE:** crear este handoff genera un commit nuevo en A; el sucesor debe volver a leer HEAD A/HEAD B y CI POR SHA, porque el CI anterior no certifica automáticamente el SHA de documentación ni futuros cambios. No congelar estas referencias como estados eternos.

---

## 4. TRABAJOS HECHOS — FUNDACIÓN HISTÓRICA A (G0–G91)

**G0–G22:** monorepo separado, environments dev/staging/prod con secretos externos; Auth/roles y PostgreSQL16, permisos/RLS; demo viaje AUTO, ofertas privadas, aceptación, estados, Driver/vehículos y primera elegibilidad; envíos por Auto/Moto, catálogos/comercios, pedidos, tarifas/ledger, primeros bloqueos documentales y seguridad.

**G23–G48:** historial paginado privado (G26), backoffice/Admin con roles/MFA (G27–G30), cobertura vs disponibilidad real (G31), ubicación autorizada y antirreplay Driver (G32–G35), exclusión transaccional de una tarea por Driver (G36), transiciones y consistencia (G37), compuertas legales territoriales G38, protección de ofertas y fraude, JWT/provider/revocación, catálogo/stock y privilegios mínimos de BD. NO desactivar fences para conseguir test verde.

**G49–G70:** chat autorizado Cliente–Driver, inbox, historial, ACK/marcador leído, redacción de PII, protección ante mensajes fuera de asignación, estados/custodia de envíos, G65 lifecycle Driver, reintento ante commit incierto, bloqueo y renovación de documentos, perfiles y seguridad. La existencia de endpoints no certifica un chat físico con push en dos dispositivos.

**G71–G91:** KYC y expediente integral con documentos, rostro, vencimiento y revocación; distintas habilitaciones por servicio y municipio, G73 cotización y booking server-first, G74 estado, G75 Admin F1, G78 elegibilidad, G81/G82 candidatos y ofertas, G85 outbox durable de dispatch, G90 estado de despacho. En QA, G71 exige expediente de ocho evidencias aprobado y G38 bloquea asignación sin autorización local; son controles deliberados. G73 y G85 no equivalen por sí solos a Driver disponible.

---

## 5. TRABAJOS NUEVOS A REALIZADOS/CERTIFICADOS G92–G113 EN GITHUB

| Grupo | Función efectivamente implementada/probada en laboratorio | Límite |
|---|---|---|
| G92–G93 | cotización/contrato y subsidio AUTO 15/10/5, versión de tarifa y campaña separadas | campaña QA, sin PSP |
| G94 | reserva provisional y ledger reversible con cuatro asientos y conciliación | no dinero cobrado/reembolsado |
| G95–G96 | cancelación idempotente, revisión GET, cierre de ofertas/outbox y protección contra aceptación tardía | no usuario real |
| G97–G99 | HTTP loopback respaldado por PostgreSQL16, same tripId Cliente+Admin MFA antes y después de cancelar | local CI |
| G100–G103 | MOTO pasajeros cotiza/reserva/cancela, números 12/10/2, G103 prohíbe dos viajes activos AUTO/MOTO por pasajero | sin asignación real de motorista |
| G104 | rechazo persistente por KYC/ley, sin atribuir conductor no elegible; un ensayo de aceptación positiva se descartó por violar condiciones | positivo NO autorizado |
| G106 | recuperar viaje Driver asignado por endpoint privado, no PII cruzada, rutas HTTP reparadas | QA |
| G107 | código REAL Cliente B contra backend A: quote → subsidio → booking → GET seguimiento → Admin → cancelación → ledger en un tripId PG16 | sin Driver asignado |
| G108 | código REAL Cliente B MOTO contra A: quote → booking → cancelación con PG16 y 12/10/2 | sin viaje MOTO completado |
| G109 | viaje aceptado con conductor SINTÉTICO independiente creado ANTES de instalar G38; luego llega, inicia y completa; Driver/Rider mismo revision, slot G36 liberado | NO enlaza G73 comercial posterior a G38 |
| G110 | historial privado G26 del mismo viaje AUTO completo y aislamiento de otras cuentas | solo HTTP+SQL CI |
| G111-AUTO | app Driver real: controlador G65 y codec HTTP nativo mandan 3 POST únicos y 4 GET de verificación para accepted→arriving→in_progress→completed; terminal bloqueado | mismo fixture sintético G109 |
| G111-DISPATCH | booking real G73 activa un trabajador G85, G90 consulta cola, replay no duplica y cancelación la cierra | sin nuevos Driver autorizados |
| G112 | worker verifica elegibilidad y reintentos de una reserva persistente, sin saltar ley ni atribuir disponibilidad | QA-only |
| G113 | inicio y tick periódico de reintentos debidos; backoff 30s, idempotencia, cierre por cancelación, parada limpia | no proceso online 24/7 |

**Evidencia combinada CLAVE:** https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40365706072.
Buscar en el log de real-schema-chain los literales:
- G107 CROSS-BRANCH PASS
- G108 CROSS-BRANCH PASS
- G109 PASS
- G111 PASS: Native Driver G65 controller...
- G113 PASS

**Dos ensayos complementarios; NO declararlos un único journey aún:**
A) G107: booking de Cliente B (G73) llega a backend A PG16; al estar G38 en vigor no hay conductor legal habilitado, y se verifica cancelación.
B) G109/G111 móvil: un viaje AUTO QA con driver sintético autorizado ANTES de G38 completa todo el ciclo y se libera slot, pero no nace del booking genuino del Cliente B del ensayo A.
La próxima brecha decisiva es unir ambos sin crear KYC o licencias falsamente verificadas, ni eliminar G38. Un test verdaderamente comercial positivo requerirá permiso/zona/KYC reales y entorno aprobado.

---

## 6. TRABAJOS NUEVOS B REALIZADOS DESDE G103/R79

| Área | Evidencia implementada | Pendiente |
|---|---|---|
| Selector Cliente | pantalla de elección AUTO/MOTO y estado privado de origen/destino; cambio de sesión limpia datos | mapa/ruta/precios en dispositivos, accesibilidad y diseño final |
| Inicio de sesión | MOTO G101 restaura reserva guardada por GET tras login tardío, rotación JWT o reinicio; no repite booking | IdP HTTPS real y SecureStore en Android/iOS |
| Cancelación | G95 AUTO recuperación tras ACK incierto, logout y reinicio, lectura privada con GET | redes/PSP reales |
| Seguimiento AUTO | confirmación G73 desencadena exactamente un GET de estado y abre tracking si misma cuenta, mismo tripId y revision; falla cerrado | GPS/ETA verificados, Driver real, pérdida de red en teléfonos |
| Historial AUTO | se verifica fin de viaje en historial privado una vez por viaje y sesión (HEAD B reciente) | precios/rutas/recibos finales reales, persistencia remota |
| Admin | backoffice UI/contratos y MFA QA, 268/268 pruebas | operaciones reales de KYC, territorios, soporte, fraudes, pagos, auditoría |
| MOTO Cliente | G100/G101 real en CI con backend A por G108 | cascos, legalidad, seguros, matching Driver MOTO y ejecución en móviles |
| Envíos / Comercios | existen interfaces, contratos y tests históricos de pedidos, logística y custodia | E2E completo con repartidor y comercio auténticos |

**No confundir:** 1.076 tests Cliente / 268 Admin son pruebas unitarias e integración local. NO constatan rendimiento ni funcionamiento instalado en tienda.

---

## 7. ESTADO HONESTO POR VERTICAL (26-OCT)

| Vertical | Código y CI verificable | Faltantes para funcionar de extremo a extremo |
|---|---|---|
| AUTO pasajeros | G107 reserva y cancelación real HTTP+PG; G109/G111 Driver completa fixture; G113 dispatch/retry | unión G73→oferta legal→aceptación Driver sobre mismo tripId, Auth real, KYC/zonas, GPS, dispositivos, PSP y Admin operativo |
| MOTO pasajeros | G108 B↔A 12/10/2 cotizar, reservar, cancelar, reversión | driver moto elegible, asignación/ofertas, aceptar→arribar→recoger→completar, GPS, seguros casco/ley, Admin y equipos reales |
| ENVÍOS AUTO/MOTO | módulos SQL, ofertas, custodia/historial y UI QA | cotizar→pedir→asignar vehículo idóneo→recoger→confirmar custodia→entregar→POD→facturar/cancelar→Admin sobre mismo deliveryId |
| COMERCIOS | catálogo, pedido, stock, almacenes, sustituciones, rutas Admin/Cliente QA | onboarding comercio auténtico, catálogo real, disponibilidad, checkout, preparación, courier, prueba entrega, reclamos, ledger y conciliación |

**Regla universal de terminación:** un flujo solo se declara completo cuando existe la misma identidad/ID y secuencia persistida en Cliente, Backend/PostgreSQL, Driver o Courier, y Admin, con pruebas de errores/reintentos/cancelación y los gates legales. QA_PASS no equivale a STAGING_E2E_PASS o DEVICE_PASS.

---

## 8. PLAN DE EJECUCIÓN OBLIGATORIO PARA SUCESOR — PRIORIDAD POR VALOR REAL

### P0-1: AUTO mismo viaje extremo a extremo
1. Verificar el HEAD exacto en PR #7 y #8, revisar issue #9 y logs G107/G109/G111/G113. No empezar otra auditoría de commits.
2. Estabilizar contrato mínimo versionado compartido: routeId, quoteId, bookingKey, tripId, driverId, vehicleId, offerId, revision, eventKey, currency PYG, nominal/subsidy/net, status, expiresAt; misma nomenclatura y errores entre A/B.
3. Combinar el booking G73 de B con el worker G112/G113 y G81/G82, manteniendo G71 documentos y G38 cerrojo legal. Probar negativo sin licencia; positivo solo con escenario explícitamente autorizado y fuente verificable. **NO insertar una falsa habilitación legal para forzar positivo.**
4. Driver recibe oferta privada, acepta exactamente una vez (DRAFT/CI), su controller G65 verifica estado; Cliente/AUTO seguimiento y Admin G75 ven mismo tripId en cada revision.
5. Llegada, recogida, viaje completado, liberación de G36 y historial G26; auditoría de ledger G93/G94/G95, sin PSP real. Añadir rechazo por conductor equivocado, reserva cancelada, documento vencido, conflicto de otro viaje, HTTP perdido tras commit, JWT revocado, indisponibilidad y GPS ausente.
6. Acoplar UI final Cliente/Driver/Admin al mismo contrato. El éxito se mide por prueba integral y videos/dispositivos posteriores, no por aumento de commits.
**Evidencia de salida:** un test CI A+B+PG16 con un único tripId y todas las etapas permitidas, más matriz de bloqueos reales pendientes de Auth/KYC legal externo. No mentir sobre habilitación territorial por usar fixture.

### P0-2: MOTO viajeros, no mensajería
Aplicar el mismo ciclo con Driver y vehículo MOTO, casco, seguro, habilitación, seguridad, asignación y finalización. Política 12/10/2 inmutable. No usar código/estatus de delivery para el viaje de una persona.

### P0-3: ENVÍOS completos
Paquetes por AUTO o MOTO, selección correcta de categoría, ítems prohibidos/restringidos, peso/volumen, tarifa por modalidad, asignación, custodia, PIN/foto/firma o evidencia permitida, entregado vs cancelado, historial del remitente y panel Admin; integración SQL real con IDs estables.

### P0-4: COMERCIOS completos
Supermercados, farmacias, restaurantes y otros. Comercio KYC, horarios, catálogo/variantes, carrito, inventario reservado, sustituir/agotado, pedido recibido→aceptado→preparado→listo→recogido→entregado, courier por AUTO/MOTO, devoluciones autorizadas, ledger y estado Admin/Cliente mismo orderId. Información sensible de farmacia con privacidad/legalidad y restricciones locales.

### P0-5: seguridad funcional y operación
KYC ocho evidencias, documento vencido→bloqueo instantáneo del backend y notificación, renovar→validar→re-habilitar legítimamente; anti-duplicidad, fraude, accidentes y SOS, denuncias, ocultación del teléfono, chat privado con lectura y push posterior, soporte, panel de incidencias y revocación. Admin controla zonas, servicio por modalidad, tarifas/10%, auditoría y estadísticas, sin convertir cobertura en disponibilidad.

### P1: preparar build y certificación para tiendas DESDE GITHUB
- Ya existen dos apps Expo con paquetes Android distintos: com.movetefacil.cliente y com.movetefacil.driver; identificadores iOS correspondientes.
- CI actual usa TypeScript/tests + expo export web; no compilación Android/iOS firmada ni AAB/IPA; artifacts no disponibles.
- Preparar pipeline reproducible de builds nativos POR APP, sin gastar ni desplegar; Android AAB para Play, iOS IPA para App Store, versionCode/buildNumber, firma en secretos, iconos, splash, permisos mínimos, nombre, política privacidad, accesibilidad, capturas y checklist de tienda.
- NO distribuir APK suelto a usuarios ni confundir pruebas unitarias con instalación. iOS signing/App Store Connect y Play Console dependen de cuentas del Owner/autorización posterior. Internal builds cuando autorizados son para pruebas, no lanzamiento.

### P2: despliegue externo ÚNICAMENTE DESPUÉS de aprobación
Proponer presupuesto detallado por Render/Supabase, IdP, Auth/DB/Storage/Backups, HTTPS, mapas/rutas, SMS/push, PSP, dominios, monitorización, almacenamiento KYC, cuentas Apple/Google, servicios legales/seguros, observabilidad y reservas de gasto. Pedir decisión del Owner sobre proveedor/región/costo ANTES de crear recursos. Luego STAGING persistente con datos de prueba, E2E de tres roles y dispositivos; finalmente producción y tiendas únicamente con GO firmado.

---

## 9. ESTÁNDAR DE EVIDENCIA / CRITERIOS DE ACEPTACIÓN

**IMPLEMENTADO:** código integrado con interfaces concretas y tipos, sin garantizar respuesta real.
**CI_QA_PASS:** Node+SQL PostgreSQL desechable+HTTP loopback, fixtures sintéticos, errores adversos, idempotencia y test reproducible.
**NATIVE_BUILD_PASS:** binarios Android AAB/iOS IPA reproducibles, compilación/firmas/metadata/compatibilidad probadas en entorno autorizado, sin publicar.
**STAGING_E2E_PASS:** identidad real de pruebas, backend HTTPS, PostgreSQL persistente y roles Client/Driver/Admin sobre un mismo ID, con logs.
**DEVICE_PASS:** apps independientes en Android y iPhone físicos, permisos, GPS, redes, segundo plano, suspensión, reconexión, notificaciones, fotos, seguridad y seguimiento reproducibles.
**COMMERCIAL_GO:** todos los servicios y controles críticos con evidencias, licencias, seguros, privacy/terms, KYC, pagos, soporte y 24/7, aprobación explícita del Owner y rollout por zona.

**Nunca llamar “certificado de producción” a SUCCESS de GitHub Actions.** Distinguir lectura de actualizaciones server-sourced de ETA/GPS calculados en frontend. No simular conductor, viaje, pago o comercio “abierto” sin fuente.

**Gates de lanzamiento en** docs/architecture/MOVETE_FACIL_LAUNCH_GATES_2026-10-24.json: 17 IDs: IDP_BACKEND_AUTH, HTTPS_BACKEND, POSTGRES_PERSISTENCE, DRIVER_ONBOARDING, DRIVER_LIVE_TRIPS, CLIENT_LIVE_BOOKINGS, PAYMENT_SETTLEMENT, PRIVACY_KYC, EMERGENCY_SAFETY, MAPS_GPS_DEVICE, DELIVERY_MERCHANTS, CHAT_PHYSICAL, ADMIN_OPERATIONS, NATIVE_RELEASES, LEGAL_COMPLIANCE, OPS_24_7_MONITORING, PROD_GO_NOGO. El manifiesto histórico es NO_GO y no debe cambiarse por un test local. Ejecutar scripts/check-movete-launch-gates.mjs y exigir referencias de verificación independientes para un futuro GO.

**Casos negativos esenciales:** usuario ajeno 401/403/404; transiciones fuera de orden 409; dos reservas activas G103; dos asignaciones Driver G36; licencia vencida/revocada; municipio sin G38; oferta expirada; ACK incierto que no duplica reserva/aceptación/cobro; cancelación vs aceptación carrera; pérdida GPS; dos conexiones PostgreSQL compitiendo; push fuera de sesión; fallo PSP/reserva y conciliación; restauración ante apagón.

---

## 10. CONDICIONES PARA “INFRAESTRUCTURA SUPERIOR A BOLT Y UBER”

Tomar SOLO referentes públicos y comparar cuando haya mediciones propias y verificables. NO conocemos su topología privada. Arquitectura propuesta, no resultado actual:

1. Backend API versionada por contrato; una sola fuente de verdad transaccional en PostgreSQL; eventos durables outbox + workers idempotentes; desacoplamiento de cotización, matching, lifecycle, mensajería, comercios y pagos.
2. Multi-país lógico: countryCode, moneda, zona IANA, idioma, impuestos, reglas de servicio, seguros, KYC/legal y tarifas por jurisdicción; separación estricta de datos sensibles y autoridades nacionales; rollout gradual.
3. Escalabilidad verificable: métricas de latencia p50/p95/p99 en cotización, búsqueda, aceptación, GPS y recuperación, SLO de disponibilidad, colas/lag, fallos de entregas y MTTR. Definir umbrales basados en capacidad real y pilotos; no declarar p99 o 99.99% sin medir.
4. Seguridad demostrable: RLS least privilege, MFA Admin, antifraude, revisiones de permisos, cifrado, minimización PII, consentimiento GPS, retención/borrado KYC, controles antifuga entre Cliente/Driver/Comercio.
5. Integridad de transacciones: no doble despacho, no doble trabajo Driver, dinero contabilizado, reconciliación PSP, ledger inmutable, recuperación tras caídas, backups y restauración REALMENTE ENSAYADA.
6. Operación centrada en usuario: precios transparentes 10% subsidio financiado, ETA solo medido, disponibilidad real y cancelación clara, atención a seguridad e incidentes, accesibilidad, soporte local y capacidad regional.
7. Pruebas de carga, chaos, staging multirrol y resiliencia en redes móviles antes de afirmar superioridad. No comprar infraestructura futura antes de demostrar demanda.

---

## 11. OWNERSHIP, CÓMO TRABAJAR SIN PISARSE

**A posee:** apps/mobility-expo/**, apps/movete-driver/**, backend/API/OpenAPI, SQL/PostgreSQL, Auth y seguridad del servidor, scripts compartidos de integración, .github/workflows/**, docs/handoff/** y docs/architecture/**.
**B posee:** apps/movete-cliente/**, apps/movete-admin/**, docs/architect-b/** y sus pruebas. No modificar A desde B ni B desde A. Cualquier test cross-branch debe consumir el código de B con checkout SHA pinneado, como G107 y G108, sin fusionar ramas.

Antes de tocar una ruta, leer head del PR y verificar quién la posee. En issue #9 colocar contrato, SHA consumidor, ruta, método, payload exacto, status/error, JWT/rol, idempotency/revision, test A+B CI y responsables de siguiente corrección. Si el head avanzó, aplicar cambio a HEAD actual, nunca pisar un commit del otro arquitecto.

**Economía del esfuerzo:** 1 problema concreto → parche mínimo → prueba integral reproducible → 1 commit funcional → evidencia. Evitar handoffs recurrentes por inercia. El presente handoff se emite porque lo pidió expresamente el Owner.

---

## 12. PRIMEROS 30 MINUTOS DEL SUCESOR (SIN PEDIR PERMISO PARA LEER/EDITAR QA)

1. Leer este handoff y los dos PR. Verificar HEAD de A y B y CI SUCCESS/FAIL por SHA exacto, sin asumir que los SHAs anteriores son actuales.
2. Ejecutar/inspeccionar los tests G107, G108, G109, G111 y G113; revisar dónde se separan el G73 nuevo y el fixture pre-G38 de G109.
3. Elegir una modificación concreta que reduzca esa separación sin aflojar KYC/G38. Priorizar composición de dispatch G112/G113, Controller Driver G65, G75 Admin y estado Cliente sobre el mismo tripId. Si la aprobación legal positiva es realmente imposible sin autorización externa, demostrar su denegación y pasar a un vertical no bloqueado.
4. Agregar evidencia CI nueva que ejercite código REAL de las apps, no adaptadores manuales, como los ensayos G107 (B Cliente) y G111 (Driver). Simular red/desconexión/replay/409, chequear PostgreSQL y asegurar NO_GO.
5. Continuar inmediatamente con MOTO Driver y, después, ENVÍOS/COMERCIOS de extremo a extremo.
6. Preparar build reproducible de Android AAB/iOS IPA desde GitHub cuando la lógica y configuraciones estén coherentes, manteniendo publicación bloqueada hasta autorización.
7. Informar al Owner únicamente: función real realizada, PR/commit, test verificable, bloqueo auténtico y próximo paso de mayor impacto. Nunca usar el número de commits como KPI.

**Plantilla de evidencia:** “Implementado [flujo], Cliente/Driver/Admin [mismo ID], PostgreSQL [persistencia+revisions], [tests y links], [nivel QA/native/staging/device], [restricciones/ley/PSP], [siguiente bloqueo real]”.

---

## 13. ARCHIVOS CRÍTICOS Y REFERENCIAS PARA NO EMPEZAR DE CERO

**A, prueba de Cliente real y PG:** apps/mobility-expo/server/g98-f1-auto-postgres-loopback-e2e-ci.mjs (G107), .github/workflows/mobility-g4-postgres-disposable.yml.
**A, MOTO Cliente real y PG:** apps/mobility-expo/server/g102-moto-passenger-pg-http-ci.mjs (G108).
**A, Driver real y PG:** apps/mobility-expo/server/g109-driver-auto-completion-pg-http-ci.mjs (G109/G110/G111).
**A, worker:** apps/mobility-expo/server/g113-auto-dispatch-retry-worker.mjs, g113-auto-dispatch-retry-pg-ci.mjs; G85/G90/G112/G113 SQL en apps/mobility-expo/docs/backend/staging_only/.
**A, seguridad:** G20/G36/G38/G71 y scripts CI_ONLY.sql de la cadena, G65 Driver lifecycle; no ejecutar esos SQL en DB remota.
**B, Cliente:** apps/movete-cliente/src/domain/client-experience.mjs; f1-auto-ride-continuation.mjs; g100-moto-passenger-flow.mjs; g101-moto-passenger-http-gateway.mjs; app/viaje.tsx y app/transporte.tsx.
**B, Driver A:** apps/movete-driver/src/domain/driver-trip-lifecycle.mjs y driver-trip-lifecycle-http.mjs; apps/movete-driver/app/viaje.tsx.
**B, Admin:** apps/movete-admin/**; verificar conexión real G75 y circuito operativo.
**QA de apps:** .github/workflows/movete-apps-isolation.yml: typecheck + test + export web solamente.
**Manifest de NO_GO:** docs/architecture/MOVETE_FACIL_LAUNCH_GATES_2026-10-24.json.
**Handoffs históricos completos:** docs/handoff/HANDOFF_MAESTRO_GLOBAL_A_B_G103_R79_CONTINUIDAD_UX_INFRA_2026-10-25.md y docs/architect-b/HANDOFF_MAESTRO_GLOBAL_A_B_G103_R79_CONTINUIDAD_SIN_PAUSAS_2026-10-25.md. Leerlos solo para detalles heredados, no aceptar conclusiones obsoletas.

---

## 14. ACTA DE ENTREGA AL PRÓXIMO CHAT

El siguiente arquitecto tiene **mandato para continuar YA**, sin confirmaciones repetidas de tareas de GitHub, con prioridad **AUTO mismo tripId Cliente→dispatch legal→Driver→Admin→PG16**, seguida por MOTO viajeros, ENVÍOS y COMERCIOS completos. NO actuar como si todas las aplicaciones ya estuvieran terminadas por tener 4/4 y 3/3 CI verdes. Todo lo no demostrado en dispositivos, autenticación HTTPS persistente y autorización legal sigue pendiente.

**Conservar NO_GO y PR DRAFT; no Render/Supabase, publicación ni costos hasta orden posterior.**

**Definición de éxito final:** Cliente y Driver independientes, Admin, backend y DB interoperables, las CUATRO verticales funcionales y seguras, verificadas en teléfonos y entorno aprobado, listas para ser publicadas oficialmente en Play Store y App Store. Un sistema propio y mediblemente mejor, no una copia ni un reporte de commits.

**FIN DEL HANDOFF MAESTRO — CONTINUAR TRABAJO REAL INMEDIATAMENTE.**

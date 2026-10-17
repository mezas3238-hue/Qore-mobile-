# HANDOFF MAESTRO INTEGRAL — QORE Mobile / ViajeYa — 16 de octubre de 2026

**OBJETIVO:** transferir íntegramente el contexto, estado verificable, pruebas, investigaciones, problemas, decisiones y trabajo faltante para que un NUEVO ARQUITECTO continúe la aplicación de movilidad solicitada por el propietario. **NO es una declaración de aplicación terminada.**

**FECHA DE CORTE:** 2026-10-16; verificación del trabajo en el PR #3 cuyo HEAD antes de este handoff era 27b92b1ba321d4bd77eba7b1685a24f875ea2400. El commit que incorpora este documento será posterior al baseline citado.

**REPOSITORIO:** https://github.com/mezas3238-hue/Qore-mobile-
**RAMA DE TRANSPORTE:** feature/viajeya-expo-mvp-20261015
**PR #3 TRANSPORTE (ABIERTO, DRAFT, SIN MERGE):** https://github.com/mezas3238-hue/Qore-mobile-/pull/3
**RAMA PRINCIPAL:** main; no incorporar cambios sin revisión. **NO intervenir en qore-core, CIBO o certificación de traders para completar la app de transporte.**
**PROYECTO AUXILIAR BACKEND:** https://lovable.dev/projects/2fa91fe1-e7a0-4fff-a16f-7d457b2d6eed (nombre visto en Lovable: «Movete Facil»; en el código móvil se usa marca provisional «ViajeYa by QORE»). El proyecto en Lovable NO está publicado. La cuenta/workspace agotó créditos durante una solicitud posterior de construcción de UI: la creación original dejó un backend Supabase y la portada estaba en plantilla.

---

## 0. INSTRUCCIONES AL PRÓXIMO ARQUITECTO — LEER ANTES DE ESCRIBIR

1. **Este es el trabajo de MOVILIDAD**: plataforma paraguaya de viajes de pasajeros tipo Bolt/Uber, con AUTOMÓVILES Y MOTOCICLETAS, app pasajero, app conductor, vehículos, administración, mapas, cotizaciones, pagos, comisiones y operación. No confundir con Bolt.new (creador de apps).
2. **Problema crítico descubierto en el repositorio**: hay una segunda línea de desarrollo completamente distinta (QORE trading supervision) en Flutter, PR #2, mientras el transporte es React Native/Expo, PR #3. No fusionar ramas automáticamente. Ver §2.
3. Trabajo de transporte verificado en **HEAD del PR #3**, NO en main. Leer el árbol ACTUAL del PR al comenzar; los SHA citados son una foto temporal.
4. Todo lo habilitador de viajes reales permanece BLOQUEADO. En src/services/production-api.ts **LIVE_TRIPS_ENABLED = false**. La app no presta viajes, no procesa pagos, no tiene despacho real ni usa GPS de conductor de forma productiva.
5. En el código móvil el 10% se aplica solo a DEMO/investigación. En la base Supabase observada el commission_pct = **15% para las tres categorías de auto**. No confundir ni cambiar automáticamente las tarifas reales.
6. No prometer «más barato que todos», «rentabilidad del conductor garantizada» o servicios de seguros/24h todavía inexistentes. Fuentes públicas de competencia no equivalen a cotización contemporánea.
7. El dueño quiere un producto **muy moderno/vanguardista y económicamente ventajoso para conductores**, competitivo para pasajeros, accesible en Paraguay, con capacidades diferenciadoras medibles.
8. Avanzar con **código + tests + documentación + GitHub** sin interrumpir para confirmar cada microtarea; preguntar solamente decisiones con implicancias reales de producto/costos, y respetar gates de seguridad.
9. **Nunca imprimir, subir ni usar service-role de Supabase, claves API no restringidas, documentos de identidad reales, tokens de pago, contraseñas, ni información personal.**
10. La prueba de repositorio actual, 14/14, no sustituye QA en Android/iOS, E2E Supabase, inspección de pólizas ni validación financiera/legislativa.

## 1. VISIÓN DE PRODUCTO Y CONDICIONES DEL USUARIO

- Empresa/plataforma: QORE Mobile; nombre de cara al cliente provisional **ViajeYa**. Identidad propia; evitar uso de marcas, logos y UI protegida de Bolt/Uber.
- País/moneda: **Paraguay / guaraníes (PYG)**. Primera investigación y posible piloto: **Asunción y Gran Asunción**; luego estudiar Ciudad del Este, Encarnación y otras zonas con legislación y economía local.
- Transporte de pasajeros con **automóviles y motocicletas**. NO tratar motos como «Económico». El transporte de envíos en moto sería un producto distinto y futuro.
- Tres roles: **pasajero, conductor, operador/administrador**; una persona puede tener roles múltiples sólo bajo permisos explícitos del servidor.
- Registro pasajero: identidad básica, celular, email/autenticación, consentimiento, perfil, accesibilidad, historial y facturas/recibos.
- Registro conductor: identidad, teléfono, licencia aplicable, foto/documentos, verificación humana, estado pendiente/aprobado/rechazado, sanción/suspensión, seguro, legalidad local.
- Registro de vehículos: patente, marca, modelo, año, color, tipo auto/moto, categoría, titularidad, documentación, seguro, inspecciones y vigencias. Asociar **vehículo concreto aprobado** al viaje y conservar snapshot.
- Pasajero: ubicación solo con permiso, origen/destino, mapa, ruta, ETA, precio previo explicable, elección auto/moto/categoría, conductor y vehículo asignado, seguimiento protegido, chat/llamada segura, valoración, soporte, cancelación.
- Conductor: disponibilidad voluntaria, viaje ofertado con dinero que recibirá + kilómetros hasta recoger + duración/ingreso estimado, aceptación/rechazo, navegación Waze/Google Maps, progreso de viaje y ganancias/wallet.
- Admin: aprobación verificada, reglas de tarifa/comisión con versionado, gestión de viajes, usuarios, vehículos, incidentes, pagos, liquidaciones, auditoría y antifraude.
- Pagos: **efectivo** para primer piloto, **QR/tarjeta** tras integrar una pasarela local contratada; comisión y deuda en efectivo; liquidaciones digitales y conciliación.
- Diferenciación concreta: FairPrice, Driver OS, Smart Pickup, Driver Wallet, Moto Safe, UX accesible español/guaraní, movilidad recurrente, soporte confiable, transparencia de cobros y asistencia basada en IA con límites de seguridad.
- Ambición comercial: conductor gana **más por hora conectada y después de costos**, no solamente un porcentaje mayor por viaje; pasajero tiene precio competitivo, plataforma sigue solvente.

## 2. BLOQUEO ARQUITECTÓNICO P0 — DOS PRODUCTOS DIFERENTES EN EL MISMO REPOSITORIO

**Esto NO estaba suficientemente explicitado durante el desarrollo del transporte; es el principal hallazgo de la revisión para el handoff.**

### Línea A: QORE Mobile Trading / Supervisión (ANTERIOR y en curso por separado)

- **PR #2:** https://github.com/mezas3238-hue/Qore-mobile-/pull/2
- Rama **agent/qore-mobile-foundation-001**, HEAD observado **4608aeb2519262cef42f722b43caffdfd455701b**.
- **Issue #1:** https://github.com/mezas3238-hue/Qore-mobile-/issues/1
- Arquitectura existente: **Flutter Android/iOS, Python Gateway read-only**, contratos multi-account/multi-trader, dispositivos con sesiones firmadas Ed25519, estados LIVE/DELAYED/STALE, alertas, widgets Android/iOS, telemetría qore-core, sin ejecución de trading desde móvil.
- El issue #1 documenta considerable avance y tareas pendientes: publicador qore-core, Keychain/Keystore, biometría, enrolamiento, push FCM/APNs, widgets, seguridad y CI. Reportaba anteriormente bloqueos de runners GitHub en ese PR; no asumir que esos bloqueos sigan o estén resueltos sin comprobar.
- Normas de trading: no false LIVE, nunca comandos de MT5, multi-account y cero credenciales en móvil. **No modificar esta línea en la tarea de transporte.**

### Línea B: QORE Mobile MOVILIDAD (este handoff)

- **PR #3:** https://github.com/mezas3238-hue/Qore-mobile-/pull/3
- Rama **feature/viajeya-expo-mvp-20261015**; parte de main, distinto a Flutter; stack **Expo SDK 57 + React Native + TypeScript + Expo Router**.
- El main inspeccionado previamente tenía solo README; PR #2 y PR #3 son iniciativas divergentes, ambos DRAFT, NO fusionados.
- Ambas pretenden ser app raíz y requieren decisiones de propiedad de identificadores de paquete, infraestructura CI, auth, Apple/Google stores y marca.

**ACCIÓN P0 con el propietario/arquitectura:** decidir si mantener ambos productos en un **monorepo con directorios independientes** (p.ej. apps/trading-flutter, services/trading-gateway, apps/mobility-expo y servicios separados) o **mover movilidad a repositorio separado** manteniendo trazabilidad histórica. NO mezclar app Flutter y Expo en la raíz mediante merge simple, ni renombrar/eliminar el trabajo del PR #2 sin autorización. La solicitud actual del usuario es continuar el producto de movilidad; preservar el otro.

## 3. HISTORIA CRONOLÓGICA DE LA LÍNEA DE MOVILIDAD

1. El usuario preguntó por app parecida a Bolt; aclaró que era **«Bolt pedí un viaje»**, no Bolt.new.
2. Se creó proyecto auxiliar Lovable con intención full-stack: perfiles pasajero/conductor/admin, tablas Supabase, políticas RLS y funciones de viajes. Lovable terminó backend y dejó frontend pendiente; solicitud de UI posterior fue rechazada por workspace sin créditos.
3. El usuario escogió implementar en repositorio **Qore-mobile-**. Se creó prototipo Expo en rama de movilidad, demo con categorías auto, mapa esquemático y estados, sin viajes reales. PR #3 DRAFT.
4. Se agregaron registro pasajero, alta conductor+vehículo, foto de licencia en bucket privado, revisión administrativa protegida, navegación Google Maps/Waze y GPS con consentimiento.
5. Se investigaron pagos/comisiones: efectivo, tarjeta y QR, comisión a plataforma, saldo conductor, ledger, pagos de pasarela, deuda de efectivo, liquidación. **Sólo diseño**; SIN pasarela ni ledger real.
6. Investigación competitiva Paraguay: Bolt soporte en español indica **23% para automóviles / 20% para motos**; versión inglesa regional contradice autos con 20%; Uber automóviles usa comisión variable, Uber Moto tiene pases PAGOS que pueden reducir tasa de servicio semanal a 0% sobre viajes elegibles, no gratis. Documentado, no medido en recibos actuales.
7. Se cambió **comisión de DEMO a 10%** para autos. Moto: recomendación 10% inicial / 8% experimental promocional sólo si costos permiten; no hay categoría moto REAL aún.
8. Se elaboró estudio de auto+moto con tiempos vacíos, combustible, costos operativos e hipótesis de contribución, seguros/seguridad.
9. Se encontraron **siete rutas orientativas publicadas por Bolt Asunción**; se elaboró propuesta de precios **QORE FairPrice**, tres pisos. Se implementó motor puro src/domain/fairprice.ts, pruebas y pantalla /precios accesible desde inicio/admin.
10. Primer test FairPrice CI falló por afirmar erroneamente que ingreso conductor debía superar un **piso del precio pasajero**; se corrigió la prueba. Último HEAD antes de handoff **27b92b1...**, GitHub Actions **38823736658** terminó SUCCESS con **14/14 tests**, TypeScript y export web Expo. NO prueba build Android/iOS ni precios reales.
11. Este documento añade conocimiento de dos arquitecturas concurrentes, inventario actualizado del backend y plan integral de entrega.

## 4. INVENTARIO REAL DE CÓDIGO EN PR #3

**Ver árbol actual y no asumir que los archivos están en main.**

### UI Expo / rutas

- app/index.tsx — inicio, entradas a demo, registro, Waze/Maps y FairPrice.
- app/demo.tsx — pasajero en demo: origen, destino, categoría, tarifa ficticia, solicitud local.
- app/conductor.tsx — conductor ficticio, acepta/avanza viajes del mismo dispositivo, ganancias demo.
- app/admin.tsx — panel de métricas DEMO, rutas a revisión real y laboratorio.
- app/historial.tsx — recibos/historial ficticios.
- app/acceso.tsx, app/registro.tsx — auth/login y registro real SI Supabase está configurado.
- app/registro-conductor.tsx — registro de licencia y vehículo auto, no moto.
- app/perfil.tsx — perfil y estado solicitud.
- app/revision.tsx — admin (rol verificado por base), documentos privados y RPC aprobar/rechazar.
- app/mapas.tsx — integración con mapas/navegación.
- app/precios.tsx — FairPrice Lab, autos/motos, siete rutas y comparación orientativa con Bolt.
- app/acerca.tsx, app/privacidad.tsx — alcance/privacidad de prototipo.
- app/_layout.tsx — providers de auth y viajes.
- app.config.js + app.json — Expo config, Google Maps key en build cuando presente.
- src/components/UI.tsx, Form.tsx, NavigationLinks.tsx, LiveMap.native.tsx, LiveMap.web.tsx, LiveMap.tsx — componentes/reemplazos web/nativos, enlaces externos.

### Dominio/servicios

- src/domain/rides.ts — simulación local viajes y tarifas DEMO para economico/confort/xl (comisión 10%), estados y cotización aproximada Haversine. **NO es producción.**
- src/domain/rides.test.ts — 3 pruebas de estados, cotización, duplicados, rating.
- src/context/RideContext.tsx — estado local volátil; datos desaparecen al reiniciar; sin multiusuario real.
- src/domain/fairprice.ts — motor puro experimento auto/moto, tres pisos, objetivos/hipótesis de costo, cotizaciones de referencia orientativas Bolt.
- src/domain/fairprice.test.ts — 6 pruebas de aritmética/validación/comparación, sin datos de mercado vivos.
- src/domain/navigation.ts, src/domain/navigation.test.ts — enlaces Maps/Waze, geocoordenadas, validaciones.
- src/domain/registration.ts — validación de formularios.
- src/services/supabase.ts — cliente Supabase opcional con EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY; SIN service role. Si no hay configuración falla explícitamente.
- src/context/AuthContext.tsx — supabase email/password y perfil, no roles otorgados desde cliente.
- src/services/driver-registration.ts — carga documento en bucket privado driver-docs y ejecución RPC submit_driver_application.
- src/services/navigation.ts — Waze/Google Maps, permiso GPS controlado.
- **src/services/production-api.ts — LIVE_TRIPS_ENABLED = false** y requestProductionRide falla de forma cerrada.
- .env.example — variables públicas vacías, key Maps EAS restringida documentada.
- .github/workflows/ci.yml — npm install, npm run check y npx expo export --platform web.

### Documentación

- README.md — desarrollo, fases y limitaciones.
- docs/research/COMPETENCIA_BOLT_UBER_PARAGUAY_CONDUCTORES_2026-10-15.md
- docs/research/QORE_MOBILE_MODELO_PROFUNDO_AUTOS_MOTOS_PARAGUAY_2026-10-15.md
- docs/research/QORE_MOBILE_TARIFAS_FAIRPRICE_VANGUARDIA_2026-10-15.md
- docs/handoff/HANDOFF_MAESTRO_QORE_MOBILE_MOVILIDAD_2026-10-16.md (este).

### Cómo reproducir CI tras resolver estrategia de repositorio

- Checkout de la rama del PR #3 o commit indicado.
- Usar Node.js 22.13+; npm install --no-audit --no-fund; npm run check; npx expo export --platform web.
- Última ejecución verificada: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/38823736658
- **14 tests / 14 pass / 0 fail; TypeScript y web export correctos.** No afirmar que Android/iOS build, publicación EAS ni E2E Supabase se hayan probado.
- Antes de cualquier merge revisar PR #2, dependencia de workspace, licencia y aislamiento de runtimes.

## 5. BACKEND SUPABASE / LOVABLE — LO QUE SÍ EXISTE Y LO QUE NO

Proyecto: https://lovable.dev/projects/2fa91fe1-e7a0-4fff-a16f-7d457b2d6eed. Backend habilitado stack Supabase. La app Expo tiene código de conexión, pero **NO hay configuración de credenciales públicas probada end-to-end en esta rama ni un piloto de usuarios reales verificado**.

### Tablas inspeccionadas en public (10)

- profiles(id, full_name, phone, created_at)
- user_roles(user_id, role)
- driver_applications(user_id, full_name, phone, license_number, license_doc_path, status, review_notes, reviewed_at)
- vehicles(driver_id, plate, brand, model, color, year, category)
- driver_locations(driver_id, available, lat, lng, updated_at)
- fare_configs(country_code, city, currency, category, base_fare, per_km, per_min, min_fare, commission_pct)
- rides(passenger_id, driver_id, category, origen/destino geo y etiquetas, distance_km, duration_min, fare_estimate, commission_pct, currency, payment_method, status, timestamps)
- ride_events(ride_id, actor_id, from_status, to_status, timestamps)
- ratings y support_tickets.

**No existen tablas observadas** de payment_intents, payment_transactions, ledger_entries, settlement_batches, payout_items, refunds, subscriptions, driver_insurance, moto_documents, signed_fare_quotes ni fare_version_history.

**Bucket privado:** storage.buckets id/name = driver-docs, public=false. Reglas de lectura para titular/admin; inserción por carpeta auth.uid. La UI crea signed URL temporal para admin. Hay que auditar acceso, eliminación, expiración y retención de documentos.

**Roles/enums observados:** app_role = admin, driver, passenger. vehicle_category = **economico, confort, xl** (NO moto). ride_status = searching, accepted, arriving, in_progress, completed, cancelled. application_status = pending, approved, rejected. Actualmente vehicles tiene UNIQUE(driver_id): un vehículo por conductor. Futuro con varias unidades exige migración y selección/verificación del vehículo concreto por viaje.

### Tarifas CONFIGURADAS en Supabase que NO son las comerciales aprobadas

| Categoría | Base | Gs/km | Gs/min | Mínimo | Comisión |
|---|---:|---:|---:|---:|---:|
| economico | 5.000 | 2.800 | 300 | 12.000 | **15%** |
| confort | 7.000 | 3.600 | 400 | 16.000 | **15%** |
| xl | 9.000 | 4.500 | 500 | 20.000 | **15%** |

Asunción / PY / PYG. **Son seed/config base de backend**; no reflejan la propuesta 10%, no se han aplicado en viajes comerciales. No alterarlas silenciosamente.

### RPC inspeccionadas y observaciones

- submit_driver_application(_full_name,_phone,_license,_license_doc_path,_plate,_brand,_model,_color,_year,_category): registra solicitud y vehículo, status pending, no aprueba automáticamente.
- admin_review_driver(_app_id,_approve,_notes): verifica rol admin, aprueba/rechaza y asigna/quita rol driver. La app tiene checkbox humano de revisión, PERO el backend no verifica pólizas/licencias por autoridad: gate pendiente.
- has_role, is_approved_driver, handle_new_user, admin_stats.
- request_ride(_category,_origin_label,_origin_lat,_origin_lng,_dest_label,_dest_lat,_dest_lng): **calcula estimado en servidor con haversine ×1.3, tiempo por 22 km/h+3 minutos**, tarifa de fare_configs; crea ride searching. **NO usa Google Routes reales ni FairPrice.** En móvil está bloqueado llamar para viaje real.
- get_nearby_requests(): solicitudes a menos de 15 km en distancia Haversine, últimos 30 min, pickup_km geométrico; NO despacho optimizado ni ETA real.
- accept_ride(_ride_id): rol conductor aprobado/disponible, asignación condicional status searching.
- advance_ride, cancel_ride, rate_ride, set_driver_availability, get_ride_counterpart.
- RLS visibles en tablas principales para propiedad/participantes; las funciones SECURITY DEFINER necesitan revisión de privilegios/search_path/ejecución con JWT y adversarial tests.

**Hallazgo positivo de concurrencia:** índices únicos parciales existen en rides: one_active_ride_per_driver (accepted/arriving/in_progress) y one_active_ride_per_passenger (searching/accepted/arriving/in_progress). Esto protege doble activo incluso si un check de RPC tiene carrera; igual se necesitan pruebas de transacción/idempotencia y tiempos de respuesta en clientes.

**Riesgos que NO deben omitirse:** coordenadas aportadas por móvil/no atestadas, cotización sin ruta en calle ni tráfico, sin quote con expiración ni tarifa versionada, selección de vehículo no está congelada en ride (solo driver_id), falta diferenciación moto, transiciones de pago no existen, offline/reconnect, rol de admin inicial no configurado por autoasignación, falta deploy/registro end-to-end.

## 6. MAPAS Y NAVEGACIÓN — ESTADO E INTEGRACIÓN FUTURA

Implementado en móvil:
- Google Maps URL para navegación a destino (sin SDK/clave de servidor).
- Waze deep-link oficial para abrir Waze; **NO SDK de mapa interno**, no fuente de cotizaciones.
- Permiso explícito para GPS en primer plano; **no es rastreo compartido en vivo de viaje comercial**.
- Expo Maps nativo Google Maps en Android sólo con API key restringida a package/firma EAS y compilación nativa; iOS Apple Maps; fallback web/Expo Go esquema demo.

Pendiente:
- Google Routes **Compute Routes** validado por backend para distancia/duración/peajes y tráfico real; Google Routes **Compute Route Matrix** para asignación eficiente de conductores.
- Parámetro TWO_WHEELER para motos en Paraguay está documentado pero requiere revisar calidad, disponibilidad beta y advertencias; DRIVE para autos.
- Geocodificación/Places con costos/cuotas, precisión de lugares de pickup, zonas/habilitaciones, rutas difíciles/puentes/restricciones.
- No calcular precios comerciales desde haversine ×1.3 si el route provider falla. Enviar «no disponible» o fallback claramente gobernado; no facturar distancia inventada.
- GPS de conductor sólo con consentimiento y disponibilidad, actualizaciones protegidas, desconexión/posición obsoleta y purga posterior al viaje.
- Mapas embebidos, navegación vuelta a conductor, tracking ETA con realtime seguro y privacidad de datos.

Fuentes técnicas: https://developers.google.com/maps/documentation/routes/coverage-two-wheeled y https://developers.google.com/maps/billing-and-pricing/pricing ; Waze deep links https://developers.google.com/waze/deeplinks/.

## 7. INVESTIGACIÓN BOLT/UBER / PARAGUAY — EVIDENCIA Y LÍMITES

**FUENTES COMPETENCIA:** documentación Bolt PY español apunta 23% comisión auto / 20% moto; página regional Bolt en inglés presenta discrepancia de auto 20%. Uber auto tasa variable (NO asumir 25% Paraguay universal). Uber Moto y Envíos Moto introdujeron **pases pagados** en 2026 con tasa semanal elegible 0% después de cubrir costo del pase; no «gratis». No conocemos precio real contemporáneo del pase por cuenta/volumen. Ver investigaciones en docs/research.

**SIETE PRECIOS ORIENTATIVOS de páginas de rutas Bolt Asunción**, NO cotizaciones de cuentas en vivo ni verificación simultánea con Uber:

| Ruta | km | Economy auto (Gs.) | Moto (Gs.) |
|---|---:|---:|---:|
| Shopping del Sol → Shopping Mariscal | 2,8 | 11.511 | 7.704 |
| Multiplaza → Shopping Mariscal | 3,6 | 13.455 | 8.768 |
| Barrio Obrero → Shopping Mariscal | 8,3 | 25.682 | 15.456 |
| Barrio Obrero → Villa Elisa | 12,3 | 35.901 | 21.045 |
| Barrio Obrero → San Lorenzo | 17,9 | 50.452 | 29.005 |
| Barrio Obrero → Aeropuerto | 18,3 | 51.579 | 29.621 |
| Barrio Obrero → Capiatá | 25,3 | 69.609 | 39.483 |

URLs individuales y limitaciones constan en docs/research/QORE_MOBILE_TARIFAS_FAIRPRICE_VANGUARDIA_2026-10-15.md. No inferir secreto tarifa/km Bolt de esos puntos (km/min y condiciones correlacionados, contexto incompleto). No prometer superarlos en toda ruta.

**Investigación primaria pendiente**:
- Capturas consentidas, contemporáneas, por cuenta/modalidad/ruta/hora/fecha y ETA; muestras por franjas, días, auto y moto, en Bolt y Uber; registrar surge, bonificaciones, promos.
- Entrevistas exploratorias **30 auto + 30 moto**, comprobantes propios anonimizado, horas conectadas, km hasta pickup, km vacíos, gastos por km, licencias/seguro, comisiones cobradas, opciones de Uber Moto Pase.
- Al menos decenas de rutas × franjas × días; objetivo orientativo ~216 muestras pareadas, **no usar como estadística representativa sin diseñar muestreo**.
- Precios reales de Google Routes/Places, pasarelas Bancard/Pagopar/transferencias, seguros con cobertura pasajeros remunerados, soporte humano, carga tributaria y adquisición de usuarios.
- No usar datos privados ajenos, scraping que contravenga términos, ni promocionar cifras sin evidencias.

## 8. MODELO FAIRPRICE EXISTENTE Y LO QUE FALTA PARA PRODUCCIÓN

**src/domain/fairprice.ts es investigación pura.** Entradas tipo auto/moto, km, minutos, recogida, comisión experimental; compara referencias públicas, output etiqueta INVESTIGACION_NO_PRECIO_REAL.

Modelo:
1. P_técnico = base + km_con_pasajero * precio_km + min_con_pasajero * precio_min.
2. Piso_conductor = [costo_km * (km_con_pasajero+km_pickup+reserva_vacía) + objetivoGs/hora * (min_servicio+min_pickup+espera)/60] / (1-comisión).
3. Piso_QORE = costo_variable_por_viaje / (comisión - participación_pago_digital * tasa_pasarela) **si denominador positivo**.
4. P_cotizado = redondear hacia arriba a múltiplo 500 Gs. el máximo de 3 pisos + tarifa mínima.
5. No activar si datos de ruta/proveedor, legalidad, unidad económica o conductor viable faltan. Propinas, peajes, cargos y promos requieren reglas aparte.

**Hipótesis actualmente embebidas en el LAB** (no contratos):
- Auto: base 3.400, 1.940/km, 270/min, mínimo 11.000; pickup 2km/6min; costo vehículo 900/km; objetivo 15.000 Gs/h; gastos plataforma variables 850/viaje.
- Moto: base 2.000, 950/km, 260/min, mínimo 7.500; pickup 1,5km/5min; costo moto 380/km; objetivo 11.000 Gs/h; variables plataforma 650/viaje.
- Ambos 10% LAB; moto 8% solo escenario. 60% pagos digitales × 2,8% tasa de pasarela **SUPUESTA** ⇒ 1,68% sobre importe promedio; falta gasto fijo/CAC/impuestos.
- En algunos viajes cortos moto el precio calculado QORE supera referencia Bolt. Mostrarlo honestamente; nunca forzar descuentos destructivos.

**Trabajo para hacerlo real (P0)**:
- Obtener **rutas reales de Google en el servidor**, inclusive pickup, recalcular sin confiar en parámetros del cliente.
- Parametrizar por ciudad/tipo/servicio/franja/vigencia con cambios auditables y versionados, lista blanca y validaciones, tipos enteros PYG.
- Construir quote_id, expiry, snapshot total pasajero, payout conductor, comisión, versión de tarifas/costos, vehículo y ruta, firma/checksum de servidor y estado aceptación.
- Legalidad, póliza moto y costos reales como gate de activación.
- Pruebas de calibración fuera de muestra, doble viaje, pickup largo, lluvia/temporales y límites anti surge/anti discriminación.
- Optimizar matching y tarifa a la vez para reducir km vacíos; no prometer ganancias netas por hora hasta medir distribución real.
- Descuentos financiados por QORE, no descontados del pago aceptado al conductor.

## 9. ESTRATEGIA DE COMISIONES Y COMPETENCIA

- Propuesta de lanzamiento por evaluar: **10% auto, 10% moto**, conductor conserva 90% de base comisionable; **8% moto promocional** solo tras probar margen, coberturas, cobro, volumen y costo operativo. NO es política contractual ni activada.
- Investigación de **suscripción opcional para motos de alto volumen** por la competencia del Pase Uber. Necesita precios reales de Uber y cálculo de tasa efectiva = pase/importe bruto de viajes elegibles.
- Sin comisión de propinas/peajes declarados fuera de base; comisiones visibles sin cargos ocultos, sin suscripción obligatoria, libertad multi-plataforma.
- KPI no sólo %: **ingreso operativo por hora conectada** (incluyendo espera, pickup, recorrido vacío), costo por km, cancelaciones, seguridad y recurrencia.
- KPIs negocio: margen de contribución por categoría y ciudad después de pago/seguro/soporte/mapas/promos/fraude, costo adquisición, retención, tiempo espera, tasa aceptación y disponibilidad.
- Una comisión 8% en moto barata puede dejar margen cero/negativo. Ejemplo supuesto de 10.000 Gs viaje, 8% y costos variables de 650 + pasarela media 168 ⇒ -18 Gs/viaje antes de fijos; **simulación, NO margen real medido**.
- Antes de publicitar «5% menos que Bolt» necesitamos cotizaciones pareadas contemporáneas y verificar que el conductor gane más y QORE no pierda.

## 10. SISTEMA FINANCIERO COMPLETO — NO IMPLEMENTADO AÚN

**Modelo deseado:**
- Efectivo: pasajero entrega efectivo al conductor, QORE registra **cuenta por cobrar de comisión**, NO efectivo ficticiamente cobrado. Recaudar vía QR/transferencia/compensación explícita compatible con la ley y términos.
- Tarjeta/QR: pasarela confirma cobro por webhooks firmados/idempotentes; registrar adeudo al conductor neto de comisión/retenciones conocidas; payout por convenio con banco/PSP.
- Costos de pasarela **separados** de comisión comercial; resolver quién los asume, impuestos, reversos y contracargos.
- Ledger de **doble entrada, inmutable** o con movimientos compensatorios, centavos no aplicables a PYG enteros; auditable por viaje, usuario, PSP y liquidación.
- Estado pago distinto de estado del viaje; no inferir «pagado» de viaje «completed». Refunds, no-show, tips, extras, promos, disputa y chargeback con reglas.
- Documentos/recibos, trazabilidad, exportes, conciliación diaria, reportes conductor+admin, saldo, transferencia, retrasos y disputa.
- Antifraude pago, conciliación bancaria, KYC/KYB, cumplimiento con marco paraguayo de PSP y obligaciones tributarias.
- **No manejar fondos de terceros fuera de contratos/licencias adecuados**; investigar split payments o PSP de payouts con Bancard/Pagopar u operador regulado. Los proveedores son candidatos, no integrados.

**Entidades propuestas:** fare_quotes, fare_policy_versions, vehicle_inspections, document_reviews, payment_intents, payment_events, ledger_accounts, ledger_entries, receivables_cash, driver_balances, settlement_batches, settlement_items, payouts, refunds, disputes, fee_configs, platform_costs y audit_trail. Ajustar esquema tras contador/abogado/PSP y no agregar datos sensibles sin tratamiento definido.

**No hay ninguna tabla financiera de pagos/ledger en la inspección actual.**

## 11. DIFERENCIACIÓN DE PRODUCTO — PLAN DE EXPERIENCIA DE VANGUARDIA

A. **QORE FairPrice 2.0:** precio previo, transparente, versión de tarifa, desglose pasajero/conductor, costo de pickup y explicador de cambios.
B. **QORE Driver OS:** panel por hora conectada y vehículo, costos/km configurables, distancias pickup/vacías, análisis de calidad de ofertas, tendencias no garantizadas, ganancias semanales.
C. **Smart Pickup:** matching por ETA real y seguridad, redistribución sin viajes largos invisibles, algoritmo con límites de equidad y cancelación.
D. **QORE Moto Safe:** seguros contratados para moto pasajero, 2 cascos/reflectivos, inspección, riesgo clima/zona y cancelación segura sin castigo, SOS y soporte humano.
E. **Wallet 360°:** pagos en efectivo/digital, transacciones auditables, comisión y liquidación transparente con eventual incentivo al conductor.
F. **App pasajero premium:** búsqueda precisa, destino favorito, contacto de confianza, estado compartido y temporizado, seguridad, accesibilidad, guaraní/español, movilidad programada.
G. **Soporte inteligente** con IA para preguntas, resumen y priorización de incidencias, pero sin decisiones autónomas de cobros, seguridad de emergencia o aprobaciones regulatorias.
H. **Diseño mobile-first de alto nivel:** identidad original, animaciones limitadas por rendimiento/accesibilidad, mapa estable, estados de carga/offline, modo ahorro batería, pruebas en teléfonos económicos, tipografía accesible y pagos locales.
I. **Diferenciarse POR métricas**, no decir que SOS, tracking, mujeres, autos eléctricos o IA son exclusividades si competidores ya los ofrecen.
J. Costos/latencia razonables: telemetría, métricas, presupuesto de API Maps, auditoría de cambios y de IA.

## 12. MATRIZ DE BLOQUEOS Y RIESGOS

### P0 — Bloquea integración/operación

- **P0-01 Dos stacks mismo repo:** PR #2 Flutter trading vs PR #3 Expo movilidad. Decidir monorepo/separación, CI y despliegues aislados, no merge sin estrategia.
- **P0-02 Motos no existen en backend productivo:** enum vehicle_category solo economico/confort/xl, vehículos UNIQUE por conductor, sin insurance/inspection, ni servicio moto_pasajero.
- **P0-03 Precios backend no corresponden a propuesta:** fare_configs 15% auto, distancias haversine×1.3, tiempo genérico 22km/h, no route/pickup real; FairPrice es sólo móvil.
- **P0-04 Registro real no verificado E2E en Expo:** variables pública Supabase ausentes, falta integración comprobada con auth, correos, documentos y admin inicial designado en servidor.
- **P0-05 Seguridad documental y de pasajeros:** no hay validación automática/legal de licencias y seguros, no hay póliza confirmada para moto transportando persona, revisión UI checkbox no constituye prueba oficial; ver requisitos municipales y licencia de cada tipo.
- **P0-06 Pagos inexistentes:** no pasarela, QR, conciliación, ledger, liquidaciones ni reglas fiscales/PSP. Efectivo no equivale a saldo cobrado.
- **P0-07 Despacho/realtime inexistente en cliente real:** requestProductionRide bloquea; sólo simulación en un mismo dispositivo.
- **P0-08 GPS/Maps real de operación incompleto:** Waze/Maps enlaza navegación, no hay Maps Routes productivas, ubicación fiable en tiempo real, rutas moto seguras, soporte sin cobertura.
- **P0-09 Soporte de seguridad/emergencias/privacidad:** falta sistema SOS operativo, seguimiento consentido y limitado, logs/retención, soporte y protocolos de incidentes.
- **P0-10 Economía no probada:** sin cotizaciones contemporáneas Uber/Bolt, costos reales de PSP/seguros/mapas/pickup, medición ingreso neto por hora o precios finales viables.

### P1 — Bloquea piloto escalable

- Falta push FCM/APNs y gestión de offline/retry con idempotencia de acciones.
- Falta app de conductor de uso real con vehículo vinculado, onboarding KYC completo, GPS con garantías, SLA de aprobaciones, lista de espera.
- Falta cancelaciones, no-show, reembolso y gastos de espera, promociones, cuotas, incidentes, ranking antifraude.
- Falta prueba en Android físico/iOS y builds firmadas EAS; GitHub CI pasa TypeScript/export web únicamente.
- Falta pruebas de carga/latencia/observabilidad, seguridad automatizada RLS/SQL, pentest/privacidad.
- Falta soporte por ciudades, tarifas versionadas y cambios seguros sin despliegue.

### P2 — Diferenciación posterior al piloto

- Motor sofisticado de demanda basado en datos, sin discriminación ni precios abusivos.
- Viajes recurrentes, accesibilidad ampliada, ayuda predictiva, Wallet avanzado, benchmarking con consentimiento.
- Escalamiento de ciudades, empresa/flota, más categorías y eventual carga/envíos con pólizas propias.

## 13. ROADMAP EJECUTABLE HASTA LANZAMIENTO (ORDEN SUGERIDO)

### Fase G0 — Alineación de repositorios, contratos y decisión de producto
- [ ] Auditar PR #2 y PR #3, fijar base y convivencia/separación Flutter/Expo; conservar historia; arquitectura aprobada con ADR.
- [ ] Definir nombre definitivo, package/bundle IDs, propietario legal, segmentación movilidad/trading, entornos separados.
- [ ] Actualizar README/CI y crear rutas de propiedad; verificar build de cada stack aislado, sin degradar supervisión trading.
**Gate:** trazabilidad de los dos productos, rutas y CI sin colisiones, ninguna rama destruida.

### Fase G1 — Infraestructura backend y autenticación confiable
- [ ] Identificar Supabase proyecto correcto, verificar claves publicables, environments dev/staging/prod (no credenciales en GitHub), RLS completa y permisos RPC.
- [ ] Exportar/versionar migraciones del backend Lovable en repo adecuado, controlar drift y backups.
- [ ] E2E pasajeros: alta, confirmación, login/logout, recuperación, revocación; verificar profile por trigger.
- [ ] E2E conductores autos: documento privado, vehículo, estado pending, admin protegido y aprobación segura; logs de aprobación, expiración.
- [ ] Integrar auditoría de seguridad por roles y pruebas adversariales; no self-assign admin.
**Gate:** 0 filtraciones de datos entre usuarios/roles y flujos de registro repetibles en staging.

### Fase G2 — Clasificación, seguridad y regulación de AUTO y MOTO
- [ ] Migrar vehicle_type AUTO/MOTO separado de service_category, viaje relacionado con vehicle_id aprobado y snapshot.
- [ ] Verificación de licencia categoría específica, chapa, documentos/fechas, antecedentes cuando legalmente aplicable, seguros/póliza/RC.
- [ ] Motos: un pasajero, dos cascos, equipamiento, inspecciones, condiciones de lluvia/noche y ruta, suspensión segura.
- [ ] Validar legalmente transporte remunerado en moto y requisitos por municipio; política de seguro firmada antes de piloto.
**Gate:** conductor y vehículo válidos identificables/renovables; no se pueden asignar vehículos sin seguro/aprobación.

### Fase G3 — Maps, GPS y FairPrice SERVER-SIDE
- [ ] Routes API DRIVE y TWO_WHEELER desde servidor, Matrix pickup, Places/geocoding, control de cuotas y caché.
- [ ] Cotizador server-side confiable con oferta expirable, route_version, fare_version, comisiones, impuestos/peajes, min conductor + margen plataforma.
- [ ] Datos reales de costos, recibos, cotizaciones comparables; modelos separados por ciudad/auto/moto, sensibilidades.
- [ ] Pantallas premium passenger/driver con precio exacto y desglose antes de confirmar; no actualizar precio unilateralmente.
- [ ] Gate tests: ruta corta/larga, tráfico, pickup largo, no ruta, zona fuera de cobertura, fallos proveedor, precios límites.
**Gate:** cotizaciones reproducibles, server authoritative, margen/no daño conductor bajo supuestos validados, sin fake GPS.

### Fase G4 — Despacho y viajes de extremo a extremo
- [ ] GPS conductor opt-in, staleness/ping, disponibilidad, zonas, asignación por ETA/proximidad/seguridad + oferta razonable.
- [ ] Trip lifecycle server-side con idempotency keys y índices contra dobles viajes; auto/moto segregados.
- [ ] Realtime/push, reintentos offline, onboarding pasajero, conductor en ruta, inicio protegido, fin y recibo.
- [ ] Cancelaciones, soporte SOS, tracking compartido consentido, antifraude, trazas/historial, ratings.
**Gate:** usuarios reales autorizados de staging en teléfonos separados, pruebas concurrencia/red y eventos auditados; AÚN sin cobrar a público.

### Fase G5 — Pagos y economía completa
- [ ] Acordar pasarela/PSP con términos de split o payout, seguros y fiscalidad; no almacenar medios de pago.
- [ ] Efectivo con comisión por cobrar; QR/tarjeta confirmados por servidor/webhook; ledger, ajustes, devoluciones, dispute.
- [ ] Driver Wallet, conciliación, reportes de liquidación, cierres contables, anti-fraude, idempotencia, alertas.
- [ ] Pruebas bancarias/PSP y redondeos, desconexión, cobranza efectivo, reversos e impuestos.
**Gate:** 100% del valor de prueba conciliable, sin doble cobro/pago, bajo marco legal.

### Fase G6 — Seguridad, calidad y lanzamiento controlado
- [ ] Política privacidad, derechos de datos, T&C por categoría, cumplimiento licencia/municipio, seguros, atención emergencia y soporte humano.
- [ ] Testing Android/iOS físico E2E, despliegues firmados, load, crash monitoring, accesibilidad, seguridad estática/dinámica, retención.
- [ ] Prueba piloto autorizada en zona acotada, horarios seguros para moto, soporte real, incidentes y pausas.
- [ ] Medir pricing vs Bolt/Uber con datos contemporáneos, conductor neto por hora conectada, contribución QORE, satisfacción, cancelaciones, ETA p90.
- [ ] Ajustar tarifa/comisión con contrato y transparencia; escalar sólo si economía y seguridad pasan umbrales.
**Gate:** evidencia escrita de aprobación legal, operacional, pagos, seguridad y métricas piloto, firmada por responsable.

## 14. MATRIZ DE PRUEBAS / CRITERIOS NO NEGOCIABLES

- Pasajero A no ve viajes, teléfono ni documentos de pasajero B.
- Conductor rechazado/sin póliza válida no puede recibir solicitudes; administrador no se autoasigna desde cliente.
- Viaje no cambia de estado por usuario no autorizado; no dobles reservas en carrera, no overwrite de pago.
- Aceptación congela vehículo concreto, categoría, versión de tarifa, payout, precio e id de operación.
- GPS no se comparte antes de opt-in ni tras viaje vencido/cancelado; ubicación obsoleta se marca sin ETA inventado.
- Moto no puede utilizar categoría auto ni póliza no adecuada; lluvia/alertas políticas seguras.
- Precio de cliente no se autoconfirma por importe del móvil, jamás negativo; peajes/tips/reversos tratados claramente.
- Eventos de pago idempotentes y webhook autenticado; efectivo registrado como deuda de comisión hasta cobro real.
- Prueba de apagado de proveedores Maps/PSP/push; app debe mostrar «no disponible» sin cobrar por ruta falsa.
- Conversión de datos de usuarios con minimización, cifrado, borrado/retención según asesoría legal.
- Backend y store/CI en ramas separadas y reproducibles, sin romper PR #2.

## 15. ACCIONES RECOMENDADAS EN EL PRIMER DÍA DEL NUEVO ARQUITECTO

1. Leer COMPLETO este archivo, PR #3, README y las 3 investigaciones y issues #4/#5, **además de PR #2 e Issue #1** para respetar la otra app.
2. Obtener por GitHub el HEAD actual del PR #3 y ejecutar CI. Usar repo/herramientas conectadas, no confiar sólo en transcripciones.
3. Generar un ADR de CONVIVENCIA DE PRODUCTOS y resolver monorepo vs separación. No hacer merge antes de documentar decisión.
4. Elegir la siguiente implementación vertical **G1: E2E seguro de alta pasajero, conductor AUTO, vehículo y rol admin en entorno staging**, con prueba y migración versionada; no intentar crear 15 módulos simulados sin integración.
5. En paralelo, preparar migración auto/moto G2 en rama aislada, sin alterar enum actual hasta auditar relaciones/RLS/funciones; verificar permisos y póliza.
6. Convertir FairPrice de investigación a servicio de cotización versionada bajo tests de calle G3 SOLO tras recibir costos/Routes reales.
7. Preparar backlog por PR pequeños con pruebas, enlaces a Issues #4/#5, ADRs y checklist de gates.
8. Mantener LIVE_TRIPS_ENABLED=false hasta G2-G6 satisfechos; no cobrar, asignar conductor real o recolectar datos sensibles fuera de servicios seguros.
9. Verificar recursos de Lovable: creación de UI allí estaba bloqueada por créditos; GitHub/Expo/Supabase pueden seguir si existe acceso autorizado a conexiones/entornos adecuados.
10. Al cerrar cada fase: commit verificado, URL, pruebas realmente ejecutadas, riesgos abiertos y actualización de este handoff.

## 16. DECISIONES AÚN ABIERTAS DEL PROPIETARIO / EQUIPO

| Decisión | Estado/alternativas sin prejuzgar |
|---|---|
| Convivencia movilidad/trading en Qore-mobile- | BLOQUEO P0: monorepo con apps separadas o repos separados; ninguna está fusionada |
| Marca comercial | «ViajeYa by QORE» provisional; Lovable UI tiene nombre auxiliar diferente |
| Entidad operadora, cobertura y permisos auto/moto | Pendiente validación local y contratación |
| Cobros PSP/QR, operación fondos de terceros | Pendiente presupuesto, cumplimiento y contrato |
| Comisión 10%/10% o promo 8% moto | Propuesta, no tarifario comercial aprobado |
| Precio por km/min, mínimos, pickups y seguros | Solo hipótesis FairPrice, necesitan datos de mercado/costos |
| Áreas de cobertura, horarios moto, condiciones lluvia | Definir tras seguro/operación y riesgos |
| Gestión de administrador inicial | Designación segura por propietario/servidor; nunca autopromoción en cliente |
| Capacidad soporte humano real, emergencias y seguros | Falta equipo/procedimiento |
| Lanzamiento tiendas vs PWA inicial | Requiere Android/iOS tests y estrategia Apple/Google |

## 17. ENLACES MAESTROS

- Repo: https://github.com/mezas3238-hue/Qore-mobile-
- Movilidad PR #3: https://github.com/mezas3238-hue/Qore-mobile-/pull/3
- Trading Supervision PR #2: https://github.com/mezas3238-hue/Qore-mobile-/pull/2
- Trading Issue #1: https://github.com/mezas3238-hue/Qore-mobile-/issues/1
- **Arquitectura conflictiva Issue #6 P0:** https://github.com/mezas3238-hue/Qore-mobile-/issues/6
- Autos y motos Issue #4: https://github.com/mezas3238-hue/Qore-mobile-/issues/4
- FairPrice Issue #5: https://github.com/mezas3238-hue/Qore-mobile-/issues/5
- Investigación Bolt/Uber: https://github.com/mezas3238-hue/Qore-mobile-/blob/feature/viajeya-expo-mvp-20261015/docs/research/COMPETENCIA_BOLT_UBER_PARAGUAY_CONDUCTORES_2026-10-15.md
- Investigación autos/motos: https://github.com/mezas3238-hue/Qore-mobile-/blob/feature/viajeya-expo-mvp-20261015/docs/research/QORE_MOBILE_MODELO_PROFUNDO_AUTOS_MOTOS_PARAGUAY_2026-10-15.md
- Investigación FairPrice: https://github.com/mezas3238-hue/Qore-mobile-/blob/feature/viajeya-expo-mvp-20261015/docs/research/QORE_MOBILE_TARIFAS_FAIRPRICE_VANGUARDIA_2026-10-15.md
- CI baseline verificado: https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/38823736658
- Proyecto backend Lovable: https://lovable.dev/projects/2fa91fe1-e7a0-4fff-a16f-7d457b2d6eed
- Repositorio de trading QORE CORE (NO alterar): https://github.com/mezas3238-hue/qore-core

## 18. TEXTO EXACTO PARA PEGAR EN UN CHAT NUEVO

«Continúa como arquitecto principal el desarrollo de QORE Mobile **aplicación de transporte de pasajeros para autos y motos en Paraguay**. Lee ENTERO el handoff maestro en https://github.com/mezas3238-hue/Qore-mobile-/blob/feature/viajeya-expo-mvp-20261015/docs/handoff/HANDOFF_MAESTRO_QORE_MOBILE_MOVILIDAD_2026-10-16.md y verifica el estado actual del PR #3, los Issues #4/#5, CI y las 3 investigaciones. Antes de cambiar código, revisa también PR #2 e Issue #1: ese repositorio tiene otra app Flutter de supervisión de trading y no debes dañarla ni fusionarla erróneamente con Expo. Quiero avanzar de verdad con commits, pruebas y documentación hasta terminar registro pasajero/conductor/vehículo AUTO y MOTO, Google Maps/Waze, rutas y GPS reales, QORE FairPrice competitivo y sostenible, asignación de viajes, pagos/QR/efectivo, comisiones, billetera y liquidaciones, administración segura, seguros y funciones modernas para conductores y pasajeros. La comisión 10% para autos/motos es solo propuesta; 8% moto solo estudio. No inventes datos ni presentes demo como producción. Mantén LIVE_TRIPS_ENABLED=false hasta resolver permisos, pólizas, seguridad, pagos, E2E y gates. Empieza verificando repo/CI/backend y ejecuta el primer bloque P0/G1, informa resultados con enlaces verificables. No te detengas para preguntarme cada paso.» 

---

**ESTADO FINAL DE TRANSFERENCIA:** proyecto de movilidad es **MVP de DEMO con prototipo de registro y navegación + motor de precios de investigación; NO aplicación comercial lista**. Código/pruebas disponibles en PR #3, Supabase separado no validado E2E, PR #2 Flutter trading concurrente, problemas y roadmap expresos. Preservar seguridad, trazabilidad, productos independientes y honestidad sobre las evidencias.

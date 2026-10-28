# HANDOFF MAESTRO A+B+C+D — QORE MOBILE / MOVETE FÁCIL — 27 OCT 2026

## Orden del Owner (NO reiniciar)
Continuar TRABAJO REAL en GitHub sin detenerse salvo bloqueo genuino. No más commits decorativos, prompts o handoffs como sustituto de funcionalidad. Si algo requiere terceros, evidencia legal o presupuesto no autorizado, registrar el bloqueo y seguir en una tarea ejecutable. NO merge, pagos, LIVE, infraestructura externa, Play Store ni App Store sin orden. Seguir diseños funcionales familiares de Bolt/Uber sin copiar propiedad intelectual; aspirar a superar seguridad/fiabilidad con métricas, no declararlo logrado.

## Proyecto, economía y alcance
Cinco recorridos: AUTO_RIDE pasajeros, MOTO_RIDE pasajeros, AUTO_DELIVERY, MOTO_DELIVERY, COMMERCE (supermercado/farmacia/restaurante/otros). Cliente siempre elige AUTO/MOTO, sin confundir MOTO_RIDE con mensajería. Apps distintas Expo Cliente y Driver, Admin Web y backend Node+PostgreSQL16; Paraguay primero, Mercosur preparado. Producto en Google Play/App Store, NO APK sueltos. Comisiones pasajeros Owner-configurables: AUTO 15% nominal, MOTO 12% nominal inicialmente; subsidio al cliente fijo 10%; retención bruta 5%/2% antes de gastos. ENVÍOS y COMMERCE requieren porcentajes/tarifas propios Owner-configurables, NO heredar 15/12 o subsidio sin orden. Versionado, Gs/ledger, MFA Owner AAL2.

## GitHub exacto (confirmado)
A Backend issue #15 PR #7 DRAFT rama feature/mobility-monorepo-isolated-20261016 HEAD b11c98c54ff9c759c7241565626569f2dc148ffa.
B Cliente issue #16 PR #8 DRAFT rama feature/mobility-cliente-admin-parallel-20261022 HEAD 66a8dff310031cd7f8f871ce044d239afd77f725.
C Driver issue #17 PR #19 DRAFT rama feature/mobility-arquitecto-c-driver-e2e-20261026 HEAD fd9d85749773bcd1d842138fd7abb75941cc49b0.
D Admin issue #18 PR #20 DRAFT rama feature/mobility-arquitecto-d-admin-e2e-20261026 HEAD 367649017380fbeb3cdea018468918c0b1263eb9.
Extras: PR #13 worker/retry DRAFT, PR #14 Store candidates DRAFT.
A owns apps/mobility-expo/server/** and SQL/workflows; B apps/movete-cliente/**; C apps/movete-driver/**; D apps/movete-admin/**. B no debe editar Admin.

## Historial técnico HECHO — no duplicar
G0–G22: monorepo movilidad independiente, Auth, RLS/JWT/PostgreSQL, primeras ofertas, pasajeros, envíos/comercio, Driver.
G23–G48: Admin roles MFA, identidad, geocerca, historia privada, duplicidad de tareas, G38 legal territorial, anti-PII.
G49–G70: mensajería privada, ACK, custodia entrega, Driver lifecycle, revocación y renovación KYC.
G71–G91: expediente KYC Driver, licencias/territorio, G73 booking, G81 ofertas, G85 outbox, G90 despacho.
G92–G113: subsidio/tarifas y ledger QA G93/G94; cancelación G95/G96; AUTO B→A G107 quote/booking/cancel; MOTO B→A G108; G109/G111 Driver AUTO termina otro fixture QA previo a G38; G103 una reserva pasajero activa; dispatch/retry G112/G113. NO son un único viaje completo legal pos-G38.
G114–G120: Owner G116/G117 comisión, MOTO pasajero G118/G119 y siguientes gates.
G121: entrega AUTO/MOTO recupera requestKey y evita duplicar al perder ACK.
G122: aceptación exacta de precio G7 por remitente, vehículo, versión y quote.
G123: bloqueo SQL a oferta/aceptación/asignación sin consentimiento G122, conserva G38/G71.
G124: tarifas AUTO_DELIVERY/MOTO_DELIVERY independientes por zona, base/km/min/mínimo/comisión/versión, Owner AAL2 y auditoría, cotización histórica inmutable.
G125: certificación de origen servidor de ruta por deliveryId/actor/vehículo/zona/km/seg/peaje antes de G7, sin precio desde Cliente.
G126: recuperación G7 quote original por requestKey antes de repetir Maps, incluso tras caducar evidencia breve, mientras quote esté vigente.
G127: Google Routes para AUTO/MOTO mismo perfil DRIVE por orden Owner, actualmente DESACTIVADO.
G128: Geoapify Free con mode=drive AUTO/MOTO, traffic=approximated NO tiempo real, verificación cobertura y peajes, callback de cuota duradera obligatorio, sin fallback Google.
G129: GitHub Actions una consulta a Geoapify usando secreto en un smoke de Asunción; CI aún FAIL por G129_RESPONSE_STREAM_UNREADABLE. NO afirmar PASS.

## Pruebas CI verificadas
A HEAD: Node SUCCESS https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40610584311 ; PG16 SUCCESS https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40610584379 ; Expo SUCCESS https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40610584252 ; aislamiento SUCCESS https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40610584239 .
Excepción G129 externo FAIL https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40610577123 .
B tests SUCCESS https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40431145866 ; C Driver SUCCESS https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40430633815 pero filtro CI ownership de PR C→A FAIL https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40430633751 ; D sin CI propio del SHA. NO E2E A+B+C+D ni dispositivos certificados.

## Estado B/C/D no repetir
B: selector AUTO/MOTO pasajeros y carga, booking/cancel/historial, SecureStore de G5 y G7/G126 B18–B23. PERO apps/movete-cliente/app/envios.tsx sólo prepara borrador; botón 'Cotizar y solicitar repartidor' DISABLED; safe-delivery-ui-harness canRequestCourier:false.
C: Driver ofertas privadas/KYC/preflight, acepta una sola vez, G65 AUTO QA, G66 custodia monotónica, bloqueo G67 si no prueba real, ganancias no verificadas sin inventar Gs0. Faltan MOTO_RIDE pasajeros, ciclo carga→POD real, ledger/gps/phones.
D: Admin roles/MFA, panel/trace UI y anti-rollback, Owner G116/G124 editores pasajeros/carga con GET relectura; no endpoint A trace certificado GET /v1/staging/admin/services/{kind}/{id}/trace; merchantCases:null; sin CI D propio.
Consultar handoffs previos: docs/handoff/HANDOFF_MAESTRO_GLOBAL_QORE_MOBILE_A_B_2026-10-26_E2E_CUATRO_SERVICIOS_TIENDAS.md y docs/architect-d/HANDOFF_MAESTRO_ARQUITECTOS_C_D_2026-10-26_E2E_QORE_MOBILE.md (rama D).

## Geoapify: evidencia real y bloqueo exacto
Owner creó Geoapify 'Movete Fácil', plan Free US$0/mes 3000 créditos/día/5 req/s; afirma guardar GEOAPIFY_API_KEY en GitHub Actions secrets, NO revelar secreto. Prueba manual Playground: Palacio López (-25.2773434,-57.6371671) → Shopping del Sol (-25.2828767,-57.5674503), drive, 8253 metros, 808.305 segundos (~13m28s), GeoJSON FeatureCollection. G128 solicita format=json results[0], NO confundir ambos formatos ni convertir tiempos directamente en tarifa. El G129 CI público falla lectura stream; revisar timeout/encoding/body bounds (G128 cap 512KiB, G129 4MiB), sin mostrar URL/clave/body ni llamadas ilimitadas. Google Cloud movete-facil creado pero solicitó prepago USD30 y Owner lo rechazó; NO pagar.

## Tareas obligatorias en secuencia
P0.1: corregir G129 real, obtener PASS con clave protegida, cuota y 1 prueba controlada; seguir aunque bloqueado el proveedor.
P0.2: cuota Geoapify REAL transaccional/atómica PostgreSQL (objetivo 100 consultas, 300 créditos al día, < Free), validación de coordenadas/geocoding por servidor + cobertura legal G38, peajes verificados, asegurar G128→G125→G7→G122→G123. No convertir tags QA a calle real.
P0.3: corregir workflow C ownership y activar tests Admin D en PR #20 SHA real, luego prueba multirrama.
P0.4: primer AUTO_RIDE de verdad con MISMO tripId B Cliente→A G73/worker→C Driver oferta/aceptación/arriving/start/finish→D trace/ledger. G38 y G71 nunca bypass, fixture pre-G38 no equivale E2E real.
P0.5: MOTO_RIDE pasajero separado en Driver con permisos casco/seguro/KYC, mismo tripId.
P0.6: AUTO_DELIVERY y MOTO_DELIVERY del borrador B al booking G121, ruta G128/125, quote G7, consentimiento G122, gate G123, Driver C G10/G66/G67 evidencia verdadera, cierre, Admin mismo deliveryId.
P0.7: COMMERCE completo (inventario, carrito, checkout, merchant KYC, courier, prueba entrega, comisiones Owner por rubro, soporte y conciliación mismo orderId).
P1: HTTPS/IdP/STAGING Render/Supabase previa autorización de gastos, GPS/push dispositivos Android+iOS, pagos/PSP autorizados, tiendas AAB/IPA, soporte/privacidad, auditoría y multi-país progresivo.

La condición de terminado exige misma ID/revisión visible en Cliente/backend/Driver/Admin, SQL persistente, tarifa legal y financiera, reconexión y pruebas negativas. QA_PASS no significa STAGING_E2E_PASS, DEVICE_PASS o COMMERCIAL_GO.

## PROMPT DE ARRANQUE PARA SIGUIENTE CHAT
Asume Arquitecto A de QORE Mobile. Verifica HEADs de PR #7/#8/#19/#20 y lee este handoff e issues #15-#18. NO reinicies ni inventes progreso. Repara G129_RESPONSE_STREAM_UNREADABLE sin exponer GEOAPIFY_API_KEY; implementa cuota Geoapify durable, geocoding/cobertura/peajes, corrige CI C/D y trabaja en paralelo en AUTO_RIDE mismo tripId Cliente→Backend→Driver→Admin, después MOTO_RIDE, ENVÍOS AUTO/MOTO, COMMERCE. No más informes o commits sin función, no parar salvo bloqueo real; no merges, LIVE, PSP, despliegues o costos no autorizados. Geoapify Free, DRIVE compartido como cálculo pero vehículo legal/seguridad/tarifa separados, subsidio fijo pasajeros 10%, comisiones Owner configurables. Entrega pruebas verificables GitHub y no declares que ya funciona comercialmente.

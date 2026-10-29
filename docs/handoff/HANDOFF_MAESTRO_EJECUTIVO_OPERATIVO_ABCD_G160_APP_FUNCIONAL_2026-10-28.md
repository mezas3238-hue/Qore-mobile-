# HANDOFF MAESTRO EJECUTIVO Y OPERATIVO — QORE MOBILE / MOVETE FÁCIL
## Continuidad A+B+C+D · Corte local 28 OCT 2026, GitHub 29 OCT 2026 UTC · HEAD de código G160

> **INSTRUCCIÓN DIRECTA DEL OWNER:** El siguiente chat NO debe producir otro handoff, abrir un proyecto desde cero, entretenerse en prototipos, llamar E2E comercial a pruebas simuladas ni preguntar otra vez lo ya acordado. Debe asumir responsabilidad ejecutiva sobre Backend, Cliente, Driver, Comercio y Admin; **continuar INMEDIATAMENTE implementando el código que falta para operar**, empezando por la misma solicitud AUTO entre B→A→C→B→D, luego los cuatro servicios restantes. Proteger las barreras legales, económicas y antifraude. El objetivo final es una aplicación utilizable y estable; el paso a Render, Supabase, PSP y Stores se hará SOLO con autorización del Owner después de la certificación GitHub.

### 0. CÓMO ARRANCAR EN EL PRÓXIMO CHAT — LECTURA DE 90 SEGUNDOS
1. Abrir repositorio: https://github.com/mezas3238-hue/Qore-mobile-
2. Obtener HEAD ACTUAL de la rama soberana **integration/qore-mobile-e2e-four-apps-20261027** antes de cambiar cualquier archivo. Al momento del corte: **ab3f60f317a89dde3eb5ecb9bc47c048480c6047**. Este SHA es solo una referencia histórica; NO supone que siga siendo HEAD.
3. Comprobar cambios de arquitectos paralelos y compararlos. GitHub es la única fuente. NO force push; crear commit sobre base actual y actualizar ref con lease expected_sha; si cambia el HEAD, inspeccionar cambios y reintentar preservándolos. NO merge hacia main ni PRs draft sin orden Owner.
4. Verificar CI de HEAD, no de commits viejos. Últimas evidencias de G160: [A+B+C+D SUCCESS 40794354339](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40794354339); [PG16 disposable SUCCESS 40794354304](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40794354304).
5. Entrar primero en **apps/mobility-expo/server/g4-staging-runtime.mjs**, G160/G111/G112, junto con **g4-staging-runtime.test.mjs**; comparar con G73 nueva reserva, G98 y G109. **G160 recién conectó después de reservar G73 al dispatcher acotado G112; falta demostrar aceptación y cierre legal en C del MISMO tripId nuevo.** Programar esa continuidad, no escribir más documentación.
6. Si la certificación positiva depende exclusivamente de licencia, IdP, cámara, GPS, PSP o ambiente externo genuino, dejar guardas fail-closed, clasificar EXTERNAL_BLOCKED y seguir implementando otra parte no bloqueada. Jamás inventar un conductor legalmente habilitado para obtener verde.
7. **Owner exige todo completo en GitHub primero.** Luego, y tras su orden, Render + Supabase STAGING externo; después pruebas en móviles reales, PSP y despliegue con gates. Nunca declarar GO comercial por CI verde.

### 1. NORMA DE VERDAD — QUÉ SIGNIFICA VERDE Y QUÉ NO
- GitHub contiene un árbol con cuatro componentes; los workflows ejecutan compilación Expo/React/Vite y una cadena SQL PostgreSQL 16 **temporal** más HTTP loopback y fixtures de prueba. Esto SÍ verifica integración de código, estados y autorizaciones sintéticas. NO equivale a servidor HTTPS persistente, Auth externo, conductor real, GPS en calle, liquidación PSP, despliegue público ni certificado legal.
- **G160 evidencia**: commit ab3f60f; el runtime compone G111AfterBookingAutoDispatch con G112ScopedAutoDispatchRepository después del booking G73 y recupera el estado G90. La prueba propia contiene un caso de oferta del mismo tripId nuevo y otro donde shortage/SQL denial no invalida la reserva. Ese test utiliza repositorios/fixtures QA: la cadena aún NO prueba la recepción, aceptación y finalización por un Driver C legalmente vigente del mismo viaje nuevo.
- **G159 evidencia**: commit [e4f212f](https://github.com/mezas3238-hue/Qore-mobile-/commit/e4f212fd3c4da815ac541e8726a8cc423d399bbb); CI [40793696233 SUCCESS](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40793696233), 13 tests Driver documento/cámara: tiempo límite sesión, captura, Storage, observación, borrado de buffer tardío, sin replay por ACK dudoso. No certifica Expo cámara en un Android real ni instala Storage privado externo.
- **G158 evidencia**: commit [6ffaff0](https://github.com/mezas3238-hue/Qore-mobile-/commit/6ffaff0dc7766a1f2cb0ad8ae3aa253208909613); CI [40792620493 PG16 SUCCESS](https://github.com/mezas3238-hue/Qore-mobile-/actions/runs/40792620493). Une una denuncia G155 tras G67 real de QA → G157 PostgreSQL → A endpoint Admin JWT/MFA AAL2/RBAC → D panel solo lectura. No prueba un fraude, no suspende ni puntúa despachos.
- **G155**: rating verificado 1–5 estrellas a conductor/repartidor/comercio; recíproco hacia cliente contemplado a nivel SQL. Pantalla Cliente existe. Servicio efectivamente finalizado + G67 custodia cuando corresponda, una calificación por servicio/objetivo e incidentes privados. UI Driver y merchant rating Cliente pendientes.
- **G156**: portal de personal de comercios con bandeja privada QA y límite de sesión. NO equivale a tienda/checkout/entrega finales operativos.
- **G154**: se usa también como identificador del fence de despacho de COMMERCE (no confundir con G155 ratings); protege pedido ready G45/G150, peso y precio G122 antes de ofrecer.
- Si un workflow falla, NO presentarlo como listo. Identificar archivo/paso exacto, corregir y repetir. El SHA de este handoff no representa el HEAD futuro de código.

### 2. OBJETIVO COMERCIAL Y CONFIGURACIÓN DEL PROPIETARIO
Marca: **QORE Mobile / Movete Fácil**. Lanzamiento inicial: **Paraguay**, guaraníes enteros PYG/Gs; futura expansión regional bajo autorización y jurisdicciones independientes.
Cinco servicios **obligatorios, no reducir**:
1. **AUTO_RIDE:** pasajero en automóvil.
2. **MOTO_RIDE:** pasajero en moto; requiere habilitación propia y casco/seguro/cobertura legal. No confundir con carga en moto.
3. **DELIVERY_AUTO:** envíos, encomiendas y paquetes en auto.
4. **DELIVERY_MOTO:** envíos, encomiendas y paquetes en moto.
5. **COMMERCE:** supermercados, restaurantes, farmacias OTC y otros, con catálogo/stock, preparación, despacho, entrega y pagos.

Cliente decide tipo de vehículo; nunca cambiar AUTO↔MOTO unilateralmente. La cotización debe provenir del servidor con origen/destino, versionado y vigencia; consentimiento expreso antes del cargo. Geoapify Free elegido por Owner, clave reportada en GitHub Secrets; no copiar clave en código/cliente/log. Verificar permisos de uso y cuota; no inventar tráfico, peajes ni cobertura.

**Comisiones Owner configurables desde la web para TODOS los servicios.** Parámetros iniciales del proyecto: AUTO pasajero 15% nominal, MOTO pasajero 12% nominal, ambos EDITABLES; **subsidio al pasajero 10 puntos porcentuales** independiente de la configuración y solo para pasajeros según política definida. No confundir 15% comisión con 15% utilidad: ejemplo 15 menos 10 deja 5 puntos antes de costos; 12 menos 10 deja 2 antes de costos. No permitir un cambio que cause pérdidas no autorizadas o contradiga el subsidio. ENVÍOS AUTO/MOTO con tarifarios y comisiones independientes; COMMERCE comisiones por vertical/comercio cuando se apruebe. No inventar porcentajes para comercios. Reglas, ajustes, recibos y ledger inmutables por versión; solo cotizaciones futuras reciben versión nueva. Todo bajo Owner + MFA + auditoría.

**Reputación y antifraude:** cliente califica conductor, repartidor y comercio; conductor/repartidor/comercio califica cliente tras servicio válido. Señales verificadas pueden priorizar revisión, pero jamás una sola baja calificación ni denuncia es prueba de estafa; necesita investigación, corroboración, decisión proporcional y apelación.

### 3. ESTRUCTURA ÚNICA — RESPONSABILIDADES A+B+C+D
| Capa | Código fuente real | Responsabilidad mínima |
|---|---|---|
| A — autoridad backend | apps/mobility-expo/server/ y docs/backend/staging_only/ | HTTP, identidad/RBAC, PostgreSQL, GPS/Geoapify, tarifas, dispatcher, custodia, pagos/ledger, trazabilidad, resiliencia |
| B — Cliente Expo | apps/movete-cliente/ | solicitud/cotización/aceptación, Auto/Moto, envíos, carrito/pedidos, tracking, historial, pagos, ratings, incidentes |
| C — Driver Expo | apps/movete-driver/ | Auth, KYC/rostro, vehículo, disponibilidad, ofertas privadas, aceptación, viaje, entrega, prueba independiente, ganancias |
| D — Admin + portal comercio | apps/movete-admin/ | Owner reglas y comisiones, Admin KYC/riesgos/auditoría/economía, comercio staff pedidos/preparación |
| CI integración | .github/workflows/qore-four-apps-unified.yml | misma revisión de apps, TS, tests Driver/documento, web build; NO dispositivo real |
| CI PostgreSQL16 | .github/workflows/mobility-g4-postgres-disposable.yml | esquema/SQL, gateways HTTP, transiciones y concurrencia; NO Supabase remoto |

**Fuente:** https://github.com/mezas3238-hue/Qore-mobile-/tree/integration/qore-mobile-e2e-four-apps-20261027

PRs OPEN/DRAFT al corte, NO FUSIONADOS:
- A Backend PR #7, issue #15, rama feature/mobility-monorepo-isolated-20261016.
- B Cliente PR #8, issue #16, rama feature/mobility-cliente-admin-parallel-20261022.
- C Driver PR #19, issue #17, rama feature/mobility-arquitecto-c-driver-e2e-20261026.
- D Admin PR #20, issue #18, rama feature/mobility-arquitecto-d-admin-e2e-20261026.
- PR #13 despacho acotado y PR #14 candidatos Store siguen DRAFT. PR #2 y #3 son herencia y NO despliegue final.

### 4. BLOQUEO CENTRAL QUE NO SE PUEDE DISFRAZAR
Aún falta la **MISMA** solicitud operativa nueva, NO combinar un viaje Cliente nuevo con una fixture histórica Driver:
B crea solicitud/cotización → A persiste identidad, vehicleKind, route/geo, quote version y requestKey → A autoriza despacho privado a Driver C efectivamente habilitado por G38/G71 → C acepta la oferta exacta bajo su propia sesión → C llega/recoge/inicia/termina con evidencias válidas → B observa MISMO tripId/deliveryId/orderId en estado terminal, historial, rating elegible → D verifica misma fuente original y auditoría → PSP/ledger real cuando certificado → reanudar tras pérdidas de ACK/reinicio sin doble operación ni cobro. Cada paso requiere verificaciones negativas (rol ajeno, expirado, revocado, permisos, doble aceptación, tipo vehículo, fraude, cotización vencida).

La matriz **actual** es:
| Servicio | Crear nueva solicitud B / fuente A | Driver/merchant en mismo servicio | Cierre original B + D | PSP real |
|---|---|---|---|---|
| AUTO_RIDE | QA G73/G98 y despacho nuevo G160/G111/G112 | Nuevo G73→C legal aceptado/cerrado **PENDIENTE** | G109 solo viaje histórico pre-fence; original nuevo **PENDIENTE** | NO |
| MOTO_RIDE | QA G100/G102/G119 | Nueva oferta/legal C MOTO pasajeros **PENDIENTE** | Cliente + Admin mismo viaje terminado **PENDIENTE** | NO |
| DELIVERY_AUTO | QA G5/G121/G122/G125/G126 | Nueva oferta + G66/G67 y confirmación destinatario **PENDIENTE** | B + D misma entrega terminal **PENDIENTE** | NO |
| DELIVERY_MOTO | QA G5/G121/G122/G125/G126 | Nueva oferta + G66/G67 y confirmación destinatario **PENDIENTE** | B + D misma entrega terminal **PENDIENTE** | NO |
| COMMERCE | QA G139/G148/156, G150 linked G5, G154 fence | Positivo courier legal→custodia→handoff merchant **PENDIENTE** | Order y delivery mismo original terminal **PENDIENTE** | NO |

**Importante:** Si G38/G71 legal exige evidencia externa que aún no existe, el flujo debe quedar correctamente BLOQUEADO; ese bloqueo NO es un bug que se salve eliminando validaciones. La ingeniería puede aislar autoridad real en adaptadores y seguir cerrando otros tramos.

### 5. P0-1 — CERRAR PRIMERO AUTO_RIDE NUEVO, NO SEGUIR ABRIENDO G170, G180…
**Archivos para entrar sin redescubrir:** 
- A: apps/mobility-expo/server/g4-staging-runtime.mjs, g4-staging-runtime.test.mjs, g73-f1-auto-gateway.mjs, g111-after-booking-auto-dispatch.mjs, g112-scoped-auto-dispatch-repository.mjs, g4-loopback-http-transport.mjs, g98-f1-auto-postgres-loopback-e2e-ci.mjs, g109-driver-auto-completion-pg-http-ci.mjs.
- B: apps/movete-cliente/app/ (AUTO screen/historial), src/ClientRuntime.tsx.
- C: apps/movete-driver/app/ofertas.tsx, app/viaje.tsx, src/NativeDriverStagingRuntime.ts y domain/driver-offer-decision.mjs / driver-trip-lifecycle-http.mjs.
- D: apps/movete-admin/src/main.tsx, service-trace-gateway.mjs, G75/G138 source read.

**Tareas exactas:**
1. Investigar G160: G73 booking realmente llama G111/G112 en runtime; comprobar ausencia de dispatch duplicado al repetir requestKey y que shortage/SQL denial mantiene booking intacto.
2. Persistir la oferta privada G112/G85 para SAME tripId y vincular al G16 inbox del conductor asignable por el servidor, NO hacer búsqueda global/client-side.
3. C sesión Driver distinta de B, KYC/licencia/seguro/geocerca G38/G71 verificados en servidor, acepta solo su oferta y solo una vez (G36/G71/G65); no forzar estado con SQL UPDATE.
4. C transmite llegar → recoger → completar bajo máquina de estados server/PG. B recupera estado/historial y reanuda después de force-stop. D recupera MISMA ID y tarifa/quote/revision.
5. Repetir con no-driver, oferta expirada, rechazo, cancelación, token vencido/revocado, comisión Owner actualizada a mitad de viaje, disconnect y ACK perdido. No fabricar ingresos.
**Aceptación:** un único booking nuevo de B y un único Driver C elegible lo completan como MISMO tripId; D y B lo leen; slot se libera; ningún gate legal baja de nivel; si IdP/ley impiden positivo externo, declararlo EXTERNAL_BLOCKED y conservar recorrido no lucrativo auténtico.

### 6. P0-2 — MOTO_RIDE: VIAJE PASAJERO EN MOTO
- Reusar G100/G101/G102/G118/G119/G142, asignación privada C y tarifa 12% inicial variable; subsidio pasajero 10 puntos bajo versión.
- Ruta propia por vehículo MOTO y permiso de pasajeros específico. Seguro, casco/vestimenta, licencia, municipio, horarios y G38/G71. NO copiar certificación de reparto MOTO.
- Mismo moto tripId B→A→C→B→D hasta terminal, cancelación, salida sin oferta, reanudación y pagos cuando estén autorizados. Sin evidencia legal, no hacer aceptación sintética pasar por operación real.

### 7. P0-3 — DELIVERY_AUTO Y DELIVERY_MOTO: DOS RECORRIDOS COMPLETOS
- Cliente apps/movete-cliente/app/envios.tsx todavía tiene deshabilitado **Cotizar y solicitar repartidor**; solo registro QA G5 con tags/zona de servidor, no una compra. Implementar geocodificación origen/destino, peso/volumen/categorías, precio calculado ANTES del consentimiento y reserva, tipo vehículo permitido, cobertura y reembolso.
- Unir G5/G7/G121/G122/G123/G125/G126 con oferta privada real G10 a C; C debe estar legalmente autorizado para carga AUTO/MOTO. Un único deliveryId, owner, priceVersion y requestKey hasta entregar.
- G66 pickup y delivery bajo G67 comprobante con proveniencia independiente, consumo único y revocación. **PENDIENTE clave: confirmación independiente del destinatario con PIN de entrega o desafío autenticado**, expiración, limitación intentos, anti-replay, sin guardar PIN en logs/plaintext, contingencia documentada para pérdida de teléfono/disputa. La prueba de Driver sola NO puede confirmar entrega.
- B ve tracking real desde estados server/GPS consentido, D ve la misma entrega, notificaciones/cancelaciones reales y devolución. UI no debe presentar posición inventada.
- Negativos: documento prohibido, peso superior al vehículo, sin consentimiento G122, moto sin permiso, misma oferta a dos couriers, entrega no recepcionada, prueba falsificada, PIN errado, perdida de Internet, posterior disputa y devolución. Ajustar ledger de modo idempotente.
- Mantener AUTO y MOTO diferenciados en nombre de enum/contratos; no mezclar etiquetas legacy AUTO_DELIVERY y DELIVERY_AUTO sin mapeo canónico.

### 8. P0-4 — COMMERCE: EL MAYOR FLUJO MULTIACTOR PENDIENTE
- B apps/movete-cliente/app/comercios.tsx + src/G148CommerceQaPanel.tsx: catálogo G45 actualizado desde sucursal permitida, precios/stock, carrito, sustituciones voluntarias, cupos, subtotal, envío, precio final, consentimiento e idempotencia. Checkout/pago reales todavía OFF; no activar sin PSP y backend aprobados.
- Merchant staff independiente: apps/movete-admin/comercio.html y src/merchant-main.tsx, G156 inbox privada y rol de personal; recibir pedido original, confirmar inventario, preparar, ready, falta de ítem/cancelación, no usar Owner/Admin para saltar identidad.
- A G139/G148/G150 vinculan orderId a deliveryId; G153 pesos de líneas; G122 tarifa consentida; G154 despacho bloquea pedidos falsos/no ready. Falta enlace POSITIVO: pedido original ready→Driver C legal ve oferta PRIVADA→acepta→G66 recoge→comercio handed_to_courier→G67 destinatario confirma→order y delivery delivered consistentes en B y D.
- Disputa, ítem errado, producto agotado, rechazo de courier, no-show, devolución, reembolso y stock reversal consistentes. Fármacos solo OTC permitido y restricciones de edad/categoría.
- Verificar delivery AUTO/MOTO según capacidad y tarifas, comisiones de comerciante, repartidor y plataforma por versión; jamás llamar a un carrito QA un checkout pagado.

### 9. P0-5 — TARIFAS, OWNER, LEDGER Y PAGOS
- D OwnerCommissionEditor.tsx G116/G136 y OwnerCargoRateEditor.tsx G124 ya contemplan control QA y cinco servicios en SQL; falta experiencia Owner completa de comisiones COMMERCE por vertical/comercio, alta/edición y verificación contra misma transacción histórica. Todo editable por Owner en Admin Web MFA AAL2, auditado, con valores versionados.
- Aplazar PSP LIVE hasta aprobación Owner y verificación de disponibilidad/legalidad para Paraguay. Contrato PSP: tokenización hospedada, auth/capture separados, webhook firmado, rechazo de replay, idempotencia, impuestos, recibos, devolución parcial/total, contracargos, reconciliation, settlement y payout por actor.
- apps/movete-cliente/app/pagos.tsx explícitamente dice **Pago no habilitado**; apps/movete-driver/app/ganancias.tsx no debe inventar ganancias; D finanzas solo cifras servidor conciliadas, no totales computados por el móvil.
- Subsidio pasajero 10 puntos independiente de comisión editable; envíos y comercios sin ese subsidio salvo autorización específica. Conservar PYG enteros y políticas piso para evitar retención negativa accidental. Historial de comisión por cotización y regla nunca reescribirlo.
- No mezclar PSP sintético en PG16 con dinero real. Si PSP es dependencia externa, reportarlo EXTERNAL_BLOCKED sin dejar de trabajar en pricing/ledger de QA.

### 10. P0-6 — ESTABILIDAD MÓVIL: NO MÁS PANTALLAS COLGADAS
**Motivación Owner:** fotografía de app ajena en motocicleta mostrando verificación selfie; la imagen NO permite diagnosticar el fallo exacto, pero muestra la necesidad de un flujo resistente. La captura no debe usarse mientras se conduce.
- Ya aplicado G159 en **apps/movete-driver/src/domain/driver-document-upload.mjs**, **driver-async-deadline.mjs**, DriverDocumentUploadProvider.tsx, app/documentos.tsx, tests recovery. A nivel JS: Auth 8s, nonce 6s, cámara 45s, Storage 25s, revalidar sesión 8s, observar 12s, parsear recibo 6s. Son políticas de UX, no garantías de interrupción de native modal/HTTP COMMIT.
- La cámara puede quedar visible aun si la promesa JS agotó tiempo; cerrar/cancelar modal desde SO, no prometer matar cámara nativa. Cuando regrese tarde un buffer, borrarlo. Consentimiento selfie expreso. No disparar reenvío automático de documento si hubo timeout del Storage o POST observe: podría haber COMMIT. Recuperar status privado G17/G69 primero, operador revisa anomalías.
- **PENDIENTE:** integrar realmente la cámara ImagePicker y Storage privado desde NativeDriverStagingRuntime bajo gates autorizados; hoy createDriverStagingRuntime recibe captureEvidence/uploadPrivateObject null por defecto y no expone selfie comercial real.
- Aplicar cancel/timeout/estado explícito en B/C/D a TODAS las llamadas de red críticas, AbortController donde sea seguro, circuit breaker/backoff para GET, colas idempotentes solo cuando autorizado. Para POST con ACK dudoso: recuperar por key y nunca repetir a ciegas. Guardar únicamente identificador de recuperación seguro, no foto ni JWT persistido indebidamente.
- Probar Android real en modelos básicos, cámara denied/cancelled, teléfono con poca RAM, background/foreground, cierre forzado, reconexión 2G/3G, timeout DNS, doble tap, bloqueo pantalla, dispositivo rota, GPS perdido, batería y suspensión; luego iOS. Sin falsa afirmación de crash-free rate cuando no hay telemetría de dispositivos reales.
- Observabilidad necesaria: crashes ANR, métricas de latencia por pantalla/red, correlación requestKey sin PII, salud de Auth, Geoapify y PSP, timeouts, alertas y rollback. Revisar accesibilidad, tamaño de botones, contraste, navegación offline/recovery.

### 11. P1 — CALIFICACIONES, ANTIFRAUDE, ADMIN Y DERECHO A APELAR
**Implementado en QA**:
- G155 cliente valora DRIVER/COURIER/MERCHANT al completar servicio original; campos y una entrada por servicio/objetivo, no cualquier usuario externo. SQL permite inverso CLIENT según rol y entrega. No usar el rating para despacho aún.
- G157 registra denuncia validada como mera ALEGACIÓN, agrega por fuentes/servicios independientes y solo privada. G158 agrega GET Admin AAL2/RBAC/revocación y pantalla D solo lectura, con mismo registro PG16. Acciones/suspensiones automáticas OFF.

**Pendiente integral**:
1. UI C Driver y Merchant staff para calificar CLIENT desde evento original verificado. Evitar manipulación por votos cruzados, cuentas coordinadas, rating por evento abierto, solicitudes ajenas.
2. Expediente de fraude real con caseId, origen, evidencia, cadena de custodia, fecha, responsable Admin, estados OPEN/INVESTIGATING/SUBSTANTIATED/DISMISSED, restricción reversible si corresponde, decisión firmada, motivo, notificación, apelación, SLA, auditoría; conectar a G8 con privilegio exclusivo, nunca desde rating ni cliente.
3. D Admin páginas de casos y revisión manual, anonimizar datos privados cuando sean irrelevantes. No exponer identidad del denunciante a terceros ni acusar en perfil público sin hallazgo.
4. Detección de multicuentas, pagos disputados, rutas sospechosas, cancelaciones repetidas, fraude en comprobantes, alteración GPS, colusión y reportes coordinados usando SOLO señales corroboradas y con retención mínima/legal; riesgo para revisión, no culpa automática.
5. Futuro algoritmo reputación prioriza calidad SOLO tras tamaños de muestra y evaluación de falsos positivos, fairness, explicación, apelación y autorización Owner; no activar scores punitivos por dos estrellas.
6. Protección de viajes/entregas: código PIN inicio y/o cierre independiente, IdP de ambas partes, expiración, máximo intentos, recuperación y ruta segura de disputa, no exposición de PIN/secretos ni aceptación por Driver autodeclarada.

### 12. P1 — MAPAS, UBICACIÓN, DESPACHO, OPERACIÓN EN CALLE
- Geoapify G128/G129/G130/G134: adaptadores de routing/cuota; clave según Owner en GitHub Secrets (NUNCA copiarla a la app). Falta STAGING externo con resolución real de origen/destino y tiempo/distancia, rutas AUTO/MOTO si proveedor soporta perfil y política legal, polilínea mapa B/C, seguimiento con GPS consentimiento y cadencia razonable, ETA no inventado, desvío de ruta, consumo de cuota y modos offline.
- Verificar estado cobertura Asunción/municipios autorizados, disponibilidad Drivers por vehículo, capacidad, tarifa por zona; rechazo apropiado sin conductor. No dar permiso municipal por una coordenada de Geoapify.
- Opciones y UX de comparación AUTO/MOTO con costo previo y mensaje de indisponibilidad. No exponer ubicaciones históricas no necesarias.

### 13. P1 — PORTAL COMERCIO Y ADMIN COMPLETOS
- G156 merchant staff listado QA limitado; falta login/config externa, paginación, cambio real de estado con transiciones, cancelación, picking, sustituciones, devolución, reportes y notificaciones.
- D Owner configuración cinco comisiones y tarifa por zonas/verticales, MFA/RBAC exclusivas; mantener acciones Owner fuera de Admin operativo. Admin revisión KYC, evidencia legal, incidentes G41/G157/G158, tickets y antifraude + apelación.
- D misma solicitud y provenance: Cliente orden → Driver asignado → Merchant prepared → custody proof → settlement por ledger (solo si PSP); una única cronología por ID, nunca unir fixtures por IDs parecidos.
- A21/G75/G138/G142/G145/G146/G151 traces QA distintas; no inventar endpoint universal si no está montado. Construir lector backoffice de cinco servicios canónicos sobre fuente original con permisos y límites.

### 14. P1 — IDENTIDAD, SEGURIDAD, PRIVACIDAD Y PERMISOS
- Roles exclusivos passenger, driver, merchant_staff, admin, owner; proveedor JWT autentificado, sesión no revocada, MFA AAL2 Admin/Owner, KYC Driver/vehículo validado legalmente, RLS y autorización server-side. El frontend NUNCA decide legal/finanzas.
- G38/G71 no se tocan para forzar test positivo. Licencias/seguro, habilitación municipal, vehículo correcto, horarios, zonas, documentación caducada/rechazada, proveedor identidad con selfie/liveness si es legal y autorizado (selfie sola NO verifica identidad).
- Evidencias de selfie/documentos privadas, cifrado, consentimiento, minimización, retención y acceso delimitado; no logs de rostros/tokens/GPS.
- Gestión de sesiones simultáneas, bloqueos por abuso con revisión proporcional, rate limits, prevención replay, autorización por recurso, firma de webhook PSP y mantenimiento de pruebas/evidencias.
- Nunca confirmar permisos externos, licencias de transporte, términos de proveedores o cobertura regulatoria sin validación documental real.

### 15. P0 TRANSVERSAL — CÓDIGO EN GITHUB VS RENDER/SUPABASE EXTERNOS
**Hasta instrucción Owner, NO aplicar migraciones, no crear servicios pagos, no desplegar a Render/Supabase ni LIVE.**
Trabajo legítimo AHORA en GitHub:
- Esquema duradero separado de SQL *_POSTGRES_CI_ONLY.sql; diseñar migraciones versionadas, RLS y políticas de rollback, no ejecutar SQL de guardas disposable en Supabase.
- Manifiestos de deploy reproducibles, env contracts, secretos como variables protegidas y comprobación de formato; nunca meter SERVICE_ROLE en apps, no mostrar API key.
- Health/readiness, DB pooling, índices, backups, disaster recovery, alertas, métricas y escalado; cero promesas de uptime sin pruebas.
- Montaje de los gateways reales con HTTPS pinned y verificación IdP; los flags de pruebas se mantienen OFF en apps productivas hasta certificación externa.
- Canal para pruebas no monetarias en dispositivos y posterior certificación PSP/KYC/zonas una vez Owner autorice.

**Gates secuenciales**:
1. GitHub QA unificada de **las cinco** operaciones B/A/C/D con source IDs comunes, tiempos, recovery y rechazos legales; cada gate negativo PASS.
2. Evidencia auténtica externa de Auth, GPS, documentación/permiso, permisos municipales y políticas; si falta, EXTERNAL_BLOCKED aunque CI sea verde.
3. Autorización expresa Owner para Render/Supabase STAGING y costos, recursos; ensayar migraciones reversibles (no CI guard SQL).
4. Android/iOS dispositivos reales y comercio staff web, estabilidad, cámara, permisos, GPS, carga/intermitencia/red.
5. PSP legítimo y pagos conciliados, reembolsos/contracargos, ledger y administración.
6. Revisión final seguridad, legalidad, privacidad, soporte, monitoreo, incidentes, apagado/rollback, App Store y Play Store; decisión Owner de despliegue LIVE/GO separada.

### 16. MATRIZ DE ACEPTACIÓN NO NEGOCIABLE
Marcar PASS solo con evidencia GitHub + test reproducible + IDs:
| Criterio | AUTO | MOTO pasajero | Envío AUTO | Envío MOTO | COMMERCE |
|---|---|---|---|---|---|
| Nueva solicitud desde B (carrito en COMMERCE) con identidad | Parcial QA | Parcial QA | Parcial QA | Parcial QA | Parcial QA |
| Ruta/stock/tarifa/consentimiento Owner versionado y server authoritative | Parcial QA | Parcial QA | Parcial QA | Parcial QA | Parcial QA |
| C recibe oferta privada de ESA solicitud, KYC/licencia/geo válidos | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |
| C acepta idempotente y ejecuta estados finales, G66/G67 donde aplique | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |
| B recupera exactamente el original y UI deja continuar tras fallo | Parcial | Parcial | Parcial | Parcial | Parcial |
| D ve mismo original, revision, cuotas, comisiones y auditoría | Parcial | Parcial | Parcial | Parcial | Parcial |
| PSP/settlement/recibo verificable (cuando esté autorizado) | EXTERNAL_BLOCKED | EXTERNAL_BLOCKED | EXTERNAL_BLOCKED | EXTERNAL_BLOCKED | EXTERNAL_BLOCKED |
| Legal/IdP/dispositivo real | EXTERNAL_BLOCKED | EXTERNAL_BLOCKED | EXTERNAL_BLOCKED | EXTERNAL_BLOCKED | EXTERNAL_BLOCKED |

**Test positivo no puede utilizar** Driver de fixture pre-legal para decir que cumplió G38; si la única ruta es bloqueo legal, documentar y seguir por otro tramo sin degradar seguridad.

### 17. PRIMER TRABAJO CONCRETO DEL SIGUIENTE ARQUITECTO
**NO leer 1.545 archivos, ni escribir otro handoff.** Focalizar:
1. Abrir runtime y test G160; confirmar integridad de G73→G111→G112→G16. Revisar la rama HEAD por si otra persona continuó.
2. Seguir la misma oferta a C por app/ofertas.tsx y driver-offer-decision, con autorización real server G38/G71; distinguir tests del runtime stub vs disposable PG16 transaccional. Añadir efecto verdadero al test de integración existente G98/G109, no solo un nuevo smoke paralelo sin cerrar cadena.
3. Seguir transiciones hasta C app/viaje, B historial, D auditoría, manteniendo requestKey/tripId y control de slot. Unificar recuperación por GET ante ACK perdido y comprobar cancelación de tercero.
4. En paralelo si legal bloquea, atacar COMMERCE ready→Driver→G67→delivered de mismo orderId/deliveryId o envío AUTO/MOTO con confirmación destinatario.
5. Publicar commits mínimos, workflow green; detallar qué se añadió (no solo cuántas pruebas), pruebas positivas/negativas y siguiente bloqueo concreto. Mantener sin despliegue.

### 18. GUÍA DE HERRAMIENTAS / RIESGO DE CONCURRENCIA
- Usar GitHub conectado. Antes de cada actualización: consultar rama, HEAD y árbol; crear blobs para archivos concretos, nuevo tree sobre base_tree_sha ACTUAL, commit padre HEAD; update_ref con expected_sha igual al HEAD leído y force:false. Si rechazo, comparar cambios concurrentes y reconstruir, NUNCA sobrescribir.
- CI: [qore-four-apps-unified.yml](https://github.com/mezas3238-hue/Qore-mobile-/blob/integration/qore-mobile-e2e-four-apps-20261027/.github/workflows/qore-four-apps-unified.yml) y [mobility-g4-postgres-disposable.yml](https://github.com/mezas3238-hue/Qore-mobile-/blob/integration/qore-mobile-e2e-four-apps-20261027/.github/workflows/mobility-g4-postgres-disposable.yml). Solo una vista CI de **HEAD**, no mezclar un PASS viejo con SHA nuevo.
- Cuando un check no se dispare, verificar filtros paths; éxito de tipo compile no afirma la operación E2E. No usar comandos SQL de actualización directa para simular cambio de estado si existen RPCs originales.
- No imprimir secretos, IDs reales, archivos KYC, fotos, GPS ni datos personales en logs ni documentos. Test de fraude respetará privacidad y proporcionalidad.

### 19. NO REPETIR ERRORES PASADOS
- No crear decenas de handoffs, READMEs o nuevas suites inconexas cuando falta connecting code.
- No declarar Auto/Delivery/Commerce funcional por G109 fixture antigua o G150 cargo vinculado sin repartidor; G160 solo inicia la ruta a un posible offer.
- No 'solucionar' fallos KYC por UPDATE directo de documentos, desactivar G37/G38/G71, inventar liveness o ignorar G67.
- No afirmar que cámara/sistema operativo nunca se congela: G159 vence promises JS, test Android físico sigue pendiente.
- No reintentar POST de pago/reserva/documento con requestKey nuevo luego de respuesta desconocida.
- No tratar rating G155 o alerta G157 como culpabilidad, ni activar auto-ban.
- No mezclar tarifas pasajeros y paquetes/comercios ni alterar el subsidio sin orden.
- No introducir dependencia de Google Maps cobrable: Geoapify por decisión Owner y secretos fuera de cliente.
- No pedir al Owner repetir requisitos ya presentes en este handoff.

### 20. CRITERIOS OBJETIVOS DE 'APP LISTA PARA RENDER/SUPABASE'
El siguiente arquitecto NO podrá decir 'lista' hasta demostrar:
- Matriz 5× servicios integrada B/A/C/D con fuente misma ID, capacidad, legalidad, tarifa/versionado y terminal.
- Cinco caminos de recuperación tras pérdida de red y peticiones duplicadas, sin dobles pagos/operaciones; errores explícitos (cámara, GPS, Auth, PSP).
- Reputación bilateral y flujo incidentes Admin sin sanciones ciegas, prueba independiente para handoff.
- Comisiones Owner completas, economía por fuente, contabilidad conciliada, UI real B/C/D, PSP si autorizado.
- Revisión de amenazas, MFA/RLS, IdP, consentimiento cámara/GPS, antigüedad de evidencia y auditoría.
- Integración de APIs real en STAGING externo + Android/iOS en dispositivo cuando Owner lo apruebe, soporte, observabilidad, rollback y legal; sin prometer certeza absoluta de disponibilidad.

### 21. MENSAJE EXACTO PARA COPIAR AL INICIAR NUEVO CHAT
> ACTÚA COMO ARQUITECTO EJECUTIVO INTEGRADOR A+B+C+D DE QORE MOBILE / MOVETE FÁCIL. Repositorio GitHub: mezas3238-hue/Qore-mobile-. Rama única de trabajo: integration/qore-mobile-e2e-four-apps-20261027. LEÉ PRIMERO el documento docs/handoff/HANDOFF_MAESTRO_EJECUTIVO_OPERATIVO_ABCD_G160_APP_FUNCIONAL_2026-10-28.md del HEAD ACTUAL y verificá en GitHub la rama y los dos workflows. NO HAGAS OTRO HANDOFF. NO RECONSTRUYAS. NO PRESENTES TESTS AISLADOS COMO SERVICIOS FUNCIONALES. TU PRIMER TRABAJO ES PROGRAMAR EL CIERRE DE LA NUEVA RESERVA AUTO G73/G160: oferta privada G112 al Driver C elegible por G38/G71, aceptación, lifecycle, retorno al mismo Cliente B e inspección del mismo original en D. Luego cerrar MOTO_RIDE, DELIVERY_AUTO, DELIVERY_MOTO y COMMERCE, incluyendo mapas, comisiones Owner configurables, antifraude G155/G157/G158, estabilidad selfie G159 y confirmación independiente de entrega. No falsear KYC/legal/PSP; marcar EXTERNAL_BLOCKED y seguir otros trabajos. No hacer force push, merge ni despliegue Render/Supabase/LIVE sin orden del Owner. QUIERO CAMBIOS REALES EN GITHUB, WORKFLOWS VERIFICADOS, Y UN REPORTE DEL AVANCE Y BLOQUEO CONCRETO, NO PROMESAS.

### 22. DOCUMENTOS PREVIOS REUTILIZABLES (HISTÓRICOS, NO SOBERANOS SOBRE HEAD)
- docs/handoff/HANDOFF_MAESTRO_OPERATIVO_E2E_G158_COMERCIO_ANTIFRAUDE_2026-10-28.md — gran inventario G158 de 19 secciones, matriz, rutas y política Owner. Su SHA y estado son HISTÓRICOS.
- docs/handoff/HANDOFF_MAESTRO_FINAL_A_B_C_D_GITHUB_PRIMERO_E2E_PENDIENTES_2026-10-28.md — estructura A/B/C/D, gate y bloques por vertical.
- docs/handoff/HANDOFF_MAESTRO_FINAL_QORE_MOBILE_ABCD_GITHUB_E2E_2026-10-28.md — ramas/PR, propietarios, integración anterior.
- docs/handoff/HANDOFF_MAESTRO_EJECUTIVO_QORE_MOBILE_GITHUB_A_B_C_D_G142_PRE_RENDER_SUPABASE_2026-10-28.md — infraestructura legacy.
Todos previos son ANEXOS; **el HEAD de GitHub al iniciar nuevo chat decide el estado real**, y este documento organiza la continuidad.

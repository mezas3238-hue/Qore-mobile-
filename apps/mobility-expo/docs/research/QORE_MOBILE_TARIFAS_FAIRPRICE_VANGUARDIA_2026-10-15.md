# QORE Mobile — Investigación de precios FAIRPRICE V1 + plataforma vanguardista
Fecha 15 de octubre de 2026. Estado INVESTIGACIÓN, NO TARIFARIO APROBADO. Sin cobros ni viajes reales.

## DESCUBRIMIENTO: Precios orientativos de rutas de Bolt Asunción
La sección de rutas Bolt publica estimaciones, NO una API de precios en tiempo real. Los valores cambian por hora, promociones, tráfico y disponibilidad; algunas páginas muestran categorías desactualizadas. El precio final que vería un usuario requiere mirar la aplicación en el momento.

| Ruta | Kilómetros | Minutos | Economy Gs | Moto Gs |
|---|---:|---:|---:|---:|
| Shopping del Sol a Shopping Mariscal | 2.8 | 9 | 11.511 | 7.704 |
| Multiplaza a Shopping Mariscal | 3.6 | 11 | 13.455 | 8.768 |
| Barrio Obrero a Shopping Mariscal | 8.3 | 19 | 25.682 | 15.456 |
| Barrio Obrero a Villa Elisa | 12.3 | 26 | 35.901 | 21.045 |
| Barrio Obrero a San Lorenzo | 17.9 | 36 | 50.452 | 29.005 |
| Barrio Obrero a aeropuerto | 18.3 | 37 | 51.579 | 29.621 |
| Barrio Obrero a Capiatá | 25.3 | 50 | 69.609 | 39.483 |

Fuentes por fila, en orden:
https://bolt.eu/es-py/cities/asuncion/route/shopping-del-sol-to-shopping-mariscal/
https://bolt.eu/es-py/cities/asuncion/route/shopping-multiplaza-to-shopping-mariscal/
https://bolt.eu/es-py/cities/asuncion/route/hospital-de-barrio-obrero-to-shopping-mariscal/
https://bolt.eu/es-py/cities/asuncion/route/hospital-de-barrio-obrero-to-hospital-general-de-villa-elisa/
https://bolt.eu/es-py/cities/asuncion/route/hospital-de-barrio-obrero-to-hospital-general-san-lorenzo/
https://bolt.eu/es-py/cities/asuncion/route/hospital-de-barrio-obrero-to-asuncion-silvio-pettirossi-airport-asu/
https://bolt.eu/es-py/cities/asuncion/route/hospital-de-barrio-obrero-to-el-ahorrazo-suc-capiata/

Bolt explica el precio como recogida, minutos, kilómetros, dinámico y suplementos: https://bolt.eu/es-py/support/articles/4405389269394/ . Uber usa factores similares https://help.uber.com/es/riders/article/how-does-the-upfront-pricing-work?nodeId=c5baa3cb-1daf-4329-bd7b-594a6160df50 . Bolt publica 23% auto y 20% moto en español https://bolt.eu/es-py/support/articles/8602437042322/; discrepancia en página regional inglesa 20% auto. Uber Moto ofrece pases pagados, precio visible solamente en app https://www.uber.com/py/es/blog/vos-pase-para-conductores/. No contamos todavía con cotizaciones reales de Uber pareadas.

**Precaución estadística:** kilómetros y minutos están muy correlacionados. Un ajuste lineal de estas rutas NO identifica las tarifas secretas por km/min ni el precio variable en tiempo real. No usar páginas públicas para prometer descuento garantizado.

## La fórmula QORE, tres pisos

1. Tarifa investigativa inicial según tipo de vehículo: BASE + km_pasajero × tarifa_km + minutos_pasajero × tarifa_minuto.
2. Piso del conductor: costo operativo por km de recorrido completo (recogida + trayecto con pasajero + reserva vacía) + objetivo neto operativo por hora por todos los minutos dedicados (recogida, trayecto, reserva de espera). Dividir por (1-comisión) para calcular precio mínimo al pasajero.
3. Piso QORE: costo variable seguro, soporte, mapas, riesgo dividido por (comisión−proporción_digital×tasa_pasarela). Todos esos costos requieren cotizaciones reales.
4. Tarifa es máximo de los tres pisos y tarifa mínima local; redondear a 500 Gs. Se adicionan aparte peajes, tasas y propinas según contrato. La promoción al cliente no reduce retroactivamente el pago aceptado por el conductor.
5. Si el precio necesario supera el mercado, REDUCIR pickup, mejorar costo o marcar sin oferta: no obligar a conductor a aceptar pérdida, ni presentar precio artificialmente bajo.

### Hipótesis numéricas del laboratorio (no aprobadas)
Auto: base 3.400 Gs; 1.940/km; 270/min; mínimo 11.000; pickup 2km/6min; costo operador 900/km; objetivo 15.000 Gs/h de tiempo operativo (incluye pickup y 5 min de espera); 0.5km vacío; costo plataforma 850/viaje.
Moto: base 2.000 Gs; 950/km; 260/min; mínimo 7.500; pickup 1.5km/5min; costo 380/km; objetivo 11.000 Gs/h; 0.5km vacío; costo plataforma 650/viaje. Ambos comisión 10%; 8% moto sólo escenario. Procesamiento HIPOTÉTICO 60% de pagos digitales y tasa pasarela del 2.8% sobre esos pagos; multiplicado = 1.68% del bruto medio. No incluyen todos los gastos fijos, impuestos, marketing, fraude significativo, accidentes extraordinarios o licencias; NO son cotizaciones de proveedores.

### Ejemplos reproducibles
| Ruta | Bolt Economy publicado | QORE auto laboratorio | Bolt Moto publicado | QORE moto laboratorio |
|---|---:|---:|---:|---:|
| Shopping Sol a Mariscal 2.8 km | 11.511 | 11.500 | 7.704 | 8.000 |
| Barrio Obrero a Mariscal 8.3 km | 25.682 | 25.000 | 15.456 | 15.000 |
| Barrio Obrero a Villa Elisa 12.3 km | 35.901 | 34.500 | 21.045 | 20.500 |
| Barrio Obrero a San Lorenzo 17.9 km | 50.452 | 48.000 | 29.005 | 28.500 |
| Barrio Obrero a aeropuerto 18.3 km | 51.579 | 49.000 | 29.621 | 29.500 |
| Barrio Obrero a Capiatá 25.3 km | 69.609 | 66.000 | 39.483 | 39.500 |

Ejemplo corto moto, precio 8.000 mayor que 7.704 estimado Bolt por piso de contribución: decisión honesta, no prometer siempre ser más baratos. Todas cifras QORE son simulación. Los parámetros elegidos se basan en hipótesis inspiradas en referencias públicas, NO constituyen modelo estadístico validado y la muestra de 7 rutas NO es holdout.

## Motor de navegación
Google Routes Compute Routes para tramo pasajero y Compute Route Matrix para pickup/dispatch, llamadas del servidor y cuotas/costos controlados: https://developers.google.com/maps/billing-and-pricing/pricing . Google Routes soporta motos motorized TWO_WHEELER en PARAGUAY https://developers.google.com/maps/documentation/routes/coverage-two-wheeled ; es beta con advertencias y calidad por confirmar. Waze sólo navegación externa, no la fuente de precios. En producción NO usar distancia en línea recta multiplicada por factor estimado si ruta Google falla: no cotizar si no hay ruta válida.

## Vanguardia: características diferenciadoras para investigar, no exclusividad inventada

Bolt ya tiene motos, Mujeres para mujeres, viajes en autos eléctricos, seguimiento de viaje y seguridad; Uber ya tiene precio previo, GPS, compartir trayecto, SOS y soporte. Fuentes: https://bolt.eu/es-py/cities/asuncion/ ; https://bolt.eu/es-py/rides/ ; https://www.uber.com/py/es/ride/safety/ . No atribuir a QORE una función supuestamente exclusiva sin auditoría.

1. QORE FairPrice: precio explicado, desgloses verificables al pasajero y al conductor, bloqueo de cotización aceptada y comprobante de todo ajuste.
2. Driver OS: estimación por hora CONECTADA, km de recogida y vacíos, costo vehicular individual optativo (sin prometer ganancias), comparador de calidad de viajes y vista semanal.
3. Smart Pickup: despachador reduce recogida en kilómetros, muestra su compensación y no envía viajes que dañen remuneración mínima; asignación atómica y aceptación libre.
4. Precios previsibles: sin tarifa dinámica inicial; para demanda excepcional explorar límites estrechos comunicados y sin sesgos protegidos. Motos suspendidas/limitadas ante clima inseguro, no primas que incentiven riesgo.
5. Moto Safe: identificación, verificación de pólizas para transporte de pasajeros en moto, cascos, equipamiento, inspecciones, protocolos de incidente y soporte humano real.
6. Wallet sin sorpresas: comisión publicada, efectivo por cobrar, conciliación digital, liquidación bajo acuerdos locales, trazabilidad/auditoría.
7. Accesibilidad y confianza: modos de letra alta, español/guaraní, destinos frecuentes, usuarios mayores, seguimiento compartido, soporte humano.
8. Viajes recurrentes, opción de regreso a casa y agrupación de viajes SOLO con consentimiento y evaluando seguridad/seguros.
9. IA como copiloto explicativo para resolver dudas, categorizar soporte y predecir tiempos con incertidumbre; nunca autorizar precios, licencias o cobros sin capa determinista.
10. Interfaz móvil premium, fluida, mapas con ETA consistente, estados offline seguros, pagos QR/efectivo y modo bajo consumo.

## Validación antes de producción
- >=30 rutas con 3 franjas por 3 días y ambas categorías desde las aplicaciones si permitido; registro de fuentes, cuentas, tráfico, fecha y hora; nunca representar páginas web como cotización viva.
- Facturas/cotizaciones de pólizas de auto y moto, pasarela y liquidación de fondos, Google Maps, centro de soporte, combustible/rodados y mantenimiento.
- Al menos 30 entrevistas de conductores por clase, datos anonimizados y consentimiento; medir ganancias operativas por hora conectada y pickup real.
- Pruebas de condiciones adversas: lluvia moto, pocas unidades, trayecto corto, tráfico severo, sin GPS, liquidaciones demoradas, precio fuera de mercado.
- Mantener backend real Supabase SIN modificar: su comisión sigue 15%, categoría moto no soportada y viajes reales deshabilitados; no habilitar pagos hasta autorización, seguros, auditoría RLS/RPC y cumplimiento local.
- Infraestructura técnica siguiente: versionado de tarifa del servidor, quote_id firmado temporal y snapshot de vehículo, routeVersion, costVersion, comisión y payout; ledger inmutable, idempotencia, seguridad, límites, telemetría agregada sin exposición de ubicación.

## Código
src/domain/fairprice.ts = simulación pura auditada de tres pisos; src/domain/fairprice.test.ts = pruebas de seguridad y márgenes; app/precios.tsx = laboratorio UI. Ninguna RPC productiva usa el laboratorio.

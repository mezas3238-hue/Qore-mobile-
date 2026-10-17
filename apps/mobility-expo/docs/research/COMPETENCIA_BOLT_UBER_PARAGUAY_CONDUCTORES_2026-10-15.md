# QORE Mobile — Bolt / Uber Paraguay: tarifas y estrategia de ingresos del conductor

**Fecha de corte:** 15-oct-2026. **Estado:** investigación documental, no validación de precios vivos ni aprobación de estrategia de producción.

## Hallazgos con fuentes oficiales

1. **Bolt Paraguay:** ayuda en español: comisión **23% coches / 20% motos**; aplica a efectivo y tarjeta; excluye propinas, bonos, peajes y tarifas de aeropuerto. Fuente: https://bolt.eu/es-py/support/articles/8602437042322/. **Discrepancia oficial:** la página inglesa `en-py` todavía declara 20% para ambos: https://bolt.eu/en-py/support/articles/8602437042322/. Por eso indicar **«23% según página oficial en español; verificar el porcentaje realmente ofertado por ciudad/cuenta»**. Cobro de comisiones a conductores: https://bolt.eu/es-py/_legacy/support/articles/8602349313682/.
2. **Uber Paraguay coches:** fuente oficial histórica explica **tasa de servicio variable por viaje**, no establece tasa única actual Asunción: https://www.uber.com/py/es/blog/tasa-de-servicio/ (2019). La documentación global menciona referencia cercana a 25%, pero **NO demuestra** que todos los conductores de Paraguay paguen 25%: https://help.uber.com/es/driving-and-delivering/article/understanding-ubers-variable-service-fee?nodeId=7448ffcc-ab98-4a32-b7fc-e9c17a58bb41.
3. **Uber Moto:** desde el artículo 11-sep-2026 ofrece **Pase para Conductores** (precio fijo por tiempo o por volumen elegible, 0% de tasa de servicio consolidada, **después de pagar el pase**). Su propia nota limita el programa a **Uber Moto y Envíos Moto**, y lista Asunción/CDE/Encarnación. No se debe presentar como cero coste ni asumir que aplique a UberX auto: https://www.uber.com/py/es/blog/vos-pase-para-conductores/.
4. **Tarifas de pasajeros:** tanto Bolt como Uber cotizan combinando distancia, duración, demanda y suplementos; no encontramos tabla pública oficial actual y exhaustiva de Gs/km y Gs/min aplicables en Asunción. Cotizaciones dependen de origen, destino, hora, categoría y cuenta. Bolt: https://bolt.eu/es-py/support/articles/115002917754/. Uber: https://www.uber.com/global/es/price-estimate/. **No inventar comparación de precios en rutas reales.**
5. Histórico: reportes paraguayos de mayo 2025 describen aumento Bolt autos del 15% al 20% desde el 2-jun-2025, no reemplazan la ayuda oficial actual del 23%: https://independiente.com.py/rebelion-bolt/.

## Propuesta para piloto de QORE (no aprobada para producción)

- Comisión **10% para automóviles**, plana y mostrada antes de aceptar. Payout **90% del importe comisionable**; propinas, peajes y reembolsos autorizados sin comisión, desglosados. Para motos no fijar todavía política: Uber tiene Pase y la seguridad/seguros/costos de la categoría deben estudiarse.
- Transparencia: no cobrar cuota oculta «tecnológica», suscripción obligatoria o procesamiento no anunciado al conductor. Si QORE asume las tasas de pasarela, su margen bruto de 10% debe **deducir** después costos de pago/operación/impuestos. El 90% para el conductor no equivale a ganancia neta después de combustible, depreciación y tiempos muertos.
- No bajar precios al pasajero indiscriminadamente: prueba inicial de **0 a 5% de descuento** sobre cotización externa comparable (mismas 2 direcciones, hora, categoría, suplementos, demanda) y controlar suelo de pago por trayecto / gastos de recolección y distancia.
- Un conductor acepta con pantalla que muestre precio cobrado, comisión, ingreso exacto, distancia hasta recoger, distancia del viaje, tiempo estimado, distancia total y ganancia estimada por hora efectiva. Evitar captación de viajes no rentables y falsas garantías.
- Promociones financiadas desde **presupuesto de adquisición de QORE**, no restadas del pago del conductor si el viaje fue aceptado bajo otra tarifa.
- Piloto condicionado: (a) retención conductor **mejor que comparable**, (b) contribución variable positiva de plataforma tras procesamiento, fraude, soporte y promos, (c) pruebas de liquidación y RLS aprobadas, (d) disponibilidad y solicitudes suficientes para superar ganancia neta por hora incluyendo espera y traslado.

## Ejemplos matemáticos (NO precios observados en Bolt/Uber)

Supuesto comparable: viaje Bolt auto **25.000 Gs** a 23%; conductor conserva **19.250 Gs**.

| Caso | Precio pasajero | % conductor | Ingreso conductor antes de costos | Ingreso QORE antes de costos |
|---|---:|---:|---:|---:|
| Bolt 23% | 25.000 | 77% | 19.250 | no aplica |
| QORE 10%, mismo precio | 25.000 | 90% | 22.500 | 2.500 |
| QORE 10%, 5% menos al pasajero | 23.750 | 90% | 21.375 | 2.375 |
| QORE 10%, 10% menos al pasajero | 22.500 | 90% | 20.250 | 2.250 |

A igual precio, QORE ofrece **16,9% más** de ingreso bruto al conductor (22.500/19.250-1). Con descuento pasajero 5%, ofrece **11,0% más** (21.375/19.250-1). Con 10% descuento pasajero, **5,2% más**. Las comparaciones suponen que la comisión Bolt de 23% aplica íntegra en ese viaje; ignoran retenciones, costos, bonos, membresías o promociones.

**Límite matemático**: para igualar ingreso bruto de un viaje Bolt con comisión 23%, QORE 10% puede cobrar hasta aproximadamente **14,44% menos** al pasajero (0,77 / 0,90 = 0,85556). No significa que sea viable descontar tanto: una plataforma con 10% de comisión necesita margen para operar.

## Protocolo de investigación comercial pendiente

1. Recolectar ≥30 cotizaciones contemporáneas por app **sin completar viaje** en 5 rutas de Gran Asunción × franjas pico/no pico × categorías equivalentes; registrar fecha/hora, origen/destino, distancia estimada, ETA, precio, incentivos, tipo de cuenta y capturas autorizadas.
2. Invitar conductores a proporcionar recibos **propios**, con consentimiento y datos personales anonimizados, para contrastar comisión efectiva, ingreso neto por hora, km sin pasajero, cancelaciones, y costo de pagos.
3. Obtener cotización formal bancaria/pasarela para MDR, procesamiento QR, liquidaciones, reversos, retenciones e impuestos.
4. Ensayar cuentas de resultados por viaje y por conductor/semana antes de alterar `fare_configs` del servidor.
5. Definir suelo de tarifa/pago, radio máximo de recogida, distancia compensable, condiciones climáticas, tiempos de espera y resolución de controversias.
6. Implementar ledger inmutable y pago validado solo por servidor; tickets e historial auditables; ningún cambio de comisión sin aviso contractual.

## Estado de implementación

La demostración Expo está ajustada a **10%** en `DEMO_FARES` y en vistas conductor/admin. **Backend Lovable / Supabase conserva 15%**, y `LIVE_TRIPS_ENABLED=false`. No se realizan cobros ni viajes reales. Ninguna cifra anterior es promesa garantizada de ganancia del conductor.

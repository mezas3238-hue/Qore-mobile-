# B20 — Movete Fácil: selección por movilidad y tarifario propio, no precios copiados de terceros

26 octubre 2026 · Referencias visuales: imágenes aportadas por Owner de Bolt y Uber en Paraguay. Solo análisis UI; no reutilizar marca, activos, logos, algoritmos privados ni tarifa competidora como default.

## Observado en capturas
- Uber: **AUTO pasajeros UberX** ejemplo 58.900→38.900 Gs (promoción G.20.000); **MOTO pasajeros** 34.900→22.700 Gs (la diferencia no es G.20.000, por lo que promoción no es necesariamente idéntica por vehículo); **ENVÍO AUTO** 58.900 Gs y **ENVÍO MOTO** 34.900 Gs en esa ruta.
- Bolt: Economy 19.500→17.900 Gs y Priority 29.900→27.900 Gs, además de Bolt estándar, Bolt L, Mujer y ENVÍOS AUTO/MOTO; 8 % anunciado en la pantalla y precios redondeados. No atribuir ninguna fórmula precisa Bolt al pantallazo.
- Promociones, tarifas finales, vehículos, disponibilidad y ETA son conceptos distintos. La imagen **no contiene** base, km, minuto, GPS autorizado, zona ni factores de demanda que permitan inferir costos unitarios.
- Los ejemplos NO configuran G124 ni constituyen oferta autorizada; un usuario puede recibir diferentes cotizaciones por región, fecha y conductor.

## Mandato de QORE: cinco modalidades comerciales diferenciadas
1. `AUTO_RIDE`: pasajero, tarifa base auto por zona, km y duración verificadas, mínimo, extras legales. Comisión nominal Owner configurable (actual directriz 15 %). Subsidio fijo al pasajero = 10 % de la tarifa de referencia.
2. `MOTO_RIDE`: pasajero, tarifa base **diferente** a AUTO, kg no aplican; modalidad autorizada legalmente, casco, seguro, KYC. Comisión nominal Owner configurable (directriz 12 %). Subsidio fijo = 10 % de la tarifa de referencia.
3. `AUTO_DELIVERY`: carga en AUTO, su propia tarifa, dimensiones, peso, restricción/seguro, cobertura; **sin asumir** subsidio 10 % ni comisión de pasajeros.
4. `MOTO_DELIVERY`: carga en MOTO, otra tarifa, tope de carga, vehículo habilitado; sin subsidio de pasajero. Deshabilitar si no cumple pesos/medidas/zonas.
5. `COMMERCE`: pedido comercial a supermercado/farmacia/restaurante + costo delivery según auto/moto, promociones del comercio explícitas, stock y finalización de orden. No inventar costos de producto ni comisión de comercio.

Opcional Owner futuro: variantes Economy, Confort, XL, Priority y categoría Mujer **solo con política, conductor/vehículo apto, permisos, cobertura y reglas de seguridad**; nunca inferir del nombre de Bolt su modelo legal o funcional.

## Reglas de cálculo — arquitectura de A, NO móvil
Entrada autenticada: `serviceKind`, `vehicleKind`, ruta verificable origen→destino, zona, km, minutos, peajes, peso/volumen permitido, revisión de tarifa Owner.
Modelo genérico, sujeto a aprobación:
```
precioBaseGs = max(minimoGs,
  baseGs + redondear(kmVerificados * porKmGs)
         + redondear(minutosVerificados * porMinutoGs)
         + extrasAutorizadosGs + peajesGs)
```
El backend calcula **enteros PYG**, firma/custodia `quoteId`, `fareVersion`, expira TTL, ligadura de ruta/propietario y vehículo, y comprueba vigencia de tasa. Nunca conservar o recalcular importes en el teléfono. Factores por demanda/promos opcionales **solo** cuando Owner apruebe política versionada y verificable. Sin parámetros de costo real por km/min ni zona inventados.

**Pasajeros**: `subsidioGs=round(precioBaseGs*1000/10000)`, `clienteGs=precioBaseGs-subsidioGs`. `comisiónBrutaGs=round(precioBaseGs*comisionBps/10000)`, `plataformaGs=comisiónBrutaGs-subsidioGs`, `conductorGs=precioBaseGs-comisiónBrutaGs`. La comisión configurada por Owner no se reduce ni se modifica para “generar” subsidio: la plataforma lo financia de su parte. Deben cuadrar sumas y reversos en ledger. Envíos/comercios permanecen sin política de subsidios hasta orden explícita.

## Trabajo B20
`mobility-fare-choices.mjs`: proyección **solo lectura** de snapshots ya validados en Cliente. Lista fija AUTO/MOTO pasajeros, ENVÍOS AUTO/MOTO y COMERCIOS; extrae el monto únicamente de recibos B de Auto G93, Moto G101 o cargo G7/G122 sobre G121 privado. Rechaza precio vencido, ajeno, falso y subsidio no conciliado; `COMMERCE` siempre sin total hasta checkout confirmado. Para modos no cotizados: **Sin tarifa confirmada**. Jamás deduce disponibilidad, ETA, conductor, PSP, GPS ni booking de una cotización.

`app/cotizacion.tsx`: muestra importe original+subsidio de pasajeros cuando existe recibo; envío muestra Gs solo de su vehículo y sin subsidio pasajero; navegación a formulario del servicio, NO botón de reserva.

## Contratos faltantes a A
- Cotización previa al booking para las 4 modalidades en **el mismo origen/destino** con proveedor de ruta y datos originales, response ETA/disponibilidad acreditados por separado y total exacto versionado.
- G124 Owner AAL2 tarifario de cargo por zona existe en QA, G125 verifica contexto de ruta independiente pero **sin proveedor real conectado**. Extender modelo sin mezclar tarifas.
- Precio de comercios: `itemsSubtotal+deliveryFare+fees-tariffPromotion` con validación stock, acuerdo comercial y política Owner; promociones e impuestos solo si se aprobaron.
- Integrar A/B/C/D con el mismo serviceId, aceptación precio, ofertas elegibles, custodia y ledger, negativas SQL y G38/G71. No prometer tiempo pickup ni disponibilidad sin telemetría.
- No merge, LIVE, compras de API, cuentas PSP o despliegue sin orden.


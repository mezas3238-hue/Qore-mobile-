# B21 — mandato Owner: todas las comisiones se configuran en la Web Admin

**Fecha:** 26-oct-2026 · **B Cliente** · coordinación A Backend y D Admin. Estado comercial NO_GO; PR #8 DRAFT.

## Orden de producto, sin porcentajes fijos
El propietario **debe poder cambiar desde Admin Web** las comisiones de los **cinco servicios** del catálogo de Movete Fácil, manteniendo las subcategorías de comercios separadas:
- `AUTO_RIDE` pasajeros y variantes configuradas (Economy/Confort/XL sólo si backend las aprueba).
- `MOTO_RIDE` pasajeros.
- `AUTO_DELIVERY` paquetería.
- `MOTO_DELIVERY` paquetería.
- `COMMERCE`: comercios con porcentajes independientes por supermercados, farmacias, restaurantes, otros; y por subclase/vehículo/zona si existe regla aprobado en A.

**Los valores 15 % AUTO y 12 % MOTO eran configuraciones iniciales mencionadas por Owner, NO valores fijos.** El Cliente nunca anuncia esos valores como inalterables ni recalcula % en teléfono. Cualquier cambio aprobado por Owner debe afectar nuevas cotizaciones únicamente, sin recompilar app ni cambiar órdenes cotizadas.

## Regla de subsidios
Solo pasajeros reciben el subsidio fijo **10 % del monto base/original**, separado de comisión. La comisión nominal `commissionBps` se configura por servicio en el servidor, y la retención bruta de plataforma es comisión menos subsidio. Si se baja del 10 % se requiere política Owner explícita para margen bruto negativo (o se rechaza por límites actuales A): nunca presentar 5 % o 2 % como retención fija ni asumir garantía de ganancia. Envíos/comercios usan sus propios componentes sin aplicar subsidio pasajero.

## Implementación real B21
- `app/transporte.tsx`: sustituido texto estático de porcentajes por mensajes de **comisión definida en Admin Web por el propietario**, para AUTO y MOTO por separado. Se conserva mención de subsidio del pasajero 10 % y seguridad legal.
- `owner-configurable-commission-client.test.mjs`: verifica que recibos certificados con comisiones diferentes para AUTO y MOTO se proyectan correctamente sin cambiar código, que 10 % de subsidio permanece, que falseo de reparto nunca da precio y que CARGO/COMERCE no heredan % pasajero.
- `mobility-fare-choices.mjs` B20 ya muestra únicamente porcentajes procedentes de recibos verificados por backend, no tiene defaults de comisión.

## Infraestructura comprobada: parcial, no completa
- **A backend:** G116 Owner comisión pasajeros AUTO_RIDE y MOTO_RIDE; G124 Owner AAL2 tarifas y comisión cargo AUTO/MOTO. Debe completar modelo versionado de COMMERCE, subcategorías y base de cálculo de comisión (productos vs delivery), versionado efectivo, auditoría, CAS y reconciliación contable. Cero defaults inventados.
- **D Admin:** `OwnerCommissionEditor` edita solo pasajeros; `OwnerCargoRateEditor` permite tarifas/comisión de envío por zona, ambos con flags OFF hasta endpoints/IdP externos certificados. **Falta la sección web completa de comisiones comerciales**, coordinación issue #18.
- **B Cliente:** no puede configurar ni aprobar tasas, sólo consumir sus recibos ya confirmados por A.

## Prueba final requerida
1. Owner Auth+AAL2 cambia comisión AUTO sin afectar MOTO/CARGO/COMMERCE y cambia MOTO separadamente.
2. Owner cambia tasa CARGO AUTO sin tocar CARGO MOTO; cambia distintas categorías comerciales independientemente.
3. Nueva cotización se calcula en backend con nueva versión y se refleje en Cliente sin upgrade.
4. Cotización/viaje previo mantiene su comisión, subsidio y ledger inmutables; conciliaciones y reembolsos reproducibles.
5. Denegación Admin sin Owner, AAL1, token revocado, conflicto CAS 409, timeout/ACK ambiguo y acción concurrente.
6. App Driver y Admin solo visualizan tasa autorizada, no hacen sizing/repartos económicos por cuenta propia.

**Restricciones:** NO MERGE/LIVE/PSP/deploy/recursos de pago ni asegurar función comercial hasta QA E2E PostgreSQL con A/B/C/D.

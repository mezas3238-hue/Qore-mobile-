# G304 — Pagos de Cliente y conciliación de Comercios, Repartidores y Movete Fácil

## Contratos de producto propuestos

Cliente: la pantalla de confirmación muestra **EFECTIVO** y **TARJETA**, total y moneda antes de aceptar. La disponibilidad de efectivo depende de la política por servicio, zona, comercio, riesgo y aceptación previa del Driver. No permitir cambiar el medio de pago después de completar el servicio sin consentimiento/registro seguro.

Los pedidos de Comercio contienen DOS partidas económicas independientes: productos y envío. Una tarifa versionada, calculada por servidor y aprobada por Owner, asigna comisión sobre productos y sobre envío por separado. Las ganancias pertenecen a TRES beneficiarios: Comercio, Repartidor y Movete Fácil. La comisión no se calcula sobre propinas ni tributos de forma no pactada; políticas de impuestos y arancel PSP deben validarse legal/contablemente.

Ejemplo en guaraníes (tasas DEMO):
- Productos: Gs. 100.000; costo entrega: Gs. 15.000; cliente paga: Gs. 115.000.
- Comisión QORE por productos: 10% de 100.000 = 10.000; Comercio neto: 90.000.
- Comisión QORE por reparto: 20% de 15.000 = 3.000; Repartidor neto: 12.000.
- Comisión bruta QORE: 13.000; **90000 + 12000 + 13000 = 115000**.
- Arancel del procesador, si corresponde a plataforma por contrato, se contabiliza aparte y reduce solo su neto; nunca reducir silenciosamente el valor de los productos o el pago del repartidor.

## A. TARJETA — cobro digital

1. Cliente acepta un checkout con reserva, stock y tarifa congelada. El proveedor de cobros autorizado tokeniza la tarjeta y confirma mediante eventos autenticados.
2. Pedidos cancelados, no entregados o discutidos NO se liquidan automáticamente.
3. Con pedido confirmado entregado y **fondos liquidados/disponibles**, el ledger crea UNA asignación por pedido: Comercio 90.000, Repartidor 12.000, plataforma 13.000, más costo PSP a descontar de la comisión si la política lo permite.
4. Un PSP apto para marketplace puede administrar split/subcomercios y payouts; si no lo ofrece **no** hay liquidación automática de terceros: no se debe asumir que `Tpago` la tiene ni usar las cuentas de Movete Fácil para custodiar fondos sin acuerdo legal.
5. Cada pago y destino debe quedar conciliado mediante comprobante independiente: `CAPTURED` o `PAYOUT_SENT` no equivale a `SETTLED` / `PAID`.
6. Un reembolso o contracargo exige asientos inversos auditables y gestión de saldos, no edición del registro original.

## B. EFECTIVO CONTRAENTREGA — el repartidor cobra al cliente

**Riesgo distinto de los viajes:** el Repartidor recibe físicamente Gs. 115.000, pero **solo Gs. 12.000 son su ingreso económico**. Queda una obligación de rendición por Gs. 103.000: Gs. 90.000 al Comercio + Gs. 13.000 a Movete Fácil. No registrar Gs. 115.000 como cobro bancario o caja física de Movete Fácil.

1. Solo habilitar contraentrega cuando Comercio y Owner aprobaron la política, Driver posee documentación vigente, acepta custodiar ese importe, el pedido es de una zona habilitada, el total es menor al tope Owner y no hay restricción por riesgo.
2. A la entrega, Cliente y Repartidor ratifican monto; prueba independiente de recepción y resolución de desacuerdo. **No crear obligación definitiva ante un cobro no confirmado o parcial.**
3. El sistema registra **saldo de efectivo por rendir** del Repartidor, separado de su ganancia por el envío y de las comisiones de viajes de pasajeros.
4. El Repartidor rinde Gs. 90.000 al Comercio y Gs. 13.000 al canal de cobranza de Movete Fácil (o la forma contractual autorizada). Los dos pagos se identifican con la ID de pedido. El Comercio ve `PENDIENTE DE RENDICIÓN`, `PARCIAL` o `ACREDITADO` según comprobantes conciliados, jamás por una mera pulsación.
5. **Para primera salida comercial: recomendamos DESACTIVAR el efectivo contraentrega de productos** hasta certificar cobro, límites, seguro/garantías y depósitos. Permitir tarjeta para pedidos de Comercios; mantener efectivo para viajes solamente con comisiones compensables y política Owner.
6. Alternativa futura de menor riesgo: al pagar por QR/transferencia, el comprador envía productos al Comercio y entrega al Repartidor solo el precio del envío (cuando el proveedor y producto lo permitan); se necesitará constancia dual y conciliación de dos operaciones sin duplicados.
7. Para producto de alta cuantía, artículos sensibles o comercios nuevos, tarjeta/transferencia directa es preferible. No ofrecer contraentrega a cuenta nueva sin política aprobada.

## C. Conciliación administrativa

- Libro contable con `order_id`, versión de catálogo, tarifa y comisiones, líneas productos/envío, pago y custodia, referencias del proveedor, beneficiarios, estado y eventos de reembolso; **no números de tarjeta ni claves**.
- Restricciones `UNIQUE(order_id,method,charge_id)` y `UNIQUE(provider_event_id)`; subcuentas por Comercio, Repartidor y plataforma; escritor transaccional con bloqueo por pedido, RLS y roles de servicio mínimos.
- No asentar dos veces contra webhooks repetidos, reintentos, entrega parcial o cierres de pedido. Resolver pagos PSP con estado desconocido por consulta al procesador, no reenvío ciego.
- Conciliación por pedido, por día y por periodo de liquidación: asignado / pendiente / confirmado / retenido / disputado. El Dashboard del Comercio solo puede ver SUS pedidos y comprobantes, el del Repartidor SUS importes y entregas.
- **Soporte** puede inspeccionar un ticket autorizado y escalar una anomalía. No puede autorizar reembolsos, cambiar beneficiarios, porcentajes, rendir efectivo ajeno o transferir.
- **Owner con MFA AAL2** establece porcentajes y topes futuros; cada pedido mantiene la versión congelada original, que no cambia retroactivamente.
- Reembolsos por cancelación, devoluciones y mercancía defectuosa requieren flujo formal (quién responde y quién recibe contracargo), antes de LIVE.

## Estado del repositorio

`server/g304-merchant-financial-reconciliation-qa.mjs` añade prototipos offline para tarjeta, efectivo contraentrega y dos comprobantes de rendición; con tests automatizados. **LIVE = OFF.** No hay pagos reales, transferencias, cuenta bancaria, integraciones PSP ni base de datos para G304; todo está en PR DRAFT. Los cinco E2E STAGING externos siguen sin certificación.

## Opciones bancarias paraguayas por investigar, no comprometidas

- Banco Central: SPI 24/7, hasta ₲10 millones por operación entre participantes habilitados. No garantiza liquidación de adquirencia de tarjeta: https://www.bcp.gov.py/es/web/institucional/sistemas-de-pago-y-tesoreria
- Bancard Tpago: ofrece cobro con tarjetas/QR, API y sandbox. La documentación **no acredita por sí sola** split 3 beneficiarios ni payout a terceros: https://tpagodocs.bancard.com.py/
- Contratar formalmente proveedor capaz de marketplace/split, pagos a terceros, KYB de comercios, KYC de Drivers, reporte y manejo de contracargos; asesoría legal y BCP antes de activar operaciones.

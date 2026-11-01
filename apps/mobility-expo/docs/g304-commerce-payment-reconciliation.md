# G304 — Comercio PREPAGO DIGITAL OBLIGATORIO (decisión Owner, 1 noviembre 2026)

## Regla de producto no negociable

**Toda compra de mercaderías en un Comercio de Movete Fácil debe pagarse digitalmente y quedar verificada antes de permitir la preparación y entrega.** NO existe efectivo ni pago contraentrega para pedidos de comercios. Esta regla prevalece sobre los borradores anteriores de G304.

El Cliente tendrá métodos de pago distintos por tipo de servicio:
- Viajes AUTO/MOTO y envíos particulares: EFECTIVO o TARJETA, sujetos a política operativa y Driver.
- **Carrito/compra a Comercio: exclusivamente medios digitales prepago** (tarjeta; transferencia/QR únicamente cuando un proveedor permite comprobar su acreditación de forma confiable). No mostrar ni aceptar EFECTIVO ni pago al repartidor.

## Máquina de estados obligatoria

1. `CART_CONFIRMED`: Cliente selecciona mercadería, cantidades y dirección. Servidor comprueba catálogo, stock, comercio, zona, precios y costo del envío. Cotización con versión de comisión Owner **congelada**.
2. `AWAITING_PAYMENT`: Se crea orden pendiente y se retiene stock con plazo de vencimiento. El botón «Pagar antes de pedir» inicia el cobro mediante PSP autorizado. No se debe preparar ni despachar mercadería.
3. `PAYMENT_VERIFIED`: El servidor comprueba evento PSP auténtico, cobro correspondiente a ese pedido, mismo cliente, importe completo PYG, método permitido y ausencia de reembolso/reversión. Tarjeta necesita **CAPTURED** (no solamente AUTHORIZED); transferencia/QR debe estar **SETTLED**. Se revisa el estado actual de pago en cada transición relevante y se impiden replays mediante identificadores únicos.
4. `PREPARING`: Solo tras pago confirmado se permite el aviso al Comercio y comienzo de preparación.
5. `READY_FOR_PICKUP` → `IN_TRANSIT` → `DELIVERED`: Preparación y entrega siguen flujo verificado; ningún repartidor recibe dinero del comprador por la mercadería.
6. `SETTLEMENT_PENDING`: Tras entrega confirmada y **fondos disponibles/liquidados del PSP**, el motor separa dinero para Comercio, Repartidor y comisión plataforma.
7. `MERCHANT_PAID` / `COURIER_PAID`: Cada beneficiario se marca como pagado solamente al recibir recibo del proveedor de desembolsos, no por mera solicitud. Si hay devolución, disputa, falta de entrega o contracargo, se retienen o corrigen las liquidaciones.

**Cobro confirmado antes de entregar** es diferente a **liquidación bancaria a Comercio y Repartidor después de entregar**.

## Ejemplo de distribución con dinero digital, no efectivo

Pedido: productos Gs. 100.000 + reparto Gs. 15.000 = Cliente paga digitalmente Gs. 115.000 antes de preparación.
- Comisión productos 10 % (solo ejemplo): Gs. 10.000. Comercio Gs. 90.000.
- Comisión reparto 20 % (solo ejemplo): Gs. 3.000. Repartidor Gs. 12.000.
- Movete Fácil: Gs. 13.000 de comisión bruta, menos aranceles PSP si así se acordó.
- Debe cerrar exactamente: `115000 = 90000 + 12000 + 13000`.

No asumir porcentaje de comisión antes de que el Owner lo configure en servidor ni modificar retroactivamente reglas congeladas. Los impuestos, propinas y aranceles se desglosan según contrato antes de operar realmente.

## Seguridad y conciliación

El backend final necesita un único escritor transaccional para cobro confirmado, stock reservado y autorización de preparación. `UNIQUE(order_id,psp_payment_ref)` / `UNIQUE(provider_event_ref)`, RLS, bloqueos y caducidad del pedido evitan despacho sin pago y cargos duplicados. Proveedor debe autenticar webhooks y permitir consultar el pago ante timeout. No confiar en capturas de pantalla, SMS, QR presentado por cliente ni estado local de app.

Conciliar por pedido y por lote: (a) cobro de Cliente, (b) venta y producto, (c) tarifa de entrega, (d) comisión Comercio, (e) comisión Repartidor, (f) arancel PSP, (g) liquidación Comercio, (h) liquidación Driver, (i) devolución/reclamación. Mantener pruebas de auditoría sin PAN/CVV ni datos innecesarios.

Accesos:
- Comercio ve solo SUS pedidos, cobros confirmados, netos, desembolsos y devoluciones.
- Repartidor ve solo sus entregas/ganancias y **no recibe pagos de mercadería**.
- Owner con MFA AAL2 configura comisiones y consulta conciliación; Soporte solo atiende incidencias, sin pagos, reembolsos ni cambios de tarifas.

## Estado de código (QA, aún NO LIVE)

- `server/g304-merchant-financial-reconciliation-qa.mjs` incluye `prepareCommercePrepaidFulfillmentGateQA` para bloquear preparación antes de cobro autenticado y `prepareCommercePrepaidSplitQA` para calcular reparto **solo después de entrega + PSP SETTLED**.
- `prepareCommerceCODReceivableQA` y `verifyCommerceCODRemittanceQA` permanecen como interfaces de compatibilidad que **rechazan siempre** con `MERCHANT_CASH_PROHIBITED`. No generan dinero adeudado ni custodia por repartidor.
- Pruebas automatizadas verifican tanto pago previo como liquidación posterior, rechazos de efectivo, importe equivocado, método no permitido, evento falso, tarifa adulterada y entrega no certificada.
- NO se ha integrado PSP real, no se ha instalado esquema G304 en PG17, no se ha desplegado en Railway, no se han hecho cobros ni payout bancario real. Todos los flags LIVE y COD permanecen OFF.
- Los 5 recorridos externos completos todavía requieren certificación.

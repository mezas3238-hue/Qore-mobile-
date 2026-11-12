# G303 — Cliente paga efectivo; Driver debe comisión a Movete Fácil

## Qué sucede realmente

1. **Antes de aceptar**, Driver ve que el viaje es EFECTIVO (cuando la política de producto lo permita), monto estimado y su propia preferencia de aceptar/rechazar efectivo; el cliente ve el medio de pago. La aplicación debe permitir cambiar preferencia de efectivo sin penalidad injusta.
2. Al terminar y **cobrar físicamente al cliente**, el Driver introduce/acepta la cantidad cobrada. La confirmación del cliente o una resolución independiente ratifica el recibo. Si hay pago parcial, ausencia de pago, desacuerdo, reembolso o seguridad activa, el registro queda **EN DISPUTA** y NO crea deuda de comisión final ni habilita penalización automática. Soporte abre caso sin acceso al dinero.
3. El Driver retiene el **100% de los billetes** cobrados (no se transfiere desde QORE). La app registra la tarifa neta del Driver y una cuenta **por cobrar de comisión QORE**, calculada con la regla Owner versionada vigente al reservar, sin aplicar comisión sobre propinas, incentivos ni peajes cuando la política así lo establezca.
4. En posteriores viajes digitales el procesador deja fondos verificados disponibles. El motor, mediante transacción SQL y autorización contractual, **compensa** parte de la comisión pendiente con el importe que le correspondía liquidar al Driver. La deducción es contable, no un débito a la cuenta bancaria del Driver. El resto se paga mediante PSP.
5. **Protección de ingresos:** versión Owner de límites de compensación automática `maxOffsetBps` y `minimumDriverPayoutPyg`, evitando retener arbitrariamente el 100% de los pagos digitales. Si sobra deuda, queda pendiente; el Driver puede pagarla por el canal autorizado cuando se contrate con proveedor habilitado. No inventar límites monetarios: requieren decisión del Owner y condiciones transparentes.
6. **Imposibilidad de compensar:** si nunca llegan pagos digitales, no es posible cobrar mágicamente una comisión de efectivo. Debe existir una alternativa de pago voluntario de deuda mediante instrumento autorizado y conciliación firmada, o ajustar temporalmente los nuevos viajes en efectivo bajo política aprobada, comunicación previa y revisión de disputas.
7. Para seguridad del Driver: no intentar cobrar compulsivamente una deuda frente al Cliente, no exigir efectivo si hay riesgo, no mostrar datos de identificación innecesarios. Nunca penalizar automáticamente por reportar efectivo impago.

## Contabilidad

Efectivo Gs. 50.000, Owner 20% sobre subtotal Gs. 50.000:
- Cliente entrega Gs. 50.000 al Driver **fuera de la custodia de Movete Fácil**.
- Ingreso económico neto del Driver: Gs. 40.000.
- Comisión devengada y *por cobrar* QORE: Gs. 10.000.
- Asiento interno: débito a `driver_commission_receivable` Gs. 10.000; crédito a `platform_commission_earned` Gs. 10.000. No registrar entrada de Gs. 50.000 en caja de QORE.
- Si un servicio digital posterior le genera Gs. 40.000 de ganancia al Driver, aplicando política Owner de compensación hasta 50% y mínimo Gs. 10.000, podrá compensarse Gs. 10.000 y transferirse Gs. 30.000 al Driver **tras la confirmación del PSP**. La deuda queda en cero.
- Un abono duplicado por red de cobranzas y compensación simultánea necesita asiento transaccional de idempotencia para no cobrar dos veces.

## Código G303 y lo que falta

`server/g303-cash-commission-qa.mjs` y los tests son contratos de laboratorio, NO el ledger real. Devuelven `liveOperationsEnabled:false` y no hacen operaciones financieras.

Pendiente en PG17: tablas de operaciones en efectivo con `UNIQUE(service_kind,booking_id)`, evento de recibo verificado, saldo de comisión por Driver, tabla de compensaciones con `UNIQUE(digital_settlement_id)`, historial doble entrada, `SELECT FOR UPDATE` y transacción serializable; gestionar errores del PSP, reversiones y conciliación. No instalar sin QA de dos Drivers y carreras de cobro/compensación. Mantener RLS y secretos del PSP fuera de apps.

## Referencias oficiales (observadas 2026-11-01)

- Bolt Paraguay: https://bolt.eu/es-py/driver/guide/commissions/ — comisión para efectivo y tarjeta, saldos y pagos por red de cobranza.
- Bolt Paraguay: https://bolt.eu/es-py/support/articles/8602349313682/ — pago pendiente y restricción de efectivo.
- Uber: https://help.uber.com/es/driving-and-delivering/article/how-do-cash-trips-work-?nodeId=39353185-bc12-4126-8e0e-55663804f91d — Driver cobra en efectivo y se ajusta saldo digital.
- Algunas guías oficiales Bolt muestran tasas y umbrales distintos; Movete Fácil no copia valores ni aplica suspensiones sin política aprobada.

### Prohibiciones actuales
- NO traspasos bancarios de efectivo inexistente; NO cobro físico directo por QORE.
- NO retener fondos del Driver sin contrato, conciliación ni obligación real comprobada.
- NO habilitar LIVE o PSP; NO crear deudas reales en STAGING durante pruebas.

# Arquitecto B R71 — G93 AUTO subvención de pasajero 10 % (QA)

Contrato observado en A: OpenAPI G93 `POST /v1/staging/rider/auto/prequotes/{quoteId}/subsidy`.
Ejecuta un POST **sin body** exclusivamente de lectura/idempotencia de una
previsualización ya calculada/persistida por PostgreSQL del backend; el pasajero
no manda tarifa, tasa, campaña ni porcentaje. NO pagos.

Implementación en B: respuesta estricta G93 enlazada a Owner Passenger JWT,
`quoteId`, tarifa G73 en PYG, `fareVersion`, expiración, importes enteros.
Integridad verificada por ecuaciones enteras (BigInt) sin calcular una tarifa
alternativa para UI; la UI muestra exclusivamente `originalFareGs`,
`customerSubsidyGs`, `customerPaysGs` del recibo del servidor.
AUTO 1500 bps comisión nominal / 1000 bps subsidio / 500 bps plataforma,
porcentaje siempre del importe original. Un fallo, JWT rotado, campaña inválida,
pérdida de coincidencia o expiración impide consentir y reservar.

La aplicación nativa no puede habilitar G73 sin G93 en esta generación:
`EXPO_PUBLIC_F1_G93_SUBSIDY_CONTRACT_VERIFIED=true` se exige adicional a
aprobaciones existentes G73, proveedor ruta, PostgreSQL y origen HTTPS pinned.
**NO establecer flags true sin certificado A + acta Owner.**

Limite real: A declara este endpoint sin runtime externo montado.
Pruebas automáticas son sintéticas. No existe garantía de monto final real,
subsidio comercial, permiso legal, servicio completo, instalación ni PSP.
La transacción del backend debe mantener vinculada la previsualización G93
con el booking G73 en la misma PostgreSQL sin carrera de caducidad.
MOTO_RIDE necesita su contrato financiero propio y aprobación legal.

P0 pendiente: A certificar OpenAPI G93, endpoint QA HTTPS persistente,
que G73 booking use el `campaignId`/receipt de esta quote, y lectura Admin
de desglose financiero y auditoría; integrar prueba E2E con dispositivos.

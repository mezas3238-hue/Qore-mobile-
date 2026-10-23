# QORE Mobile — Arquitecto B · Dashboard Owner (22-10-2026)

**PR:** [#8 — Arquitecto B](https://github.com/mezas3238-hue/Qore-mobile-/pull/8) DRAFT · `apps/movete-admin/**` y `docs/architect-b/**` exclusivamente. **NO LIVE, MERGE, despliegues ni cobros.**

## Propósito

El Admin Web tendrá **dos perfiles distintos**, definidos y verificados por el servidor del Arquitecto A: `admin` para operaciones autorizadas y `owner` para vista financiera del propietario. Ningún rol se concede desde el navegador ni se usa la credencial `service_role` en el bundle. Ambos requieren MFA confirmada por proveedor y verificación efectiva en backend. El backend sigue siendo soberano en permisos; la separación local es solo defensa adicional de presentación.

| Operación | owner | admin | Estado frontend |
|---|---|---|---|
| Resumen financiero agregado conciliado | Ver según JWT owner verificado | No | Presentación y proyección QA preparadas, API pendiente |
| Documentos/KYC de conductores | No por rol owner | Ver metadatos según permiso admin. Decidir solo con API auditada | Visor read-only y entrenamiento sintético |
| Cambiar tarifas/comisiones | No en UI; requiere futuro procedimiento Owner aprobado | No | **Deshabilitado para ambos** |
| Ver detalle bancario/documentos de terceros | No implícito | No implícito | No hay campos ni URLs en el DTO |

## Implementación publicada
- `129b36dede0713cdaa23931ad9a01963c8a09ef7` — `owner-finance.mjs` y pruebas Node: allowlist estricta de DTO owner, moneda PYG, enteros de Gs, historial/periodo máximo 92 días, conciliación `RECONCILED`, expiración máxima 5 minutos, ledgerVersion, rechazo de PII y actor ajeno.
- `ede7c29650e0c248e1532f88debd6cbe7ab23677` — `admin-session` soporta perfiles `owner` y `admin` con MFA; `admin-experience` separa snapshots, permite solo al owner leer resumen financiero y bloquea KYC/vehicle review para ese rol; tests adversariales.
- `1fb2e232583a642d65b82273de1d8c4aed06e357` — UI nueva **Propietario**, seis tarjetas Gs, recuentos de viajes/envíos/órdenes, fuente de datos etiquetada y estado «—» para valor no verificado. Ningún dato inventado ni controles que cambien el ledger.
- `d30ad5eb7ce7f1f489cbfe4d397c67bfb9b99787` + `ace3760a5fdd9403f596b5b1a10896f19a03e238` — Respuestas tardías de review KYC tras logout/cambio de cuenta se ignoran.
- `fe2ef56906cf36b1d9cfd1011e547b0d6a6e385c` + `5c0878c7c0942b74b4196b40b9af796f4b68a1cf` — Neto financiero negativo legítimo por pérdida queda permitido; cifras de comisiones/bruto negativas se rechazan.
- `935030820b64b45703d8ddb8fd7c640c960f6a8a` — Se evita que Owner entre a interfaz KYC como si heredara permiso revisor.

**Pruebas confirmadas:** los checks existentes `Movete Facil Architect B ownership boundary` y `Movete Facil two app isolation` finalizaron **SUCCESS** en commit de UI `1fb2e232`: runs #39887088244 y #39887088331. Estos checks **no ejecutan el build propio de Admin**, sus tests adicionales no pueden llamarse certificados. No se realizó un despliegue.

## Contrato Owner solicitado a Arquitecto A — NUEVO, pendiente de decisión
Propuesta para `GET /v1/staging/owner/finance/summary?from=YYYY-MM-DD&to=YYYY-MM-DD`:

- Solo JWT servidor con rol `owner`, step-up MFA vigente y autorización por acción `owner.finance.read`. No confiar en rol enviado desde JavaScript.
- Datos exclusivamente agregados del ledger autoritativo, con corte y trazabilidad en Paraguay: `scope='owner.finance.read'`, `ownerId` desde JWT, `currency='PYG'`, `period:{from,to,timezone:'America/Asuncion'}`, `revision`, `ledgerRevision`, `reconciliationStatus='RECONCILED'`, `generatedAt`, `expiresAt`.
- `totals` con enteros seguros de Gs: `completedRides`, `completedDeliveries`, `completedMerchantOrders`, `grossCollectedGs`, `driverPayoutGs`, `platformCommissionGs`, `refundsGs`, `processingFeesGs`, `netPlatformGs`. El neto de plataforma puede ser **negativo** si el ledger reporta pérdidas. No extrapolar utilidad contable/fiscal de ese neto.
- No incluir nombres/documentos/placas/teléfonos/tokens/cuentas bancarias/recibos de terceros.
- Tests 401 sin sesión, 403 admin/driver/passenger, MFA no validado, ledger no conciliado o vencido, 409 revisión, 429 throttling, 503 falla y control de PII. Autorización y auditoría requieren RLS/DB por A.
- **Un endpoint propuesto no existe por el hecho de describirlo aquí.** No ejecutar la integración hasta contrato y staging certificados.

## Trabajo pendiente y coordinación
1. A incluye el contrato Owner, Auth/MFA y lectura KYC versionada, con respuestas tipadas, autorización y evidencia CI/RLS. El Owner no necesita privilegios documentales por defecto.
2. A agrega a su propiedad `.github/**` un job que ejecute `npm run check && npm run build` dentro de `apps/movete-admin` (sin instalar root ni cambiar archivos B).
3. B verifica Admin build y E2E de roles. Después conecta pantallas con endpoints **solo STAGING**, sin liberar LIVE.
4. El propietario aprueba por separado las políticas económicas/regulatorias de Paraguay antes de cambios reales de comisión/tarifa. Ni backend ni UI suponen tasa concreta.

**Estado: Infraestructura visual y validadores QA avanzados. Admin real no certificado.**
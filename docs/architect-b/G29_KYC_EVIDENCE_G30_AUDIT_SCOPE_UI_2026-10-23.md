# QORE Mobile — G29 KYC documental y G30 auditoría parcial — Arquitecto B

23/10/2026. PR #8 DRAFT. Contratos del backend A rev. G29/G29.1 y G30.

## Código

- `apps/movete-admin/src/kyc-page-view.mjs` tipado en `.d.mts`: clasifica únicamente los tres campos documentales `licenseStatus`, `insuranceStatus`, `inspectionStatus`, siguiendo prioridad `EXPIRED > REJECTED > MISSING > PENDING > REPORTED_VALID`. Ni `approved` de aplicación ni tres `valid` concluyen habilitación operativa; `operationalEligibilityConfirmed:false` siempre.
- `main.tsx` muestra filtros en la **página visible**, contadores locales y avisos de ausencia sin inventar que el universo está vacío. El estado de expediente sigue intacto y sólo el backend lo certifica. Cero controles para aprobar o eliminar, sin imagen ni documento privado.
- `main.tsx` indica que G30 cubre sólo auditoría parcial de G2/G8 (vehículos, incidentes, suspensiones). No afirmar contabilidad, tarifa, zona, merchant ni acceso de operador auditado mientras falten fuentes.
- QA adversarial: 50 elementos por página, 120 páginas sin máximo global, rol MOTO_PASSENGER rechazado, datos PII no expuestos, expiración reportada prioritaria.

## Gates pendientes

G29 y G30 sólo están conectados a composición local loopback y SQL en PostgreSQL descartable. Faltan Auth/MFA AAL2 externo real, HTTPS STAGING y auditoría completa. NO MERGE, NO LIVE, no pagos ni KYC operativo, sin tocar Arquitecto A/Driver.
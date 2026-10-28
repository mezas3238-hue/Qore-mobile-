# QORE Mobile · B · Contratos A05 y G29 KYC, Zonas, Auditoría (23/10/2026)

El contrato OpenAPI A05 del Arquitecto A establece `maxItems: 50` por página para cuatro tipos de cola administrativa. La bandeja de incidentes ya utilizaba ese tamaño; las proyecciones KYC, Zonas y Auditoría de B aceptaban erróneamente 100/200. Se ajustó a 50 por página, **sin límite acumulado**. El navegador no puede admitir una página parcialmente malformada de 51, ni deducir que la plataforma contiene sólo 50 elementos.

QA adversarial por bandeja: 50 aceptados, 51 rechazados; integración del runtime con 51 registros en cada scope y limpieza de paginadores; KYC 123 registros en 3 páginas 50/50/23 y última fila 123 accesible.

La integridad final, ACL/roles JWT MFA AAL2 y cursores firmados siguen siendo responsabilidad del servidor; Admin desactivado de forma predeterminada, sin PII ni LIVE; el Arquitecto A todavía no montó APIs HTTPS de producción y G29 es SQL descartable. PR #8 DRAFT, sin merge ni tocar repositorio de Arquitecto A.

# Arquitecto B — G41 navegación anterior/siguiente (23-10-2026)

PR #8 DRAFT. Agregadas anclas de cursor opaco solo en memoria, unidas al filtro y sesión Admin. Retroceder vuelve a consultar backend; no hay caché de incidentes anteriores, ni límite global de registros; 50 es tamaño máximo por respuesta. Tras logout, cambio de filtros o MFA se invalidan anclas y datos. QA recorre 120 páginas y valida retroceso, reintento y no mezcla de filtros. El nuevo botón anterior aparece solo cuando el G41 autorizado está certificado.

Backend A mantiene x-qore-runtime-wired=false. Sin merge, despliegue LIVE, SOS, pagos o autorización para operaciones reales.

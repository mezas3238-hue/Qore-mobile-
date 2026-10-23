# Arquitecto B — Infinite scroll de historial Cliente, QA 23/10/2026

Carga incremental automática al final de FlatList virtualizada (un GET por cursor), conserva botón manual y no impone tope global. El cursor nunca se reutiliza cuando la misma página ya fue solicitada, no se llama con error/401/sesión ausente. No carga todos los registros en una sola petición. Cambio de cuenta y reinicio limpian el guard efímero.

Corrección adicional en history-feed: clave compuesta `kind:serviceId` al deduplicar y dibujar. Un viaje y envío con UUID coincidente pertenecen a tablas diferentes y ambos se conservan, con revisión individual. Se mantienen pruebas previas de 5.000 filas/100 páginas.

Contrato de backend sigue OFF por defecto hasta verificación de JWT/RLS y STAGING; NO MERGE, NO LIVE, cero otros módulos afectados.

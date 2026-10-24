# Evidencia manual Android — Auth/RLS V3, conductores A y B

Fecha: 2026-10-18. Fuente: cuatro capturas proporcionadas por el propietario en conversación, no archivos adjuntos al repositorio. Entorno indicado por la interfaz: Supabase STAGING aislado ref hylgkfgkcyrddokloljm. Herramienta: HTML QA V3 local abierto en Chrome Android (no frontend Lovable/Expo).

## Resultados observados

- Conductor A: **PASS V3 vinculado a cuenta**; servidor Auth confirma identidad al inicio y al final; registro público deshabilitado; exactamente un perfil propio; único rol conductor sin admin; cero solicitudes y cero vehículos visibles. Hora indicada por la UI: 2:23:15 p. m.
- Conductor B: **PASS V3 vinculado a cuenta**; mismas verificaciones; cero solicitudes y cero vehículos visibles. Hora indicada por la UI: 2:23:48 p. m.
- Ambas capturas muestran la cuenta autenticada en el resultado, mitigando el defecto de selector persistente de V2.
- Pasajero: PASS V3 ya documentado en handoff maestro anterior, no reejecutado en esta ronda.

## Alcance y límites

La evidencia es captura de una prueba manual ejecutada por el propietario; no es auditoría independiente de trazas del backend. Tablas vacías no demuestran RLS adversarial entre propietarios. No hay evidencia de Storage REST con dos objetos, GPS, push, ETA, dispatch, viajes ni pagos. No se comparten contraseñas, JWT ni datos de sesión.

## Siguiente gate

Crear fixtures sintéticos aislados de dos propietarios con autorización y limpieza documentada; comprobar lecturas propias positivas y lecturas cruzadas denegadas para vehículos/solicitudes y Storage REST; registrar evidencia sin identificadores sensibles. Mantener LIVE_TRIPS_ENABLED=false, PR #7 draft y trading PR #2 intacto.

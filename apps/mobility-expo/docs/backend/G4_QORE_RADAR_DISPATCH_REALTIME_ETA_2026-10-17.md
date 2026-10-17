# QORE RADAR G4 — Arquitectura de asignación, GPS, notificaciones y ETA real

**17 de octubre de 2026 · PR #7 DRAFT · NO LIVE**. Esta ronda agrega contratos de dominio y tests; no existe un despacho real desplegado, ni API Google/Expo Push con claves operativas, ni conexión Auth E2E. No se ha instalado G4 en Supabase, ni se han activado viajes/pagos. AUTO primero; MOTO comercial continúa bloqueada.

## Experiencia funcional requerida

1. El pasajero autenticado elige origen/destino; el servidor calcula oferta económica versionada. Nunca confiar en identidad, precio o distancia enviados por frontend.
2. QORE Radar consulta índice geográfico de conductores voluntariamente ONLINE, con GPS fresco (menos de 30 s), precisión aceptable, permisos de ubicación y vehículos comprobados mediante seguro remunerado, licencia, municipio y compliance del backend.
3. Google Routes matriz con TRAFFIC_AWARE calcula distancia **por calle** y ETA para cada candidato. Descartar fallback sin tráfico, matriz ambigua y datos obsoletos. Ranking justo combina ETA con una bonificación ACOTADA por tiempo sin pedidos; no mostrar identidad ni posición de conductores no asignados.
4. Un servicio de ofertas crea proposalId único por conductor, expiración breve, deduplicación y ventana de notificación. Expo Push solo avisa que existe una propuesta y el conductor debe abrir app autenticada para verla; un push enviado NO significa entregado ni aceptado.
5. El primer conductor elegible que acepta gana mediante RPC/SQL con bloqueo transaccional, revisiones, expiración y auditoría; los demás reciben evento de expiración y no pueden aceptar un segundo viaje. Antes de marcar «Conductor asignado», confirmarlo mediante respuesta AUTORITATIVA del servidor.
6. Mostrar ficha verificada de conductor (nombre, fotografía autorizada, puntuación, auto/moto, modelo, color, placa, y capacidad según vehículo) solo tras asignación confirmada. Moto se habilitaría únicamente después de gates legales por zona y seguro.
7. Una vez aceptado, el conductor opt-in envía GPS al backend, que verifica identidad, recencia y precisión, recalcula distancia restante por CALLES y ETA tráfico. En canal Realtime privado por viaje el pasajero observa posición, minutos aproximados, distancia y frescura. Cuando el GPS o routing caduca, el frontend no muestra marcador/ETA inventado; muestra «Recalculando ubicación».
8. Al llegar se actualiza «Conductor llegó». Durante viaje, seguimiento adicional solo conforme al consentimiento y reglas de privacidad; al terminar/cancelar se desactiva el canal, se retiene lo estrictamente necesario y se liquida pago únicamente mediante PSP auditado.

## Trabajo versionado esta ronda

- server/g4-qore-radar-core.mjs: búsqueda con checkCompliance SERVER-ONLY, filtro GPS, ETA carretera verificable, ranking y snapshot sanitizado; perfiles y GPS nunca se exponen antes de confirmación. LIVE siempre falso.
- server/g4-google-road-router.mjs: adaptador REST Google Routes v2 ComputeRouteMatrix, TRAFFIC_AWARE/DRIVE, field mask explícita que incluye status y fallbackInfo, máximo 20 orígenes/una recogida por cuota. NO hace llamadas con credenciales reales todavía.
- server/g4-expo-push-offers.mjs: contrato de notificación privada, token de dispositivo, TTL, mensajes sin ubicación, y semántica «aceptado para procesamiento», no «entregado» ni «viaje aceptado». Falta instalación de expo-notifications, APNs/FCM, push receipts y pruebas nativas.
- src/domain/qore-radar-feed.ts: estado UI con versiones de servidor, rechazo de mensajes atrasados/no autorizados, detalles después de aceptación, minutos/distancia solamente cuando posiciones y rutas están frescas. El frontend no fabrica ubicación o ETA.
- Pruebas adversariales asociadas a cada módulo, compilación y tests en GitHub CI. La prueba de concurrencia G3 SQL anterior demuestra **un ganador sintético**, no E2E entre dispositivos.
- Estos módulos NO están conectados al reductor DEMO ni al servicio local gateway: esto impide que una interfaz ficticia sea confundida con un servicio GPS REAL.

## Parámetros experimentales, no promesas

| Parámetro | Regla inicial del contrato |
|---|---|
| GPS candidato | Precisión 75 m o mejor, 30 s o más reciente, consentido, online |
| Routing | Ruta con tráfico, resultado calculado en 20 s o menos, sin fallback |
| Fanout ofertas | Máximo 5 conductores seleccionados, TTL de oferta 30 s como techo |
| ETA de pasajero | Minutos redondeados; solo con GPS y routing verdaderos, caducados se ocultan |
| Compensación FairMatch | Bonificación máxima de 90 segundos a conductores con mayor espera |
| Google Matrix | Máximo 20 candidatos por solicitud del adaptador, con presupuesto y alertas pendientes |
| Ubicación visible | Solo conductor asignado y solo durante estados/políticas autorizados |

## Elementos distintivos por construir y validar en Paraguay

**QORE Camino Claro:** ETA y razón de cambios (ruta, congestión, GPS perdido), frescura y margen de incertidumbre medido frente a tiempos reales, nunca cronómetro engañoso.

**QORE FairMatch:** selección que considere además del ETA la distancia de recogida sin remuneración, ingresos previstos antes de costos, tiempo ocioso y equidad entre conductores. Métricas transparentes y auditoría anti-sesgos.

**QORE Encuentro Inteligente:** punto seguro del lado adecuado de la calle, accesible para sillas de ruedas y personas mayores, referencias visuales, coordinación sin compartir contactos personales.

**QORE Escudo:** verificación humana de auto/moto, placa y foto; PIN de abordaje opcional, asistencia y SOS local, seguridad por consentimiento y alertas de riesgo. Cumplir protocolos de emergencia y privacidad.

**QORE Confianza Radical:** etiquetar cada dato como LIVE, ESTIMADO, VERIFICADO, DEMO o DESACTUALIZADO; interfaz inclusiva en español y guaraní, pensada para red débil y móviles económicos.

No declarar que estas funciones no existen en ningún competidor sin estudio comparativo; la diferencia defensible será calidad, transparencia y validación local.

## Gates antes de conectar celulares

1. Cerrar disable_signup=true Auth en el Supabase STAGING NUEVO, nunca reutilizar el proyecto antiguo; ejecutar dos JWT con RLS real. Última observación Auth indicada false; no inventar cierre.
2. Verificar identidad/provisión de conductores y seguros, habilitación municipal, consentimiento GPS real, antifraude y controles por dispositivo.
3. Probar en Google Cloud API con clave exclusivamente servidor, presupuesto y alertas; medir precisión de llegada en Asunción, cobertura de routing por zona.
4. Configurar expo-notifications con development builds físicos (en Android no opera push remoto en Expo Go); FCM/APNs, token único por conductor autenticado, control de duplicaciones/reintentos, receipts y pruebas con app cerrada.
5. Implementar backend de ofertas con expiración/aceptación transaccional, idempotencia, cuotas distribuidas/WAF y cancelación de ofertas perdedoras. Conectar a contrato G3 tras revisión staging explícita; G3 sigue CI-only.
6. Crear canal Supabase Realtime privado con RLS sobre realtime.messages, revisar Allow public access y autorización del pasajero y conductor asignado; revocar lectura al finalizar.
7. E2E de 2 teléfonos reales con latencia, carretera, GPS falso, pérdida de señal, fallos de notificación, cancelación, batería y dos conductores concurrentes.
8. Solo tras compliance/legal/seguro, tarifas y PSP, aprobación humana y pruebas nativas considerar habilitar piloto AUTO. MOTO necesita gates adicionales.

**Recursos oficiales de integración:** https://developers.google.com/maps/documentation/routes/reference/rest/v2/TopLevel/computeRouteMatrix · https://supabase.com/docs/guides/realtime/authorization · https://docs.expo.dev/versions/latest/sdk/notifications/ · https://docs.expo.dev/push-notifications/sending-notifications/

**Invariantes:** LIVE_TRIPS_ENABLED=false, sin SQL G4 remoto, sin publicar, sin moto comercial, sin secretos/PII en push, sin ubicación pública de conductores, sin fusionar Flutter trading.

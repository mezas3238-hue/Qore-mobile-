# QORE Mobile — G58C/A43: control de tasa y agotamiento en chat QA

**Fecha:** 24 octubre 2026. **Estado:** límites locales sintéticos, no servidor productivo.

## Implementado

- **g58c-local-chat-rate-gate-qa.mjs:** presupuesto de ventana fija de 60 segundos por actor G42 autenticado, máximo interno fijo de 30 peticiones por minuto por actor al integrar con G58B, no por IP/cabecera ni actorId de JSON. No ofrece endpoints para consultar identidades ni contadores; rechaza scopes con campos adicionales. Soporta cinco operaciones de lectura/acuse: DRIVER_INBOX, DRIVER_HISTORY, DRIVER_MARK_VISIBLE_ORDERED, CHAT_HISTORY, CHAT_MARK_VISIBLE_ORDERED. No incluye minting de tickets, envíos ni funciones SQL arbitrarias.
- La instancia QA acota el mapa a **512 actores** y al llegar al límite falla cerrada hasta que contadores expiren por ventana; no permite crecimiento ilimitado. Si el reloj retrocede, falla cerrada. El mapa no se serializa ni se expone por HTTP.
- **g58b-local-auth-chain-qa.mjs:** compone externalAllowRequest === true y el nuevo límite interno. No existe opción desde HTTP para desactivar ese límite. El presupuesto se consume solo después de verificar JWT, sesión/grant y rol exclusivo.
- **g58c-local-chat-rate-gate-qa.test.mjs:** límites, usuario diferente, operaciones desconocidas, scopes extra, retroceso de reloj, máximo de actores, reseteo de ventana y rechazo de modo LIVE/producción.
- **g58b-local-auth-chain-qa.test.mjs:** prueba integrada de localhost con token ES256 sintético firmado: 30 consultas Driver correctas, consulta 31 bloqueada con 429 y sin acuñar un ticket adicional; un Passenger autenticado conserva su presupuesto independiente.

## Riesgos y advertencias

**Este es un control QA por proceso**, no un algoritmo adecuado por sí solo para operación real con servidores múltiples o ataques distribuidos. Se requiere rate limiting centralizado por identidad/sesión y, cuando proceda, límites de red/IP en infraestructura STAGING/PROD; ventanas deslizantes, cuotas distintas para mensajes/enlaces, control de reintentos 429, métricas libres de PII, límites de conexiones y timeouts operativos.

El límite no demuestra autorización SQL ni lectura física de mensajes; G57 garantiza confirmación secuencial y G42 verifica JWT/proveedor sintético. Seguir exigiendo roles SQL restringidos con SET LOCAL ROLE y las RPCs de G57A/G57B. No se han montado rutas de SEND para usuarios reales. Sin credenciales, datos de usuarios, migración remota ni despliegue.

## Continuidad A G58D

Priorizar cancelación/timeout de operaciones SQL lentas con rollback correcto, pool SQL de menor privilegio, prevención de consumo de conexiones por clientes HTTP lentos, auditoría de eventos sin contenido privado, y ensayo de revocación de usuario en carrera con requests. Mantener cliente UI/UX del Arquitecto B sin modificar.

**Gobernanza:** PR #7/#8 DRAFT; no merge/LIVE sin autorización, no reinterpretar un workflow SUCCESS como disponibilidad comercial.

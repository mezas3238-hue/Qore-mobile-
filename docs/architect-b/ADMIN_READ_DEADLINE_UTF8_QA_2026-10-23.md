# B — Endurecimiento de lecturas Admin: deadline y bytes UTF-8

**23 de octubre de 2026 · PR #8 DRAFT · NO MERGE, NO LIVE ni despliegue**

## Problemas corregidos
1. Un \`fetchImpl\` demorado puede resolver una respuesta HTTP 200 *después* del plazo aunque el transporte ignore \`AbortSignal\`; el cliente no debe admitir los datos ni aceptar un 401 tardío como fundamento para revocar otra sesión. Se agregó plazo estricto (\`deadline\`) y verificación en retorno HTTP, lectura del body y antes de aceptar DTO.
2. El tamaño límite de body se medía en caracteres de JS en vez de bytes reales; una respuesta Unicode podía rebasar \`maxBytes\` aun con menos caracteres. Ahora se usa \`TextEncoder().encode(body).byteLength\` y se conserva el chequeo de \`Content-Length\`.

## Pruebas
5 pruebas adversariales nuevas: 200 después del plazo, 401 tardío sin revocación, lectura del body tardía, exceso de bytes UTF-8 y aceptación del JSON válido en plazo. Validar en CI exacta del commit: Admin web unit tests, TypeScript, Vite build, ownership y aislamiento de Cliente/Driver.

## Límites
No garantiza límite de memoria durante \`Response.text()\` de un servidor malicioso que omite \`Content-Length\`; el guard evita **aceptar** el DTO sobredimensionado, pero streaming acotado requerirá un adaptador adicional. No se introduce servidor real, credencial, rol o permiso. Integración STAGING y JWT/MFA reales siguen pendientes de A.

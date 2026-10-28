# B — Historial Cliente: límite estricto de tiempo y bytes UTF-8

**Fecha:** 2026-10-23 · PR #8 DRAFT · NO MERGE / NO LIVE / NO DEPLOY.

## Corrección
- El lector de historial propio rechaza una respuesta 200 o 401 posterior al plazo aun si el adaptador de red ignora \`AbortSignal\`. También rechaza un body que termina de leerse después del deadline; ninguna respuesta tardía puede repoblar el estado privado.
- Antes de JSON.parse compara el tamaño en bytes UTF-8, además de Content-Length y longitud JS, para no aceptar respuestas multibyte sobredimensionadas.
- 5 pruebas adversariales nuevas: 200 tardío, 401 tardío sin invalidar sesión, body tardío, exceso UTF-8 y lectura normal aceptada.

## Alcance y pendientes
La lectura sigue \`enabled=false\` por defecto; el backend A es responsable del JWT verificable, RLS, cursor firmado y retención. La protección de tamaño actúa tras resolver \`Response.text()\`, por lo que no establece por sí sola límite de memoria durante streaming de bytes. Las pruebas de GitHub Actions deben comprobarse en el SHA de esta entrega antes de declararlas verdes. Nunca implica que 50 filas por respuesta sean 50 filas globales.

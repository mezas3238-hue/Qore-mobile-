# G1 Seguridad de imágenes privadas — 2026-10-16

Estado previo verificado en Supabase Lovable: `driver-docs` es privado (`public=false`), máximo 5 MiB, sin lista MIME permitida. Políticas RLS storage exigen carpeta de propietario y lectura propietario/admin, pero aún requieren pruebas adversariales.

La migración `20261016195200_private_license_mime.sql` agrega lista de MIME JPEG/PNG con precondición transaccional; conserva privacidad y límite. No autoriza viajes ni modifica roles.
La aplicación ahora comprueba el límite de 5 MiB, firma de archivo preliminar y tipo MIME tanto al seleccionar como al enviar. Esto NO autentica la licencia ni previene todos los archivos maliciosos: backend debe validar contenido real, vigencia, póliza y auditoría humana.

Próximos gates: pruebas con 2 usuarios aislados en Supabase staging (propio/ajeno, MIME incorrecto, 5 MiB, admin real, retención y borrado). Nunca usar documentos personales de producción para fixtures.

## Cierre verificable de configuración del bucket (2026-10-16)
- **MIGRACIÓN APLICADA** en el backend Lovable existente, proyecto `2fa91fe1-e7a0-4fff-a16f-7d457b2d6eed`, no en la base STAGING independiente.
- La aplicación usó SQL transaccional del archivo `supabase/migrations/20261016195200_private_license_mime.sql` con guard adicional abortando si existían usuarios Auth, viajes o documentos almacenados, y rechazando deriva de MIME.
- El SQL de postcondiciones corrió dentro de la misma transacción y abortaba/retrocedía ante cambios inesperados. Respuesta **real** de Lovable:
  `{"allowed_mime_types":["image/jpeg","image/png"],"document_objects":0,"file_size_limit":5242880,"id":"driver-docs","public":false}`.
- El bucket está **privado**, con tope **5 MiB** y solo permite MIME declarados `image/jpeg`, `image/png`. No se movió ni leyó documento personal.
- **Continúan pendientes:** comprobar acceso REST storage con JWT de 2 usuarios, suplantación de folder, bytes falsos bajo MIME válido, validación de firma/escaneo en servidor, ciclo de retención/borrado, revisión humana y autorización legal. MIME allowlist no es análisis de contenido.

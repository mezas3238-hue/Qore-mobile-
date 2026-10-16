# G1 Seguridad de imágenes privadas — 2026-10-16

Estado previo verificado en Supabase Lovable: `driver-docs` es privado (`public=false`), máximo 5 MiB, sin lista MIME permitida. Políticas RLS storage exigen carpeta de propietario y lectura propietario/admin, pero aún requieren pruebas adversariales.

La migración `20261016195200_private_license_mime.sql` agrega lista de MIME JPEG/PNG con precondición transaccional; conserva privacidad y límite. No autoriza viajes ni modifica roles.
La aplicación ahora comprueba el límite de 5 MiB, firma de archivo preliminar y tipo MIME tanto al seleccionar como al enviar. Esto NO autentica la licencia ni previene todos los archivos maliciosos: backend debe validar contenido real, vigencia, póliza y auditoría humana.

Próximos gates: pruebas con 2 usuarios aislados en Supabase staging (propio/ajeno, MIME incorrecto, 5 MiB, admin real, retención y borrado). Nunca usar documentos personales de producción para fixtures.

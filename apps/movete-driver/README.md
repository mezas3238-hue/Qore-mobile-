# Movete Fácil Driver — Android e iOS independientes

App nativa exclusiva de conductores/repartidores, paquete `com.movetefacil.driver`, sin importar rutas ni contexto de Cliente o Admin Web.

**Acceso del conductor (código listo, dispositivo aún no certificado):** la pantalla Inicio permite ingresar/cerrar sesión con el proyecto Supabase STAGING autorizado mediante clave pública `sb_publishable_` y HTTPS validado. La sesión se guarda solo en Keychain/Keystore mediante `expo-secure-store` con límite de tamaño seguro y sin fallback en texto plano. El dispositivo consulta `auth.getUser(token)` y exactamente un rol `driver` bajo RLS; pasajeros, administradores, usuarios anónimos y roles dobles no activan la identidad Driver. Las credenciales de servicio no van dentro de la aplicación. Web no realiza este login nativo.

**Importante:** autenticarse NO habilita ofertas, viajes, GPS, documentos, mensajería ni disponibilidad real. `DriverApplicationProviders` permanece sin `runtime` en `app/_layout.tsx` hasta tener backend STAGING HTTPS/IdP/PostgreSQL común y las capacidades seguras firmadas por A; ningún usuario puede despachar sin KYC vigente, geocerca legal, asignación atómica y autorización verificable.

Verificación local: `npm install && npm run check`. `npm run android` y `npm run ios` requieren entornos Expo; **Web export/typecheck no certifican instalación nativa**. Para vincular sesión usar variables públicas de `.env.example`, con proyecto de prueba autorizado y cuentas previamente provisionadas. No crear usuarios públicos o activar LIVE sin autorización Owner.

**Entrega pendiente:** dispositivos físicos Android/iOS, dos cuentas diferentes Cliente/Driver y mismo `tripId` con tarifa PYG, reserva, oferta, aceptación, GPS, mensajes, etapas, liquidación y comprobación Admin Web. El flujo completo de negocio sigue NO_GO.

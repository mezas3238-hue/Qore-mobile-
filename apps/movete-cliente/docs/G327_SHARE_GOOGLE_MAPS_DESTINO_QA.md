# G327 — Recibir destinos compartidos desde Google Maps (Android QA)

## Motivo
G326 abre Google Maps instalado vía Maps URLs (sin API key), pero no recibe directamente el destino elegido. Expo Sharing SDK57 documenta recepción experimental de texto/URL de otras apps mediante `ACTION_SEND` y `app/+native-intent.ts`.

## Nuevo flujo
1. Cliente toca «¿A dónde vas?» y se abre Google Maps.
2. En Google Maps elige el lugar, pulsa **Compartir** y selecciona «Movete Fácil Cliente».
3. Cliente muestra el nombre sugerido desde el texto compartido, con botón explícito «Buscar y confirmar este destino».
4. Al aceptar, almacena el nombre en RAM un máximo de dos minutos, sin navegación con PII; abre `/transporte` y precarga el nombre para **búsqueda con Android Geocoder**.
5. Usuario toca Buscar, selecciona candidato de Paraguay y confirma destino. No se puede cotizar o reservar solo con contenido compartido.

## Limitaciones intencionales
- La función es EXPERIMENTAL de Expo SDK57; debe pasar test de equipo Android. iOS Share Extension queda OFF.
- Una URL corta `maps.app.goo.gl` sin nombre visible no revela coordenadas. En G330 se aprovecha la resolución **experimental de Expo Sharing** únicamente cuando devuelve otra URL HTTPS válida de Google Maps con nombre de lugar o consulta; se valida estrictamente el origen y el destino de ese enlace. Si falla la resolución, no se inventa una ubicación y se mantiene la búsqueda manual.
- **La dirección recibida es solo una propuesta**: nunca certifica coordenadas, no equivale a una selección automática de pin y exige geocodificación nativa paraguaya y confirmación del pasajero.
- Solo texto o URL HTTPs de Google Maps, un único payload, límite 2048 caracteres y texto sanitizado; jamás se ejecutan comandos, se confían coordenadas de enlaces, se registran GPS o se envía URL externo a servidor.
- Módulo RAM es consumible una sola vez, expira en 2 minutos y se invalida al cambiar la sesión privada.
- No se toca Driver, cámara, finanzas, Railway o Supabase. Modo QA no LIVE.
- La app G326 sigue siendo el fallback: si Google Maps no comparte nombre, el usuario escribe el lugar en Movete Fácil.

## Certificación pendiente
Compile Android ARM64, verificar intent-filter ACTION_SEND text/plain, descargar APK, probar en Android real con selección Google Maps → Compartir → Movete Fácil → geocoder → confirmación y regreso, además de denegación/timeout/NO GPS y ausencia de ANR.

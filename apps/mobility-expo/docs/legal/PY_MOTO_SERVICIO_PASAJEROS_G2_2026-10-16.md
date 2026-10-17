# G2 — Marco legal preliminar: motocicletas con pasajero en Paraguay
Fecha de investigación: 2026-10-16. **Investigación orientativa, no dictamen jurídico ni habilitación comercial.**

## Fuentes primarias y hallazgos contrastados
1. [Ley 5016/2014 Nacional de Tránsito y Seguridad Vial — BACN](https://www.bacn.gov.py/leyes-paraguayas/4418/ley-n-5016-nacional-de-transito-y-seguridad-vial): Artículo 58 refiere licencia, cédula del vehículo y documentos de circulación/servicio; Artículo 95 recoge marco de seguros para transporte público de pasajeros y motos. **No asumir que la mera póliza vehicular privada cubre transporte remunerado**; verificar estado reglamentario vigente y certificado asegurador.
2. [Ley 5016/2014 — texto BACN artículos 72 y 76](https://www.bacn.gov.py/leyesparaguayas/4418/ley-n-5016-nacional-detransito-y-seguridad-vial): máximo **dos personas** en una motocicleta (incluido el conductor), **acompañante menor de 12 años prohibido**, casco reglamentario para ambos ocupantes y chaleco reflectivo para ocupantes; revisar reflectivos, sujeción y matrícula del casco conforme a reglamentación actual.
3. [Recordatorio MOPC sobre motos](https://mopc.gov.py/12501-2/): ratifica casco obligatorio tanto para conductor como acompañante; chaleco reflectivo y máximo dos ocupantes, con referencia a Ley 5016.
4. [Municipalidad de Asunción: licencias y habilitaciones de rodados](https://www.asuncion.gov.py/formularios-y-requisitos/transito-y-transporte): distingue trámites de licencia de motociclista, habilitación de motocicletas y trámites específicos de taxi/remís. **Habilitación común de una moto NO demuestra autorización comercial para transportar pasajeros mediante app.**
5. [Requisitos de taxi de Asunción (documento municipal)](https://www.asuncion.gov.py/wp-content/uploads/2024/05/Habilitacion-de-Rodados-Taxi.pdf): la categoría taxi tiene régimen de rodado/trámites específico. No extrapolar automáticamente a moto.
6. [Cobertura informativa de ordenanza Uber/MUV 2019](https://www.npy.com.py/noticias/municipalidad-promulga-ordenanza-sobre-muv-y-uber): señala permiso municipal por vehículo; fuente periodística secundaria y de 2019, por lo que requiere verificación de ordenanza vigente y aplicabilidad exacta. No sirve para autorizar motos.

## Conclusiones de arquitectura
- Moto: **1 pasajero máximo**, 2 cascos y 2 chalecos reflectivos conformes/verificados, habilitación vial, licencia adecuada, seguro de pasajeros remunerados válido, permiso jurisdiccional expreso y confirmación server-side del requisito de edad para pasajero (12+), sin publicar fecha de nacimiento.
- El chequeo de edad es de cada **solicitud/viaje**, no un atributo del vehículo; nunca basta con fotos de cascos o una declaración del conductor.
- La aprobación general de conductor AUTO no habilita MOTO, ni una habilitación de circulación autoriza servicio comercial.
- No afirmar hoy que exista autorización para mototaxi por app en Asunción, Central u otras ciudades; solicitar dictamen/consulta formal de autoridad municipal y transporte.
- En caso de ambigüedad legislativa o aseguradora: **no ofertar el servicio**; mantener `LIVE_TRIPS_ENABLED=false` y RPC de viajes revocadas.

## Preguntas de certificación antes de cualquier piloto
1. Normativa de prestación por plataforma, jurisdicción, licencia de operador, cupos, ordenanza, inscripción y vigencia municipal.
2. Licencia habilitante específica por AUTO/MOTO, antigüedad/edad conductor y antecedentes, reglas de afiliación y documentación especial.
3. Aseguradora que expida por escrito cobertura de pasajeros remunerados por moto (terceros/ocupantes, exclusiones, área geográfica, límite), y vigencia.
4. Equipo homologado e inspección: cascos, chalecos reflectivos, iluminación, revisión, protocolo entrega casco al pasajero.
5. Contratación con menores y verificación de edad con privacidad; mecanismos de negativa sin recolectar datos excesivos.
6. Incidentes/SOS, supervisión humana, vías restringidas y reglas de seguridad vial.

**Estado G2:** investigación oficial + controles preproductivos en código. No equivale a dictamen favorable ni habilitación legal.

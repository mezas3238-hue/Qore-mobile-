import React from 'react';
import { Text } from 'react-native';
import { Card, Headline, Navigation, Note, Page, Top, textStyles } from '../src/components/UI';
export default function Privacy() {
  return <Page><Top subtitle="Información de datos y seguridad" />
    <Headline eyebrow="Documento provisional · piloto cerrado" title="Tus datos y tu seguridad" description="Resumen técnico de los datos tratados durante el registro. Debe completarse con una política legal aprobada antes de publicar a usuarios externos." />
    <Card><Text style={textStyles.heading}>Pasajero</Text><Text style={textStyles.body}>La cuenta registra nombre, teléfono, correo y credenciales de acceso gestionadas por el proveedor de autenticación. La contraseña no se almacena en código local ni se envía a QORE CORE.</Text></Card>
    <Card><Text style={textStyles.heading}>Conductor y vehículo</Text><Text style={textStyles.body}>Se solicitan nombre, teléfono, número y fotografía de licencia, chapa, marca, modelo, color, año y categoría. El documento se almacena en un depósito privado, accesible únicamente con permisos comprobados por el servidor.</Text></Card>
    <Card><Text style={textStyles.heading}>Ubicación</Text><Text style={textStyles.body}>Tu GPS solo se consulta cuando tocás «Usar mi ubicación» y concedés permiso. Esta versión no comparte ni almacena ubicaciones en vivo. Google Maps y Waze recibirán los lugares seleccionados cuando abras navegación externa, sujetos a sus condiciones de privacidad.</Text></Card>
    <Card><Text style={textStyles.heading}>Derechos y revisión</Text><Text style={textStyles.body}>Antes del lanzamiento se deben publicar identidad del responsable, vías de contacto para acceso/rectificación/supresión, bases legales, retención, terceros, medidas de seguridad y procedimiento de reclamaciones. Los registros de prueba no constituyen habilitación para transportar personas.</Text></Card>
    <Note>Esta página NO sustituye una política legal definitiva. No habilitar públicamente el registro hasta aprobar una política de privacidad, términos de uso, plan de retención y proceso de eliminación.</Note>
    <Navigation />
  </Page>;
}

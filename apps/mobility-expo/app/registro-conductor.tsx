import { router } from 'expo-router';
import React, { useState } from 'react';
import { Switch, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Button, C, Card, CategoryChoices, Headline, Navigation, Note, Page, Top, textStyles } from '../src/components/UI';
import { FormField, FormMessage } from '../src/components/Form';
import { useAuth } from '../src/context/AuthContext';
import { type DriverInput, validateDriver } from '../src/domain/registration';
import { submitDriverRegistration } from '../src/services/driver-registration';
import { inspectLicenseImage } from '../src/domain/license-evidence';

const initial: DriverInput = {
  fullName: '', phone: '', licenseNumber: '', licensePhotoSelected: false,
  plate: '', brand: '', model: '', color: '', year: '', category: 'economico', consent: false,
};
export default function DriverRegistration() {
  const { user, configured, loading } = useAuth();
  const [form, setForm] = useState<DriverInput>(initial);
  const [licenseBase64, setLicenseBase64] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  function update<K extends keyof DriverInput>(key: K, value: DriverInput[K]) {
    setForm(current => ({ ...current, [key]: value }));
  }
  async function selectLicense() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], quality: 0.65, base64: true, allowsEditing: false,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset?.base64) throw new Error('No se pudo leer la imagen.');
      const image = inspectLicenseImage(asset.base64);
      setLicenseBase64(image.base64);
      update('licensePhotoSelected', true);
      setMessage('Licencia seleccionada. Se enviará a un depósito privado al confirmar.');
      setFailed(false);
    } catch (e) { setLicenseBase64(''); update('licensePhotoSelected', false); setMessage(e instanceof Error ? e.message : 'Error al seleccionar documento'); setFailed(true); }
  }
  async function submit() {
    const error = validateDriver(form);
    if (error) { setMessage(error); setFailed(true); return; }
    setBusy(true); setMessage('');
    try {
      await submitDriverRegistration(form, licenseBase64);
      setLicenseBase64('');
      setMessage('Conductor y vehículo registrados. La solicitud está pendiente de revisión; todavía no podés recibir viajes.');
      setFailed(false);
    } catch (e) { setMessage(e instanceof Error ? e.message : 'No se pudo enviar el registro.'); setFailed(true); }
    finally { setBusy(false); }
  }
  return <Page>
    <Top subtitle="Alta de conductor y vehículo" />
    <Headline eyebrow="Solicitud sujeta a revisión" title="Registrá tu vehículo" description="Tu registro no te habilita automáticamente para operar. Un administrador debe verificar identidad, licencia, vehículo y seguros." />
    <Button secondary text="¿Tenés motocicleta? Revisar requisitos (sin viajes habilitados)" onPress={() => router.push('/requisitos-moto')} />
    {!configured && <Note>Servicio de registro inactivo: se requiere configurar Supabase. Tus datos no se guardarán localmente.</Note>}
    {!user && !loading ? <Card><Text style={textStyles.heading}>Primero creá o ingresá a tu cuenta</Text><Button text="Ingresar" onPress={() => router.push('/acceso')} /><Button secondary text="Registrarme como pasajero" onPress={() => router.push('/registro')} /></Card> : <>
      <Card>
        <Text style={textStyles.heading}>1. Datos del conductor</Text>
        <FormField label="Nombre y apellido" value={form.fullName} onChangeText={v => update('fullName', v)} autoCapitalize="words" />
        <FormField label="Celular" value={form.phone} onChangeText={v => update('phone', v)} keyboardType="phone-pad" />
        <FormField label="Número de licencia profesional" value={form.licenseNumber} onChangeText={v => update('licenseNumber', v)} />
        <Text style={textStyles.subtitle}>Se verificará la clase de licencia, fecha de vencimiento y validez local antes de aprobarte.</Text>
        <Button secondary text={form.licensePhotoSelected ? '✓ Foto de licencia seleccionada · Cambiar' : 'Seleccionar fotografía de licencia'} onPress={() => void selectLicense()} />
        <Text style={textStyles.subtitle}>Foto JPG/PNG de hasta 5 MiB. El documento se guarda en almacenamiento privado; acceso sujeto a políticas del servidor.</Text>
      </Card>
      <Card>
        <Text style={textStyles.heading}>2. Datos del vehículo</Text>
        <FormField label="Chapa / patente" value={form.plate} onChangeText={v => update('plate', v)} autoCapitalize="characters" maxLength={12} />
        <FormField label="Marca" value={form.brand} onChangeText={v => update('brand', v)} />
        <FormField label="Modelo" value={form.model} onChangeText={v => update('model', v)} />
        <FormField label="Color" value={form.color} onChangeText={v => update('color', v)} />
        <FormField label="Año de fabricación" value={form.year} onChangeText={v => update('year', v)} keyboardType="number-pad" maxLength={4} />
        <Text style={textStyles.heading}>Tipo de vehículo</Text>
        <CategoryChoices category={form.category} onChange={v => update('category', v)} />
        <Note>La cédula del automotor, habilitación municipal y seguro deberán verificarse por administración antes de poner el vehículo en servicio. Este formulario no verifica automáticamente esos documentos.</Note>
      </Card>
      <Card>
        <Text style={textStyles.heading}>3. Confirmación</Text>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <Switch value={form.consent} onValueChange={v => update('consent', v)} accessibilityLabel="Acepto la revisión de documentos" trackColor={{ true: C.teal }} />
          <Text style={[textStyles.subtitle, { flex: 1 }]}>Autorizo el tratamiento de estos datos únicamente para revisar mi solicitud de conductor y vehículo.</Text>
        </View>
        <Button secondary text="Leer información de privacidad" onPress={() => router.push('/privacidad')} />
        <FormMessage text={message} error={failed} />
        <Button text={busy ? 'Enviando…' : 'Enviar conductor y vehículo a revisión'} disabled={busy || !user || !configured} onPress={() => void submit()} />
        <Button text="Consultar estado de registro" secondary onPress={() => router.push('/perfil')} />
      </Card>
    </>}
    <Navigation />
  </Page>;
}

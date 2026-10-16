import { router } from 'expo-router';
import React, { useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { Button, Card, Headline, Navigation, Note, Page, Top, textStyles, C } from '../src/components/UI';
import { FormField, FormMessage } from '../src/components/Form';
import { useAuth } from '../src/context/AuthContext';
import { validatePassenger } from '../src/domain/registration';

export default function RegisterPassenger() {
  const { registerPassenger, configured } = useAuth();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit() {
    const input = { fullName, phone, email, password, consent };
    const validation = validatePassenger(input);
    if (validation) { setMessage(validation); setFailed(true); return; }
    setBusy(true); setMessage('');
    try {
      setMessage(await registerPassenger(input)); setFailed(false);
    } catch (e) { setMessage(e instanceof Error ? e.message : 'No se pudo registrar'); setFailed(true); }
    finally { setBusy(false); }
  }
  return <Page>
    <Top subtitle="Registro de pasajero" />
    <Headline eyebrow="Tu cuenta" title="Registrate para viajar" description="Guardamos tu nombre, teléfono y correo en una cuenta protegida. No se crearán viajes reales en esta fase." />
    {!configured && <Note>Registro REAL inactivo: falta configurar el endpoint y clave pública de Supabase. Podés probar la demo sin datos personales.</Note>}
    <Card>
      <FormField label="Nombre y apellido" value={fullName} onChangeText={setFullName} autoCapitalize="words" />
      <FormField label="Celular" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <FormField label="Correo electrónico" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <FormField label="Contraseña (10+ caracteres, letras y números)" value={password} onChangeText={setPassword} secure autoCapitalize="none" />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Switch value={consent} onValueChange={setConsent} accessibilityLabel="Acepto tratamiento de mis datos de registro" trackColor={{ true: C.teal }} />
        <Text style={[textStyles.subtitle, { flex: 1 }]}>Acepto las condiciones de uso y el tratamiento de mis datos para crear mi cuenta.</Text>
      </View>
      <Button secondary text="Leer tratamiento de datos y privacidad" onPress={() => router.push('/privacidad')} />
      <FormMessage text={message} error={failed} />
      <Button text={busy ? 'Registrando…' : 'Crear cuenta de pasajero'} disabled={!configured || busy} onPress={() => void submit()} />
      <Button text="Ya tengo cuenta · Ingresar" secondary onPress={() => router.push('/acceso')} />
    </Card>
    <Note>No ingreses documentos ni datos bancarios en la demostración. El registro real solo se activa al configurar el servicio protegido.</Note>
    <Navigation />
  </Page>;
}

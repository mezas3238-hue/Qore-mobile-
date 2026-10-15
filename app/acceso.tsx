import { router } from 'expo-router';
import React, { useState } from 'react';
import { Text } from 'react-native';
import { Button, Card, Headline, Navigation, Note, Page, Top, textStyles } from '../src/components/UI';
import { FormField, FormMessage } from '../src/components/Form';
import { useAuth } from '../src/context/AuthContext';
export default function Access() {
  const { logIn, user, logOut, configured } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function enter() {
    setBusy(true); setError('');
    try { await logIn(email, password); router.replace('/perfil'); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo ingresar.'); }
    finally { setBusy(false); }
  }
  return <Page><Top subtitle="Inicio de sesión" /><Headline title={user ? 'Tu sesión' : 'Ingresar a ViajeYa'} description="Una cuenta te permite registrarte como pasajero y solicitar la aprobación como conductor." />
    {!configured && <Note>Inicio de sesión sin conexión: configurar Supabase para habilitar cuentas reales.</Note>}
    <Card>
      {user ? <><Text style={textStyles.heading}>{user.email}</Text><Button text="Ir a mi perfil" onPress={() => router.push('/perfil')} /><Button secondary text="Cerrar sesión" onPress={() => void logOut().catch(e => setError(String(e)))} /></> : <>
        <FormField label="Correo electrónico" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <FormField label="Contraseña" value={password} onChangeText={setPassword} secure autoCapitalize="none" />
        <FormMessage text={error} error />
        <Button text={busy ? 'Ingresando…' : 'Ingresar'} onPress={() => void enter()} disabled={!configured || busy || !email || !password} />
        <Button text="Crear cuenta de pasajero" secondary onPress={() => router.push('/registro')} />
      </>}
    </Card><Navigation /></Page>;
}

import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { Button, Card, Headline, Navigation, Note, Page, Top, textStyles } from '../src/components/UI';
import { useAuth } from '../src/context/AuthContext';
import { getDriverRegistrationStatus, type DriverApplicationStatus } from '../src/services/driver-registration';
import { supabase } from '../src/services/supabase';
export default function Profile() {
  const { user, logOut, loading } = useAuth();
  const [status, setStatus] = useState<DriverApplicationStatus>('none');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [plate, setPlate] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!user || !supabase) return;
    let active = true;
    Promise.all([getDriverRegistrationStatus(), supabase.from('profiles').select('full_name,phone').eq('id', user.id).maybeSingle(), supabase.from('vehicles').select('plate,brand,model').eq('driver_id', user.id).maybeSingle()])
      .then(([s, p, v]) => { if (active) { setStatus(s); setName(p.data?.full_name || ''); setPhone(p.data?.phone || ''); setPlate(v.data ? `${v.data.brand} ${v.data.model} · ${v.data.plate}` : ''); if (p.error || v.error) setError(p.error?.message || v.error?.message || ''); } })
      .catch(e => { if (active) setError(String(e)); });
    return () => { active = false; };
  }, [user]);
  return <Page><Top subtitle="Mi perfil" /><Headline title="Mi cuenta" description="Datos registrados en el servicio protegido (no en el modo demo)." />
    {loading ? <Note>Verificando sesión…</Note> : !user ? <Card><Text style={textStyles.heading}>Ingresá para acceder a tu perfil</Text><Button text="Ingresar" onPress={() => router.push('/acceso')} /><Button secondary text="Crear cuenta" onPress={() => router.push('/registro')} /></Card> : <>
      <Card><Text style={textStyles.heading}>{name || 'Pasajero registrado'}</Text><Text style={textStyles.subtitle}>{user.email}</Text><Text style={textStyles.subtitle}>{phone || 'Teléfono pendiente'}</Text></Card>
      <Card><Text style={textStyles.heading}>Solicitud de conductor</Text><Text style={textStyles.subtitle}>{status === 'none' ? 'Sin solicitud' : status === 'pending' ? 'Pendiente de aprobación' : status === 'approved' ? 'Aprobada' : 'Rechazada: podés reenviar la solicitud'}</Text>{!!plate && <Text style={textStyles.subtitle}>Vehículo registrado: {plate}</Text>}<Button secondary text="Registrar o actualizar conductor y vehículo" onPress={() => router.push('/registro-conductor')} /></Card>
      {error ? <Note>{error}</Note> : null}
      <Button secondary text="Cerrar sesión" onPress={() => void logOut().then(() => router.replace('/'))} />
    </>}
    <Navigation /></Page>;
}

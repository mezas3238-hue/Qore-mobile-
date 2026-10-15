import React, { useEffect, useState } from 'react';
import { Switch, Text, View, Linking } from 'react-native';
import { Button, Card, Headline, Navigation, Note, Page, Top, textStyles, C } from '../src/components/UI';
import { useAuth } from '../src/context/AuthContext';
import { FormField } from '../src/components/Form';
import { requireBackend, backendConfigured } from '../src/services/supabase';

type Application = { id:string;user_id:string;full_name:string;phone:string;license_number:string;license_doc_path:string|null;status:string;created_at:string };
type Vehicle = {driver_id:string;plate:string;brand:string;model:string;color:string;year:number|null;category:string};
export default function Reviews() {
  const { user, loading } = useAuth();
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const [applications, setApplications] = useState<Application[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [checks, setChecks] = useState<Record<string,boolean>>({});
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const [working, setWorking] = useState(false);
  async function reload() {
    if (!user || !backendConfigured) { setChecking(false); setAuthorized(false); return; }
    setChecking(true);
    try {
      const client = requireBackend();
      const { data: role, error: roleError } = await client.from('user_roles').select('role').eq('user_id',user.id).eq('role','admin').maybeSingle();
      if (roleError) throw roleError;
      if (!role) { setAuthorized(false); return; }
      setAuthorized(true);
      const [a,v] = await Promise.all([
        client.from('driver_applications').select('id,user_id,full_name,phone,license_number,license_doc_path,status,created_at').order('created_at',{ascending:false}).limit(50),
        client.from('vehicles').select('driver_id,plate,brand,model,color,year,category').limit(100),
      ]);
      if (a.error || v.error) throw a.error || v.error;
      setApplications((a.data||[]) as Application[]);
      setVehicles((v.data||[]) as Vehicle[]);
    } catch(e) { setMessage(e instanceof Error ? e.message : 'Error de autorización'); }
    finally { setChecking(false); }
  }
  useEffect(() => { if (!loading) void reload(); }, [user, loading]);
  async function viewLicense(path: string) {
    const {data,error} = await requireBackend().storage.from('driver-docs').createSignedUrl(path,60);
    if (error || !data?.signedUrl) { setMessage(error?.message||'No se pudo acceder al documento');return; }
    await Linking.openURL(data.signedUrl);
  }
  async function review(app: Application, approve: boolean) {
    if (approve && (!app.license_doc_path || !checks[app.id])) {setMessage('Verificá presencialmente identidad, licencia profesional, vehículo, seguro y habilitación antes de aprobar.');return;}
    if (!approve && !notes.trim()) {setMessage('Indicá el motivo del rechazo.');return;}
    setWorking(true); setMessage('');
    try {
      const {error} = await requireBackend().rpc('admin_review_driver',{_app_id:app.id,_approve:approve,_notes:notes.trim() || 'Verificación presencial completada por administración'});
      if (error) throw error;
      setMessage(approve?'Conductor aprobado en el backend.':'Solicitud rechazada.');
      setChecks(x => ({...x,[app.id]:false}));setNotes('');await reload();
    } catch(e) {setMessage(e instanceof Error?e.message:'Fallo de revisión');}
    finally {setWorking(false);}
  }
  return <Page><Top subtitle="Revisión administrativa de registros" /><Headline title="Aprobación de conductores" description="Acceso protegido por rol administrador del backend. La simulación no concede permisos." />
    {!backendConfigured ? <Note>Conectá primero el backend seguro. No hay aprobaciones locales.</Note> : checking ? <Note>Comprobando permisos…</Note> : !authorized ? <Note>Acceso denegado. Solo administradores designados desde el servidor pueden revisar documentos y aprobar vehículos.</Note> : <>
      <Note>La aprobación es una decisión administrativa. Verificá físicamente licencia profesional, matrícula, titularidad, seguros, habilitación y vigencia. No es un proceso automático.</Note>
      {applications.length===0 && <Card><Text style={textStyles.subtitle}>Todavía no hay solicitudes.</Text></Card>}
      {applications.map(app => {
        const car=vehicles.find(v=>v.driver_id===app.user_id);
        return <Card key={app.id}>
          <Text style={textStyles.heading}>{app.full_name} · {app.status}</Text>
          <Text style={textStyles.subtitle}>Celular: {app.phone} · licencia N.º {app.license_number}</Text>
          <Text style={textStyles.subtitle}>Vehículo: {car ? `${car.brand} ${car.model} (${car.year || 'sin año'}) · ${car.plate} · ${car.color} · ${car.category}`:'Sin vehículo registrado'}</Text>
          {app.license_doc_path && <Button secondary text="Ver licencia (enlace privado temporal)" onPress={()=>void viewLicense(app.license_doc_path!)} />}
          {app.status==='pending' && <>
            <View style={{ flexDirection:'row',alignItems:'center',gap:12 }}>
              <Switch value={Boolean(checks[app.id])} onValueChange={v=>setChecks(x=>({...x,[app.id]:v}))} accessibilityLabel="Verifiqué los documentos y habilitaciones de esta solicitud" trackColor={{true:C.teal}} />
              <Text style={[textStyles.subtitle,{flex:1}]}>Confirmo que revisé físicamente licencia profesional, documento de vehículo, seguro y habilitaciones requeridas.</Text>
            </View>
            <FormField label="Notas de revisión (obligatorias para rechazar)" value={notes} onChangeText={setNotes} maxLength={500} />
            <Button text="Aprobar conductor" disabled={working||!app.license_doc_path||!car||!checks[app.id]} onPress={()=>void review(app,true)} />
            <Button secondary text="Rechazar solicitud" disabled={working} onPress={()=>void review(app,false)} />
          </>}
        </Card>;
      })}
      <Button secondary text="Actualizar solicitudes" onPress={()=>void reload()} />
    </>}
    {!!message && <Note>{message}</Note>}
    <Navigation />
  </Page>;
}

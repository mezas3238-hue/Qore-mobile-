import { decode } from 'base64-arraybuffer';
import { requireBackend } from './supabase';
import { DriverInput, validateDriver } from '../domain/registration';

/** Stores private license under auth.uid()/..., submits driver + vehicle through one server RPC. */
export async function submitDriverRegistration(input: DriverInput, licenseBase64: string): Promise<void> {
  const error = validateDriver(input);
  if (error) throw new Error(error);
  if (!licenseBase64 || licenseBase64.length > 14_000_000) throw new Error('La imagen de licencia no es válida o pesa demasiado.');
  const client = requireBackend();
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) throw new Error('Iniciá sesión antes de registrar un vehículo.');
  const path = `${user.id}/licencia-${Date.now()}.jpg`;
  const { error: uploadError } = await client.storage.from('driver-docs').upload(path, decode(licenseBase64), {
    contentType: 'image/jpeg', upsert: false, cacheControl: '3600',
  });
  if (uploadError) throw new Error(`No se pudo guardar la licencia en almacenamiento privado: ${uploadError.message}`);
  const { error: rpcError } = await client.rpc('submit_driver_application', {
    _full_name: input.fullName.trim(), _phone: input.phone.trim(),
    _license: input.licenseNumber.trim(), _license_doc_path: path,
    _plate: input.plate.trim().toUpperCase(), _brand: input.brand.trim(),
    _model: input.model.trim(), _color: input.color.trim(), _year: Number(input.year),
    _category: input.category,
  });
  if (rpcError) {
    // Best effort remove orphaned upload when RPC fails; never block error propagation.
    await client.storage.from('driver-docs').remove([path]).catch(() => undefined);
    throw new Error(`Registro no completado: ${rpcError.message}`);
  }
}
export type DriverApplicationStatus = 'pending' | 'approved' | 'rejected' | 'none';
export async function getDriverRegistrationStatus(): Promise<DriverApplicationStatus> {
  const client = requireBackend();
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error('Necesitás iniciar sesión.');
  const { data, error } = await client.from('driver_applications').select('status').eq('user_id', user.id).maybeSingle();
  if (error) throw error;
  return (data?.status as DriverApplicationStatus) ?? 'none';
}

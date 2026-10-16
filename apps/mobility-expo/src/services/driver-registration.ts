import { decode } from 'base64-arraybuffer';
import { requireBackend } from './supabase';
import { DriverInput, validateDriver } from '../domain/registration';
import { inspectLicenseImage } from '../domain/license-evidence';

/** Stores private license under auth.uid()/..., submits driver + vehicle through one server RPC.
 * A filename/signature check is NOT identity verification; admin + server policies decide approval.
 */
export async function submitDriverRegistration(input: DriverInput, licenseBase64: string): Promise<void> {
  const error = validateDriver(input);
  if (error) throw new Error(error);
  const image = inspectLicenseImage(licenseBase64);
  const client = requireBackend();
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) throw new Error('Iniciá sesión antes de registrar un vehículo.');
  const path = `${user.id}/licencia-${Date.now()}.${image.extension}`;
  const { error: uploadError } = await client.storage.from('driver-docs').upload(path, decode(image.base64), {
    contentType: image.mimeType, upsert: false, cacheControl: '3600',
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

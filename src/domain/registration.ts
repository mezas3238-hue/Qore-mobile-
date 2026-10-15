/** Pure validation shared by registration UI and unit tests. Server validates independently. */
export type PassengerInput = { fullName: string; phone: string; email: string; password: string; consent: boolean };
export type VehicleInput = {
  plate: string; brand: string; model: string; color: string; year: string;
  category: 'economico' | 'confort' | 'xl';
};
export type DriverInput = VehicleInput & {
  fullName: string; phone: string; licenseNumber: string; licensePhotoSelected: boolean; consent: boolean;
};
export function validatePassenger(v: PassengerInput): string | null {
  if (v.fullName.trim().length < 3 || v.fullName.trim().length > 120) return 'Ingresá nombre y apellido completos.';
  if (!/^\+?[0-9\s()-]{7,20}$/.test(v.phone.trim())) return 'Ingresá un teléfono válido.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) return 'Ingresá un correo electrónico válido.';
  if (v.password.length < 10 || !/[0-9]/.test(v.password) || !/[A-Za-z]/.test(v.password)) return 'La contraseña debe tener 10 caracteres, números y letras.';
  if (!v.consent) return 'Debés aceptar la política de privacidad y las condiciones.';
  return null;
}
export function validateDriver(v: DriverInput): string | null {
  if (!v.consent) return 'Debés aceptar el tratamiento de datos para verificar tu solicitud.';
  if (v.fullName.trim().length < 3 || v.fullName.trim().length > 120) return 'Ingresá nombre y apellido.';
  if (!/^\+?[0-9\s()-]{7,20}$/.test(v.phone.trim())) return 'Ingresá un teléfono válido.';
  if (v.licenseNumber.trim().length < 4 || v.licenseNumber.trim().length > 40) return 'Ingresá el número de licencia profesional.';
  if (v.plate.trim().length < 4 || v.plate.trim().length > 12) return 'Ingresá la chapa/patente del vehículo.';
  if (v.brand.trim().length < 2 || v.model.trim().length < 1 || v.color.trim().length < 3) return 'Completá marca, modelo y color.';
  const year = Number(v.year);
  if (!Number.isInteger(year) || year < 1995 || year > new Date().getFullYear() + 1) return 'Año del vehículo inválido.';
  if (!['economico', 'confort', 'xl'].includes(v.category)) return 'Elegí la categoría del vehículo.';
  if (!v.licensePhotoSelected) return 'Adjuntá una imagen de tu licencia antes de enviar.';
  return null;
}

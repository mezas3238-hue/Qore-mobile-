/**
 * Modelo de dominio 100% demostrativo; NO estima tarifas comerciales reales.
 * El backend de producción debe realizar los cálculos y las transiciones con RPC.
 */
export type Category = 'economico' | 'confort' | 'xl';
export type RideStage = 'searching' | 'accepted' | 'arriving' | 'in_progress' | 'completed' | 'cancelled';
export type Driver = { name: string; vehicle: string; plate: string; rating: number };
export type Place = { id: string; label: string; lat: number; lng: number; subtitle: string };
export type Fare = { base: number; perKm: number; perMinute: number; commissionPercent: number };
export type Quote = { distanceKm: number; minutes: number; priceGs: number };

export const PLACES: readonly Place[] = [
  { id: 'panteon', label: 'Panteón de los Héroes', subtitle: 'Centro, Asunción', lat: -25.282, lng: -57.635 },
  { id: 'shopping', label: 'Shopping del Sol', subtitle: 'Las Lomas, Asunción', lat: -25.284, lng: -57.565 },
  { id: 'terminal', label: 'Terminal de Ómnibus', subtitle: 'República Argentina', lat: -25.315, lng: -57.574 },
  { id: 'costanera', label: 'Costanera de Asunción', subtitle: 'Bahía de Asunción', lat: -25.270, lng: -57.615 },
  { id: 'botanico', label: 'Jardín Botánico', subtitle: 'Santísima Trinidad', lat: -25.254, lng: -57.570 },
  { id: 'aeropuerto', label: 'Aeropuerto Silvio Pettirossi', subtitle: 'Luque', lat: -25.241, lng: -57.514 },
] as const;

/** Tarifas inventadas PARA DEMOSTRACIÓN, sujetas a revisión. */
export const DEMO_FARES: Record<Category, Fare> = {
  economico: { base: 7000, perKm: 3200, perMinute: 250, commissionPercent: 15 },
  confort: { base: 11000, perKm: 4300, perMinute: 350, commissionPercent: 15 },
  xl: { base: 15000, perKm: 5500, perMinute: 450, commissionPercent: 15 },
};
export const CATEGORY_LABEL: Record<Category, string> = {
  economico: 'Económico', confort: 'Confort', xl: 'XL',
};
export const DEMO_DRIVER: Driver = {
  name: 'Alejandro (ficticio)', vehicle: 'Toyota Vitz · blanco', plate: 'DEMO-123', rating: 4.9,
};

export function haversineKm(a: Place, b: Place): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const v = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(v), Math.sqrt(1 - v));
}

export function quoteDemo(origin: Place, destination: Place, category: Category): Quote {
  if (origin.id === destination.id) throw new Error('Elegí lugares diferentes.');
  const distanceKm = Math.max(0.5, Math.round(haversineKm(origin, destination) * 1.3 * 10) / 10);
  const minutes = Math.max(3, Math.round(distanceKm / 24 * 60));
  const cfg = DEMO_FARES[category];
  const priceGs = Math.ceil((cfg.base + distanceKm * cfg.perKm + minutes * cfg.perMinute) / 1000) * 1000;
  return { distanceKm, minutes, priceGs };
}

export const formatGs = (n: number): string => `Gs. ${Math.round(n).toLocaleString('es-PY')}`;
export const STATUS_LABEL: Record<RideStage, string> = {
  searching: 'Buscando conductor', accepted: 'Conductor asignado', arriving: 'Conductor en el origen',
  in_progress: 'Viaje en curso', completed: 'Viaje finalizado', cancelled: 'Viaje cancelado',
};

export type Ride = {
  id: string;
  createdAt: string;
  origin: Place;
  destination: Place;
  category: Category;
  quote: Quote;
  stage: RideStage;
  driver: Driver | null;
  rating?: number;
};
export type Action =
  | { type: 'request'; ride: Ride }
  | { type: 'accept'; id: string }
  | { type: 'arrive'; id: string }
  | { type: 'start'; id: string }
  | { type: 'complete'; id: string }
  | { type: 'cancel'; id: string }
  | { type: 'rate'; id: string; rating: number }
  | { type: 'availability'; available: boolean }
  | { type: 'reset' };
export type RideState = { rides: Ride[]; driverAvailable: boolean };
export const initialRideState: RideState = { rides: [], driverAvailable: true };
export const isActive = (r: Ride): boolean => r.stage !== 'completed' && r.stage !== 'cancelled';

/** Las transiciones inválidas NO cambian el estado. La demo no concede permisos reales. */
export function rideReducer(state: RideState, action: Action): RideState {
  if (action.type === 'reset') return { rides: [], driverAvailable: true };
  if (action.type === 'availability') return { ...state, driverAvailable: action.available };
  if (action.type === 'request') {
    if (state.rides.some(isActive) || action.ride.origin.id === action.ride.destination.id || action.ride.stage !== 'searching' || action.ride.driver !== null) return state;
    return { ...state, rides: [action.ride, ...state.rides] };
  }
  const ride = state.rides.find(r => r.id === action.id);
  if (!ride) return state;
  const stage = ride.stage;
  let update: Ride | undefined;
  switch (action.type) {
    case 'accept':
      if (stage === 'searching' && state.driverAvailable) update = { ...ride, stage: 'accepted', driver: DEMO_DRIVER };
      break;
    case 'arrive': if (stage === 'accepted') update = { ...ride, stage: 'arriving' }; break;
    case 'start': if (stage === 'arriving') update = { ...ride, stage: 'in_progress' }; break;
    case 'complete': if (stage === 'in_progress') update = { ...ride, stage: 'completed' }; break;
    case 'cancel': if (stage === 'searching' || stage === 'accepted' || stage === 'arriving') update = { ...ride, stage: 'cancelled' }; break;
    case 'rate': if (stage === 'completed' && !ride.rating && Number.isInteger(action.rating) && action.rating >= 1 && action.rating <= 5) update = { ...ride, rating: action.rating }; break;
  }
  const nextRide = update;
  return nextRide ? { ...state, rides: state.rides.map(r => r.id === action.id ? nextRide : r) } : state;
}

export function createDemoRide(origin: Place, destination: Place, category: Category): Ride {
  return {
    id: `DEMO-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
    origin, destination, category, quote: quoteDemo(origin, destination, category), stage: 'searching', driver: null,
  };
}

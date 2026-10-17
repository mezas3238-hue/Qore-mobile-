/** Official, keyless third-party navigation. Coordinates come from selected/verified places. */
export type Point = { lat: number; lng: number };
export function validPoint(p: Point): boolean {
  return Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.lat >= -90 && p.lat <= 90 && p.lng >= -180 && p.lng <= 180;
}
export function mapsDirectionsUrl(destination: Point, origin?: Point): string {
  if (!validPoint(destination) || (origin && !validPoint(origin))) throw new Error('Coordenadas inválidas.');
  const d = encodeURIComponent(`${destination.lat},${destination.lng}`);
  const o = origin ? `&origin=${encodeURIComponent(`${origin.lat},${origin.lng}`)}` : '';
  return `https://www.google.com/maps/dir/?api=1&destination=${d}${o}&travelmode=driving&dir_action=navigate`;
}
export function wazeDirectionsUrl(destination: Point): string {
  if (!validPoint(destination)) throw new Error('Coordenadas inválidas.');
  return `https://waze.com/ul?ll=${encodeURIComponent(`${destination.lat},${destination.lng}`)}&navigate=yes&utm_source=qore-mobile`;
}

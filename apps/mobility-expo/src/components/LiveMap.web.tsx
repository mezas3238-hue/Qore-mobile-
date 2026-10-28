import React from 'react';
import { Place } from '../domain/rides';
export function LiveMap({ fallback }: { origin: Place; destination: Place; myPosition?: {lat:number;lng:number}|null; fallback: React.ReactNode }) {
  return <>{fallback}</>;
}

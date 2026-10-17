import React, { createContext, useContext, useMemo, useReducer } from 'react';
import { Action, Category, createDemoRide, initialRideState, isActive, PLACES, Ride, rideReducer, RideState } from '../domain/rides';

type ContextValue = {
  state: RideState;
  active: Ride | undefined;
  request: (originId: string, destinationId: string, category: Category) => string | undefined;
  act: (action: Action) => void;
};
const Context = createContext<ContextValue | undefined>(undefined);
export function RideProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(rideReducer, initialRideState);
  const active = state.rides.find(isActive);
  const value = useMemo<ContextValue>(() => ({
    state, active,
    request(originId, destinationId, category) {
      if (state.rides.some(isActive)) return 'Ya hay un viaje activo. Finalizalo antes de pedir otro.';
      const origin = PLACES.find(p => p.id === originId);
      const destination = PLACES.find(p => p.id === destinationId);
      if (!origin || !destination || origin.id === destination.id) return 'Elegí dos lugares diferentes.';
      dispatch({ type: 'request', ride: createDemoRide(origin, destination, category) });
      return undefined;
    },
    act: dispatch,
  }), [state, active]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useRides(): ContextValue {
  const ctx = useContext(Context);
  if (!ctx) throw new Error('useRides fuera de RideProvider');
  return ctx;
}

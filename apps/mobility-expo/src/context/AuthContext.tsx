import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { requireBackend, supabase, backendConfigured } from '../services/supabase';
import { PassengerInput, validatePassenger } from '../domain/registration';

interface AuthValue {
  user: User | null; loading: boolean; configured: boolean;
  registerPassenger: (input: PassengerInput) => Promise<string>;
  logIn: (email: string, password: string) => Promise<void>;
  logOut: () => Promise<void>;
}
const Context = createContext<AuthValue | undefined>(undefined);
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(backendConfigured);
  useEffect(() => {
    if (!supabase) return;
    let live = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session: Session | null) => {
      if (live) { setUser(session?.user ?? null); setLoading(false); }
    });
    supabase.auth.getSession().then(({ data, error }) => {
      if (live) { if (!error) setUser(data.session?.user ?? null); setLoading(false); }
    }).catch(() => { if (live) setLoading(false); });
    return () => { live = false; subscription.unsubscribe(); };
  }, []);
  const value = useMemo<AuthValue>(() => ({
    user, loading, configured: backendConfigured,
    async registerPassenger(input) {
      const error = validatePassenger(input);
      if (error) throw new Error(error);
      const client = requireBackend();
      const { data, error: authError } = await client.auth.signUp({
        email: input.email.trim().toLowerCase(), password: input.password,
        options: { data: { full_name: input.fullName.trim(), phone: input.phone.trim() } },
      });
      if (authError) throw authError;
      if (!data.user) throw new Error('No se pudo crear la cuenta.');
      // The trigger in Supabase creates the passenger role and profile. Never let clients write user_roles.
      if (data.session) {
        const { error: profileError } = await client.from('profiles')
          .update({ full_name: input.fullName.trim(), phone: input.phone.trim() })
          .eq('id', data.user.id);
        if (profileError) throw new Error(`Cuenta creada, pero no se pudo completar el perfil: ${profileError.message}`);
      }
      return data.session ? 'Cuenta de pasajero creada correctamente.' : 'Cuenta creada. Revisá tu correo para verificar la dirección antes de ingresar.';
    },
    async logIn(email, password) {
      const { error } = await requireBackend().auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error) throw error;
    },
    async logOut() { const { error } = await requireBackend().auth.signOut(); if (error) throw error; },
  }), [user, loading]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAuth(): AuthValue {
  const value = useContext(Context);
  if (!value) throw new Error('useAuth debe utilizarse dentro de AuthProvider');
  return value;
}

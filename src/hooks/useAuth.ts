import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

export type UserRole = 'super_admin' | 'clinic_admin' | 'doctor' | 'wound_specialist' | 'nurse' | 'patient' | 'clinician';

export interface OrgMembership {
  id: string;
  organization_id: string;
  role: string;
  status: string;
}

export interface AuthState {
  user: User | null;
  session: Session | null;
  role: UserRole | null;
  organizationId: string | null;
  membership: OrgMembership | null;
  loading: boolean;
}

async function fetchUserContext(user: User): Promise<{ role: UserRole; organizationId: string | null; membership: OrgMembership | null }> {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, organization_id')
    .eq('id', user.id)
    .maybeSingle();

  const metaRole = (user.app_metadata?.role ?? user.user_metadata?.role) as UserRole | undefined;
  const role = (profile?.role as UserRole) ?? metaRole ?? 'patient';
  let organizationId = profile?.organization_id ?? null;
  let membership: OrgMembership | null = null;

  if (profileError) {
    console.warn('Profile fetch failed:', profileError.message);
  }

  const { data: mem, error: memError } = await supabase
    .from('organization_memberships')
    .select('id, organization_id, role, status')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (memError) {
    console.warn('Membership fetch failed:', memError.message);
  }

  if (mem) {
    membership = mem;
    if (!organizationId) {
      organizationId = mem.organization_id;
    }
  }

  return { role, organizationId, membership };
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    role: null,
    organizationId: null,
    membership: null,
    loading: true,
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchUserContext(session.user).then(ctx => {
          setAuthState({ user: session.user, session, ...ctx, loading: false });
        });
      } else {
        setAuthState({ user: null, session: null, role: null, organizationId: null, membership: null, loading: false });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        (async () => {
          const ctx = await fetchUserContext(session.user);
          setAuthState({ user: session.user, session, ...ctx, loading: false });
        })();
      } else {
        setAuthState({ user: null, session: null, role: null, organizationId: null, membership: null, loading: false });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return authState;
}

export async function signUp(email: string, password: string, role: UserRole, displayName: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { role, display_name: displayName },
    },
  });
  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
'use client';

// CocoaTrack V2 - Auth Context
// Provides authentication state and methods to the app

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { createClient } from '@/lib/supabase/client';

import type { AuthContextValue, AuthState, AuthUser } from './types';
import type { Profile } from '@/types/database.gen';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
  initialProfile?: Profile | null;
}

export function AuthProvider({ children, initialProfile = null }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    user: initialProfile ? profileToAuthUser(initialProfile) : null,
    profile: initialProfile,
    isLoading: !initialProfile,
    isAuthenticated: !!initialProfile,
  });

  const supabase = createClient();

  // Fetch user profile from database
  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }

    return data;
  }, [supabase]);

  // Refresh the current user's profile
  const refreshProfile = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setState({
        user: null,
        profile: null,
        isLoading: false,
        isAuthenticated: false,
      });
      return;
    }

    const profile = await fetchProfile(user.id);
    setState({
      user: profile ? profileToAuthUser(profile) : null,
      profile,
      isLoading: false,
      isAuthenticated: !!profile,
    });
  }, [supabase, fetchProfile]);

  // Sign in with email and password
  const signIn = useCallback(
    async (email: string, password: string) => {
      setState((prev) => ({ ...prev, isLoading: true }));

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setState((prev) => ({ ...prev, isLoading: false }));
        return { error };
      }

      if (data.user) {
        const profile = await fetchProfile(data.user.id);
        setState({
          user: profile ? profileToAuthUser(profile) : null,
          profile,
          isLoading: false,
          isAuthenticated: !!profile,
        });
      }

      return { error: null };
    },
    [supabase, fetchProfile]
  );

  // Sign out
  const signOut = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }));
    await supabase.auth.signOut();
    setState({
      user: null,
      profile: null,
      isLoading: false,
      isAuthenticated: false,
    });
  }, [supabase]);

  // Listen for auth state changes
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const profile = await fetchProfile(session.user.id);
        setState({
          user: profile ? profileToAuthUser(profile) : null,
          profile,
          isLoading: false,
          isAuthenticated: !!profile,
        });
      } else if (event === 'SIGNED_OUT') {
        setState({
          user: null,
          profile: null,
          isLoading: false,
          isAuthenticated: false,
        });
      }
    });

    // Initial fetch if no initial profile provided
    if (!initialProfile) {
      refreshProfile();
    }

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, fetchProfile, refreshProfile, initialProfile]);

  const value: AuthContextValue = {
    ...state,
    signIn,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access auth context
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * Convert a Profile to an AuthUser
 */
function profileToAuthUser(profile: Profile): AuthUser {
  return {
    id: profile.id,
    email: profile.email,
    full_name: profile.full_name,
    role: profile.role,
    cooperative_id: profile.cooperative_id,
    region_id: profile.region_id,
    phone: profile.phone,
    is_active: profile.is_active,
  };
}

// CocoaTrack V2 - Auth Types
// Type definitions for authentication and authorization

import type { Profile, UserRole } from '@/types/database.gen';

export type { UserRole };

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  cooperative_id: string | null;
  region_id: string | null;
  phone: string | null;
  is_active: boolean;
}

export interface AuthState {
  user: AuthUser | null;
  profile: Profile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export interface SignInCredentials {
  email: string;
  password: string;
}

export interface AuthError {
  code: string;
  message: string;
}

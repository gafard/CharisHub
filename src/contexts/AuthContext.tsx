'use client';

import logger from '@/lib/logger';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { claimLegacyData, performInitialSync } from '@/lib/cloudSync';
import { Session, User, AuthChangeEvent } from '@supabase/supabase-js';

const AUTH_INIT_TIMEOUT_MS = 1500;

export type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  updated_at: string;
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async (userId: string) => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        // Si le profil n'existe pas encore, on le cree
        if (error.code === 'PGRST116') {
          await createProfile(userId);
          return;
        }
        console.error('Error fetching profile:', error);
        return;
      }
      setProfile(data);
    } catch (err) {
      console.error('Unexpected error fetching profile:', err);
    }
  };

  const createProfile = async (userId: string, displayName?: string) => {
    if (!supabase) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .insert({ id: userId, display_name: displayName || null });

      if (error) {
        console.error('Error creating profile:', error);
        return;
      }

      // Re-fetch after creation
      await fetchProfile(userId);
    } catch (err) {
      console.error('Unexpected error creating profile:', err);
    }
  };

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let isActive = true;
    const finishLoading = () => {
      if (isActive) {
        setLoading(false);
      }
    };

    const hydrateAuthenticatedUser = async (nextUser: User | null) => {
      if (!nextUser) {
        if (isActive) {
          setProfile(null);
        }
        return;
      }

      try {
        await fetchProfile(nextUser.id);
        await migrateLocalDataToAccount(nextUser.id);
        // Lancer la synchronisation initiale pour récupérer les données d'autres appareils
        void performInitialSync();
      } catch (err) {
        logger.error('[Auth] Error while hydrating user context:', err);
      }
    };

    const loadingGuard = window.setTimeout(() => {
      logger.warn('[Auth] Session bootstrap timed out; releasing app shell.');
      finishLoading();
    }, AUTH_INIT_TIMEOUT_MS);

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isActive) return;
        setSession(session);
        setUser(session?.user ?? null);
        finishLoading();
        void hydrateAuthenticatedUser(session?.user ?? null);
      } catch (err) {
        logger.error('[Auth] Error during initAuth:', err);
      } finally {
        window.clearTimeout(loadingGuard);
        finishLoading();
      }
    };

    void initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event: AuthChangeEvent, session: Session | null) => {
      try {
        if (!isActive) return;
        setSession(session);
        setUser(session?.user ?? null);
        finishLoading();
        void hydrateAuthenticatedUser(session?.user ?? null);
      } catch (err) {
        logger.error('[Auth] Error during onAuthStateChange:', err);
      } finally {
        finishLoading();
      }
    });

    return () => {
      isActive = false;
      window.clearTimeout(loadingGuard);
      subscription.unsubscribe();
    };
  }, []);

  // Migrer les donnees localStorage vers le compte Supabase via RPC sécurisée
  const migrateLocalDataToAccount = async (userId: string) => {
    if (!supabase) return;
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('formation_biblique_identity_v1') : null;
      if (!raw) return;
      const identity = JSON.parse(raw);
      const deviceId = identity?.deviceId;
      if (!deviceId) return;

      // Si les donnees ont deja ete migrees, on skip
      if (identity._migratedToAccount) return;

      logger.log('[Auth] Migration (RPC) des donnees locales vers le compte:', userId);
      
      // Appel de la nouvelle fonction SQL sécurisée
      const { error } = await supabase.rpc('link_device_to_user', { p_device_id: deviceId });
      
      if (error) {
        console.error('[Auth] Erreur RPC link_device_to_user:', error.message);
        // Fallback optionnel vers l'ancienne méthode si la RPC n'est pas encore déployée
        await claimLegacyData(deviceId, userId);
      }

      // Marquer comme migre localement
      identity._migratedToAccount = true;
      identity.userId = userId;
      localStorage.setItem('formation_biblique_identity_v1', JSON.stringify(identity));
    } catch (err) {
      console.error('[Auth] Erreur migration donnees locales:', err);
    }
  };

  const signInWithGoogle = async () => {
    if (!supabase) {
      throw new Error('Authentification indisponible.');
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    if (!supabase) {
      throw new Error('Authentification indisponible.');
    }
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  // Connexion avec email + mot de passe
  const signInWithEmail = async (email: string, password: string) => {
    if (!supabase) {
      throw new Error('Authentification indisponible.');
    }
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) {
      setError(error.message);
      throw error;
    }
  };

  // Inscription avec email + mot de passe + nom d'affichage
  const signUpWithEmail = async (email: string, password: string, displayName: string) => {
    if (!supabase) {
      throw new Error('Authentification indisponible.');
    }
    setError(null);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          display_name: displayName.trim(),
        },
      },
    });
    if (error) {
      setError(error.message);
      throw error;
    }

    // Si l'utilisateur est cree (pas besoin de verification email)
    if (data.user) {
      await createProfile(data.user.id, displayName.trim());
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return;
    if (!supabase) {
      throw new Error('Profil indisponible.');
    }
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) {
        console.error('Error updating profile:', error);
        throw error;
      }

      await fetchProfile(user.id);
    } catch (err) {
      console.error('Unexpected error updating profile:', err);
      throw err;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        error,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        refreshProfile,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

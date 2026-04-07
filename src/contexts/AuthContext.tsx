'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { claimLegacyData } from '@/lib/cloudSync';
import { Session, User, AuthChangeEvent } from '@supabase/supabase-js';

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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async (userId: string) => {
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
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        await fetchProfile(session.user.id);
        // Migrer les donnees locales vers le compte
        await migrateLocalDataToAccount(session.user.id);
      }
      setLoading(false);
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event: AuthChangeEvent, session: Session | null) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        await fetchProfile(session.user.id);
        // Migrer les donnees locales vers le compte
        await migrateLocalDataToAccount(session.user.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Migrer les donnees localStorage vers le compte Supabase via RPC sécurisée
  const migrateLocalDataToAccount = async (userId: string) => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('formation_biblique_identity_v1') : null;
      if (!raw) return;
      const identity = JSON.parse(raw);
      const deviceId = identity?.deviceId;
      if (!deviceId) return;

      // Si les donnees ont deja ete migrees, on skip
      if (identity._migratedToAccount) return;

      console.log('[Auth] Migration (RPC) des donnees locales vers le compte:', userId);
      
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
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  // Connexion avec email + mot de passe
  const signInWithEmail = async (email: string, password: string) => {
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

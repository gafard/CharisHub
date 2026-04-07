'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const KEY = 'formation_biblique_identity_v1';

export type CommunityIdentity = {
  deviceId: string;     // identifiant local
  displayName: string;  // pseudo/nom
  userId?: string;      // UUID Supabase si connecté
  avatarUrl?: string;
};

function makeDeviceId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function useCommunityIdentity() {
  const { user, profile } = useAuth();
  const [localIdentity, setLocalIdentity] = useState<CommunityIdentity | null>(null);

  // Charger l'identité locale (deviceId)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        setLocalIdentity(JSON.parse(raw));
        return;
      }
      const init: CommunityIdentity = { deviceId: makeDeviceId(), displayName: '' };
      localStorage.setItem(KEY, JSON.stringify(init));
      setLocalIdentity(init);
    } catch {
      setLocalIdentity({ deviceId: makeDeviceId(), displayName: '' });
    }
  }, []);

  // Flags d'authentification
  const isAuthenticated = !!(user && profile);
  const isGuest = !isAuthenticated;

  // L'identité finale est soit celle du compte, soit la locale
  const identity = useMemo((): CommunityIdentity | null => {
    if (isAuthenticated && user && profile) {
      return {
        deviceId: localIdentity?.deviceId || 'unknown',
        displayName: profile.display_name || user.email?.split('@')[0] || 'Utilisateur',
        userId: user.id,
        avatarUrl: profile.avatar_url || undefined,
      };
    }
    return localIdentity;
  }, [user, profile, localIdentity, isAuthenticated]);

  const updateName = (displayName: string) => {
    // Note: On ne met plus à jour le nom local si on veut forcer l'auth
    // Le nom devrait venir du profil Supabase
    setLocalIdentity((prev) => {
      const next = { ...(prev ?? { deviceId: makeDeviceId(), displayName: '' }), displayName };
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  return useMemo(() => ({ 
    identity, 
    isAuthenticated, 
    isGuest,
    updateName 
  }), [identity, isAuthenticated, isGuest]);
}

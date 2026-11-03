import { useEffect, useState } from 'react';
import type { ThinkingProfile } from '@sq/shared';
import { api } from './api';

/** Profil de pensée du joueur (`null` : pas chargé, ou aucune revue réflexive). */
export function useThinking(enabled: boolean): ThinkingProfile | null {
  const [profile, setProfile] = useState<ThinkingProfile | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void api.thinkingProfile().then((p) => alive && setProfile(p));
    return () => {
      alive = false;
    };
  }, [enabled]);
  return profile;
}

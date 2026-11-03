import { create } from 'zustand';
import type { UserPublic } from '@sq/shared';
import { api } from './api';

/** Utilisateur connecté (cookie de session httpOnly côté serveur ; rien n'est stocké ici). */
interface SessionStore {
  user: UserPublic | null;
  loaded: boolean;
  refresh: () => Promise<void>;
  setUser: (user: UserPublic | null) => void;
}

export const useSession = create<SessionStore>((set) => ({
  user: null,
  loaded: false,
  refresh: async () => set({ user: await api.me(), loaded: true }),
  setUser: (user) => set({ user, loaded: true }),
}));

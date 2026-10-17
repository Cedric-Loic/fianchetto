import type { BotLevelInfo, LeaderboardResponse, ProfileResponse, UserPublic } from '@sq/shared';

/** Appel REST ; `null` en cas d'erreur HTTP ou réseau (serveur arrêté…). */
async function call<T>(method: string, path: string, body?: unknown): Promise<T | null> {
  try {
    const res = await fetch(path, {
      method,
      headers: body ? { 'content-type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export const api = {
  me: () => call<UserPublic>('GET', '/api/auth/me'),
  login: (username: string, password: string) =>
    call<UserPublic>('POST', '/api/auth/login', { username, password }),
  register: (username: string, password: string) =>
    call<UserPublic>('POST', '/api/auth/register', { username, password }),
  logout: () => call<{ ok: true }>('POST', '/api/auth/logout'),
  botLevels: () => call<BotLevelInfo[]>('GET', '/api/bot-levels'),
  leaderboard: () => call<LeaderboardResponse>('GET', '/api/leaderboard'),
  profile: (username: string) =>
    call<ProfileResponse>('GET', `/api/profile/${encodeURIComponent(username)}`),
  activeGame: () => call<{ gameId: string | null }>('GET', '/api/games/active'),
  createGame: (body: unknown) => call<{ gameId: string }>('POST', '/api/games', body),
};

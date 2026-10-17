/*
 * Récupération des parties publiques d'un joueur chess.com (API publique « PubAPI »). Seul
 * accès réseau de l'application : uniquement sur demande explicite de l'utilisateur, côté
 * serveur (docs/DECISIONS.md, étape 7).
 */

/** Requête HTTP GET renvoyant du JSON (remplaçable dans les tests). */
export type JsonFetcher = (
  url: string,
) => Promise<{ status: number; json: () => Promise<unknown> }>;

export class ChessComError extends Error {
  constructor(readonly code: 'NOT_FOUND' | 'UNAVAILABLE') {
    super(code);
  }
}

export interface ChessComGame {
  url: string;
  pgn: string;
}

const API = 'https://api.chess.com/pub/player';

export const defaultFetcher: JsonFetcher = async (url) => {
  const res = await fetch(url, {
    headers: { 'user-agent': 'Fianchetto (application d’échecs personnelle, usage local)' },
    signal: AbortSignal.timeout(20_000),
  });
  return { status: res.status, json: () => res.json() };
};

async function getJson(fetcher: JsonFetcher, url: string): Promise<unknown> {
  let res;
  try {
    res = await fetcher(url);
  } catch {
    throw new ChessComError('UNAVAILABLE');
  }
  if (res.status === 404) throw new ChessComError('NOT_FOUND');
  if (res.status !== 200) throw new ChessComError('UNAVAILABLE');
  try {
    return await res.json();
  } catch {
    throw new ChessComError('UNAVAILABLE');
  }
}

/**
 * Les `max` parties d'échecs standard les plus récentes du joueur (les variantes sont
 * ignorées), de la plus récente à la plus ancienne.
 */
export async function fetchRecentGames(
  username: string,
  max: number,
  fetcher: JsonFetcher = defaultFetcher,
): Promise<ChessComGame[]> {
  const user = encodeURIComponent(username.toLowerCase());
  const index = (await getJson(fetcher, `${API}/${user}/games/archives`)) as {
    archives?: unknown;
  };
  const archives = Array.isArray(index.archives)
    ? index.archives.filter((a): a is string => typeof a === 'string' && a.startsWith(API))
    : [];
  const games: ChessComGame[] = [];
  // Les archives mensuelles vont de la plus ancienne à la plus récente.
  for (const archive of archives.reverse()) {
    if (games.length >= max) break;
    const month = (await getJson(fetcher, archive)) as { games?: unknown };
    const list = Array.isArray(month.games) ? (month.games as Record<string, unknown>[]) : [];
    for (const g of [...list].reverse()) {
      if (games.length >= max) break;
      if (g.rules !== 'chess' || typeof g.pgn !== 'string' || typeof g.url !== 'string') continue;
      games.push({ url: g.url, pgn: g.pgn });
    }
  }
  return games;
}

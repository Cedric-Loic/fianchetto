import { useEffect, useState } from 'react';
import type { EndgameSummary, GameResult, ViewerGameState } from '@sq/shared';
import { api } from './api';

/**
 * Finale réussie (même règle que le serveur, `@sq/coach`) : gagner, ou pour une finale à
 * tenir, gagner ou faire nulle autrement que par accord.
 */
export function endgameSucceeded(endgame: EndgameSummary, result: GameResult): boolean {
  if (result.winner === endgame.color) return true;
  return endgame.goal === 'draw' && result.winner === null && result.reason !== 'agreement';
}

/** Démarre une finale contre le bot et ouvre la partie ; `false` si le serveur refuse. */
export async function startEndgame(id: string): Promise<boolean> {
  const res = await api.startEndgame(id);
  if (!res) return false;
  location.hash = `#/game/${res.gameId}`;
  return true;
}

/**
 * Finale jouée par cette partie (entraînement depuis une position de la bibliothèque), ou
 * `null`. La position de départ est publique : on la compare à celles de la liste.
 */
export function useEndgameOf(state: ViewerGameState): EndgameSummary | null {
  const fen = state.mode === 'bot' && state.training ? state.initialFen : null;
  const [found, setFound] = useState<{ fen: string; endgame: EndgameSummary | null } | null>(null);
  useEffect(() => {
    if (!fen) return;
    let alive = true;
    void api.endgames().then((r) => {
      if (alive) setFound({ fen, endgame: r?.endgames.find((e) => e.fen === fen) ?? null });
    });
    return () => {
      alive = false;
    };
  }, [fen]);
  return found && found.fen === fen ? found.endgame : null;
}

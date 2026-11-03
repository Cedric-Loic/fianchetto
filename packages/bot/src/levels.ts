import type { BotLevel } from '@sq/shared';

/**
 * Réglage de la force par niveau. L'Elo nominal affiché est dans config/game.config.json ;
 * ici, seulement la mécanique : temps de réflexion par hypothèse, Skill Level de Stockfish,
 * nombre de coups candidats et « température » (en centipions) du tirage parmi eux.
 * Stockfish ne descend pas sous ~1320 Elo avec UCI_Elo : les niveaux bas ajoutent du hasard.
 */
export interface LevelSettings {
  movetimeMs: number;
  skill: number;
  multipv: number;
  temperature: number;
}

export const LEVELS: Readonly<Partial<Record<BotLevel, LevelSettings>>> = {
  1: { movetimeMs: 40, skill: 0, multipv: 6, temperature: 250 },
  2: { movetimeMs: 60, skill: 3, multipv: 5, temperature: 120 },
  3: { movetimeMs: 100, skill: 8, multipv: 4, temperature: 50 },
  4: { movetimeMs: 200, skill: 14, multipv: 3, temperature: 20 },
  5: { movetimeMs: 400, skill: 20, multipv: 3, temperature: 0 },
};

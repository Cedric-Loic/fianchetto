import type { GameResult, MoveIntent, PublicMove, Square } from '@sq/shared';

/** Cases de départ des pions choisis comme dames secrètes. */
export interface SecretChoice {
  w: Square;
  b: Square;
}

/**
 * Forme persistable (reprise après redémarrage) : secrets + intentions jouées + fin externe
 * éventuelle. Toujours manipulée enveloppée dans `Secret<PersistedGame>`.
 */
export interface PersistedGame {
  version: 1;
  secrets: SecretChoice;
  moves: MoveIntent[];
  externalResult: GameResult | null;
}

export type PlayResult =
  | { ok: true; move: PublicMove; result: GameResult | null } // result non nul si le coup termine la partie
  | { ok: false }; // refus SANS motif

/** Forme persistable d'une partie classique (rien de secret, mais même circuit de stockage). */
export interface PersistedClassicGame {
  version: 1;
  variant: 'classic';
  /** Position de départ, si ce n'est pas la position initiale standard. */
  initialFen?: string;
  moves: MoveIntent[];
  externalResult: GameResult | null;
}

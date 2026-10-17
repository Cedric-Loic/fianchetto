/*
 * Format des leçons (étape 10). Le contenu est écrit à la main en français ; chaque position
 * est vérifiée par les tests (légalité, et unicité de la solution avec Stockfish).
 */

/** Exercice « trouve le coup ». */
export interface Exercise {
  fen: string;
  prompt: string;
  /**
   * - `exact` : `solution` = suite de coups UCI (le joueur, la réponse adverse, le joueur…) ;
   *   un autre coup qui mate est accepté ;
   * - `choice` : un coup parmi `accepted` (principes d'ouverture) ;
   * - `engine` : tout coup qui ne perd pas plus de `tolerance` points de % de gain (Stockfish).
   */
  mode: 'exact' | 'choice' | 'engine';
  solution: string[];
  accepted?: string[];
  tolerance?: number;
  /** Coups tentants mais faux, vérifiés comme tels par les tests (mode `engine`). */
  traps?: string[];
  /** Explication affichée après l'exercice (réussi ou non). */
  explanation: string;
}

export type Section =
  | { kind: 'text'; title?: string; body: string }
  | {
      kind: 'example';
      fen: string;
      caption: string;
      /** Flèches [de, vers] et cases marquées pour illustrer l'idée. */
      arrows?: [string, string][];
      marks?: string[];
    };

export interface Lesson {
  id: string;
  /** Phase du plan de progression (1 : ne plus rien donner…). */
  phase: number;
  title: string;
  summary: string;
  minutes: number;
  sections: Section[];
  exercises: Exercise[];
}

/** Part d'exercices réussis du premier coup pour valider la leçon. */
export const PASS_RATIO = 0.8;

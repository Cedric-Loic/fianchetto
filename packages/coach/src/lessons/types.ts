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
   * - `engine` : tout coup qui ne perd pas plus de `tolerance` points de % de gain (Stockfish) ;
   * - `squares` : le joueur désigne des cases ; `squares` donne l'ensemble attendu (`solution` vide).
   */
  mode: 'exact' | 'choice' | 'engine' | 'squares';
  /** Mode `squares` : cases attendues (sans ordre). */
  squares?: string[];
  /** Indices progressifs (1 à 3), du plus discret au plus explicite : le ton est socratique. */
  hints?: string[];
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
    }
  | {
      /** Partie ou variante commentée : `moves` en UCI depuis `fen`, un commentaire par coup. */
      kind: 'walkthrough';
      title?: string;
      fen: string;
      moves: { uci: string; comment: string }[];
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

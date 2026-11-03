import { z } from 'zod';
import { ColorSchema } from './chess.js';
import { LegalMoveSchema } from './game-state.js';

/*
 * Puzzles (coach, étape 8). Le serveur est seul juge : le client affiche les positions reçues
 * (FEN) et envoie les coups ; il ne connaît jamais la solution avant d'avoir échoué ou réussi.
 * Sources : base Lichess (CC0, importée une fois en local) et « mes erreurs » (positions tirées
 * des revues de tes propres parties).
 */

export const PuzzleSourceSchema = z.enum(['lichess', 'mine']);
export type PuzzleSource = z.infer<typeof PuzzleSourceSchema>;

/**
 * Mode de tirage :
 * - `rated` : au niveau (classement puzzle), légèrement au-dessus ;
 * - `theme` : même chose, filtré par thème ;
 * - `review` : révisions (puzzles ratés, répétition espacée) ;
 * - `mine` : positions de mes erreurs.
 */
export const PuzzleModeSchema = z.enum(['rated', 'theme', 'review', 'mine']);
export type PuzzleMode = z.infer<typeof PuzzleModeSchema>;

/** Un demi-coup joué dans un puzzle, avec la position qui en résulte. */
export const PuzzleStepSchema = z.object({
  uci: z.string(),
  san: z.string(),
  fen: z.string(),
});
export type PuzzleStep = z.infer<typeof PuzzleStepSchema>;

export const PuzzleAttemptSchema = z.object({
  attemptId: z.string(),
  source: PuzzleSourceSchema,
  puzzleId: z.string(),
  /** Classement du puzzle (Lichess) ; `null` pour mes erreurs. */
  rating: z.number().int().nullable(),
  themes: z.array(z.string()),
  /** Camp qui doit trouver la solution (plateau orienté de son côté). */
  color: ColorSchema,
  /** Position avant le coup adverse qui lance le puzzle. */
  fenBefore: z.string(),
  /** Coup adverse qui lance le puzzle (animé), puis position à résoudre. */
  setup: PuzzleStepSchema,
  legalMoves: z.array(LegalMoveSchema),
  /** Le résultat compte pour le classement puzzle. */
  rated: z.boolean(),
  /** Origine : lien de la partie Lichess, ou « ta partie contre X, coup 14 ». */
  origin: z.object({ label: z.string(), url: z.string().nullable() }).nullable(),
});
export type PuzzleAttempt = z.infer<typeof PuzzleAttemptSchema>;

export const PuzzleNextResponseSchema = z.object({ attempt: PuzzleAttemptSchema });
export type PuzzleNextResponse = z.infer<typeof PuzzleNextResponseSchema>;

export const PuzzleMoveRequestSchema = z.object({
  uci: z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/),
});

export const PuzzleMoveResponseSchema = z.object({
  /** `illegal` : coup refusé sans conséquence ; `failed` : mauvais coup (puzzle raté). */
  status: z.enum(['continue', 'solved', 'failed', 'illegal']),
  /** Coups joués à appliquer dans l'ordre : le tien, puis la réponse adverse éventuelle. */
  steps: z.array(PuzzleStepSchema),
  legalMoves: z.array(LegalMoveSchema),
  /** Après un échec : la solution depuis la position courante. */
  solution: z.array(PuzzleStepSchema).nullable(),
  /** Variation du classement puzzle (puzzle classé, première résolution). */
  rating: z.object({ before: z.number().int(), after: z.number().int() }).nullable(),
});
export type PuzzleMoveResponse = z.infer<typeof PuzzleMoveResponseSchema>;

/** Indice : case de départ de la pièce à jouer. */
export const PuzzleHintResponseSchema = z.object({ from: z.string() });

export const PuzzleThemeStatSchema = z.object({
  theme: z.string(),
  attempts: z.number().int(),
  solved: z.number().int(),
});

export const PuzzleStatsSchema = z.object({
  rating: z.number().int(),
  /** Écart type (Glicko-2) : plus il est grand, moins le classement est sûr. */
  deviation: z.number().int(),
  attempts: z.number().int(),
  solved: z.number().int(),
  /** Nombre de puzzles disponibles : base Lichess, mes erreurs, révisions dues. */
  available: z.object({
    lichess: z.number().int(),
    mine: z.number().int(),
    due: z.number().int(),
  }),
  themeOfDay: z.string(),
  /** Résultats par thème (thèmes déjà rencontrés). */
  themes: z.array(PuzzleThemeStatSchema),
});
export type PuzzleStats = z.infer<typeof PuzzleStatsSchema>;

/**
 * Thèmes proposés au choix (clés de la base Lichess), avec leur nom français. Ordre : du plan
 * de progression (tactique de base d'abord).
 */
export const PUZZLE_THEMES: Readonly<Record<string, string>> = {
  hangingPiece: 'Pièce en prise',
  fork: 'Fourchette',
  pin: 'Clouage',
  skewer: 'Enfilade',
  mateIn1: 'Mat en 1',
  mateIn2: 'Mat en 2',
  mateIn3: 'Mat en 3',
  backRankMate: 'Mat du couloir',
  discoveredAttack: 'Attaque à la découverte',
  doubleCheck: 'Échec double',
  deflection: 'Déviation',
  attraction: 'Attraction',
  capturingDefender: 'Élimination du défenseur',
  trappedPiece: 'Pièce piégée',
  sacrifice: 'Sacrifice',
  intermezzo: 'Coup intermédiaire',
  quietMove: 'Coup tranquille',
  defensiveMove: 'Coup défensif',
  advancedPawn: 'Pion avancé',
  kingsideAttack: 'Attaque sur le roi',
  exposedKing: 'Roi exposé',
  opening: 'Ouverture',
  middlegame: 'Milieu de partie',
  endgame: 'Finale',
  pawnEndgame: 'Finale de pions',
  rookEndgame: 'Finale de tours',
  short: 'Court (2 coups)',
  long: 'Long (3 coups)',
};

/** Noms français de tous les thèmes affichés (choix possibles, thèmes Lichess, mes erreurs). */
export const PUZZLE_THEME_LABELS: Readonly<Record<string, string>> = {
  ...PUZZLE_THEMES,
  mate: 'Mat',
  mateIn4: 'Mat en 4',
  mateIn5: 'Mat en 5 ou plus',
  crushing: 'Avantage décisif',
  advantage: 'Avantage',
  equality: 'Égalisation',
  oneMove: 'Un coup',
  veryLong: 'Très long',
  smotheredMate: 'Mat à l’étouffée',
  anastasiaMate: 'Mat d’Anastasia',
  arabianMate: 'Mat arabe',
  hookMate: 'Mat du crochet',
  bodenMate: 'Mat de Boden',
  doubleBishopMate: 'Mat des deux fous',
  dovetailMate: 'Mat en queue d’aronde',
  xRayAttack: 'Attaque aux rayons X',
  zugzwang: 'Zugzwang',
  interference: 'Interception',
  clearance: 'Dégagement',
  castling: 'Roque',
  enPassant: 'Prise en passant',
  promotion: 'Promotion',
  underPromotion: 'Sous-promotion',
  queensideAttack: 'Attaque à l’aile dame',
  bishopEndgame: 'Finale de fous',
  knightEndgame: 'Finale de cavaliers',
  queenEndgame: 'Finale de dames',
  queenRookEndgame: 'Finale dame et tour',
  master: 'Partie de maître',
  masterVsMaster: 'Maître contre maître',
  superGM: 'Super-GM',
  // Mes erreurs : type d'erreur détecté par la revue.
  'missed-mate': 'Mat manqué',
  'allowed-mate': 'Mat permis',
  'hanging-piece': 'Pièce laissée en prise',
  'allowed-fork': 'Fourchette permise',
  'material-loss': 'Perte de matériel',
  'missed-fork': 'Fourchette manquée',
  'missed-material': 'Gain de matériel manqué',
  'allowed-pin': 'Clouage permis',
  'missed-pin': 'Clouage manqué',
  'allowed-skewer': 'Enfilade permise',
  'missed-skewer': 'Enfilade manquée',
  'endgame-conversion': 'Finale mal convertie',
  generic: 'Meilleur coup à trouver',
};

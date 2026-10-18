import { z } from 'zod';
import { SquareSchema } from './chess.js';

/*
 * Analyse interactive (revue, échiquier d'analyse) : lignes du moteur en direct et schémas
 * dessinés sur le plateau. Le moteur en direct ne reçoit qu'une FEN fournie par le client :
 * jamais d'identifiant de partie, donc aucune information secrète possible.
 */

/** Ligne du moteur, du point de vue des Blancs. */
export const EngineLineSchema = z.object({
  /** Rang de la ligne (1 = meilleure). */
  multipv: z.number().int().positive(),
  depth: z.number().int().nonnegative(),
  evalCp: z.number().int().nullable(),
  /** Mat en N (positif : les Blancs matent), sinon `null`. */
  mate: z.number().int().nullable(),
  /** Suite de coups en UCI, puis en SAN (même longueur). */
  pv: z.array(z.string()),
  sanPv: z.array(z.string()),
});
export type EngineLine = z.infer<typeof EngineLineSchema>;

/** Événement du flux d'analyse en direct (SSE `GET /api/analysis/stream`). */
export const AnalysisEventSchema = z.discriminatedUnion('type', [
  /** Nouvelle profondeur atteinte : lignes triées par rang. */
  z.object({ type: z.literal('lines'), fen: z.string(), lines: z.array(EngineLineSchema) }),
  /** Recherche terminée (profondeur ou durée maximale atteinte, ou position finale). */
  z.object({ type: z.literal('done'), fen: z.string() }),
  /** Recherche arrêtée par une autre demande (autre onglet) : le client peut la relancer. */
  z.object({ type: z.literal('interrupted'), fen: z.string() }),
  z.object({ type: z.literal('error'), error: z.string() }),
]);
export type AnalysisEvent = z.infer<typeof AnalysisEventSchema>;

export const ANALYSIS_MAX_MULTIPV = 5;

/** Paramètres du flux d'analyse en direct. */
export const AnalysisStreamQuerySchema = z.object({
  fen: z.string().min(10).max(120),
  multipv: z.coerce.number().int().min(1).max(ANALYSIS_MAX_MULTIPV).default(3),
});
export type AnalysisStreamQuery = z.infer<typeof AnalysisStreamQuerySchema>;

// --- Schémas dessinés sur le plateau ------------------------------------------------------

/**
 * Types de flèches : meilleur coup, coup joué, menace adverse, coups d'une ligne (numérotés),
 * indice d'entraînement.
 */
export const ARROW_KINDS = ['best', 'played', 'threat', 'line', 'hint'] as const;
export const ArrowKindSchema = z.enum(ARROW_KINDS);
export type ArrowKind = z.infer<typeof ArrowKindSchema>;

export const BoardArrowSchema = z.object({
  from: SquareSchema,
  to: SquareSchema,
  kind: ArrowKindSchema,
  /** Rang dans une ligne (1, 2, 3…), affiché sur la flèche. */
  index: z.number().int().positive().optional(),
});
export type BoardArrow = z.infer<typeof BoardArrowSchema>;

/** Cases marquées : pièce en prise, cible (fourchette…), attaquant, case de mat. */
export const SQUARE_MARK_KINDS = ['hanging', 'target', 'attacker', 'mate'] as const;
export const SquareMarkKindSchema = z.enum(SQUARE_MARK_KINDS);
export type SquareMarkKind = z.infer<typeof SquareMarkKindSchema>;

export const SquareMarkSchema = z.object({ square: SquareSchema, kind: SquareMarkKindSchema });
export type SquareMark = z.infer<typeof SquareMarkSchema>;

/** Schéma qui illustre une explication : flèches, cases, et ligne à rejouer (UCI). */
export const ExplanationVisualSchema = z.object({
  arrows: z.array(BoardArrowSchema),
  marks: z.array(SquareMarkSchema),
  /** Ligne à animer (« Voir la ligne ») à partir de la position AVANT le coup. */
  line: z.array(z.string()).optional(),
});
export type ExplanationVisual = z.infer<typeof ExplanationVisualSchema>;

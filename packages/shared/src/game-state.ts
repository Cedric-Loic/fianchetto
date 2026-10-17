import { z } from 'zod';
import {
  ColorSchema,
  DisplayedPieceSchema,
  PieceIdSchema,
  PieceTypeSchema,
  PromotionPieceSchema,
  SquareSchema,
} from './chess.js';
import { TimeControlIdSchema } from './time-control.js';

/*
 * Vue d'une partie par un spectateur donné (projectForViewer).
 *
 * Règles de conception (exigence n°1, §4) :
 * - tous les types de pièces sont des types AFFICHÉS ;
 * - toutes les clés sont toujours présentes (valeur `null` plutôt que clé absente) pour que
 *   deux mondes différents produisent des messages de même forme (test d'indistinguabilité) ;
 * - aucun champ ne dérive de la position réelle sans être une annonce publique
 *   (échec, mat, fin de partie). En particulier : PAS de case de prise en passant,
 *   PAS de compteur des 50 coups, PAS de droits de roque, PAS de FEN réelle avant la fin.
 */

/**
 * Variante jouée. `classic` : échecs classiques, aucune information cachée (la projection est la
 * position réelle). `secret-queen` : un pion de chaque camp est secrètement une dame.
 */
export const VARIANTS = ['classic', 'secret-queen'] as const;
export const VariantSchema = z.enum(VARIANTS);
export type Variant = z.infer<typeof VariantSchema>;

/** Qui regarde : un camp, ou `public` (écran partagé du hot-seat, sans secret). */
export const ViewerSchema = z.enum(['w', 'b', 'public']);
export type Viewer = z.infer<typeof ViewerSchema>;

export const PublicMoveSchema = z.object({
  /** Numéro de demi-coup, à partir de 1. */
  ply: z.number().int().positive(),
  color: ColorSchema,
  pieceId: PieceIdSchema,
  /** Type affiché de la pièce AVANT le coup. */
  displayedType: PieceTypeSchema,
  from: SquareSchema,
  to: SquareSchema,
  /** Notation publique (§3.7) : « e4 », « exd5 », « a2-d5 », « a2xd5 », « Nf3+ », « O-O ». */
  san: z.string().min(2).max(16),
  /** Pièce prise, avec son type AFFICHÉ. `square` diffère de `to` en cas de prise en passant. */
  capture: z
    .object({
      pieceId: PieceIdSchema,
      displayedType: PieceTypeSchema,
      square: SquareSchema,
    })
    .nullable(),
  /** Promotion d'un pion ordinaire (jamais pour une dame secrète, qui ne se promeut pas). */
  promotion: PromotionPieceSchema.nullable(),
  /** Déplacement de la tour lors d'un roque, pour l'animation. */
  castle: z
    .object({
      rookId: PieceIdSchema,
      rookFrom: SquareSchema,
      rookTo: SquareSchema,
    })
    .nullable(),
  check: z.boolean(),
  checkmate: z.boolean(),
});
export type PublicMove = z.infer<typeof PublicMoveSchema>;

/** Case de la dame secrète du spectateur lui-même (marqueur discret, §4). */
export const OwnSecretSchema = z.object({
  pieceId: PieceIdSchema,
  /** `null` si la dame secrète a été capturée. */
  square: SquareSchema.nullable(),
});
export type OwnSecret = z.infer<typeof OwnSecretSchema>;

export const END_REASONS = [
  'checkmate',
  'resignation',
  'timeout',
  'stalemate',
  'insufficient-material',
  'timeout-vs-insufficient-material',
  'fifty-move-rule',
  'threefold-repetition',
  'agreement',
] as const;
export const EndReasonSchema = z.enum(END_REASONS);
export type EndReason = z.infer<typeof EndReasonSchema>;

export const GameResultSchema = z.object({
  /** `null` = partie nulle. */
  winner: ColorSchema.nullable(),
  reason: EndReasonSchema,
});
export type GameResult = z.infer<typeof GameResultSchema>;

export const RevealedSecretSchema = z.object({
  pieceId: PieceIdSchema,
  initialSquare: SquareSchema,
  /** Case finale, `null` si capturée. */
  finalSquare: SquareSchema.nullable(),
});
export type RevealedSecret = z.infer<typeof RevealedSecretSchema>;

/**
 * Révélation de fin de partie (§3.10). Présente UNIQUEMENT quand la partie est terminée.
 * Contient la vérité : les deux secrets, la FEN réelle initiale et, pour chaque demi-coup,
 * la notation réelle et la FEN réelle après le coup (rejeu et analyse).
 */
export const RevealSchema = z.object({
  secrets: z.object({ w: RevealedSecretSchema, b: RevealedSecretSchema }),
  realInitialFen: z.string(),
  plies: z.array(z.object({ realSan: z.string(), realFenAfter: z.string() })),
});
export type Reveal = z.infer<typeof RevealSchema>;

/** Coup légal (cases de départ et d'arrivée), pour l'aide visuelle du mode classique. */
export const LegalMoveSchema = z.object({ from: SquareSchema, to: SquareSchema });
export type LegalMove = z.infer<typeof LegalMoveSchema>;

/**
 * Partie « échiquier » de la vue, produite par `projectForViewer` (Secret Queen) ou
 * `projectClassic` (classique), dans packages/engine.
 * Secret Queen : `result` et `reveal` sont non nuls si et seulement si la partie est terminée.
 * Classique : `reveal` est toujours `null` (rien n'est caché, la notation est déjà réelle).
 */
export const ViewerBoardStateSchema = z.object({
  viewer: ViewerSchema,
  /** Pièces sur l'échiquier, triées par case (ordre de SQUARES), types affichés. */
  pieces: z.array(DisplayedPieceSchema),
  turn: ColorSchema,
  fullmoveNumber: z.number().int().positive(),
  /** Annonce « échec » pour le camp au trait (jamais la case ni la pièce attaquante). */
  inCheck: z.boolean(),
  moves: z.array(PublicMoveSchema),
  /** Types AFFICHÉS des pièces capturées, classées par couleur de la pièce capturée. */
  captured: z.object({ w: z.array(PieceTypeSchema), b: z.array(PieceTypeSchema) }),
  /** Uniquement si `viewer` est un camp ; toujours `null` pour `public`. */
  ownSecret: OwnSecretSchema.nullable(),
  result: GameResultSchema.nullable(),
  reveal: RevealSchema.nullable(),
  /**
   * Classique uniquement : coups légaux du camp au trait (`null` une fois la partie finie).
   * TOUJOURS `null` en Secret Queen (pas de surbrillance des coups légaux, et la liste
   * trahirait la dame secrète).
   */
  legalMoves: z.array(LegalMoveSchema).nullable(),
});
export type ViewerBoardState = z.infer<typeof ViewerBoardStateSchema>;

export const BotLevelSchema = z.number().int().min(1).max(5);
export type BotLevel = z.infer<typeof BotLevelSchema>;

export const PlayerInfoSchema = z.object({
  name: z.string().min(1).max(32),
  /** Elo affiché ; `null` pour un joueur sans classement (hot-seat). */
  rating: z.number().int().nullable(),
  isBot: z.boolean(),
  botLevel: BotLevelSchema.nullable(),
});
export type PlayerInfo = z.infer<typeof PlayerInfoSchema>;

export const ClockStateSchema = z.object({
  /** Temps restant au moment de l'envoi du message. */
  remainingMs: z.object({ w: z.number().int().nonnegative(), b: z.number().int().nonnegative() }),
  /** Camp dont la pendule tourne, `null` si aucune. */
  running: ColorSchema.nullable(),
  incrementMs: z.number().int().nonnegative(),
});
export type ClockState = z.infer<typeof ClockStateSchema>;

/** Phase de choix du pion secret (§3.9). */
export const SelectionStateSchema = z.object({
  /**
   * Hot-seat : camp qui choisit (choix séquentiels). Mode bot : `null` (choix simultanés).
   */
  chooser: ColorSchema.nullable(),
  /**
   * Hot-seat : `true` tant que l'écran de passage est affiché (le chrono n'a pas démarré).
   * Mode bot : toujours `false`.
   */
  handoffPending: z.boolean(),
  /** Temps restant pour choisir, `null` tant que le chrono n'a pas démarré. */
  remainingMs: z.number().int().nonnegative().nullable(),
  /** « Prêt » de chaque camp : seule information visible sur le choix adverse. */
  ready: z.object({ w: z.boolean(), b: z.boolean() }),
  /** Pion verrouillé par le spectateur lui-même (mode bot). Toujours `null` pour `public`. */
  ownLocked: SquareSchema.nullable(),
});
export type SelectionState = z.infer<typeof SelectionStateSchema>;

export const GameModeSchema = z.enum(['bot', 'hotseat']);
export type GameMode = z.infer<typeof GameModeSchema>;

export const GamePhaseSchema = z.enum(['secret-selection', 'playing', 'ended']);
export type GamePhase = z.infer<typeof GamePhaseSchema>;

/** Vue complète envoyée à un client (snapshot WebSocket). */
export const ViewerGameStateSchema = z.object({
  gameId: z.string().min(1),
  variant: VariantSchema,
  mode: GameModeSchema,
  viewer: ViewerSchema,
  phase: GamePhaseSchema,
  rated: z.boolean(),
  timeControl: TimeControlIdSchema,
  players: z.object({ w: PlayerInfoSchema, b: PlayerInfoSchema }),
  /** Non nul uniquement pendant la phase `secret-selection` (jamais en classique). */
  selection: SelectionStateSchema.nullable(),
  /** `null` pendant la phase `secret-selection`. */
  board: ViewerBoardStateSchema.nullable(),
  /** `null` pour une partie sans pendule. */
  clock: ClockStateSchema.nullable(),
  /** Camp ayant proposé nulle (proposition en attente), sinon `null`. */
  drawOffer: ColorSchema.nullable(),
  rematch: z.object({
    offeredBy: ColorSchema.nullable(),
    nextGameId: z.string().nullable(),
  }),
});
export type ViewerGameState = z.infer<typeof ViewerGameStateSchema>;

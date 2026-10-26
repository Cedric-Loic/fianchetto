import { create } from 'zustand';
import { TIME_CONTROL_IDS, type TimeControlId, type Variant } from '@sq/shared';

/*
 * Préférences (affichage, pseudo chess.com pour l'import). Seule donnée gardée dans le
 * navigateur (localStorage) : aucune information de partie n'y est jamais écrite
 * (docs/SECURITY.md §8).
 */

export const BOARD_THEMES = {
  marine: { label: 'Marine', light: '#e8e4d8', dark: '#5c7393' },
  bois: { label: 'Bois', light: '#f0d9b5', dark: '#b58863' },
  bleu: { label: 'Bleu', light: '#dee3e6', dark: '#8ca2ad' },
  gris: { label: 'Gris', light: '#e0e0e0', dark: '#9e9e9e' },
} as const;
export type BoardTheme = keyof typeof BOARD_THEMES;

export const PIECE_SETS = { cburnett: 'Classique', merida: 'Merida', alpha: 'Alpha' } as const;
export type PieceSet = keyof typeof PIECE_SETS;

/** Dernière partie lancée depuis l'accueil, reprise par le bouton « Jouer ». */
export interface LastPlay {
  mode: 'bot' | 'hotseat';
  variant: Variant;
  /** Entraînement avec le coach (classique contre le bot). */
  training: boolean;
  level: number;
  color: 'w' | 'b' | 'random';
  timeControl: TimeControlId;
}

export const DEFAULT_LAST_PLAY: LastPlay = {
  mode: 'bot',
  variant: 'classic',
  training: false,
  level: 3,
  color: 'random',
  timeControl: 'blitz-5+0',
};

/** Relit une dernière partie enregistrée ; `null` si elle est absente ou invalide. */
export function parseLastPlay(value: unknown): LastPlay | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  const tc = v.timeControl;
  if (
    (v.mode !== 'bot' && v.mode !== 'hotseat') ||
    (v.variant !== 'classic' && v.variant !== 'secret-queen') ||
    typeof v.level !== 'number' ||
    !Number.isInteger(v.level) ||
    v.level < 1 ||
    v.level > 10 ||
    (v.color !== 'w' && v.color !== 'b' && v.color !== 'random') ||
    typeof tc !== 'string' ||
    !(TIME_CONTROL_IDS as readonly string[]).includes(tc)
  ) {
    return null;
  }
  return {
    mode: v.mode,
    variant: v.variant,
    training: v.training === true && v.variant === 'classic' && v.mode === 'bot',
    level: v.level,
    color: v.color,
    timeControl: tc as TimeControlId,
  };
}

export interface Settings {
  board: BoardTheme;
  pieces: PieceSet;
  sound: boolean;
  /** Hot-seat : retourner le plateau vers le camp au trait. */
  autoFlip: boolean;
  /** Classique : points sur les cases accessibles à la pièce sélectionnée (jamais en Secret Queen). */
  showLegalMoves: boolean;
  /** Pseudo chess.com (import des parties), mémorisé pour ne pas le retaper. */
  chessComUsername: string;
  /** Entraînement : demander confirmation avant une gaffe. */
  trainingGuard: boolean;
  /** Entraînement classique contre le bot : le coach pose une question avant ton coup. */
  coached: boolean;
  /** Coups anticipés (premoves) : partout sauf à deux sur le même écran. */
  premoves: boolean;
  /** Analyse : moteur en direct (désactivé par défaut). */
  engine: boolean;
  /** Coups affichés en notation française (C, F, T, D, R) au lieu de l'anglaise. */
  frenchNotation: boolean;
  /** Revue guidée en quiz : on devine ton coup avant que le coach ne l'explique. */
  quiz: boolean;
  /** Premier lancement guidé terminé (ou passé). */
  onboarded: boolean;
  /** Dernière partie lancée (mode, niveau, couleur, cadence). */
  lastPlay: LastPlay | null;
}

const KEY = 'sq-settings';
const DEFAULTS: Settings = {
  board: 'marine',
  pieces: 'cburnett',
  sound: true,
  autoFlip: false,
  showLegalMoves: true,
  chessComUsername: '',
  trainingGuard: true,
  coached: true,
  premoves: true,
  engine: false,
  frenchNotation: false,
  quiz: false,
  onboarded: false,
  lastPlay: null,
};
const bool = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);
/** Thème d'échiquier enregistré : l'ancien « vert » (retiré) ou une valeur inconnue devient « marine ». */
export const boardTheme = (value: unknown): BoardTheme =>
  typeof value === 'string' && Object.hasOwn(BOARD_THEMES, value)
    ? (value as BoardTheme)
    : DEFAULTS.board;

/** Lit les préférences enregistrées (valeurs invalides remplacées par les valeurs par défaut). */
export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<Settings>) : {};
    return {
      board: boardTheme(parsed.board),
      pieces: parsed.pieces && parsed.pieces in PIECE_SETS ? parsed.pieces : DEFAULTS.pieces,
      sound: bool(parsed.sound, DEFAULTS.sound),
      autoFlip: bool(parsed.autoFlip, DEFAULTS.autoFlip),
      showLegalMoves: bool(parsed.showLegalMoves, DEFAULTS.showLegalMoves),
      trainingGuard: bool(parsed.trainingGuard, DEFAULTS.trainingGuard),
      coached: bool(parsed.coached, DEFAULTS.coached),
      premoves: bool(parsed.premoves, DEFAULTS.premoves),
      engine: bool(parsed.engine, DEFAULTS.engine),
      frenchNotation: bool(parsed.frenchNotation, DEFAULTS.frenchNotation),
      quiz: bool(parsed.quiz, DEFAULTS.quiz),
      onboarded: bool(parsed.onboarded, DEFAULTS.onboarded),
      lastPlay: parseLastPlay(parsed.lastPlay),
      chessComUsername:
        typeof parsed.chessComUsername === 'string'
          ? parsed.chessComUsername.slice(0, 40)
          : DEFAULTS.chessComUsername,
    };
  } catch {
    return DEFAULTS;
  }
}

export const useSettings = create<Settings & { update: (patch: Partial<Settings>) => void }>(
  (set, get) => ({
    ...loadSettings(),
    update(patch) {
      set(patch);
      // Tout l'état sauf la fonction `update`.
      const { update: _update, ...settings } = get();
      try {
        localStorage.setItem(KEY, JSON.stringify(settings));
      } catch {
        // stockage indisponible : préférences non conservées
      }
    },
  }),
);

export const pieceUrl = (set: PieceSet, color: string, type: string) =>
  `/pieces/${set}/${color}${type.toUpperCase()}.svg`;

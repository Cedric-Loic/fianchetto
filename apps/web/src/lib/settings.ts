import { create } from 'zustand';

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
  /** Coups anticipés (premoves) : partout sauf à deux sur le même écran. */
  premoves: boolean;
  /** Analyse : moteur en direct (désactivé par défaut). */
  engine: boolean;
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
  premoves: true,
  engine: false,
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
      premoves: bool(parsed.premoves, DEFAULTS.premoves),
      engine: bool(parsed.engine, DEFAULTS.engine),
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
      const {
        board,
        pieces,
        sound,
        autoFlip,
        showLegalMoves,
        chessComUsername,
        trainingGuard,
        premoves,
        engine,
      } = get();
      try {
        localStorage.setItem(
          KEY,
          JSON.stringify({
            board,
            pieces,
            sound,
            autoFlip,
            showLegalMoves,
            chessComUsername,
            trainingGuard,
            premoves,
            engine,
          }),
        );
      } catch {
        // stockage indisponible : préférences non conservées
      }
    },
  }),
);

export const pieceUrl = (set: PieceSet, color: string, type: string) =>
  `/pieces/${set}/${color}${type.toUpperCase()}.svg`;

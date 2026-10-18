import {
  PUZZLE_THEME_FOR_KIND,
  type ClassCounts,
  type Color,
  type ExplanationKind,
  type GameReview,
  type ReviewMove,
} from '@sq/shared';

/*
 * Revue guidée : choix des moments clés d'une partie et bilan final. Fonctions pures (testées
 * sans React).
 */

/** Étiquettes d'un moment clé : un coup peut en porter plusieurs. */
export type MomentTag = 'blunder' | 'mistake' | 'missed-win' | 'turning-point';

export interface KeyMoment {
  ply: number;
  move: ReviewMove;
  tags: MomentTag[];
}

export const MOMENT_LABEL: Record<MomentTag, string> = {
  blunder: 'Gaffe',
  mistake: 'Erreur',
  'missed-win': 'Gain manqué',
  'turning-point': 'Tournant de la partie',
};

/** Position gagnante (probabilité de gain en %) à partir de laquelle une erreur « manque un gain ». */
export const MISSED_WIN_FROM = 70;
/** Variation minimale (points de %) pour parler de tournant de la partie. */
export const TURNING_POINT_MIN = 15;

/** Erreurs et gaffes d'un camp (ou des deux si `color` est nul). */
export function mistakesOf(review: GameReview, color: Color | null): ReviewMove[] {
  return review.moves.filter(
    (m) =>
      (color === null || m.color === color) &&
      (m.classification === 'mistake' || m.classification === 'blunder'),
  );
}

/**
 * Moments clés pour le camp de l'utilisateur (les deux camps s'il est inconnu) : ses erreurs et
 * gaffes, marquées « gain manqué » quand la position était gagnante (≥ 70 %), puis le tournant
 * de la partie (plus forte chute de probabilité de gain, tous camps confondus, une seule fois).
 * Triés dans l'ordre de la partie.
 */
export function keyMoments(review: GameReview, userColor: Color | null): KeyMoment[] {
  const byPly = new Map<number, KeyMoment>();
  for (const m of mistakesOf(review, userColor)) {
    const tags: MomentTag[] = [m.classification === 'blunder' ? 'blunder' : 'mistake'];
    if (m.winBefore >= MISSED_WIN_FROM) tags.push('missed-win');
    byPly.set(m.ply, { ply: m.ply, move: m, tags });
  }
  let turning: ReviewMove | null = null;
  for (const m of review.moves) {
    const drop = m.winBefore - m.winAfter;
    if (drop < TURNING_POINT_MIN) continue;
    if (!turning || drop > turning.winBefore - turning.winAfter) turning = m;
  }
  if (turning) {
    const existing = byPly.get(turning.ply);
    if (existing) existing.tags.push('turning-point');
    else byPly.set(turning.ply, { ply: turning.ply, move: turning, tags: ['turning-point'] });
  }
  return [...byPly.values()].sort((a, b) => a.ply - b.ply);
}

/** Conseil du coach selon le type d'erreur. */
export const TIPS: Record<ExplanationKind, string> = {
  'hanging-piece':
    'Avant chaque coup, vérifie que la pièce jouée, et celles qu’elle protégeait, restent défendues.',
  'allowed-mate':
    'Après ton coup envisagé, regarde les échecs possibles de l’adversaire : ton roi est-il en sécurité ?',
  'allowed-fork':
    'Repère les cases d’où un cavalier ou un pion adverse attaquerait deux de tes pièces à la fois.',
  'material-loss':
    'Avant de jouer, cherche les prises et menaces de l’adversaire après ton coup (routine « échecs, prises, menaces »).',
  'missed-mate': 'À chaque coup, cherche d’abord tes échecs : un mat se cache parfois derrière.',
  'missed-fork':
    'Cherche les coups qui attaquent deux cibles à la fois : fourchettes, échecs doubles.',
  'missed-material':
    'Avant de jouer, vérifie si une pièce adverse est en prise : prends ce qu’on te donne.',
  'allowed-pin':
    'Avant de jouer, regarde les lignes (colonnes, diagonales) qui mènent à ton roi ou à ta dame : une pièce placée devant risque d’être clouée.',
  'missed-pin':
    'Cherche les pièces adverses alignées avec leur roi ou leur dame : un fou ou une tour peut les clouer.',
  'allowed-skewer':
    'Évite d’aligner ton roi ou ta dame avec une pièce non défendue derrière : une enfilade la gagnerait.',
  'missed-skewer':
    'Quand le roi ou la dame adverse est aligné avec une autre pièce, cherche l’échec ou l’attaque qui la fait s’écarter.',
  'endgame-conversion':
    'En finale gagnante, simplifie, active ton roi et pousse tes pions passés ; vérifie chaque coup avant de jouer vite.',
  generic:
    'Compare deux ou trois coups candidats avant de jouer, surtout dans les positions tendues.',
};

/** Conseils d'appoint quand la partie compte moins de trois types d'erreurs. */
const FALLBACK_KINDS: readonly ExplanationKind[] = ['generic', 'material-loss', 'missed-mate'];

export interface GuidedSummary {
  /** Précision par camp concerné. */
  accuracy: { color: Color; value: number | null }[];
  /** Nombre de gaffes, erreurs et imprécisions des camps concernés. */
  counts: Pick<ClassCounts, 'blunder' | 'mistake' | 'inaccuracy'>;
  /** Trois conseils, du type d'erreur le plus fréquent au moins fréquent. */
  tips: string[];
  /** Type d'erreur le plus fréquent (`null` sans erreur expliquée). */
  mainKind: ExplanationKind | null;
  /** Thème de puzzles qui l'entraîne (`null` : pas de thème, lien vers « Mes erreurs »). */
  theme: string | null;
  puzzlesHref: string;
}

/** Bilan de fin de revue guidée pour le camp de l'utilisateur (les deux s'il est inconnu). */
export function guidedSummary(review: GameReview, userColor: Color | null): GuidedSummary {
  const colors: Color[] = userColor ? [userColor] : ['w', 'b'];
  const counts = { blunder: 0, mistake: 0, inaccuracy: 0 };
  for (const c of colors) {
    counts.blunder += review.counts[c].blunder;
    counts.mistake += review.counts[c].mistake;
    counts.inaccuracy += review.counts[c].inaccuracy;
  }
  const kinds = new Map<ExplanationKind, number>();
  for (const m of review.moves) {
    if (!colors.includes(m.color) || !m.explanation) continue;
    if (!['inaccuracy', 'mistake', 'blunder'].includes(m.classification)) continue;
    kinds.set(m.explanation.kind, (kinds.get(m.explanation.kind) ?? 0) + 1);
  }
  const sorted = [...kinds.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const tipKinds = [...sorted];
  for (const k of FALLBACK_KINDS) if (!tipKinds.includes(k)) tipKinds.push(k);
  const mainKind = sorted[0] ?? null;
  const theme = mainKind ? PUZZLE_THEME_FOR_KIND[mainKind] : undefined;
  return {
    accuracy: colors.map((color) => ({ color, value: review.accuracy[color] })),
    counts,
    tips: tipKinds.slice(0, 3).map((k) => TIPS[k]),
    mainKind,
    theme: theme ?? null,
    puzzlesHref: theme ? `#/puzzles/theme/${theme}` : '#/puzzles/mine',
  };
}

/** Découpe un texte en morceaux, les cases citées (« e5 ») à part, pour les surligner au survol. */
export function splitSquares(text: string): { text: string; square: string | null }[] {
  const parts: { text: string; square: string | null }[] = [];
  // Une case : lettre a-h puis chiffre 1-8, ni dans un mot (sauf après « x » ou une pièce en
  // majuscule : « Nxe5 », « Bc4 »), ni suivie d'un chiffre ou d'une lettre.
  const re = /(?<![a-wyz0-9])[a-h][1-8](?![0-9A-Za-z])/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const square = m[0];
    if (m.index > last) parts.push({ text: text.slice(last, m.index), square: null });
    parts.push({ text: square, square });
    last = m.index + square.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), square: null });
  return parts;
}

/** Temps restant à la pendule : « 4:07 », « 1:02:05 » (au-delà d'une heure). */
export function formatMoveClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

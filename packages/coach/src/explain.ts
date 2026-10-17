import { Chess } from 'chess.js';
import type { Color, ExplanationKind } from '@sq/shared';
import {
  balanceAfterLine,
  forkTargets,
  pieceLabel,
  pieceShort,
  playUci,
  pronoun,
  uciToSan,
  winsMaterial,
  type ForkTarget,
} from './board.js';
import { formatEval, type EvalLike } from './win.js';

/** Évaluation moteur d'une position (point de vue des Blancs), avec la ligne principale. */
export interface EngineEval extends EvalLike {
  bestMoveUci: string | null;
  /** Ligne principale en UCI (commence par le meilleur coup). */
  pv: string[];
}

export interface MoveContext {
  color: Color;
  fenBefore: string;
  fenAfter: string;
  playedUci: string;
  /** Évaluation de la position avant le coup (meilleur jeu du camp `color`). */
  before: EngineEval;
  /** Évaluation après le coup (meilleure réponse de l'adversaire). */
  after: EngineEval;
}

export interface Explanation {
  kind: ExplanationKind;
  text: string;
}

/** Profondeur (demi-coups) des lignes utilisées pour mesurer un gain ou une perte de matériel. */
const LINE_PLIES = 6;

/** Mat en N pour `side` (positif), sinon `null`. */
function mateFor(e: EvalLike, side: Color): number | null {
  if (e.mate === null) return null;
  const n = side === 'w' ? e.mate : -e.mate;
  return n > 0 ? n : null;
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** « roi e8 et tour a8 », « dame d8, tour a8 et fou c8 ». */
function listTargets(targets: readonly ForkTarget[]): string {
  const names = targets.map((t) => pieceShort(t.type, t.square));
  return names.length <= 1
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} et ${names[names.length - 1] ?? ''}`;
}

/**
 * Explication en français d'un coup imprécis, d'une erreur ou d'une gaffe. Détecteurs, du plus
 * précis au plus général : mat manqué, mat permis, pièce laissée en prise, fourchette permise,
 * fourchette manquée, prise gagnante manquée, perte de matériel sur la suite, puis repli
 * générique (meilleur coup et évaluations). Formulation neutre : elle vaut pour les deux camps.
 */
export function explainMove(
  ctx: MoveContext,
  options: {
    /**
     * Ignorer ce que le joueur a manqué (mat, fourchette, prise) : seules les conséquences du
     * coup comptent. Utilisé par le garde-fou, qui ne doit pas souffler le meilleur coup.
     */
    consequencesOnly?: boolean;
  } = {},
): Explanation {
  const missed = !options.consequencesOnly;
  const { color, fenBefore, fenAfter, playedUci, before, after } = ctx;
  const opponent: Color = color === 'w' ? 'b' : 'w';
  const bestUci = before.bestMoveUci;
  const bestSan = bestUci ? uciToSan(fenBefore, bestUci) : null;
  const replyUci = after.bestMoveUci;
  const reply = replyUci ? playUci(new Chess(fenAfter), replyUci) : null;
  const playedBest = bestUci === playedUci;

  const mateBefore = mateFor(before, color);
  if (missed && mateBefore !== null && mateFor(after, color) === null && bestSan) {
    return {
      kind: 'missed-mate',
      text: `Mat en ${mateBefore} manqué : ${bestSan} lançait le mat.`,
    };
  }

  const mateAgainst = mateFor(after, opponent);
  if (mateAgainst !== null && mateFor(before, opponent) === null && reply) {
    return {
      kind: 'allowed-mate',
      text: `Ce coup permet un mat en ${mateAgainst}, à commencer par ${reply.san}.`,
    };
  }

  if (reply?.captured && winsMaterial(fenAfter, reply)) {
    const type = reply.captured;
    const square = reply.isEnPassant() ? `${reply.to[0]}${reply.from[1]}` : reply.to;
    const text =
      square === playedUci.slice(2, 4)
        ? `${capitalize(pieceLabel(type, square).replace(` ${square}`, ''))} ${pronoun(type) === 'la' ? 'jouée' : 'joué'} en ${square} est en prise : ${reply.san} ${pronoun(type)} gagne.`
        : `Laisse ${pieceLabel(type, square)} en prise : ${reply.san} ${pronoun(type)} gagne.`;
    return { kind: 'hanging-piece', text };
  }

  if (replyUci && reply) {
    const targets = forkTargets(fenAfter, replyUci);
    if (targets.length > 0) {
      return {
        kind: 'allowed-fork',
        text: `Permet la fourchette ${reply.san} sur ${listTargets(targets)}.`,
      };
    }
  }

  if (missed && bestUci && bestSan && !playedBest) {
    const targets = forkTargets(fenBefore, bestUci);
    if (targets.length > 0) {
      return {
        kind: 'missed-fork',
        text: `${bestSan} était une fourchette sur ${listTargets(targets)}.`,
      };
    }
    const best = playUci(new Chess(fenBefore), bestUci);
    if (best?.captured && winsMaterial(fenBefore, best)) {
      return {
        kind: 'missed-material',
        text: `${bestSan} gagnait ${pieceLabel(best.captured, best.to)}.`,
      };
    }
  }

  if (bestUci && bestSan) {
    const bestLine = before.pv.length > 0 ? before.pv : [bestUci];
    const bestBalance = balanceAfterLine(fenBefore, bestLine, color, LINE_PLIES);
    const playedBalance = balanceAfterLine(fenBefore, [playedUci, ...after.pv], color, LINE_PLIES);
    const lost = bestBalance - playedBalance;
    if (lost >= 2) {
      return {
        kind: 'material-loss',
        text: `Ce coup coûte du matériel (environ ${lost} points sur la suite) ; ${bestSan} était meilleur.`,
      };
    }
  }

  return {
    kind: 'generic',
    text: bestSan
      ? `Meilleur coup : ${bestSan} (évaluation ${formatEval(before)} au lieu de ${formatEval(after)}).`
      : `Évaluation ${formatEval(before)} avant le coup, ${formatEval(after)} après.`,
  };
}

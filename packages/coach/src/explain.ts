import { Chess } from 'chess.js';
import {
  isSquare,
  type ArrowKind,
  type BoardArrow,
  type Color,
  type ExplanationKind,
  type ExplanationVisual,
  type SquareMark,
  type SquareMarkKind,
} from '@sq/shared';
import {
  balanceAfterLine,
  forkTargets,
  isEndgame,
  lineTactics,
  pieceLabel,
  pieceShort,
  playUci,
  pronoun,
  uciToSan,
  winsMaterial,
  type ForkTarget,
  type LineTactic,
} from './board.js';
import { formatEval, winChance, type EvalLike } from './win.js';

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
  /** Flèches et cases qui illustrent l'explication sur le plateau. */
  visual: ExplanationVisual;
}

/** Longueur maximale (demi-coups) d'une ligne à rejouer. */
const VISUAL_LINE_PLIES = 8;

function arrow(uci: string | null | undefined, kind: ArrowKind): BoardArrow[] {
  const from = uci?.slice(0, 2) ?? '';
  const to = uci?.slice(2, 4) ?? '';
  return isSquare(from) && isSquare(to) ? [{ from, to, kind }] : [];
}

function marks(squares: readonly string[], kind: SquareMarkKind): SquareMark[] {
  return squares.filter(isSquare).map((square) => ({ square, kind }));
}

function visual(
  arrows: BoardArrow[],
  squareMarks: SquareMark[],
  line: readonly string[],
): ExplanationVisual {
  const trimmed = line.slice(0, VISUAL_LINE_PLIES);
  return { arrows, marks: squareMarks, ...(trimmed.length > 1 ? { line: trimmed } : {}) };
}

/** Case du roi de `color` dans `fen`. */
function kingSquare(fen: string, color: Color): string | null {
  for (const row of new Chess(fen).board()) {
    for (const cell of row) if (cell?.type === 'k' && cell.color === color) return cell.square;
  }
  return null;
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

/** « est cloué devant le roi e8 », « est clouée devant la dame d8 ». */
function pinnedText(t: LineTactic): string {
  return `${pieceLabel(t.front.type, t.front.square)} est ${pronoun(t.front.type) === 'la' ? 'clouée' : 'cloué'} devant ${pieceLabel(t.back.type, t.back.square)}`;
}

/** Marques d'un clouage ou d'une enfilade : cible de devant, pièce gagnée derrière, attaquant. */
function lineMarks(t: LineTactic, attacker: string): SquareMark[] {
  return [
    ...marks([t.front.square], 'target'),
    ...marks([t.back.square], t.kind === 'skewer' ? 'hanging' : 'target'),
    ...marks([attacker], 'attacker'),
  ];
}

/** Finale mal convertie : probabilité de gain d'au moins 80 % avant le coup… */
export const ENDGAME_WIN_FROM = 80;
/** … et d'au plus 60 % après (le gain a disparu). */
export const ENDGAME_WIN_AFTER_MAX = 60;

/**
 * Explication en français d'un coup imprécis, d'une erreur ou d'une gaffe. Détecteurs, du plus
 * précis au plus général : mat manqué, mat permis, pièce laissée en prise, fourchette permise,
 * clouage ou enfilade permis, fourchette, clouage ou enfilade manqués, prise gagnante manquée,
 * perte de matériel sur la suite, finale gagnante mal convertie, puis repli générique (meilleur coup et évaluations). Formulation neutre : elle vaut pour les deux camps.
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
  // Lignes à rejouer depuis la position avant le coup : la meilleure suite, ou le coup joué
  // suivi de la meilleure réponse adverse (la réfutation).
  const bestLine = before.pv.length > 0 ? before.pv : bestUci ? [bestUci] : [];
  const refutation = [playedUci, ...after.pv];

  const mateBefore = mateFor(before, color);
  if (missed && mateBefore !== null && mateFor(after, color) === null && bestSan) {
    return {
      kind: 'missed-mate',
      text: `Mat en ${mateBefore} manqué : ${bestSan} lançait le mat.`,
      visual: visual(
        arrow(bestUci, 'best'),
        marks([kingSquare(fenBefore, opponent) ?? ''], 'mate'),
        bestLine,
      ),
    };
  }

  const mateAgainst = mateFor(after, opponent);
  if (mateAgainst !== null && mateFor(before, opponent) === null && reply) {
    return {
      kind: 'allowed-mate',
      text: `Ce coup permet un mat en ${mateAgainst}, à commencer par ${reply.san}.`,
      visual: visual(
        arrow(replyUci, 'threat'),
        marks([kingSquare(fenAfter, color) ?? ''], 'mate'),
        refutation,
      ),
    };
  }

  if (reply?.captured && winsMaterial(fenAfter, reply)) {
    const type = reply.captured;
    const square = reply.isEnPassant() ? `${reply.to[0]}${reply.from[1]}` : reply.to;
    const text =
      square === playedUci.slice(2, 4)
        ? `${capitalize(pieceLabel(type, square).replace(` ${square}`, ''))} ${pronoun(type) === 'la' ? 'jouée' : 'joué'} en ${square} est en prise : ${reply.san} ${pronoun(type)} gagne.`
        : `Laisse ${pieceLabel(type, square)} en prise : ${reply.san} ${pronoun(type)} gagne.`;
    return {
      kind: 'hanging-piece',
      text,
      visual: visual(
        arrow(replyUci, 'threat'),
        [...marks([square], 'hanging'), ...marks([reply.from], 'attacker')],
        refutation,
      ),
    };
  }

  if (replyUci && reply) {
    const targets = forkTargets(fenAfter, replyUci);
    if (targets.length > 0) {
      return {
        kind: 'allowed-fork',
        text: `Permet la fourchette ${reply.san} sur ${listTargets(targets)}.`,
        visual: visual(
          arrow(replyUci, 'threat'),
          [
            ...marks(
              targets.map((t) => t.square),
              'target',
            ),
            ...marks([reply.to], 'attacker'),
          ],
          refutation,
        ),
      };
    }
  }

  if (replyUci && reply) {
    const tactic = lineTactics(fenAfter, replyUci)[0];
    if (tactic) {
      return {
        kind: tactic.kind === 'pin' ? 'allowed-pin' : 'allowed-skewer',
        text:
          tactic.kind === 'pin'
            ? `Permet le clouage ${reply.san} : ${pinnedText(tactic)}.`
            : `Permet l’enfilade ${reply.san} : ${pieceLabel(tactic.front.type, tactic.front.square)} doit s’écarter et ${pieceLabel(tactic.back.type, tactic.back.square)} tombe.`,
        visual: visual(arrow(replyUci, 'threat'), lineMarks(tactic, reply.to), refutation),
      };
    }
  }

  if (missed && bestUci && bestSan && !playedBest) {
    const targets = forkTargets(fenBefore, bestUci);
    if (targets.length > 0) {
      return {
        kind: 'missed-fork',
        text: `${bestSan} était une fourchette sur ${listTargets(targets)}.`,
        visual: visual(
          arrow(bestUci, 'best'),
          marks(
            targets.map((t) => t.square),
            'target',
          ),
          bestLine,
        ),
      };
    }
    const tactic = lineTactics(fenBefore, bestUci)[0];
    if (tactic) {
      return {
        kind: tactic.kind === 'pin' ? 'missed-pin' : 'missed-skewer',
        text:
          tactic.kind === 'pin'
            ? `${bestSan} clouait ${pieceLabel(tactic.front.type, tactic.front.square)} devant ${pieceLabel(tactic.back.type, tactic.back.square)}.`
            : `${bestSan} était une enfilade : ${pieceLabel(tactic.front.type, tactic.front.square)} devait s’écarter et ${pieceLabel(tactic.back.type, tactic.back.square)} tombait.`,
        visual: visual(arrow(bestUci, 'best'), lineMarks(tactic, bestUci.slice(2, 4)), bestLine),
      };
    }
    const best = playUci(new Chess(fenBefore), bestUci);
    if (best?.captured && winsMaterial(fenBefore, best)) {
      return {
        kind: 'missed-material',
        text: `${bestSan} gagnait ${pieceLabel(best.captured, best.to)}.`,
        visual: visual(arrow(bestUci, 'best'), marks([best.to], 'target'), bestLine),
      };
    }
  }

  if (bestUci && bestSan) {
    const bestBalance = balanceAfterLine(fenBefore, bestLine, color, LINE_PLIES);
    const playedBalance = balanceAfterLine(fenBefore, refutation, color, LINE_PLIES);
    const lost = bestBalance - playedBalance;
    if (lost >= 2) {
      return {
        kind: 'material-loss',
        text: `Ce coup coûte du matériel (environ ${lost} points sur la suite) ; ${bestSan} était meilleur.`,
        visual: visual([...arrow(replyUci, 'threat'), ...arrow(bestUci, 'best')], [], refutation),
      };
    }
  }

  const winBefore = winChance(before, color);
  const winAfter = winChance(after, color);
  if (
    missed &&
    bestSan &&
    winBefore >= ENDGAME_WIN_FROM &&
    winAfter <= ENDGAME_WIN_AFTER_MAX &&
    isEndgame(fenBefore)
  ) {
    return {
      kind: 'endgame-conversion',
      text: `Finale gagnante mal convertie : ${Math.round(winBefore)} % de chances de gain avant ce coup, ${Math.round(winAfter)} % après. ${bestSan} gardait le gain.`,
      visual: visual(arrow(bestUci, 'best'), [], bestLine),
    };
  }

  return {
    kind: 'generic',
    text: bestSan
      ? `Meilleur coup : ${bestSan} (évaluation ${formatEval(before)} au lieu de ${formatEval(after)}).`
      : `Évaluation ${formatEval(before)} avant le coup, ${formatEval(after)} après.`,
    visual: visual(arrow(bestUci, 'best'), [], bestLine),
  };
}

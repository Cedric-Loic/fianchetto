import { Chess } from 'chess.js';
import type { ReviewInput } from './review.js';

/** Partie lue dans un PGN : en-têtes et données d'analyse. */
export interface ParsedGame extends ReviewInput {
  headers: Record<string, string>;
}

/** Découpe un fichier PGN en parties (une partie = en-têtes puis coups). */
export function splitPgn(text: string): string[] {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/^\uFEFF/, '')
    .split(/\n\s*\n(?=\s*\[)/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0)
    .reduce<string[]>((games, chunk) => {
      // Un bloc d'en-têtes seul est suivi de ses coups : on les recolle.
      const last = games[games.length - 1];
      if (last !== undefined && !/\n\s*\n/.test(last) && /^\[/.test(last) && !hasMoves(last)) {
        games[games.length - 1] = `${last}\n\n${chunk}`;
      } else {
        games.push(chunk);
      }
      return games;
    }, []);
}

const hasMoves = (chunk: string) => chunk.split('\n').some((line) => !/^\s*(\[|$)/.test(line));

/**
 * Lit une partie PGN (échecs standard uniquement, position de départ libre via [FEN]).
 * `null` si elle est illisible, sans coup, ou d'une autre variante.
 */
export function parseGame(text: string): ParsedGame | null {
  const chess = new Chess();
  try {
    chess.loadPgn(text);
  } catch {
    return null;
  }
  const headers = Object.fromEntries(
    Object.entries(chess.getHeaders()).filter((e): e is [string, string] => e[1] !== undefined),
  );
  const variant = headers.Variant?.toLowerCase();
  if (variant && variant !== 'standard' && variant !== 'chess') return null;
  const history = chess.history({ verbose: true });
  const first = history[0];
  if (!first) return null;
  return {
    headers,
    positions: [first.before, ...history.map((m) => m.after)],
    moves: history.map((m) => ({ uci: m.lan, san: m.san })),
  };
}

/** « [%clk 0:09:57.3] » → millisecondes ; `null` sans pendule. */
function clockOf(comment: string): number | null {
  const m = /\[%clk\s+(\d+):(\d{1,2}):(\d{1,2}(?:\.\d+)?)\]/.exec(comment);
  if (!m) return null;
  return Math.round((Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])) * 1000);
}

/**
 * Temps restant (ms) après chaque demi-coup, lu dans les commentaires `[%clk h:mm:ss]` des PGN
 * de chess.com et Lichess : `clocks[i]` suit le demi-coup `i + 1` (`null` s'il n'a pas de
 * pendule). `null` si la partie n'en a aucune. Lecture rapide du texte des coups (sans rejouer
 * la partie) : les variantes entre parenthèses sont ignorées.
 */
export function pgnClocks(pgn: string): (number | null)[] | null {
  const moves = pgn
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((line) => !/^\s*\[/.test(line))
    .join(' ');
  const clocks: (number | null)[] = [];
  let found = false;
  let depth = 0;
  // Jetons : commentaire {…}, commentaire de fin de ligne ;…, parenthèse, ou mot.
  for (const [token] of moves.matchAll(/\{[^}]*\}|;[^\n]*|[()]|[^\s{}();]+/g)) {
    if (token === '(') depth++;
    else if (token === ')') depth = Math.max(0, depth - 1);
    else if (depth > 0) continue;
    else if (token.startsWith('{') || token.startsWith(';')) {
      const clock = clockOf(token);
      if (clock !== null && clocks.length > 0) {
        clocks[clocks.length - 1] = clock;
        found = true;
      }
    } else if (/^\d+\.+$/.test(token) || /^\$\d+$/.test(token)) {
      continue;
    } else if (/^(1-0|0-1|1\/2-1\/2|\*)$/.test(token)) {
      break;
    } else {
      // Un numéro collé au coup (« 1.e4 ») n'est pas un demi-coup à part.
      if (token.replace(/^\d+\.+/, '') !== '') clocks.push(null);
    }
  }
  return found ? clocks : null;
}

/** Temps initial (ms) d'après l'en-tête TimeControl (« 600+5 », « 180 ») ; `null` sinon. */
export function initialClockMs(timeControl: string | null | undefined): number | null {
  const m = /^(\d+)(?:\+\d+)?$/.exec(timeControl ?? '');
  return m ? Number(m[1]) * 1000 : null;
}

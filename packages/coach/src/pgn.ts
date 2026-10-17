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

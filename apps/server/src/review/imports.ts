import { createHash, randomUUID } from 'node:crypto';
import { parseGame } from '@sq/coach';
import type { Color } from '@sq/shared';
import type { ImportedGameRow } from '../persistence/db.js';

const known = (value: string | undefined) =>
  value !== undefined && value !== '' && !/^\?+$/.test(value) ? value : null;

const elo = (value: string | undefined) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** « 2026.10.01 » → « 2026-10-01 » ; `null` si la date est inconnue ou partielle. */
function isoDate(value: string | undefined): string | null {
  const m = /^(\d{4})\.(\d{2})\.(\d{2})$/.exec(value ?? '');
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/**
 * Prépare l'enregistrement d'une partie importée. `names` : pseudos de l'utilisateur (compte
 * local, pseudo chess.com) pour retrouver son camp. `null` si le PGN est illisible.
 */
export function importedRow(
  pgn: string,
  options: { userId: string; source: 'pgn' | 'chesscom'; url?: string; names: string[] },
): ImportedGameRow | null {
  const game = parseGame(pgn);
  if (!game) return null;
  const h = game.headers;
  const white = known(h.White) ?? 'Blancs';
  const black = known(h.Black) ?? 'Noirs';
  const names = options.names.map((n) => n.toLowerCase()).filter(Boolean);
  const userColor: Color | null = names.includes(white.toLowerCase())
    ? 'w'
    : names.includes(black.toLowerCase())
      ? 'b'
      : null;
  const url = options.url ?? known(h.Link) ?? null;
  return {
    id: randomUUID(),
    userId: options.userId,
    source: options.source,
    // Anti-doublon : lien de la partie, sinon empreinte des en-têtes et des coups.
    externalId:
      url ??
      createHash('sha256')
        .update(JSON.stringify([h, game.moves]))
        .digest('hex'),
    pgn,
    white,
    black,
    whiteElo: elo(h.WhiteElo),
    blackElo: elo(h.BlackElo),
    result: known(h.Result) ?? '*',
    date: isoDate(h.UTCDate) ?? isoDate(h.Date),
    timeControl: known(h.TimeControl),
    userColor,
    plies: game.moves.length,
    url,
  };
}

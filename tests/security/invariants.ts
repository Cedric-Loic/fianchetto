import { isDeepStrictEqual } from 'node:util';
import {
  PublicMoveSchema,
  SQUARES,
  ViewerBoardStateSchema,
  type Color,
  type PieceType,
  type PublicMove,
  type Square,
  type Viewer,
  type ViewerBoardState,
} from '@sq/shared';
import { CASTLE_SAN_RE, COORD_SAN_RE, PAWN_SAN_RE, PIECE_SAN_RE } from './public-board.js';
import { findForbidden, formatFindings } from './scan.js';

/**
 * Invariants d'une projection (`docs/RULES.md` §2 et §3), vérifiables sur la seule sortie.
 * Chaque fonction renvoie la liste des violations (vide = conforme).
 */

const SQUARE_ORDER = new Map<Square, number>(SQUARES.map((sq, index) => [sq, index]));

/** Une valeur est-elle exactement conforme à un schéma (aucune clé non déclarée) ? */
function exactSchemaViolations(
  schema: { safeParse(value: unknown): { success: boolean; data?: unknown } },
  value: unknown,
  label: string,
): string[] {
  const parsed = schema.safeParse(value);
  if (!parsed.success) return [`${label} : non conforme au schéma`];
  // Zod supprime les clés non déclarées : toute différence est un champ en trop.
  if (!isDeepStrictEqual(parsed.data, value)) return [`${label} : champs non déclarés`];
  return [];
}

/**
 * Un coup public isolé : schéma exact (sauf si l'appelant l'a déjà vérifié), notation cohérente
 * avec le type affiché.
 */
export function publicMoveViolations(
  move: PublicMove,
  label = 'coup',
  checkSchema = true,
): string[] {
  const out = checkSchema ? exactSchemaViolations(PublicMoveSchema, move, label) : [];
  const { san } = move;
  if (move.displayedType === 'p') {
    const pawn = PAWN_SAN_RE.exec(san);
    const coord = COORD_SAN_RE.exec(san);
    if (pawn) {
      const [, fromFile, toFile, toRank, promo] = pawn;
      if (fromFile !== move.from[0]) out.push(`${label} : colonne de départ incohérente (${san})`);
      if (`${toFile ?? fromFile}${toRank}` !== move.to) {
        out.push(`${label} : case d'arrivée incohérente (${san})`);
      }
      if (Boolean(promo) !== (move.promotion !== null)) {
        out.push(`${label} : promotion incohérente (${san})`);
      }
    } else if (coord) {
      const [, from, sep, to] = coord;
      if (from !== move.from || to !== move.to) out.push(`${label} : coordonnées incohérentes`);
      if ((sep === 'x') !== (move.capture !== null)) {
        out.push(`${label} : séparateur de prise incohérent (${san})`);
      }
      if (move.promotion !== null) out.push(`${label} : promotion sur un coup en coordonnées`);
    } else {
      out.push(`${label} : notation de pion inattendue « ${san} » (notation réelle ?)`);
    }
  } else {
    const piece = PIECE_SAN_RE.exec(san);
    const castle = CASTLE_SAN_RE.exec(san);
    if (piece) {
      const [, letter, , , capture, to] = piece;
      if (letter?.toLowerCase() !== move.displayedType) {
        out.push(`${label} : lettre de pièce ≠ type affiché (${san})`);
      }
      if (to !== move.to) out.push(`${label} : case d'arrivée incohérente (${san})`);
      if (Boolean(capture) !== (move.capture !== null)) {
        out.push(`${label} : prise incohérente (${san})`);
      }
    } else if (castle) {
      if (move.displayedType !== 'k' || move.castle === null) {
        out.push(`${label} : roque incohérent (${san})`);
      }
    } else {
      out.push(`${label} : notation inattendue « ${san} »`);
    }
    if (move.promotion !== null) out.push(`${label} : promotion d'une pièce non pion`);
  }
  const suffix = san.endsWith('#') ? '#' : san.endsWith('+') ? '+' : '';
  if ((suffix === '#') !== move.checkmate) out.push(`${label} : suffixe « # » incohérent`);
  if ((suffix === '+') !== (move.check && !move.checkmate)) {
    out.push(`${label} : suffixe « + » incohérent`);
  }
  if (move.checkmate && !move.check) out.push(`${label} : mat sans échec`);
  if (move.pieceId[0] !== move.color) out.push(`${label} : identifiant d'une autre couleur`);
  if (move.capture && move.capture.pieceId[0] === move.color) {
    out.push(`${label} : prise d'une pièce de son propre camp`);
  }
  return out;
}

export interface ProjectionContext {
  viewer: Viewer;
  /** La partie est-elle terminée (getter `isOver` du moteur) ? */
  over: boolean;
  /** Case de départ du pion secret du spectateur (si c'est un camp). */
  ownSecretStart?: Square;
}

/** Tous les invariants d'une projection. */
export function projectionViolations(state: ViewerBoardState, ctx: ProjectionContext): string[] {
  const out = exactSchemaViolations(ViewerBoardStateSchema, state, 'projection');
  if (out.length > 0) return out;

  // Champs interdits, et données pures : `findForbidden` signale aussi undefined, fonctions,
  // symboles, accesseurs et instances de classe (dont Secret).
  const findings = findForbidden(state, { allowReveal: ctx.over });
  if (findings.length > 0) out.push(`projection : champs interdits\n${formatFindings(findings)}`);

  if (state.viewer !== ctx.viewer) out.push(`projection : viewer ${state.viewer} ≠ ${ctx.viewer}`);

  // result / reveal non nuls si et seulement si la partie est terminée.
  if ((state.result !== null) !== ctx.over) out.push('projection : result incohérent avec la fin');
  if ((state.reveal !== null) !== ctx.over) out.push('projection : reveal incohérent avec la fin');

  // ownSecret : jamais pour `public`, jamais celui de l'adversaire.
  if (ctx.viewer === 'public') {
    if (state.ownSecret !== null) out.push('projection publique : ownSecret non nul');
  } else if (state.ownSecret !== null) {
    const { pieceId, square } = state.ownSecret;
    if (!pieceId.startsWith(`${ctx.viewer}p`)) {
      out.push(
        `projection ${ctx.viewer} : ownSecret d'un autre camp ou d'une non-pion (${pieceId})`,
      );
    }
    if (ctx.ownSecretStart && pieceId !== `${ctx.viewer}p${ctx.ownSecretStart}`) {
      out.push(`projection ${ctx.viewer} : ownSecret ${pieceId} ≠ secret choisi`);
    }
    const onBoard = state.pieces.find((piece) => piece.id === pieceId);
    if ((onBoard?.square ?? null) !== square) {
      out.push(`projection ${ctx.viewer} : ownSecret.square ne suit pas la pièce ${pieceId}`);
    }
  } else if (ctx.ownSecretStart) {
    out.push(`projection ${ctx.viewer} : ownSecret absent`);
  }

  // Pièces : triées par case, identifiants et cases uniques, un roi par camp.
  const orders = state.pieces.map((piece) => SQUARE_ORDER.get(piece.square) ?? -1);
  if (orders.some((order, index) => index > 0 && order <= (orders[index - 1] ?? -1))) {
    out.push('projection : pièces non triées par case (ou case en double)');
  }
  if (new Set(state.pieces.map((piece) => piece.id)).size !== state.pieces.length) {
    out.push('projection : identifiants de pièces en double');
  }
  for (const color of ['w', 'b'] as const) {
    const kings = state.pieces.filter((piece) => piece.color === color && piece.type === 'k');
    if (kings.length !== 1) out.push(`projection : ${kings.length} roi(s) ${color}`);
  }

  // Types affichés : un identifiant de pion reste « p » sauf promotion publique.
  const promotedTo = new Map<string, PieceType>();
  for (const move of state.moves) {
    if (move.promotion !== null) promotedTo.set(move.pieceId, move.promotion);
  }
  for (const piece of state.pieces) {
    if (piece.id[0] !== piece.color) out.push(`pièce ${piece.id} : couleur incohérente`);
    const initialType = piece.id[1] as PieceType;
    const expected = initialType === 'p' ? (promotedTo.get(piece.id) ?? 'p') : initialType;
    if (piece.type !== expected) {
      out.push(`pièce ${piece.id} : type affiché ${piece.type} ≠ ${expected} (type réel ?)`);
    }
  }

  // Historique : demi-coups numérotés, trait alterné, notation cohérente.
  state.moves.forEach((move, index) => {
    if (move.ply !== index + 1) out.push(`coup ${index + 1} : ply ${move.ply}`);
    const color: Color = index % 2 === 0 ? 'w' : 'b';
    if (move.color !== color) out.push(`coup ${index + 1} : couleur ${move.color}`);
    // Schéma déjà vérifié avec celui de la projection.
    out.push(...publicMoveViolations(move, `coup ${index + 1}`, false));
  });
  const expectedTurn: Color = state.moves.length % 2 === 0 ? 'w' : 'b';
  if (state.turn !== expectedTurn) out.push(`projection : trait ${state.turn} ≠ ${expectedTurn}`);
  if (state.fullmoveNumber !== Math.floor(state.moves.length / 2) + 1) {
    out.push('projection : numéro de coup incohérent');
  }

  // Captures : types affichés, ordre chronologique, classées par couleur de la pièce prise.
  const captured: Record<Color, PieceType[]> = { w: [], b: [] };
  for (const move of state.moves) {
    if (move.capture) captured[move.capture.pieceId[0] as Color].push(move.capture.displayedType);
  }
  if (!isDeepStrictEqual(captured, state.captured)) {
    out.push('projection : liste des captures ≠ captures de l’historique');
  }
  return out;
}

/**
 * Un refus doit être EXACTEMENT `{ ok: false }` : objet simple, une seule clé propre (même en
 * comptant les clés non énumérables et les symboles), aucun prototype exotique.
 */
export function bareRefusalViolations(result: unknown): string[] {
  if (result === null || typeof result !== 'object') return ['refus : pas un objet'];
  const out: string[] = [];
  if (Object.getPrototypeOf(result) !== Object.prototype) out.push('refus : prototype exotique');
  const keys = Reflect.ownKeys(result).map(String);
  if (keys.length !== 1 || keys[0] !== 'ok') out.push(`refus : clés ${JSON.stringify(keys)}`);
  if ((result as { ok?: unknown }).ok !== false) out.push('refus : ok !== false');
  if (JSON.stringify(result) !== '{"ok":false}') out.push(`refus : ${JSON.stringify(result)}`);
  return out;
}

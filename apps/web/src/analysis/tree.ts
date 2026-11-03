// chess.js n'est utilisé QUE dans ce module, et seulement pour des positions publiques (revue
// d'une partie terminée, échiquier d'analyse) : jamais dans l'écran de partie (DECISIONS,
// étape 12).
import { Chess, validateFen } from 'chess.js';
import type { Color, PromotionPiece, Square } from '@sq/shared';

/*
 * Arbre de coups de l'échiquier d'analyse. Chaque nœud est une position ; ses enfants sont les
 * coups joués depuis elle, le premier étant la continuation principale. Les autres enfants sont
 * des variantes. Logique pure, sans React.
 */

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export interface TreeNode {
  id: string;
  fen: string;
  /** Coup qui mène à ce nœud (`null` pour la racine). */
  san: string | null;
  uci: string | null;
  /** Demi-coups depuis la racine (racine = 0). */
  ply: number;
  parent: string | null;
  /** Coups suivants ; le premier est la continuation principale. */
  children: string[];
}

export interface LegalMove {
  from: Square;
  to: Square;
  promotion?: PromotionPiece;
}

/** Coup donné de l'extérieur (ligne de la partie) : FEN et SAN facultatives. */
export interface LineMove {
  uci: string;
  san?: string;
  /** Position après le coup, si connue (revue : FEN fournie par le serveur). */
  fen?: string;
}

const UCI = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/;

function chessAt(fen: string): Chess | null {
  try {
    return new Chess(fen);
  } catch {
    return null;
  }
}

/** Coup UCI → objet chess.js ; `null` si la chaîne est mal formée. */
export function parseUci(uci: string): LegalMove | null {
  const m = UCI.exec(uci);
  if (!m) return null;
  const move: LegalMove = { from: m[1] as Square, to: m[2] as Square };
  if (m[3]) move.promotion = m[3] as PromotionPiece;
  return move;
}

export const toUci = (m: LegalMove) => `${m.from}${m.to}${m.promotion ?? ''}`;

/** Camp au trait d'une FEN. */
export const turnOf = (fen: string): Color => (fen.split(' ')[1] === 'b' ? 'b' : 'w');

/** Numéro de coup (champ 6) d'une FEN. */
export const fullmoveOf = (fen: string): number => {
  const n = Number(fen.split(' ')[5]);
  return Number.isInteger(n) && n > 0 ? n : 1;
};

/** FEN valide ? Message d'erreur en français sinon. */
export function checkFen(fen: string): string | null {
  const res = validateFen(fen.trim());
  return res.ok ? null : 'FEN invalide : vérifie la position, le trait et les roques.';
}

export class AnalysisTree {
  private readonly nodes = new Map<string, TreeNode>();
  private counter = 0;
  readonly rootId: string;
  /** Identifiants de la ligne fournie à la construction (partie revue), racine exclue. */
  readonly initialLine: readonly string[];

  constructor(fen: string = START_FEN, line: readonly (LineMove | string)[] = []) {
    this.rootId = this.add({ fen, san: null, uci: null, ply: 0, parent: null });
    const ids: string[] = [];
    let current = this.rootId;
    for (const raw of line) {
      const move = typeof raw === 'string' ? { uci: raw } : raw;
      const next = this.play(current, move.uci, move);
      if (!next) break;
      ids.push(next);
      current = next;
    }
    this.initialLine = ids;
  }

  private add(data: Omit<TreeNode, 'id' | 'children'>): string {
    const id = `n${this.counter++}`;
    this.nodes.set(id, { ...data, id, children: [] });
    return id;
  }

  get(id: string): TreeNode {
    const node = this.nodes.get(id);
    if (!node) throw new Error(`nœud inconnu : ${id}`);
    return node;
  }

  has(id: string): boolean {
    return this.nodes.has(id);
  }

  get root(): TreeNode {
    return this.get(this.rootId);
  }

  /** Coups légaux depuis un nœud (vide si la position n'est pas lisible par chess.js). */
  legalMoves(id: string): LegalMove[] {
    const chess = chessAt(this.get(id).fen);
    if (!chess) return [];
    return chess.moves({ verbose: true }).map((m) => {
      const move: LegalMove = { from: m.from, to: m.to };
      if (m.promotion) move.promotion = m.promotion as PromotionPiece;
      return move;
    });
  }

  /** Case du roi au trait s'il est en échec, sinon `null`. */
  checkSquare(id: string): Square | null {
    const chess = chessAt(this.get(id).fen);
    if (!chess?.inCheck()) return null;
    const turn = chess.turn();
    for (const row of chess.board()) {
      for (const cell of row) {
        if (cell?.type === 'k' && cell.color === turn) return cell.square;
      }
    }
    return null;
  }

  /** Enfant de `id` atteint par le coup `uci`, s'il existe déjà. */
  child(id: string, uci: string): string | null {
    return this.get(id).children.find((c) => this.get(c).uci === uci) ?? null;
  }

  /**
   * Joue un coup depuis `fromId` : réutilise l'enfant identique s'il existe, sinon crée une
   * variante (ou la continuation principale si le nœud n'a pas encore de suite). Renvoie
   * l'identifiant du nœud atteint, `null` si le coup est illégal.
   *
   * `known` : coup d'une ligne fournie (revue). Si chess.js le refuse (position particulière)
   * mais que la FEN d'arrivée est connue, le nœud est créé tel quel.
   */
  play(fromId: string, uci: string, known?: LineMove): string | null {
    const parent = this.get(fromId);
    const parsed = parseUci(uci);
    if (!parsed) return null;
    const normalized = toUci(parsed);
    const existing = parent.children.find((c) => this.get(c).uci === normalized);
    if (existing) return existing;

    let san = known?.san ?? null;
    let fen = known?.fen ?? null;
    const chess = chessAt(parent.fen);
    if (chess) {
      try {
        const m = chess.move(parsed);
        san ??= m.san;
        fen ??= m.after;
      } catch {
        if (!known?.fen) return null;
      }
    } else if (!known?.fen) {
      return null;
    }
    if (!fen) return null;
    const id = this.add({
      fen,
      san: san ?? normalized,
      uci: normalized,
      ply: parent.ply + 1,
      parent: fromId,
    });
    parent.children.push(id);
    return id;
  }

  /** Joue une suite de coups UCI ; renvoie les nœuds atteints (s'arrête au premier illégal). */
  playLine(fromId: string, ucis: readonly string[]): string[] {
    const ids: string[] = [];
    let current = fromId;
    for (const uci of ucis) {
      const next = this.play(current, uci);
      if (!next) break;
      ids.push(next);
      current = next;
    }
    return ids;
  }

  // --- Navigation -----------------------------------------------------------------------

  next(id: string): string | null {
    return this.get(id).children[0] ?? null;
  }

  prev(id: string): string | null {
    return this.get(id).parent;
  }

  /** Dernier nœud de la ligne courante (on suit les premiers enfants). */
  end(id: string): string {
    let current = id;
    for (let n = this.next(current); n; n = this.next(current)) current = n;
    return current;
  }

  /**
   * Variante voisine (↑ / ↓) : frère précédent ou suivant du nœud ; à défaut, celui du premier
   * ancêtre qui a des frères. `null` s'il n'y a aucune variante.
   */
  sibling(id: string, direction: 1 | -1): string | null {
    for (let current: string | null = id; current; current = this.get(current).parent) {
      const parent: string | null = this.get(current).parent;
      if (!parent) return null;
      const siblings = this.get(parent).children;
      if (siblings.length < 2) continue;
      const index = siblings.indexOf(current);
      const target = siblings[(index + direction + siblings.length) % siblings.length];
      return target ?? null;
    }
    return null;
  }

  /** Chemin de la racine jusqu'au nœud (inclus). */
  path(id: string): string[] {
    const ids: string[] = [];
    for (let current: string | null = id; current; current = this.get(current).parent) {
      ids.push(current);
    }
    return ids.reverse();
  }

  /** Ligne principale : la racine puis les premiers enfants successifs. */
  mainline(): string[] {
    const ids = [this.rootId];
    for (let n = this.next(this.rootId); n; n = this.next(n)) ids.push(n);
    return ids;
  }

  /** Le nœud est-il sur la ligne principale (chaque ancêtre est le premier enfant) ? */
  isMainline(id: string): boolean {
    for (let current: string | null = id; current;) {
      const parent: string | null = this.get(current).parent;
      if (parent && this.get(parent).children[0] !== current) return false;
      current = parent;
    }
    return true;
  }

  /**
   * Premier nœud de la variante qui contient `id` : l'ancêtre (ou lui-même) qui n'est pas le
   * premier enfant de son parent. `null` sur la ligne principale.
   */
  variationStart(id: string): string | null {
    for (let current: string | null = id; current; current = this.get(current).parent) {
      const parent: string | null = this.get(current).parent;
      if (parent && this.get(parent).children[0] !== current) return current;
    }
    return null;
  }

  /**
   * Promeut la variante d'un cran : son premier nœud devient la continuation principale de son
   * parent. Renvoie `false` si le nœud est déjà sur la ligne principale.
   */
  promote(id: string): boolean {
    const start = this.variationStart(id);
    if (!start) return false;
    const parent = this.get(this.get(start).parent ?? '');
    parent.children = [start, ...parent.children.filter((c) => c !== start)];
    return true;
  }

  /** Supprime le nœud et toute sa suite ; renvoie le parent (`null` pour la racine). */
  remove(id: string): string | null {
    const node = this.get(id);
    if (!node.parent) return null;
    const parent = this.get(node.parent);
    parent.children = parent.children.filter((c) => c !== id);
    const stack = [id];
    while (stack.length) {
      const current = stack.pop() ?? '';
      stack.push(...this.get(current).children);
      this.nodes.delete(current);
    }
    return node.parent;
  }

  /** Numéro de coup et camp du coup qui mène au nœud (racine : ceux du trait). */
  moveLabel(id: string): { number: number; color: Color } {
    const node = this.get(id);
    const before = node.parent ? this.get(node.parent).fen : node.fen;
    return { number: fullmoveOf(before), color: turnOf(before) };
  }
}

/** Partie lue d'un PGN : position de départ et coups UCI. Message d'erreur en français sinon. */
export function parsePgn(
  pgn: string,
): { ok: true; fen: string; moves: string[] } | { ok: false; error: string } {
  const chess = new Chess();
  try {
    chess.loadPgn(pgn.trim());
  } catch {
    return { ok: false, error: 'PGN illisible : vérifie les coups et les en-têtes.' };
  }
  const history = chess.history({ verbose: true });
  const fen = history[0]?.before ?? chess.fen();
  return { ok: true, fen, moves: history.map((m) => m.lan) };
}

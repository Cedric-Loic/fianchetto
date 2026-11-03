/*
 * Base exacte roi et pion contre roi (KPK), calculée en mémoire par analyse rétrograde au
 * premier appel (environ 200 000 positions, une fraction de seconde, aucune dépendance).
 *
 * Les positions sont rangées du point de vue des Blancs (pion blanc, qui monte) et la colonne
 * du pion est ramenée à a-d par symétrie. Algorithme classique : on marque d'abord les positions
 * invalides, les gains immédiats (promotion sans prise) et les nulles immédiates (pat, pion pris),
 * puis on propage jusqu'à ce que plus rien ne change. Ce qui reste indécis est nul (le pion ne
 * passe jamais).
 */

export type KpkResult = 'win' | 'draw';

// Valeurs stockées ; ce sont des drapeaux combinés avec OU pour résumer les coups possibles.
const INVALID = 0;
const UNKNOWN = 1;
const DRAW = 2;
const WIN = 4;

const WHITE = 0;
const BLACK = 1;

const SIZE = 24 * 2 * 64 * 64;

const file = (sq: number): number => sq & 7;
const rank = (sq: number): number => sq >> 3;
const dist = (a: number, b: number): number =>
  Math.max(Math.abs(file(a) - file(b)), Math.abs(rank(a) - rank(b)));

/** Cases voisines d'un roi (au plus 8). */
const KING_MOVES: number[][] = Array.from({ length: 64 }, (_, sq) => {
  const out: number[] = [];
  for (let s = 0; s < 64; s++) if (s !== sq && dist(s, sq) === 1) out.push(s);
  return out;
});

/** Cases attaquées par un pion blanc placé en `sq`. */
function pawnAttacks(sq: number): number[] {
  const out: number[] = [];
  if (file(sq) > 0) out.push(sq + 7);
  if (file(sq) < 7) out.push(sq + 9);
  return out;
}

/** Pion sur les colonnes a-d et les rangées 2 à 7 : 24 cases. */
function pawnIndex(sq: number): number {
  return (rank(sq) - 1) * 4 + file(sq);
}

function index(stm: number, bk: number, wk: number, psq: number): number {
  return wk | (bk << 6) | (stm << 12) | (pawnIndex(psq) << 13);
}

let table: Uint8Array | null = null;

function initial(wk: number, bk: number, stm: number, psq: number): number {
  const attackedByPawn = pawnAttacks(psq);
  if (
    dist(wk, bk) <= 1 ||
    wk === psq ||
    bk === psq ||
    (stm === WHITE && attackedByPawn.includes(bk))
  )
    return INVALID;

  const promo = psq + 8;
  // Promotion sans être pris : gain immédiat.
  if (
    stm === WHITE &&
    rank(psq) === 6 &&
    wk !== promo &&
    bk !== promo &&
    (dist(bk, promo) > 1 || dist(wk, promo) === 1)
  )
    return WIN;

  if (stm === BLACK) {
    // Pat : aucune case libre pour le roi noir.
    const free = KING_MOVES[bk]!.some(
      (s) => dist(s, wk) > 1 && !attackedByPawn.includes(s) && s !== psq,
    );
    const takesPawn = dist(bk, psq) === 1 && dist(wk, psq) > 1;
    if (!free && !takesPawn) return DRAW;
    // Pion pris, faute de protection.
    if (takesPawn) return DRAW;
  }
  return UNKNOWN;
}

function classify(db: Uint8Array, wk: number, bk: number, stm: number, psq: number): number {
  let r = INVALID;
  if (stm === WHITE) {
    for (const s of KING_MOVES[wk]!) r |= db[index(BLACK, bk, s, psq)]!;
    if (rank(psq) < 6) {
      const push = psq + 8;
      r |= db[index(BLACK, bk, wk, push)]!;
      if (rank(psq) === 1 && push !== wk && push !== bk)
        r |= db[index(BLACK, bk, wk, push + 8)]!;
    }
    return r & WIN ? WIN : r & UNKNOWN ? UNKNOWN : DRAW;
  }
  for (const s of KING_MOVES[bk]!) r |= db[index(WHITE, s, wk, psq)]!;
  return r & DRAW ? DRAW : r & UNKNOWN ? UNKNOWN : WIN;
}

function build(): Uint8Array {
  const db = new Uint8Array(SIZE);
  const positions: number[] = [];
  for (let p = 0; p < 24; p++) {
    const psq = (Math.floor(p / 4) + 1) * 8 + (p % 4);
    for (let stm = 0; stm < 2; stm++)
      for (let bk = 0; bk < 64; bk++)
        for (let wk = 0; wk < 64; wk++) {
          const i = index(stm, bk, wk, psq);
          db[i] = initial(wk, bk, stm, psq);
          if (db[i] === UNKNOWN) positions.push(i);
        }
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const i of positions) {
      if (db[i] !== UNKNOWN) continue;
      const wk = i & 63;
      const bk = (i >> 6) & 63;
      const stm = (i >> 12) & 1;
      const p = i >> 13;
      const psq = (Math.floor(p / 4) + 1) * 8 + (p % 4);
      const r = classify(db, wk, bk, stm, psq);
      if (r !== UNKNOWN) {
        db[i] = r;
        changed = true;
      }
    }
  }
  // Positions jamais résolues : le pion ne passe pas.
  for (const i of positions) if (db[i] === UNKNOWN) db[i] = DRAW;
  return db;
}

/**
 * Résultat théorique d'une position roi et pion contre roi, avec le meilleur jeu des deux
 * camps : `'win'` si le camp du pion gagne (quel que soit le trait), `'draw'` sinon.
 * `null` si la position n'est pas exactement roi et pion contre roi, ou si elle est illégale.
 */
export function kpkResult(fen: string): KpkResult | null {
  const [placement, turn] = fen.split(' ');
  if (!placement || (turn !== 'w' && turn !== 'b')) return null;

  const kings: { w?: number; b?: number } = {};
  let pawn: { sq: number; color: 'w' | 'b' } | null = null;
  const rows = placement.split('/');
  if (rows.length !== 8) return null;
  for (const [r, row] of rows.entries()) {
    let f = 0;
    for (const ch of row) {
      if (ch >= '1' && ch <= '8') {
        f += Number(ch);
        continue;
      }
      const sq = (7 - r) * 8 + f;
      if (ch === 'K') {
        if (kings.w !== undefined) return null;
        kings.w = sq;
      } else if (ch === 'k') {
        if (kings.b !== undefined) return null;
        kings.b = sq;
      } else if (ch === 'P' || ch === 'p') {
        if (pawn) return null;
        pawn = { sq, color: ch === 'P' ? 'w' : 'b' };
      } else return null;
      f++;
    }
    if (f !== 8) return null;
  }
  if (kings.w === undefined || kings.b === undefined || !pawn) return null;
  if (rank(pawn.sq) === 0 || rank(pawn.sq) === 7) return null;

  // Point de vue du camp du pion (qui monte) : on retourne l'échiquier si le pion est noir.
  const flipRank = (sq: number): number => sq ^ 56;
  let own = pawn.color === 'w' ? kings.w : kings.b;
  let other = pawn.color === 'w' ? kings.b : kings.w;
  let psq = pawn.sq;
  const stm = turn === pawn.color ? WHITE : BLACK;
  if (pawn.color === 'b') {
    own = flipRank(own);
    other = flipRank(other);
    psq = flipRank(psq);
  }
  // Symétrie gauche-droite : pion sur les colonnes a-d.
  if (file(psq) > 3) {
    const mirror = (sq: number): number => sq ^ 7;
    own = mirror(own);
    other = mirror(other);
    psq = mirror(psq);
  }

  table ??= build();
  const value = table[index(stm, other, own, psq)];
  if (value === WIN) return 'win';
  if (value === DRAW) return 'draw';
  return null;
}

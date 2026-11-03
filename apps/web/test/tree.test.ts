import { describe, expect, it } from 'vitest';
import { morphPieces } from '../src/analysis/pieces';
import { AnalysisTree, checkFen, parsePgn, START_FEN } from '../src/analysis/tree';
import { piecesFromFen } from '../src/lib/fen';

const sans = (tree: AnalysisTree, ids: readonly string[]) => ids.map((id) => tree.get(id).san);

describe('AnalysisTree', () => {
  it('construit la ligne principale depuis des coups UCI', () => {
    const tree = new AnalysisTree(START_FEN, ['e2e4', 'e7e5', 'g1f3']);
    expect(tree.initialLine).toHaveLength(3);
    expect(sans(tree, tree.mainline().slice(1))).toEqual(['e4', 'e5', 'Nf3']);
    const last = tree.get(tree.end(tree.rootId));
    expect(last.ply).toBe(3);
    expect(last.fen).toBe('rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2');
  });

  it('s’arrête au premier coup illégal de la ligne fournie', () => {
    const tree = new AnalysisTree(START_FEN, ['e2e4', 'e2e4', 'g1f3']);
    expect(tree.initialLine).toHaveLength(1);
  });

  it('réutilise un enfant identique, crée une variante sinon', () => {
    const tree = new AnalysisTree(START_FEN, ['e2e4', 'e7e5']);
    const e4 = tree.initialLine[0] ?? '';
    expect(tree.play(e4, 'e7e5')).toBe(tree.initialLine[1]);
    const c5 = tree.play(e4, 'c7c5') ?? '';
    expect(tree.get(c5).san).toBe('c5');
    expect(tree.get(e4).children).toEqual([tree.initialLine[1], c5]);
    expect(tree.isMainline(c5)).toBe(false);
    expect(tree.variationStart(c5)).toBe(c5);
    // Coup illégal : rien n'est créé.
    expect(tree.play(e4, 'e7e4')).toBeNull();
    expect(tree.get(e4).children).toHaveLength(2);
  });

  it('navigue : suivant, précédent, fin, variantes voisines', () => {
    const tree = new AnalysisTree(START_FEN, ['e2e4', 'e7e5', 'g1f3']);
    const [e4 = '', e5 = '', nf3 = ''] = tree.initialLine;
    const c5 = tree.play(e4, 'c7c5') ?? '';
    const e6 = tree.play(e4, 'e7e6') ?? '';
    const nc3 = tree.play(c5, 'b1c3') ?? '';
    expect(tree.next(tree.rootId)).toBe(e4);
    expect(tree.prev(e5)).toBe(e4);
    expect(tree.prev(tree.rootId)).toBeNull();
    expect(tree.end(e4)).toBe(nf3);
    expect(tree.end(c5)).toBe(nc3);
    expect(tree.sibling(e5, 1)).toBe(c5);
    expect(tree.sibling(c5, 1)).toBe(e6);
    expect(tree.sibling(e6, 1)).toBe(e5);
    expect(tree.sibling(e5, -1)).toBe(e6);
    // Sans frère : on remonte à la première bifurcation.
    expect(tree.sibling(nc3, 1)).toBe(e6);
    expect(tree.sibling(e4, 1)).toBeNull();
    expect(tree.path(nc3)).toEqual([tree.rootId, e4, c5, nc3]);
  });

  it('promeut une variante en ligne principale', () => {
    const tree = new AnalysisTree(START_FEN, ['e2e4', 'e7e5']);
    const [e4 = '', e5 = ''] = tree.initialLine;
    const c5 = tree.play(e4, 'c7c5') ?? '';
    const nf3 = tree.play(c5, 'g1f3') ?? '';
    expect(tree.promote(nf3)).toBe(true);
    expect(tree.get(e4).children).toEqual([c5, e5]);
    expect(tree.isMainline(nf3)).toBe(true);
    expect(sans(tree, tree.mainline().slice(1))).toEqual(['e4', 'c5', 'Nf3']);
    expect(tree.promote(nf3)).toBe(false);
  });

  it('supprime un nœud et toute sa suite', () => {
    const tree = new AnalysisTree(START_FEN, ['e2e4', 'e7e5']);
    const e4 = tree.initialLine[0] ?? '';
    const c5 = tree.play(e4, 'c7c5') ?? '';
    const nf3 = tree.play(c5, 'g1f3') ?? '';
    expect(tree.remove(c5)).toBe(e4);
    expect(tree.has(c5)).toBe(false);
    expect(tree.has(nf3)).toBe(false);
    expect(tree.get(e4).children).toEqual([tree.initialLine[1]]);
    expect(tree.remove(tree.rootId)).toBeNull();
  });

  it('promotion de pion : coups légaux avec pièce, SAN, échec', () => {
    const tree = new AnalysisTree('8/4P3/8/8/8/8/k7/4K3 w - - 0 1');
    const promotions = tree.legalMoves(tree.rootId).filter((m) => m.from === 'e7');
    expect(promotions.map((m) => m.promotion).sort()).toEqual(['b', 'n', 'q', 'r']);
    // Sans pièce de promotion, le coup est refusé (le plateau demande la pièce).
    expect(tree.play(tree.rootId, 'e7e8')).toBeNull();
    const queen = tree.play(tree.rootId, 'e7e8q') ?? '';
    expect(tree.get(queen).san).toBe('e8=Q');
    expect(tree.get(queen).uci).toBe('e7e8q');
    const knight = tree.play(tree.rootId, 'e7e8n') ?? '';
    expect(tree.get(knight).san).toBe('e8=N');
    expect(tree.get(tree.rootId).children).toEqual([queen, knight]);
  });

  it('case du roi en échec, numéro et camp des coups', () => {
    const tree = new AnalysisTree(START_FEN, ['e2e4', 'f7f6', 'd2d4', 'g7g5', 'd1h5']);
    const mate = tree.end(tree.rootId);
    expect(tree.get(mate).san).toBe('Qh5#');
    expect(tree.checkSquare(mate)).toBe('e8');
    expect(tree.checkSquare(tree.rootId)).toBeNull();
    expect(tree.legalMoves(mate)).toEqual([]);
    expect(tree.moveLabel(tree.initialLine[1] ?? '')).toEqual({ number: 1, color: 'b' });
    expect(tree.moveLabel(mate)).toEqual({ number: 3, color: 'w' });
  });

  it('accepte une ligne fournie avec FEN et SAN, même si chess.js la refuse', () => {
    const forced = '4k3/8/8/8/8/8/8/Q3K3 b - - 0 1';
    const tree = new AnalysisTree(START_FEN, [{ uci: 'a2a5', san: 'a5', fen: forced }]);
    const id = tree.initialLine[0] ?? '';
    expect(tree.get(id).fen).toBe(forced);
    expect(tree.get(id).san).toBe('a5');
  });

  it('lit un PGN et valide les FEN', () => {
    const res = parsePgn('1. e4 e5 2. Nf3 Nc6 3. Bb5 *');
    expect(res).toEqual({
      ok: true,
      fen: START_FEN,
      moves: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5'],
    });
    expect(parsePgn('1. e4 e5 2. Ke3 Ke6 3. Qxh8').ok).toBe(false);
    expect(checkFen(START_FEN)).toBeNull();
    expect(checkFen('pas une fen')).toMatch(/FEN invalide/);
  });
});

describe('morphPieces', () => {
  it('garde les identifiants des pièces, la pièce jouée glisse', () => {
    const before = piecesFromFen(START_FEN);
    const tree = new AnalysisTree(START_FEN, ['g1f3']);
    const after = morphPieces(before, piecesFromFen(tree.get(tree.initialLine[0] ?? '').fen));
    const knight = after.find((p) => p.square === 'f3');
    expect(knight?.id).toBe(before.find((p) => p.square === 'g1')?.id);
    expect(new Set(after.map((p) => p.id)).size).toBe(after.length);
    // Retour en arrière : le cavalier revient avec le même identifiant.
    const back = morphPieces(after, piecesFromFen(START_FEN));
    expect(back.find((p) => p.square === 'g1')?.id).toBe(knight?.id);
  });
});

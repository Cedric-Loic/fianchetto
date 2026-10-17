import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { explainMove, forkTargets, type EngineEval } from '../src/index.js';

/*
 * Détecteurs d'erreurs, sur de vraies positions. Les évaluations moteur sont écrites à la main
 * (ce que Stockfish renverrait) : les tests ne dépendent pas de Stockfish.
 */

const ev = (partial: Partial<EngineEval>): EngineEval => ({
  evalCp: 0,
  mate: null,
  bestMoveUci: null,
  pv: [],
  ...partial,
});

/** Position après une suite de coups UCI depuis la position initiale. */
function after(line: string): string {
  const chess = new Chess();
  for (const uci of line.split(' ').filter(Boolean)) {
    chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  }
  return chess.fen();
}

function play(fen: string, uci: string): string {
  const chess = new Chess(fen);
  chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  return chess.fen();
}

describe('détecteurs', () => {
  it('pièce jouée en prise', () => {
    const fenBefore = after('e2e4 e7e5 g1f3 b8c6');
    const explanation = explainMove({
      color: 'w',
      fenBefore,
      fenAfter: play(fenBefore, 'f3e5'),
      playedUci: 'f3e5',
      before: ev({ evalCp: 30, bestMoveUci: 'f1b5', pv: ['f1b5'] }),
      after: ev({ evalCp: -250, bestMoveUci: 'c6e5', pv: ['c6e5'] }),
    });
    expect(explanation).toEqual({
      kind: 'hanging-piece',
      text: 'Le cavalier joué en e5 est en prise : Nxe5 le gagne.',
    });
  });

  it('autre pièce laissée en prise', () => {
    // Le fou g4, attaqué par la dame d4, reste sans défense.
    const fenBefore = '4k3/8/8/8/3Q2b1/5N2/8/4K3 b - - 0 1';
    const explanation = explainMove({
      color: 'b',
      fenBefore,
      fenAfter: play(fenBefore, 'e8e7'),
      playedUci: 'e8e7',
      before: ev({ evalCp: 900, bestMoveUci: 'g4f3', pv: ['g4f3'] }),
      after: ev({ evalCp: 1200, bestMoveUci: 'd4g4', pv: ['d4g4'] }),
    });
    expect(explanation).toEqual({
      kind: 'hanging-piece',
      text: 'Laisse le fou g4 en prise : Qxg4 le gagne.',
    });
  });

  it('fourchette permise', () => {
    const fenBefore = 'r3k3/7p/8/1N6/8/8/8/4K3 b - - 0 1';
    const explanation = explainMove({
      color: 'b',
      fenBefore,
      fenAfter: play(fenBefore, 'h7h6'),
      playedUci: 'h7h6',
      before: ev({ evalCp: 0, bestMoveUci: 'e8d7', pv: ['e8d7'] }),
      after: ev({ evalCp: 300, bestMoveUci: 'b5c7', pv: ['b5c7'] }),
    });
    expect(explanation).toEqual({
      kind: 'allowed-fork',
      text: 'Permet la fourchette Nc7+ sur roi e8 et tour a8.',
    });
  });

  it('fourchette manquée', () => {
    const fenBefore = 'r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1';
    const explanation = explainMove({
      color: 'w',
      fenBefore,
      fenAfter: play(fenBefore, 'e1d2'),
      playedUci: 'e1d2',
      before: ev({ evalCp: 400, bestMoveUci: 'd5c7', pv: ['d5c7'] }),
      after: ev({ evalCp: 0, bestMoveUci: 'a8a2', pv: ['a8a2'] }),
    });
    expect(explanation).toEqual({
      kind: 'missed-fork',
      text: 'Nc7+ était une fourchette sur roi e8 et tour a8.',
    });
  });

  it('prise gagnante manquée', () => {
    const fenBefore = '4k3/8/8/4n3/8/2B5/8/4K3 w - - 0 1';
    const explanation = explainMove({
      color: 'w',
      fenBefore,
      fenAfter: play(fenBefore, 'e1d1'),
      playedUci: 'e1d1',
      before: ev({ evalCp: 300, bestMoveUci: 'c3e5', pv: ['c3e5'] }),
      after: ev({ evalCp: 0, bestMoveUci: 'e5c4', pv: ['e5c4'] }),
    });
    expect(explanation).toEqual({
      kind: 'missed-material',
      text: 'Bxe5 gagnait le cavalier e5.',
    });
  });

  it('mat manqué', () => {
    const fenBefore = '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1';
    const explanation = explainMove({
      color: 'w',
      fenBefore,
      fenAfter: play(fenBefore, 'g2g3'),
      playedUci: 'g2g3',
      before: ev({ evalCp: null, mate: 1, bestMoveUci: 'a1a8', pv: ['a1a8'] }),
      after: ev({ evalCp: 500, bestMoveUci: 'h7h6', pv: ['h7h6'] }),
    });
    expect(explanation).toEqual({
      kind: 'missed-mate',
      text: 'Mat en 1 manqué : Ra8# lançait le mat.',
    });
  });

  it('mat permis', () => {
    const fenBefore = '6k1/5ppp/1p6/8/8/8/5PPP/R5K1 b - - 0 1';
    const explanation = explainMove({
      color: 'b',
      fenBefore,
      fenAfter: play(fenBefore, 'b6b5'),
      playedUci: 'b6b5',
      before: ev({ evalCp: 500, bestMoveUci: 'h7h6', pv: ['h7h6'] }),
      after: ev({ evalCp: null, mate: 1, bestMoveUci: 'a1a8', pv: ['a1a8'] }),
    });
    expect(explanation).toEqual({
      kind: 'allowed-mate',
      text: 'Ce coup permet un mat en 1, à commencer par Ra8#.',
    });
  });

  it('perte de matériel sur la suite, puis repli générique', () => {
    // Kd2 ?? permet l'enfilade Rb2+ : le roi s'écarte et la tour h2 tombe.
    const fenBefore = '1r2k3/8/8/8/8/8/7R/3K4 w - - 0 1';
    const loss = explainMove({
      color: 'w',
      fenBefore,
      fenAfter: play(fenBefore, 'd1d2'),
      playedUci: 'd1d2',
      before: ev({ evalCp: 0, bestMoveUci: 'd1e1', pv: ['d1e1'] }),
      after: ev({ evalCp: -500, bestMoveUci: 'b8b2', pv: ['b8b2', 'd2e3', 'b2h2'] }),
    });
    expect(loss).toEqual({
      kind: 'material-loss',
      text: 'Ce coup coûte du matériel (environ 5 points sur la suite) ; Ke1 était meilleur.',
    });

    const generic = explainMove({
      color: 'w',
      fenBefore: after(''),
      fenAfter: after('a2a4'),
      playedUci: 'a2a4',
      before: ev({ evalCp: 30, bestMoveUci: 'e2e4', pv: ['e2e4'] }),
      after: ev({ evalCp: -20, bestMoveUci: 'e7e5', pv: ['e7e5'] }),
    });
    expect(generic).toEqual({
      kind: 'generic',
      text: 'Meilleur coup : e4 (évaluation +0,3 au lieu de −0,2).',
    });
  });
});

describe('fourchettes', () => {
  it('une pièce prise aussitôt avec profit ne fait pas de fourchette', () => {
    // Nc7+ attaque e8 et a8, mais le cavalier est pris par la dame d8 (sans défense).
    expect(forkTargets('r2qk3/8/8/1N6/8/8/8/4K3 w - - 0 1', 'b5c7')).toEqual([]);
    // Un pion défendu qui attaque deux pièces est une fourchette.
    expect(forkTargets('4k3/8/8/2n1b3/8/3PP3/8/4K3 w - - 0 1', 'd3d4')).toEqual([
      { type: 'n', square: 'c5' },
      { type: 'b', square: 'e5' },
    ]);
    // Le même pion sans défense est pris par le fou : pas de fourchette.
    expect(forkTargets('4k3/8/8/2n1b3/8/3P4/8/4K3 w - - 0 1', 'd3d4')).toEqual([]);
    // Coup illégal : rien.
    expect(forkTargets('4k3/8/8/8/8/8/8/4K3 w - - 0 1', 'e1e3')).toEqual([]);
  });
});
